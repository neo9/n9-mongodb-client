import { N9Log } from '@neo9/n9-node-log';
import { N9Error } from '@neo9/n9-node-utils';
import { Diff, diff as deepDiff } from 'deep-diff';
import * as _ from 'lodash';
import {
	AggregationCursor,
	BulkWriteOperation,
	CollationDocument,
	Collection,
	CollectionAggregationOptions,
	CollectionInsertManyOptions,
	Cursor,
	Db,
	FilterQuery,
	FindAndModifyWriteOpResultObject,
	IndexOptions,
	MatchKeysAndValues,
	MongoClient as MongodbClient,
	ObjectId,
	UpdateQuery,
} from 'mongodb';
import { AggregationBuilder } from './aggregation-utils';
import { HistoricManager } from './historic-manager';
import { IndexManager } from './index-manager';
import { LangUtils } from './lang-utils';
import { LockFieldsManager } from './lock-fields-manager';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import {
	AddTagOptions,
	BaseMongoObject,
	ClassType,
	EntityHistoric,
	MongoClientConfiguration,
	RemoveTagOptions,
	StringMap,
	UpdateManyAtOnceOptions,
	UpdateManyQuery,
} from './models';
import { UpdateManyToSameValueOptions } from './models/update-many-to-same-value-options.models';
import { MongoReadStream } from './mongo-read-stream';
import { MongoUtils } from './mongo-utils';
import { TagManager } from './tag-manager';

const defaultConfiguration: MongoClientConfiguration = {
	keepHistoric: false,
};

export class MongoClient<U extends BaseMongoObject, L extends BaseMongoObject> {
	private readonly collection: Collection<U>;
	private readonly collectionSourceForAggregation: Collection<U>;
	private readonly logger: N9Log;
	private readonly db: Db;
	private readonly mongoClient: MongodbClient;
	private readonly type: ClassType<U>;
	private readonly typeList: ClassType<L>;
	private readonly conf: MongoClientConfiguration;
	private readonly lockFieldsManager: LockFieldsManager<U>;
	private readonly indexManager: IndexManager;
	private readonly historicManager: HistoricManager<U>;
	private readonly tagManager: TagManager;

	constructor(
		collection: Collection<U> | string,
		type: ClassType<U>,
		typeList: ClassType<L>,
		conf: MongoClientConfiguration = {},
	) {
		this.conf = _.merge({}, defaultConfiguration, conf);
		if (this.conf.lockFields) {
			this.lockFieldsManager = new LockFieldsManager(this.conf.lockFields);
		}
		this.logger = (global.log as N9Log).module('mongo-client');

		this.db = global.db as Db;
		if (!this.db) {
			throw new N9Error('missing-db', 500);
		}

		this.mongoClient = global.dbClient as MongodbClient;
		if (!this.mongoClient) {
			throw new N9Error('missing-db-client', 500);
		}

		this.type = type;
		this.typeList = typeList;

		if (typeof collection === 'string') {
			this.collection = this.db.collection(collection);
		} else {
			this.collection = collection;
		}
		this.indexManager = new IndexManager(this.collection);
		this.historicManager = new HistoricManager(this.collection);
		this.tagManager = new TagManager(this.collection);

		if (this.conf.aggregationCollectionSource) {
			this.collectionSourceForAggregation = this.db.collection(
				this.conf.aggregationCollectionSource,
			);
		} else {
			this.collectionSourceForAggregation = this.collection;
		}
	}

	public async createIndex(fieldOrSpec: string | any, options?: IndexOptions): Promise<void> {
		await this.indexManager.createIndex(fieldOrSpec, options);
	}

	public async dropIndex(indexName: string): Promise<void> {
		await this.indexManager.dropIndex(indexName);
	}

	public async createUniqueIndex(
		fieldOrSpec: string | any = 'code',
		options?: IndexOptions,
	): Promise<void> {
		await this.indexManager.createUniqueIndex(fieldOrSpec, options);
	}

	public async createExpirationIndex(
		ttlInDays: number,
		fieldOrSpec: string | object = 'objectInfos.creation.date',
		options: IndexOptions = {},
	): Promise<void> {
		await this.indexManager.ensureExpirationIndex(fieldOrSpec, ttlInDays, options);
	}

	public async initTagsIndex(): Promise<void> {
		await this.indexManager.createIndex({ 'objectInfos.tags': 1 });
	}

	public async initHistoricIndexes(): Promise<void> {
		await this.historicManager.initIndexes();
	}

	public async createHistoricIndex(
		fieldOrSpec: string | any,
		options?: IndexOptions,
	): Promise<void> {
		await this.historicManager.createIndex(fieldOrSpec, options);
	}

	public async createHistoricUniqueIndex(
		fieldOrSpec: string | any = 'code',
		options?: IndexOptions,
	): Promise<void> {
		await this.historicManager.createUniqueIndex(fieldOrSpec, options);
	}

