import { N9Log } from '@neo9/n9-node-log';
import { diff as deepDiff } from 'deep-diff';
import { Collection, Db, IndexSpecification, ObjectId, WithId } from 'mongodb';

import { FilterQuery, IndexOptions } from '.';
import { N9FindCursor } from './cursors';
import { IndexManager } from './index-manager';
import { LangUtils } from './lang-utils';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import {
	BaseMongoObject,
	EntityHistoric,
	EntityHistoricStored,
	HistoricManagerSettings,
	StringMap,
} from './models';
import { MongoUtils } from './mongo-utils';

/**
 * Class that handles the historisation of entity changes
 */
export class HistoricManager<U extends BaseMongoObject> {
	private readonly collection: Collection<EntityHistoricStored<U>>;
	private readonly logger: N9Log;
	private readonly db: Db;
	private readonly indexManager: IndexManager<EntityHistoricStored<U>>;

	constructor(collection: Collection<U>, historicManagerSettings: HistoricManagerSettings) {
		this.logger = historicManagerSettings.logger.module('mongo-client-historic');
		this.db = historicManagerSettings.db; // existence is checked in client.ts

		this.collection = this.db.collection<EntityHistoricStored<U>>(
			`${collection.collectionName}Historic`,
		);

		this.indexManager = new IndexManager<EntityHistoricStored<U>>(this.collection);
	}

	public async initIndexes(): Promise<void> {
		await this.createIndex('entityId');
	}

	public async createIndex(
		fieldOrSpec: string | IndexSpecification,
		options?: IndexOptions,
	): Promise<void> {
		await this.indexManager.createIndex(fieldOrSpec, options);
	}

	public async createUniqueIndex(
		fieldOrSpec: string | IndexSpecification = 'code',
		options?: IndexOptions,
	): Promise<void> {
		await this.indexManager.createUniqueIndex(fieldOrSpec, options);
	}

