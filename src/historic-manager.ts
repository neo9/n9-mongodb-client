import { N9Log } from '@neo9/n9-node-log';
import { Diff } from 'deep-diff';
import { Collection, Cursor, Db, IndexOptions, ObjectId } from 'mongodb';
import { IndexManager } from './index-manager';
import { LangUtils } from './lang-utils';
import { BaseMongoObject, EntityHistoric, StringMap } from './models';
import { MongoUtils } from './mongo-utils';

/**
 * Class that handles the historisation of entity changes
 */
export class HistoricManager<U extends BaseMongoObject> {
	private readonly collection: Collection<EntityHistoric<U>>;
	private readonly logger: N9Log;
	private readonly db: Db;
	private readonly indexManager: IndexManager;

	constructor(collection: Collection<U>) {
		this.logger = (global.log as N9Log).module('mongo-client-historic');
		this.db = global.db as Db; // existence is checked in client.ts

		this.collection = this.db.collection(`${collection.collectionName}Historic`);

		this.indexManager = new IndexManager(this.collection);
	}

	public async initIndexes(): Promise<void> {
		await this.createIndex('entityId');
	}

	public async createIndex(fieldOrSpec: string | any, options?: IndexOptions): Promise<void> {
		await this.indexManager.createIndex(fieldOrSpec, options);
	}

	public async createUniqueIndex(
		fieldOrSpec: string | any = 'code',
		options?: IndexOptions,
	): Promise<void> {
		await this.indexManager.createUniqueIndex(fieldOrSpec, options);
	}

	public async ensureExpirationIndex(
		ttlInDays: number,
		fieldOrSpec: string | object = 'date',
		options: IndexOptions = {},
	): Promise<void> {
		await this.indexManager.ensureExpirationIndex(fieldOrSpec, ttlInDays, options);
	}

	public async dropIndex(indexName: string): Promise<void> {
		await this.indexManager.dropIndex(indexName);
	}

	/**
	 * Insert a change of an entity in database.
	 *
	 * @param entityId id of the entity that changed
	 * @param diffs list of changes
	 * @param snapshot snapshot of the entity before the changes
	 * @param updateDate date at which the update occurred
	 * @param userId id of the user who performed the update
	 */
	public async insertOne(
		entityId: string,
		diffs: Diff<U, U>[],
		snapshot: U,
		updateDate: Date,
		userId: string,
	): Promise<void> {
		try {
			const change: EntityHistoric<U> = {
				entityId: MongoUtils.oid(entityId) as any,
				date: updateDate,
				userId: ObjectId.isValid(userId) ? (MongoUtils.oid(userId) as any) : userId,
				dataEdited: diffs,
				snapshot: MongoUtils.removeSpecialCharactersInKeys(snapshot),
			};
			await this.collection.insertOne(change as any);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				entityId,
				diffs,
				snapshot,
				updateDate,
				userId,
			});
		}
	}

	public async findByEntityId(
		id: string,
		page: number = 0,
		size: number = 10,
	): Promise<Cursor<EntityHistoric<U>>> {
		try {
			return await this.collection
				.find<EntityHistoric<U>>({ entityId: MongoUtils.oid(id) as any })
				.sort('_id', -1)
				.skip(page * size)
				.limit(size)
				.map((a: EntityHistoric<U>) =>
					MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(
						EntityHistoric,
						MongoUtils.unRemoveSpecialCharactersInKeys(a),
					),
				);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				id,
				page,
				size,
			});
		}
	}

	public async findOneByUserIdMostRecent(
		entityId: string,
		userId: string,
	): Promise<EntityHistoric<U>> {
		try {
			const cursor = await this.collection
				.find<EntityHistoric<U>>({
					entityId: MongoUtils.oid(entityId) as any,
					userId: ObjectId.isValid(userId) ? (MongoUtils.oid(userId) as any) : userId,
				})
				.sort('_id', -1)
				.limit(1)
				.map((a: EntityHistoric<U>) =>
					MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(
						EntityHistoric,
						MongoUtils.unRemoveSpecialCharactersInKeys(a),
					),
				);
			if (await cursor.hasNext()) {
				return await cursor.next();
			}
			return;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				entityId,
				userId,
			});
		}
	}

	public async findOneByJustAfterAnother(
		entityId: string,
		historicId: string,
	): Promise<EntityHistoric<U>> {
		try {
			const cursor = await this.collection
				.find<EntityHistoric<U>>({
					entityId: MongoUtils.oid(entityId) as any,
					_id: {
						$gt: MongoUtils.oid(historicId) as any,
					},
				})
				.sort('_id', 1)
				.limit(1)
				.map((a: EntityHistoric<U>) =>
					MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(
						EntityHistoric,
						MongoUtils.unRemoveSpecialCharactersInKeys(a),
					),
				);
			if (await cursor.hasNext()) {
				return await cursor.next();
			}
			return;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				entityId,
				historicId,
			});
		}
	}

	public async countByEntityId(id: string): Promise<number> {
		try {
			return await this.collection.countDocuments({ entityId: MongoUtils.oid(id) as any });
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { id });
		}
	}

	public async countSince(entityId: string, historicIdReference?: string): Promise<number> {
		try {
			const query: StringMap<any> = {
				entityId: MongoUtils.oid(entityId),
			};
			if (historicIdReference) {
				query._id = {
					$gt: MongoUtils.oid(historicIdReference),
				};
			}
			return await this.collection.countDocuments(query);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { entityId, historicIdReference });
		}
	}

	public async drop(): Promise<void> {
		try {
			await this.collection.drop();
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e);
		}
	}
}