	public async createHistoricExpirationIndex(
		ttlInDays: number,
		fieldOrSpec: string | object = 'date',
		options: IndexOptions = {},
	): Promise<void> {
		await this.historicManager.ensureExpirationIndex(ttlInDays, fieldOrSpec, options);
	}

	public async dropHistoryIndex(indexName: string): Promise<void> {
		await this.historicManager.dropIndex(indexName);
	}

	public async insertOne(
		newEntity: U,
		userId: string,
		lockFields: boolean = true,
		returnNewValue: boolean = true,
	): Promise<U> {
		if (!newEntity) return newEntity;
		const date = new Date();
		newEntity.objectInfos = {
			creation: {
				date,
				userId,
			},
			lastUpdate: {
				date,
				userId,
			},
			lastModification: {
				date,
				userId,
			},
		};
		if (newEntity._id) {
			this.logger.warn(
				`Trying to set _id field to ${newEntity._id} (${newEntity._id.constructor.name})`,
			);
			delete newEntity._id;
		}
		let newEntityWithoutForbiddenCharacters = MongoUtils.removeSpecialCharactersInKeys(newEntity);

		if (this.conf.lockFields) {
			if (!newEntityWithoutForbiddenCharacters.objectInfos.lockFields) {
				newEntityWithoutForbiddenCharacters.objectInfos.lockFields = [];
			}
			if (lockFields) {
				newEntityWithoutForbiddenCharacters.objectInfos.lockFields = this.lockFieldsManager.getAllLockFieldsFromEntity(
					newEntityWithoutForbiddenCharacters,
					date,
					userId,
				);
			}
		}

		newEntityWithoutForbiddenCharacters = LangUtils.removeEmptyDeep(
			newEntityWithoutForbiddenCharacters,
			undefined,
			undefined,
			!!this.conf.lockFields,
		);
		await this.collection.insertOne(newEntityWithoutForbiddenCharacters);
		if (returnNewValue) {
			return MongoUtils.mapObjectToClass(
				this.type,
				MongoUtils.unRemoveSpecialCharactersInKeys(newEntityWithoutForbiddenCharacters),
			);
		}
		return;
	}

	public async count(query: object = {}): Promise<number> {
		return await this.collection.countDocuments(query);
	}

	public async insertMany(
		newEntities: U[],
		userId: string,
		options?: CollectionInsertManyOptions,
		returnNewValue: boolean = true,
	): Promise<U[]> {
		if (LodashReplacerUtils.IS_ARRAY_EMPTY(newEntities)) return;

		const date = new Date();
		const entitiesToInsert: any = newEntities.map((newEntity) => {
			newEntity.objectInfos = {
				creation: {
					date,
					userId,
				},
				lastUpdate: {
					date,
					userId,
				},
				lastModification: {
					date,
					userId,
				},
			};
			return MongoUtils.removeSpecialCharactersInKeys(newEntity);
		});

		const insertResult = await this.collection.insertMany(entitiesToInsert, options);
		if (returnNewValue) {
			return (insertResult.ops || []).map((newEntity) =>
				MongoUtils.mapObjectToClass(
					this.type,
					MongoUtils.unRemoveSpecialCharactersInKeys(newEntity),
				),
			);
		}
	}

	public async findWithType<T extends Partial<U | L>>(
		query: object,
		type: ClassType<T>,
		page: number = 0,
		size: number = 10,
		sort: object = {},
		projection: object = {},
		collation?: CollationDocument,
	): Promise<Cursor<T>> {
		let findCursor: Cursor<T> = this.collection.find<T>(query);

		if (collation) {
			findCursor = findCursor.collation(collation);
		}

		return findCursor
			.sort(sort)
			.skip(page * size)
			.limit(size)
			.project(projection)
			.map((a: Partial<U | L>) => {
				const b = MongoUtils.unRemoveSpecialCharactersInKeys(a);
				return MongoUtils.mapObjectToClass(type, b);
			});
	}

	public stream<T extends Partial<U | L>>(
		query: object,
		pageSize: number,
		projection: object = {},
	): MongoReadStream<Partial<U>, Partial<L>> | MongoReadStream<U, L> {
		return new MongoReadStream<U, L>(this, query, pageSize, projection);
	}

	public streamWithType<T extends Partial<U | L>>(
		query: object,
		type: ClassType<T>,
		pageSize: number,
		projection: object = {},
	): MongoReadStream<Partial<U>, Partial<L>> | MongoReadStream<U, L> {
		return new MongoReadStream<U, L>(this, query, pageSize, projection, type);
	}

	public async find(
		query: object,
		page: number = 0,
		size: number = 10,
		sort: object = {},
		projection: object = {},
		collation?: CollationDocument,
	): Promise<Cursor<L>> {
		return this.findWithType<any>(query, this.typeList, page, size, sort, projection, collation);
	}

	public async findOneById(id: string, projection?: object): Promise<U> {
		return this.findOneByKey(MongoUtils.oid(id), '_id', projection);
	}