	public async ensureExpirationIndex(
		ttlInDays: number,
		fieldOrSpec: IndexSpecification = 'date',
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
	 * @param snapshot snapshot of the entity before the changes
	 * @param updateDate date at which the update occurred
	 * @param userId id of the user who performed the update
	 */
	public async insertOne(
		entityId: string,
		snapshot: U,
		updateDate: Date,
		userId: string,
	): Promise<void> {
		try {
			const change: EntityHistoricStored<U> = {
				entityId: MongoUtils.TO_OBJECT_ID(entityId) as any,
				date: updateDate,
				userId: ObjectId.isValid(userId) ? (MongoUtils.TO_OBJECT_ID(userId) as any) : userId,
				snapshot: MongoUtils.REMOVE_SPECIAL_CHARACTERS_IN_KEYS(snapshot),
			};
			await this.collection.insertOne(change as any);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				entityId,
				snapshot,
				updateDate,
				userId,
			});
		}
	}

	public async insertMany(snapshots: U[], updateDate: Date, userId: string): Promise<void> {
		try {
			if (LodashReplacerUtils.IS_ARRAY_EMPTY(snapshots)) {
				return;
			}
			const changes: EntityHistoricStored<U>[] = [];
			for (const snapshot of snapshots) {
				changes.push({
					entityId: MongoUtils.TO_OBJECT_ID(snapshot._id) as any,
					date: updateDate,
					userId: ObjectId.isValid(userId) ? (MongoUtils.TO_OBJECT_ID(userId) as any) : userId,
					snapshot: MongoUtils.REMOVE_SPECIAL_CHARACTERS_IN_KEYS(snapshot),
				});
			}
			await this.collection.insertMany(changes as any);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				snapshots,
				updateDate,
				userId,
			});
		}
	}

	public findByEntityId(
		entityId: string,
		latestEntityVersion: U,
		page: number = 0,
		size: number = 10,
	): N9FindCursor<EntityHistoric<U>> {
		try {
			let previousEntityHistoricSnapshot: U = latestEntityVersion;
			const filterQuery: FilterQuery<EntityHistoric<U>> = {
				entityId: MongoUtils.TO_OBJECT_ID(entityId) as any,
			};
			const findCursor = this.collection
				.find(filterQuery)
				.sort('_id', -1)
				.skip(page * size)
				.limit(size)
				.map((a: WithId<EntityHistoricStored<U>>) => {
					const entityHistoric = MongoUtils.MAP_OBJECT_TO_CLASS<
						EntityHistoric<U>,
						EntityHistoric<U>
					>(EntityHistoric, MongoUtils.UN_REMOVE_SPECIAL_CHARACTERS_IN_KEYS(a));
					// old vs new
					const { oldValue, newValue }: { oldValue: U; newValue: U } = this.cleanObjectInfos(
						entityHistoric.snapshot,
						previousEntityHistoricSnapshot,
					);
					entityHistoric.dataEdited = deepDiff(oldValue, newValue);
					previousEntityHistoricSnapshot = entityHistoric.snapshot;
					return entityHistoric;
				});

			return new N9FindCursor<EntityHistoric<U>>(this.collection, findCursor, filterQuery);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				entityId,
				page,
				size,
			});
		}
	}

	public async findOneByUserIdMostRecent(
		entityId: string,
		userId: string,
		lastestValue: U,
	): Promise<EntityHistoric<U>> {
		try {
			const cursor = this.collection
				.find({
					entityId: MongoUtils.TO_OBJECT_ID(entityId) as any,
					userId: ObjectId.isValid(userId) ? (MongoUtils.TO_OBJECT_ID(userId) as any) : userId,
				})
				.sort('_id', -1)
				.limit(1);
			if (await cursor.hasNext()) {
				const entityHistoricRaw = await cursor.next();
				const oneMoreRecentValueCursor = this.collection
					.find({
						entityId: MongoUtils.TO_OBJECT_ID(entityId) as any,
						_id: {
							$gt: MongoUtils.TO_OBJECT_ID(entityHistoricRaw._id) as any,
						},
					})
					.sort('_id', -1)
					.limit(1);
				let oneMoreRecentValue: U;
				if (await oneMoreRecentValueCursor.hasNext()) {
					oneMoreRecentValue = (await oneMoreRecentValueCursor.next()).snapshot;
				} else {
					oneMoreRecentValue = lastestValue;
				}
				const entityHistoric = MongoUtils.MAP_OBJECT_TO_CLASS<EntityHistoric<U>, EntityHistoric<U>>(
					EntityHistoric,
					MongoUtils.UN_REMOVE_SPECIAL_CHARACTERS_IN_KEYS(entityHistoricRaw),
				);

				// old vs new
				const { oldValue, newValue }: { oldValue: U; newValue: U } = this.cleanObjectInfos(
					entityHistoric.snapshot,
					oneMoreRecentValue,
				);
				entityHistoric.dataEdited = deepDiff(oldValue, newValue);
				return entityHistoric;
			}
			return;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				entityId,
				userId,
			});
		}
	}

	public async countByEntityId(id: string): Promise<number> {
		try {
			return await this.collection.countDocuments({ entityId: MongoUtils.TO_OBJECT_ID(id) });
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { id });
		}
	}

	public async countSince(entityId: string, historicIdReference?: string): Promise<number> {
		try {
			const query: StringMap<any> = {
				entityId: MongoUtils.TO_OBJECT_ID(entityId),
			};
			if (historicIdReference) {
				query._id = {
					$gt: MongoUtils.TO_OBJECT_ID(historicIdReference),
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

	// eslint-disable-next-line class-methods-use-this
	private cleanObjectInfos(snapshot: U, newEntity: U): { oldValue: U; newValue: U } {
		const oldValue: U = { ...snapshot };
		if (oldValue.objectInfos) {
			oldValue.objectInfos = { ...oldValue.objectInfos };
			delete oldValue.objectInfos.creation;
			delete oldValue.objectInfos.lastUpdate;
			delete oldValue.objectInfos.lastModification;
		}

		const newValue: U = { ...newEntity };
		if (newValue.objectInfos) {
			newValue.objectInfos = { ...newValue.objectInfos };
			delete newValue.objectInfos.creation;
			delete newValue.objectInfos.lastUpdate;
			delete newValue.objectInfos.lastModification;
		}
		return { oldValue, newValue };
	}
}