	public async findOneByKey(
		keyValue: any,
		keyName: string = 'code',
		projection?: object,
	): Promise<U> {
		const query: StringMap<any> = {
			[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
		};

		return await this.findOne(query, projection);
	}

	public async findOne(query: object, projection?: object): Promise<U> {
		const internalEntity = await this.collection.findOne(query, { projection });
		if (!internalEntity) return null;
		const entity = MongoUtils.unRemoveSpecialCharactersInKeys(internalEntity);
		return MongoUtils.mapObjectToClass(this.type, entity);
	}

	public async existsById(id: string): Promise<boolean> {
		return this.existsByKey(MongoUtils.oid(id), '_id');
	}

	public async existsByKey(keyValue: any, keyName: string = 'code'): Promise<boolean> {
		const query: StringMap<any> = {
			[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
		};

		return await this.exists(query);
	}

	public async exists(query: object): Promise<boolean> {
		const found = await this.collection.findOne<U>(query, { projection: { _id: 1 } });
		return !!found;
	}

	public async findOneAndUpdateById(
		id: string,
		updateQuery: UpdateQuery<U>,
		userId: string,
		internalCall: boolean = false,
		returnNewValue: boolean = true,
		arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		const query: FilterQuery<any> = {
			_id: MongoUtils.oid(id),
		};
		return await this.findOneAndUpdate(
			query,
			updateQuery,
			userId,
			internalCall,
			false,
			returnNewValue,
			arrayFilters,
		);
	}

	public async findOneAndUpdateByKey(
		keyValue: any,
		updateQuery: UpdateQuery<U>,
		userId: string,
		keyName: string = 'code',
		internalCall: boolean = false,
		returnNewValue: boolean = true,
		arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		const query: FilterQuery<any> = {
			[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
		};
		return await this.findOneAndUpdate(
			query,
			updateQuery,
			userId,
			internalCall,
			false,
			returnNewValue,
			arrayFilters,
		);
	}

	/**
	 * To upsert you should use findOneAndUpsert
	 *
	 * @param query The selection criteria for the update. The same query selectors as in the find() method are available.
	 *
	 * @param updateQuery The update document
	 *
	 * @param userId user identifier
	 *
	 * @param internalCall activate the lock field management.
	 *
	 * @param upsert Optional. When true, findOneAndUpdate() either:<ul><li>Creates a new document
	 * if no documents match the filter. For more details see upsert behavior. Returns null after
	 * inserting the new document, unless returnNewDocument is true.</li><li>Updates a single
	 * document that matches the filter.</li></ul><br/>To avoid multiple upserts, ensure that the
	 * filter fields are uniquely indexed.<br/> Defaults to false.
	 *
	 * @param returnNewValue Optional. When true, returns the updated document instead of the
	 * original document.<br/> Defaults to true.
	 *
	 * @param arrayFilters Optional. An array of filter documents that determine which array
	 * elements to modify for an update operation on an array field. <br/> In the update document,
	 * use the $[<identifier>] filtered positional operator to define an identifier, which you then
	 * reference in the array filter documents. You cannot have an array filter document for an
	 * identifier if the identifier is not included in the update document.
	 */
	public async findOneAndUpdate(
		query: FilterQuery<U>,
		updateQuery: UpdateQuery<U>,
		userId: string,
		internalCall: boolean = false,
		upsert: boolean = false,
		returnNewValue: boolean = true,
		arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		if (!internalCall) {
			this.ifHasLockFieldsThrow();
		}

		if (!updateQuery.$set) {
			updateQuery.$set = {};
		}

		const now = new Date();
		const formattedUserId = (ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId) as string;

		updateQuery.$set = {
			...(updateQuery.$set as object),
			'objectInfos.lastUpdate': {
				date: now,
				userId: formattedUserId,
			},
		} as any;
		if (!this.conf.updateOnlyOnChange) {
			(updateQuery.$set as any)['objectInfos.lastModification'] = {
				date: now,
				userId: formattedUserId,
			};
		}

		if (upsert) {
			updateQuery.$setOnInsert = {
				...(updateQuery.$setOnInsert as object),
				'objectInfos.creation': {
					date: now,
					userId: formattedUserId,
				},
			} as any;

			if (this.conf.updateOnlyOnChange) {
				(updateQuery.$setOnInsert as any)['objectInfos.lastModification'] = {
					date: now,
					userId: formattedUserId,
				};
			}
		}

		let saveOldValue;
		if (this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
			saveOldValue = await this.findOne(query);
		}

		let newEntity = (
			await this.collection.findOneAndUpdate(query, updateQuery, {
				upsert,
				arrayFilters,
				returnOriginal: !returnNewValue,
			})
		).value as U;
		if (returnNewValue || this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
			newEntity = MongoUtils.mapObjectToClass(
				this.type,
				MongoUtils.unRemoveSpecialCharactersInKeys(newEntity),
			);
		}

		if (this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
			const diffs = deepDiff(saveOldValue, newEntity, (path: string[], key: string) => {
				return [
					'objectInfos.creation',
					'objectInfos.lastUpdate',
					'objectInfos.lastModification',
				].includes([...path, key].join('.'));
			});
			if (diffs) {
				await this.historicManager.insertOne(newEntity._id, diffs, saveOldValue, now, userId);

				if (this.conf.updateOnlyOnChange) {
					const newUpdate = await this.updateLastModificationDate(
						newEntity._id,
						diffs,
						now,
						userId,
					);

					if (returnNewValue && newUpdate) {
						newEntity = newUpdate.value;
						newEntity = MongoUtils.mapObjectToClass(
							this.type,
							MongoUtils.unRemoveSpecialCharactersInKeys(newEntity),
						);
					}
				}
			}
		}
		if (returnNewValue) return newEntity;
		return;
	}

	// wrapper around findOneAndUpdate
	public async findOneAndUpsert(
		query: FilterQuery<U>,
		updateQuery: UpdateQuery<U>,
		userId: string,
		internalCall: boolean = false,
		returnNewValue: boolean = true,
		arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		return this.findOneAndUpdate(
			query,
			updateQuery,
			userId,
			internalCall,
			true,
			returnNewValue,
			arrayFilters,
		);
	}

	public async findOneByIdAndRemoveLock(
		id: string,
		lockFieldPath: string,
		userId: string,
	): Promise<U> {
		const query: FilterQuery<any> = {
			_id: MongoUtils.oid(id),
		};
		return await this.findOneAndRemoveLock(query, lockFieldPath, userId);
	}

	public async findOneByKeyAndRemoveLock(
		keyValue: any,
		lockFieldPath: string,
		userId: string,
		keyName: string = 'code',
	): Promise<U> {
		const query: FilterQuery<any> = {
			[keyName]: keyValue,
		};
		return await this.findOneAndRemoveLock(query, lockFieldPath, userId);
	}

	public async findOneAndRemoveLock(
		query: FilterQuery<U>,
		lockFieldPath: string,
		userId: string,
	): Promise<U> {
		if (!this.conf.lockFields) {
			throw new N9Error('invalid-function-call', 500, {
				query,
				lockFieldPath,
				name: 'findOneByIdAndRemoveLock',
			});
		}

		return await this.findOneAndUpdate(
			query,
			({
				$pull: {
					'objectInfos.lockFields': {
						path: lockFieldPath,
					},
				},
			} as any) as UpdateQuery<U>,
			userId,
			true,
			false,
			true,
		);
	}

	public async findOneAndUpdateByIdWithLocks(
		id: string,
		newEntity: Partial<U>,
		userId: string,
		lockNewFields: boolean = true,
		forceEditLockFields: boolean = false,
	): Promise<U> {
		if (this.conf.lockFields) {
			const existingEntity = await this.findOneById(id);
			if (!existingEntity) {
				this.logger.warn(`Entity not found with id ${id} (${this.type.name})`, {
					userId,
					newEntity,
					id,
				});
				return;
			}

			let newEntityWithOnlyDataToUpdate;
			let newEntityToSave;
			if (forceEditLockFields) {
				newEntityWithOnlyDataToUpdate = newEntity;
				newEntityToSave = this.lockFieldsManager.mergeOldEntityWithNewOne(
					newEntity,
					existingEntity,
					'',
					[],
				);
			} else {
				newEntityWithOnlyDataToUpdate = this.lockFieldsManager.pruneEntityWithLockFields(
					newEntity,
					existingEntity.objectInfos.lockFields,
				);
				// console.log('-- client.ts ', newEntityWithOnlyDataToUpdate, ` <<-- newEntityWithOnlyDataToUpdate`);
				newEntityToSave = this.lockFieldsManager.mergeOldEntityWithNewOne(
					newEntity,
					existingEntity,
					'',
					existingEntity.objectInfos.lockFields,
				);
				// TODO : add function in parameters or in mongoClient conf to allow validation here
			}

			const updateQuery: UpdateQuery<U> = {
				$set: newEntityToSave,
			};
			if (lockNewFields) {
				if (!newEntityToSave?.objectInfos?.lockFields) {
					_.set(newEntityToSave, 'objectInfos.lockFields', []);
				}
				const allLockFieldsFromEntity = this.lockFieldsManager.getAllLockFieldsFromEntity(
					newEntityWithOnlyDataToUpdate,
					new Date(),
					userId,
					existingEntity,
				);

				if (!LodashReplacerUtils.IS_ARRAY_EMPTY(allLockFieldsFromEntity)) {
					const lockFields = [];
					for (const lockField of allLockFieldsFromEntity) {
						if (!existingEntity.objectInfos.lockFields?.find((lf) => lf.path === lockField.path)) {
							lockFields.push(lockField);
						}
					}

					updateQuery.$push = {
						'objectInfos.lockFields': {
							$each: lockFields,
						},
					};
				}
			}
			delete newEntityToSave.objectInfos;
			delete newEntityToSave._id;
			// console.log(`--   --    --  newEntityToSave  --    --   --    --   --`);
			// console.log(JSON.stringify(newEntityToSave, null, 2));
			// console.log(`--   --    --   --    --   --    --   --`);
			// console.log(JSON.stringify(updateQuery, null, 2));
			// console.log(`--   --    --  updateQuery  --    --   --    --   --`);

			const updatedValue = await this.findOneAndUpdateById(id, updateQuery, userId, true);
			// console.log(JSON.stringify(updatedValue, null, 2));
			// console.log(`--   --    --   --    --   --    --   --`);

			return updatedValue;
		}
		delete newEntity._id;
		delete newEntity.objectInfos;
		return await this.findOneAndUpdateById(id, { $set: newEntity }, userId, true);
	}

	public async deleteOneById(id: string): Promise<U> {
		return this.deleteOneByKey(MongoUtils.oid(id), '_id');
	}

	public async deleteOneByKey(keyValue: any, keyName: string = 'code'): Promise<U> {
		const query: StringMap<any> = {
			[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
		};

		return await this.deleteOne(query);
	}

	public async deleteOne(query: object): Promise<U> {
		const entity = await this.findOne(query);
		await this.collection.deleteOne(query);
		return entity;
	}

	public async deleteMany(query: object): Promise<void> {
		await this.collection.deleteMany(query);
	}

	/**
	 * Update multiple entities in one update. The update will be performed through a bulkWrite.
	 *
	 * @param entities list of entities to update
	 * @param userId id of the user that is performing the operation. Will be stored in objectInfos.
	 * @param options see UpdateManyAtOnceOptions for more details
	 */
	public async updateManyAtOnce(
		entities: Partial<U>[],
		userId: string,
		options: UpdateManyAtOnceOptions<U> = {},
	): Promise<Cursor<U>> {
		options.upsert = LodashReplacerUtils.IS_BOOLEAN(options.upsert) ? options.upsert : false;
		options.lockNewFields = LodashReplacerUtils.IS_BOOLEAN(options.lockNewFields)
			? options.lockNewFields
			: true;
		options.forceEditLockFields = LodashReplacerUtils.IS_BOOLEAN(options.forceEditLockFields)
			? options.forceEditLockFields
			: false;
		options.unsetUndefined = LodashReplacerUtils.IS_BOOLEAN(options.unsetUndefined)
			? options.unsetUndefined
			: true;
		const updateQueries = await this.buildUpdatesQueries(entities, userId, options);
		// console.log(`-- client.ts>updateManyAtOnce updateQueries --`, JSON.stringify(updateQueries, null, 2));
		return await this.updateMany(updateQueries, userId, options.upsert);
	}

	public async updateManyToSameValue(
		query: FilterQuery<U>,
		updateQuery: UpdateQuery<U>,
		userId: string,
		options: UpdateManyToSameValueOptions<U> = {},
	): Promise<{ matchedCount: number; modifiedCount: number }> {
		this.ifHasLockFieldsThrow();

		if (this.conf.keepHistoric) {
			throw new N9Error('not-supported-operation-for-collection-with-historic', 501, {
				conf: this.conf,
			});
		}

		if (this.conf.updateOnlyOnChange && !options.forceLastModificationDate) {
			throw new N9Error('force-last-modification-required', 501, {
				conf: this.conf,
			});
		}

		if (!updateQuery.$set) {
			updateQuery.$set = {};
		}

		const now = new Date();

		updateQuery.$set = {
			...(updateQuery.$set as object),
			'objectInfos.lastUpdate': {
				date: now,
				userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			},
			'objectInfos.lastModification': {
				date: now,
				userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			},
		} as any;

		const updateResult = await this.collection.updateMany(query, updateQuery);

		return {
			matchedCount: updateResult.matchedCount,
			modifiedCount: updateResult.modifiedCount,
		};
	}

	/**
	 * Do an aggregation on mongodb, use it carefully
	 * @param aggregateSteps steps of the aggregation
	 * @param options options to send to the client
	 * @param readInOutputCollection to read in the main mongoClient collection
	 */
	public async aggregate<T = void>(
		aggregateSteps: object[],
		options?: CollectionAggregationOptions,
		readInOutputCollection: boolean = false,
	): Promise<AggregationCursor<T>> {
		if (readInOutputCollection) {
			return await this.collection.aggregate<T>(aggregateSteps, options);
		}
		return await this.collectionSourceForAggregation.aggregate<T>(aggregateSteps, options);
	}

	public async aggregateWithBuilder<T = void>(
		aggregationBuilder: AggregationBuilder<U>,
		options?: CollectionAggregationOptions,
		readInOutputCollection: boolean = false,
	): Promise<AggregationCursor<T>> {
		return await this.aggregate<T>(aggregationBuilder.build(), options, readInOutputCollection);
	}

	public newAggregationBuilder(): AggregationBuilder<U> {
		return new AggregationBuilder<U>(this.collection.collectionName);
	}

	public async findHistoricByEntityId(
		id: string,
		page: number = 0,
		size: number = 10,
	): Promise<Cursor<EntityHistoric<U>>> {
		return await this.historicManager.findByEntityId(id, page, size);
	}

	public async findOneHistoricByUserIdMostRecent(
		entityId: string,
		userId: string,
	): Promise<EntityHistoric<U>> {
		return await this.historicManager.findOneByUserIdMostRecent(entityId, userId);
	}

	public async findOneHistoricByJustAfterAnother(
		entityId: string,
		historicId: string,
	): Promise<EntityHistoric<U>> {
		return await this.historicManager.findOneByJustAfterAnother(entityId, historicId);
	}

	public async countHistoricByEntityId(id: string): Promise<number> {
		return await this.historicManager.countByEntityId(id);
	}

	public async countHistoricSince(entityId: string, historicIdReference?: string): Promise<number> {
		return await this.historicManager.countSince(entityId, historicIdReference);
	}

	public async collectionExists(): Promise<boolean> {
		const collectionName = this.collection.collectionName;
		const collections = await this.db.listCollections({ name: collectionName }).toArray();
		return collections.length === 1;
	}

	public async dropCollection(
		dropHistoryIfExists: boolean = true,
		throwIfNotExists: boolean = false,
	): Promise<void> {
		if (dropHistoryIfExists && this.conf.keepHistoric) {
			await this.dropHistory();
		}
		try {
			if (throwIfNotExists || (await this.collectionExists())) {
				await this.collection.drop();
			}
		} catch (e) {
			throw new N9Error('mongodb-drop-collection-error', 500, { mongodbError: e });
		}
	}

	public async dropHistory(): Promise<void> {
		await this.historicManager.drop();
	}

	/**
	 * Add a tag to an entity.
	 * If the entity already has the tag, this method has no effect.
	 *
	 * @param query the query to select the entity to tag
	 * @param userId id of the user performing the operation
	 * @param options options to customize the tag
	 */
	public async addTagToOne(
		query: object,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		return await this.tagManager.addTagToOne(query, userId, options);
	}

	/**
	 * Same as addTagToOne, except the query is made by id.
	 */
	public async addTagToOneById(
		id: string,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		return await this.tagManager.addTagToOneById(id, userId, options);
	}

	/**
	 * Same as addTagToOne, but for many entities
	 */
	public async addTagToMany(
		query: object,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		return await this.tagManager.addTagToMany(query, userId, options);
	}

	/**
	 * Remove a tag from an entity.
	 * If the entity doesn't have the tag, this method has no effect.
	 *
	 * @param query the query to select the entity to tag
	 * @param tag the tag to remove
	 * @param userId id of the user performing the operation
	 * @param options options to customize the tag
	 */
	public async removeTagFromOne(
		query: object,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		return await this.tagManager.removeTagFromOne(query, tag, userId, options);
	}

	/**
	 * Same as removeTagFromOne, except the query is made by id.
	 */
	public async removeTagFromOneById(
		id: string,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		return await this.tagManager.removeTagFromOneById(id, tag, userId, options);
	}

	/**vs
	 * Same as removeTagFromOne, but for many entities
	 */
	public async removeTagFromMany(
		query: object,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		return await this.tagManager.removeTagFromMany(query, tag, userId, options);
	}

	/**
	 * Delete all entities with the given tag
	 */
	public async deleteManyWithTag(tag: string): Promise<void> {
		return await this.tagManager.deleteManyWithTag(tag);
	}

	private async buildUpdatesQueries(
		entities: MatchKeysAndValues<U>[],
		userId: string,
		options: UpdateManyAtOnceOptions<U>,
	): Promise<UpdateManyQuery[]> {
		const updates: UpdateManyQuery[] = [];
		let now;
		if (options.lockNewFields) now = new Date();

		for (let entity of entities) {
			let currentValue: U;
			if (options.query) {
				if (LodashReplacerUtils.IS_STRING(options.query)) {
					currentValue = await this.findOneByKey(_.get(entity, options.query), options.query);
				} else {
					currentValue = await this.findOne(options.query.call(null, entity));
				}
			}
			if (currentValue) {
				if (!!options.mapFunction) {
					entity = await options.mapFunction(entity, currentValue);
				}
				LangUtils.removeEmptyDeep(entity, false, false, true);

				if (this.conf.lockFields) {
					if (!options.forceEditLockFields) {
						entity = this.lockFieldsManager.pruneEntityWithLockFields(
							entity,
							currentValue.objectInfos.lockFields,
						);
						const newEntityMerged = this.lockFieldsManager.mergeOldEntityWithNewOne(
							entity,
							currentValue,
							'',
							currentValue.objectInfos.lockFields,
						);
						// console.log(`--  newEntityMerged --`, JSON.stringify(newEntityMerged, null, 2));
						delete newEntityMerged.objectInfos;
						delete newEntityMerged._id;

						entity = newEntityMerged;
						// TODO : add function parameter to allow validation here
					}

					if (options.lockNewFields) {
						const lockFields = currentValue.objectInfos.lockFields || [];
						const newLockFields = this.lockFieldsManager.getAllLockFieldsFromEntity(
							entity,
							now,
							userId,
							currentValue,
						);

						delete (entity as any)?.objectInfos;
						if (!LodashReplacerUtils.IS_ARRAY_EMPTY(newLockFields)) {
							lockFields.push(...newLockFields);
						}
						if (options.forceEditLockFields && options.unsetUndefined) {
							// we can delete lock fields only if we change there values
							const newLockFieldsCleaned = this.lockFieldsManager.cleanObsoleteLockFields(
								lockFields,
								entity,
							);
							if (
								!(
									LodashReplacerUtils.IS_ARRAY_EMPTY(newLockFieldsCleaned) &&
									LodashReplacerUtils.IS_ARRAY_EMPTY(currentValue.objectInfos.lockFields)
								)
							) {
								entity['objectInfos.lockFields'] = newLockFieldsCleaned as any;
							}
						} else if (!LodashReplacerUtils.IS_ARRAY_EMPTY(newLockFields)) {
							entity['objectInfos.lockFields'] = lockFields as any;
						}
					}
				}

				const toSet = _.omit(entity, options.onlyInsertFieldsKey);
				const toSetOnInsert = _.pick(entity, options.onlyInsertFieldsKey);

				let setOnInsert;
				if (!LodashReplacerUtils.IS_OBJECT_EMPTY(toSetOnInsert)) {
					setOnInsert = {
						$setOnInsert: {
							...(toSetOnInsert as object),
						},
					};
				}

				// Unset only level 1, other are override by $set on objects
				let unsetQuery;
				if (options.unsetUndefined) {
					const toUnset: object = _.omit(currentValue, [..._.keys(entity), '_id', 'objectInfos']);
					if (!LodashReplacerUtils.IS_OBJECT_EMPTY(toUnset)) {
						unsetQuery = {
							$unset: {
								..._.mapValues(toUnset, () => false),
							},
						};
					}
				}

				const update = {
					$set: {
						...(toSet as object),
					},
					...unsetQuery,
					...setOnInsert,
				};

				updates.push({
					id: currentValue._id,
					updateQuery: update,
				});
			} else {
				// on insert for upsert
				if (!!options.mapFunction) {
					entity = await options.mapFunction(entity);
				}
				LangUtils.removeEmptyDeep(entity, undefined, undefined, !!this.conf.lockFields); // keep null values for lockfields

				const toSet = _.omit(entity, options.onlyInsertFieldsKey);
				const toSetOnInsert = _.pick(entity, options.onlyInsertFieldsKey);

				let setOnInsert;
				if (!LodashReplacerUtils.IS_OBJECT_EMPTY(toSetOnInsert)) {
					setOnInsert = {
						$setOnInsert: {
							...(toSetOnInsert as object),
						},
					};
				}

				const update: UpdateManyQuery = {
					updateQuery: {
						$set: {
							...(toSet as object),
						},
						...setOnInsert,
					},
				};

				if (options.query) {
					if (LodashReplacerUtils.IS_STRING(options.query)) {
						update.key = {
							name: options.query,
							value: _.get(entity, options.query),
						};
					} else {
						update.query = options.query.call(null, entity);
					}
				}
				updates.push(update);
			}
		}
		return updates;
	}

	private async updateMany(
		newEntities: UpdateManyQuery[],
		userId: string,
		upsert?: boolean,
	): Promise<Cursor<U>> {
		if (LodashReplacerUtils.IS_ARRAY_EMPTY(newEntities)) {
			return await this.getEmptyCursor<U>(this.type);
		}

		const bulkOperations: BulkWriteOperation<U>[] = [];
		const now = new Date();
		for (const newEnt of newEntities) {
			const updateQuery = newEnt.updateQuery;
			if (!updateQuery.$set) {
				updateQuery.$set = {};
			}

			const formattedUserId = ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId;
			updateQuery.$set = {
				...(updateQuery.$set as object),
				'objectInfos.lastUpdate': {
					date: now,
					userId: formattedUserId,
				},
			};

			if (!this.conf.updateOnlyOnChange) {
				(updateQuery.$set as any)['objectInfos.lastModification'] = {
					date: now,
					userId: formattedUserId,
				};
			}
			if (updateQuery.$set._id) {
				this.logger.warn(
					`Trying to set _id field to ${updateQuery.$set._id} (${updateQuery.$set._id.constructor.name})`,
				);
				delete updateQuery.$set._id;
			}

			if (upsert) {
				updateQuery.$setOnInsert = {
					...(updateQuery.$setOnInsert as object),
					'objectInfos.creation': {
						userId,
						date: now,
					},
				};
				if (this.conf.updateOnlyOnChange) {
					(updateQuery.$setOnInsert as any)['objectInfos.lastModification'] = {
						date: now,
						userId: formattedUserId,
					};
				}
			}

			let filter: FilterQuery<any | BaseMongoObject> = {};

			if (newEnt.id) {
				filter._id = MongoUtils.oid(newEnt.id) as any;
			} else if (newEnt.key) {
				filter[newEnt.key.name] = newEnt.key.value;
			} else if (newEnt.query) {
				filter = newEnt.query;
			} else {
				filter._id = {
					$exists: false,
				};
			}

			bulkOperations.push({
				updateOne: {
					filter,
					upsert,
					update: updateQuery,
				},
			});
		}
		let oldValuesSaved: StringMap<U>;
		if (this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
			oldValuesSaved = _.keyBy(
				await (
					await this.findWithType(
						{
							_id: {
								$in: MongoUtils.oids(newEntities.map((newEntity) => newEntity.id)),
							},
						},
						this.type,
						0,
						newEntities.length,
					)
				).toArray(),
				'_id',
			);
		}

		// for (const bulkOperation of bulkOperations) {
		// 	console.log(`--  bulkOperation --`);
		// 	console.log(JSON.stringify(bulkOperation));
		// 	console.log(`--                --`);
		// }

		const bulkResult = await this.collection.bulkWrite(bulkOperations);
		const newValuesQuery = {
			_id: {
				$in: MongoUtils.oids(
					_.concat(
						newEntities.map((newEntity) => newEntity.id),
						Object.values(bulkResult.insertedIds ?? {}),
						Object.values(bulkResult.upsertedIds ?? {}),
					),
				),
			},
		};
		let newValues: Cursor<U> = await this.findWithType(
			newValuesQuery,
			this.type,
			0,
			newEntities?.length,
		);

		if (this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
			let shouldResetResponse = false;
			while (await newValues.hasNext()) {
				const newEntity = await newValues.next();
				const oldValueSaved: U = oldValuesSaved[newEntity._id];

				if (oldValueSaved) {
					const diffs = deepDiff(oldValueSaved, newEntity, (path: string[], key: string) => {
						return [
							'objectInfos.creation',
							'objectInfos.lastUpdate',
							'objectInfos.lastModification',
						].includes([...path, key].join('.'));
					});
					if (diffs) {
						await this.historicManager.insertOne(newEntity._id, diffs, oldValueSaved, now, userId);

						if (this.conf.updateOnlyOnChange) {
							const retValue = await this.updateLastModificationDate(
								newEntity._id,
								diffs,
								now,
								userId,
								false,
							);
							if (retValue) {
								shouldResetResponse = true;
							}
						}
					}
				}
			}
			if (shouldResetResponse) {
				await newValues.close();
				newValues = await this.findWithType(newValuesQuery, this.type, 0, newEntities?.length);
			} else {
				newValues.rewind();
			}
		}
		return newValues;
	}

	private ifHasLockFieldsThrow(): void {
		if (this.conf.lockFields) {
			throw new N9Error('invalid-function-call', 401, { lockFields: this.conf.lockFields });
		}
	}

	private async getEmptyCursor<X extends U>(type: ClassType<X>): Promise<Cursor<X>> {
		return await this.findWithType<X>({ $and: [{ _id: false }, { _id: true }] }, type, -1, 0);
	}

	/**
	 * Return undefined if nothing has changed
	 */
	private async updateLastModificationDate(
		entityId: string,
		diffs: Diff<U, U>[],
		updateDate: Date,
		userId: string,
		returnNewValue: boolean = true,
	): Promise<FindAndModifyWriteOpResultObject<U> | undefined> {
		// determine if the document has changed
		// if omit is not empty, field names must not be in omit to be taken into account
		// if pick is not empty, field names must be in pick to be taken into account
		const pick = this.conf.updateOnlyOnChange?.changeFilters?.pick ?? [];
		const omit = pick.length ? [] : this.conf.updateOnlyOnChange?.changeFilters?.omit ?? [];
		let hasChanged = false;
		for (const diff of diffs) {
			if (diff.path) {
				const path = diff.path.join('.');
				const isOmitted = omit.length && omit.find((omittedPath) => path.startsWith(omittedPath));
				const isPicked = !pick.length || pick.find((pickedPath) => path.startsWith(pickedPath));

				if (!isOmitted && isPicked) {
					hasChanged = true;
					break;
				}
			}
		}
		// if no change were detected, don't update lastModification
		if (!hasChanged) {
			return;
		}

		return await this.collection.findOneAndUpdate(
			{ _id: MongoUtils.oid(entityId) as any },
			{
				$set: {
					'objectInfos.lastModification': {
						date: updateDate,
						userId: (ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId) as string,
					},
				} as any,
			},
			{
				returnOriginal: !returnNewValue,
			},
		);
	}
}
