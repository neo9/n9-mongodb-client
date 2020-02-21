import { N9Log } from '@neo9/n9-node-log';
import { N9Error } from '@neo9/n9-node-utils';
import * as deepDiff from 'deep-diff';
import * as _ from 'lodash';
import {
	AggregationCursor,
	CollationDocument,
	Collection,
	CollectionAggregationOptions,
	CollectionInsertManyOptions,
	Cursor,
	Db,
	FilterQuery,
	IndexOptions,
	ObjectID,
	ObjectId,
	UpdateQuery,
} from 'mongodb';
import { BaseMongoObject, EntityHistoric, LockField, StringMap, UpdateManyQuery } from './models';
import { ClassType } from './models/class-type.models';
import { UpdateManyAtOnceOptions } from './models/update-many-at-once-options.models';
import { MongoReadStream } from './mongo-read-stream';
import { MongoUtils } from './mongo-utils';
import { AggregationBuilder } from './aggregation-utils';
import { TagOptions, AddTagOptions, RemoveTagOptions } from './models/tag-options.models';

export interface MongoClientConfiguration {
	keepHistoric?: boolean;
	lockFields?: {
		excludedFields?: string[],
		arrayWithReferences?: StringMap<string>
	};
	aggregationCollectionSource?: string;
}

const defaultConfiguration: MongoClientConfiguration = {
	keepHistoric: false,
};

export class MongoClient<U extends BaseMongoObject, L extends BaseMongoObject> {
	public static removeEmptyDeep<T>(obj: T, compactArrays: boolean = false, removeEmptyObjects: boolean = false, keepNullValues: boolean = false): T {
		for (const key of Object.keys(obj)) {
			const objElement = obj[key];
			if (compactArrays && _.isArray(objElement)) {
				obj[key] = _.filter(objElement, (elm) => !_.isNil(elm));
			}
			if (removeEmptyObjects && _.isObject(objElement) && !_.isArray(objElement) && _.isEmpty(objElement)) {
				delete obj[key];
			}
			// @ts-ignore
			if (objElement && typeof objElement === 'object') MongoClient.removeEmptyDeep(objElement, compactArrays, removeEmptyObjects, keepNullValues);
			// @ts-ignore
			else if ((keepNullValues && _.isUndefined(objElement)) || (!keepNullValues && _.isNil(objElement))) delete obj[key];
		}
		return obj;
	}

	private static getJoinPaths(basePath: string, key: string): string {
		if (basePath) return basePath + '.' + key;
		else return key;
	}

	private static isClassicObject(existingEntityElement: any): boolean {
		return _.isObject(existingEntityElement)
				&& !_.isFunction(existingEntityElement)
				&& !(existingEntityElement instanceof ObjectID)
				&& !(existingEntityElement instanceof Date)
				&& !_.isArray(existingEntityElement);
	}

	private readonly collection: Collection<U>;
	private readonly collectionSourceForAggregation: Collection<U>;
	private readonly logger: N9Log;
	private readonly db: Db;
	private readonly type: ClassType<U>;
	private readonly typeList: ClassType<L>;
	private readonly conf: MongoClientConfiguration;
	private readonly collectionHistoric: Collection<EntityHistoric<U>>;

	constructor(collection: Collection<U> | string, type: ClassType<U>, typeList: ClassType<L>, conf: MongoClientConfiguration = {}) {
		this.conf = _.merge({}, defaultConfiguration, conf);
		if (this.conf.lockFields) {
			this.conf.lockFields.excludedFields = _.union(this.conf.lockFields.excludedFields, ['objectInfos', '_id']);
		}
		this.logger = (global.log as N9Log).module('mongo-client');
		this.db = global.db as Db;

		if (!this.db) {
			throw new N9Error('missing-db', 500);
		}

		if (typeof collection === 'string') {
			this.collection = this.db.collection(collection);
			this.collectionHistoric = this.db.collection(collection + 'Historic');
		} else {
			this.collection = collection;
			this.collectionHistoric = this.db.collection(collection.collectionName + 'Historic');
		}

		if (this.conf.aggregationCollectionSource) {
			this.collectionSourceForAggregation = this.db.collection(this.conf.aggregationCollectionSource);
		} else {
			this.collectionSourceForAggregation = this.collection;
		}

		this.type = type;
		this.typeList = typeList;
	}

	public async createIndex(fieldOrSpec: string | any, options?: IndexOptions): Promise<void> {
		await this.collection.createIndex(fieldOrSpec, options);
	}

	public async dropIndex(indexName: string): Promise<void> {
		if (await this.collection.indexExists(indexName)) {
			await this.collection.dropIndex(indexName);
		}
	}

	public async createUniqueIndex(fieldOrSpec: string | any = 'code', options?: IndexOptions): Promise<void> {
		await this.createIndex(fieldOrSpec, { ...options, unique: true });
	}

	public async createExpirationIndex(ttlInDays: number, fieldOrSpec: string | object = 'objectInfos.creation.date', options: IndexOptions = {}): Promise<void> {
		await this.ensureExpirationIndex(this.collection, fieldOrSpec, ttlInDays, options);
	}

	public async initTagsIndex(): Promise<void> {
		await this.collection.createIndex({ 'objectInfos.tags': 1 });
	}

	public async initHistoricIndexes(): Promise<void> {
		await this.createHistoricIndex('entityId');
	}

	public async createHistoricIndex(fieldOrSpec: string | any, options?: IndexOptions): Promise<void> {
		await this.collectionHistoric.createIndex(fieldOrSpec, options);
	}

	public async createHistoricUniqueIndex(fieldOrSpec: string | any = 'code'): Promise<void> {
		await this.createHistoricIndex(fieldOrSpec, { unique: true });
	}

	public async createHistoricExpirationIndex(ttlInDays: number, fieldOrSpec: string | object = 'date', options: IndexOptions = {}): Promise<void> {
		await this.ensureExpirationIndex(this.collectionHistoric, fieldOrSpec, ttlInDays, options);
	}

	public async insertOne(newEntity: U, userId: string, lockFields: boolean = true, returnNewValue: boolean = true): Promise<U> {
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
		};
		let newEntityWithoutForbiddenCharacters = MongoUtils.removeSpecialCharactersInKeys(newEntity);

		if (this.conf.lockFields) {
			if (!newEntityWithoutForbiddenCharacters.objectInfos.lockFields) newEntityWithoutForbiddenCharacters.objectInfos.lockFields = [];
			if (lockFields) {
				newEntityWithoutForbiddenCharacters.objectInfos.lockFields = this.getAllLockFieldsFromEntity(newEntityWithoutForbiddenCharacters, date, userId);
			}
		}

		newEntityWithoutForbiddenCharacters = MongoClient.removeEmptyDeep(newEntityWithoutForbiddenCharacters);
		await this.collection.insertOne(newEntityWithoutForbiddenCharacters);
		if (returnNewValue) return MongoUtils.mapObjectToClass(this.type, MongoUtils.unRemoveSpecialCharactersInKeys(newEntityWithoutForbiddenCharacters));
		else return;
	}

	public async count(query: object = {}): Promise<number> {
		return await this.collection.countDocuments(query);
	}

	public async insertMany(newEntities: U[], userId: string, options?: CollectionInsertManyOptions, returnNewValue: boolean = true): Promise<U[]> {
		if (_.isEmpty(newEntities)) return;

		const entitiesToInsert = newEntities.map((newEntity) => {
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
			};
			return MongoUtils.removeSpecialCharactersInKeys(newEntity);
		});

		const insertResult = await this.collection.insertMany(entitiesToInsert, options);
		if (returnNewValue) {
			return (insertResult.ops || []).map((newEntity) => MongoUtils.mapObjectToClass(this.type, MongoUtils.unRemoveSpecialCharactersInKeys(newEntity)));
		} else {
			return;
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

	public stream<T extends Partial<U | L>>(query: object, pageSize: number, projection: object = {}): MongoReadStream<Partial<U>, Partial<L>> {
		return new MongoReadStream<U, L>(this, query, pageSize, projection);
	}

	public streamWithType<T extends Partial<U | L>>(query: object, type: ClassType<T>, pageSize: number, projection: object = {}): MongoReadStream<Partial<U>, Partial<L>> {
		return new MongoReadStream<U, L>(this, query, pageSize, projection, type);
	}

	public async find(query: object, page: number = 0, size: number = 10, sort: object = {}, projection: object = {}, collation?: CollationDocument): Promise<Cursor<L>> {
		return this.findWithType<any>(query, this.typeList, page, size, sort, projection, collation);
	}

	public async findOneById(id: string, projection?: object): Promise<U> {
		return this.findOneByKey(MongoUtils.oid(id), '_id', projection);
	}

	public async findOneByKey(keyValue: any, keyName: string = 'code', projection?: object): Promise<U> {
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
			updateQuery: { [id: string]: object, $set?: object },
			userId: string,
			internalCall: boolean = false,
			returnNewValue: boolean = true,
			arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		const query: StringMap<any> = {
			_id: MongoUtils.oid(id),
		};
		return await this.findOneAndUpdate(query, updateQuery, userId, internalCall, false, returnNewValue, arrayFilters);
	}

	public async findOneAndUpdateByKey(
			keyValue: any,
			updateQuery: { [id: string]: object, $set?: object },
			userId: string,
			keyName: string = 'code',
			internalCall: boolean = false,
			returnNewValue: boolean = true,
			arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		const query: StringMap<any> = {
			[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
		};
		return await this.findOneAndUpdate(query, updateQuery, userId, internalCall, false, returnNewValue, arrayFilters);
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
			updateQuery: { [id: string]: object, $set?: object, $unset?: object },
			userId: string,
			internalCall: boolean = false,
			upsert: boolean = false,
			returnNewValue: boolean = true,
			arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		if (!internalCall) {
			this.ifHasLockFieldsThrow();
		}

		if (!updateQuery['$set']) {
			updateQuery['$set'] = {};
		}

		const now = new Date();

		updateQuery['$set'] = {
			...updateQuery['$set'] as object,
			'objectInfos.lastUpdate': {
				date: now,
				userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			},
		};

		if (upsert) {
			updateQuery['$setOnInsert'] = {
				...updateQuery['$setOnInsert'] as object,
				'objectInfos.creation': {
					date: new Date(),
					userId,
				},
			};
		}

		let saveOldValue;
		if (this.conf.keepHistoric) {
			saveOldValue = await this.findOne(query);
		}

		let newEntity = (await this.collection.findOneAndUpdate(query, updateQuery, { returnOriginal: !returnNewValue, upsert, arrayFilters })).value as U;
		if (returnNewValue || this.conf.keepHistoric) {
			newEntity = MongoUtils.mapObjectToClass(this.type, MongoUtils.unRemoveSpecialCharactersInKeys(newEntity));
		}

		if (this.conf.keepHistoric) {
			const diffs = deepDiff.diff(saveOldValue, newEntity, (path: string[], key: string) => {
				return ['objectInfos.creation', 'objectInfos.lastUpdate'].includes([...path, key].join('.'));
			});
			if (diffs) {
				const change: EntityHistoric<U> = {
					entityId: MongoUtils.oid(newEntity._id) as any,
					date: now,
					userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) as any : userId,
					dataEdited: diffs,
					snapshot: MongoUtils.removeSpecialCharactersInKeys(saveOldValue),
				};
				await this.collectionHistoric.insertOne(change);
			}
		}

		if (returnNewValue) return newEntity;
		else return;
	}

	// wrapper around findOneAndUpdate
	public async findOneAndUpsert(
			query: FilterQuery<U>,
			updateQuery: { [id: string]: object, $set?: object },
			userId: string,
			internalCall: boolean = false,
			returnNewValue: boolean = true,
			arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		return this.findOneAndUpdate(query, updateQuery, userId, internalCall, true, returnNewValue, arrayFilters);
	}

	public async findOneByIdAndRemoveLock(id: string, lockFieldPath: string, userId: string): Promise<U> {
		const query: StringMap<any> = {
			_id: MongoUtils.oid(id),
		};
		return await this.findOneAndRemoveLock(query, lockFieldPath, userId);
	}

	public async findOneByKeyAndRemoveLock(keyValue: any, lockFieldPath: string, userId: string, keyName: string = 'code'): Promise<U> {
		const query: StringMap<any> = {
			[keyName]: keyValue,
		};
		return await this.findOneAndRemoveLock(query, lockFieldPath, userId);
	}

	public async findOneAndRemoveLock(query: FilterQuery<U>, lockFieldPath: string, userId: string): Promise<U> {
		if (!this.conf.lockFields) {
			throw new N9Error('invalid-function-call', 500, { name: 'findOneByIdAndRemoveLock', query, lockFieldPath });
		}

		return await this.findOneAndUpdate(query, {
			$pull: {
				'objectInfos.lockFields': {
					path: lockFieldPath,
				},
			},
		}, userId, true, false, true);
	}

	public async findOneAndUpdateByIdWithLocks(id: string, newEntity: Partial<U>, userId: string, lockNewFields: boolean = true, forceEditLockFields: boolean = false): Promise<U> {
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
				newEntityToSave = this.mergeOldEntityWithNewOne(newEntity, existingEntity, '', []);
			} else {
				newEntityWithOnlyDataToUpdate = this.pruneEntityWithLockFields(newEntity, existingEntity.objectInfos.lockFields);
				// console.log('-- client.ts ', newEntityWithOnlyDataToUpdate, ` <<-- newEntityWithOnlyDataToUpdate`);
				newEntityToSave = this.mergeOldEntityWithNewOne(newEntity, existingEntity, '', existingEntity.objectInfos.lockFields);
				// TODO : add function in parameters or in mongoClient conf to allow validation here
			}

			const updateQuery: StringMap<any> = {
				$set: newEntityToSave,
			};
			if (lockNewFields) {
				if (!_.get(newEntityToSave, 'objectInfos.lockFields')) {
					_.set(newEntityToSave, 'objectInfos.lockFields', []);
				}
				const allLockFieldsFromEntity = this.getAllLockFieldsFromEntity(newEntityWithOnlyDataToUpdate, new Date(), userId, existingEntity);

				if (!_.isEmpty(allLockFieldsFromEntity)) {
					const lockFields = [];
					for (const lockField of allLockFieldsFromEntity) {
						if (!_.find(existingEntity.objectInfos.lockFields, { path: lockField.path })) {
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
		} else {
			delete newEntity._id;
			delete newEntity.objectInfos;
			return await this.findOneAndUpdateById(id, { $set: newEntity }, userId, true);
		}
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
		options.upsert = _.isBoolean(options.upsert) ? options.upsert : false;
		options.lockNewFields = _.isBoolean(options.lockNewFields) ? options.lockNewFields : true;
		options.forceEditLockFields = _.isBoolean(options.forceEditLockFields) ? options.forceEditLockFields : false;
		options.unsetUndefined = _.isBoolean(options.unsetUndefined) ? options.unsetUndefined : true;
		const updateQueries = await this.buildUpdatesQueries(
				entities,
				userId,
				options,
		);
		// console.log(`-- client.ts>updateManyAtOnce updateQueries --`, JSON.stringify(updateQueries, null, 2));
		return await this.updateMany(updateQueries, userId, options.upsert);
	}

	public async updateManyToSameValue(query: FilterQuery<U>, updateQuery: UpdateQuery<U>, userId: string): Promise<Cursor<U>> {
		this.ifHasLockFieldsThrow();

		if (!updateQuery['$set']) {
			updateQuery['$set'] = {};
		}

		const now = new Date();

		updateQuery['$set'] = {
			...updateQuery['$set'] as object,
			'objectInfos.lastUpdate': {
				date: now,
				userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			},
		};

		if (this.conf.keepHistoric) {
			throw new N9Error('not-supported-operation-for-collection-with-historic', 501, { conf: this.conf });
		}
		const updateResult = await this.collection.updateMany(query, updateQuery);
		return this.findWithType(query, this.type, 0, updateResult.matchedCount);
	}

	/**
	 * Do an aggregation on mongodb, use it carefully
	 * @param aggregateSteps steps of the aggregation
	 * @param options options to send to the client
	 * @param readInOutputCollection to read in the main mongoClient collection
	 */
	public async aggregate<T = void>(aggregateSteps: object[], options?: CollectionAggregationOptions, readInOutputCollection: boolean = false): Promise<AggregationCursor<T>> {
		if (readInOutputCollection) {
			return await this.collection.aggregate<T>(aggregateSteps, options);
		} else {
			return await this.collectionSourceForAggregation.aggregate<T>(aggregateSteps, options);
		}
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

	public async findHistoricByEntityId(id: string, page: number = 0, size: number = 10): Promise<Cursor<EntityHistoric<U>>> {
		return await this.collectionHistoric.find<EntityHistoric<U>>({ entityId: MongoUtils.oid(id) })
				.sort('_id', -1)
				.skip(page * size)
				.limit(size)
				.map((a: EntityHistoric<U>) => MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(EntityHistoric, MongoUtils.unRemoveSpecialCharactersInKeys(a)));
	}

	public async findOneHistoricByUserIdMostRecent(entityId: string, userId: string): Promise<EntityHistoric<U>> {
		const cursor = await this.collectionHistoric
				.find<EntityHistoric<U>>({
					entityId: MongoUtils.oid(entityId),
					userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
				})
				.sort('_id', -1)
				.limit(1)
				.map((a: EntityHistoric<U>) => MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(EntityHistoric, MongoUtils.unRemoveSpecialCharactersInKeys(a)));
		if (await cursor.hasNext()) {
			return await cursor.next();
		} else {
			return;
		}
	}

	public async findOneHistoricByJustAfterAnother(entityId: string, historicId: string): Promise<EntityHistoric<U>> {
		const cursor = await this.collectionHistoric
				.find<EntityHistoric<U>>({
					entityId: MongoUtils.oid(entityId),
					_id: {
						$gt: MongoUtils.oid(historicId),
					},
				})
				.sort('_id', 1)
				.limit(1)
				.map((a: EntityHistoric<U>) => MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(EntityHistoric, MongoUtils.unRemoveSpecialCharactersInKeys(a)));
		if (await cursor.hasNext()) {
			return await cursor.next();
		} else {
			return;
		}
	}

	public async countHistoricByEntityId(id: string): Promise<number> {
		return await this.collectionHistoric.countDocuments({ entityId: MongoUtils.oid(id) });
	}

	public async countHistoricSince(entityId: string, historicIdReference?: string): Promise<number> {
		const query: StringMap<any> = {
			entityId: MongoUtils.oid(entityId),
		};
		if (historicIdReference) {
			query['_id'] = {
				$gt: MongoUtils.oid(historicIdReference),
			};
		}
		return await this.collectionHistoric.countDocuments(query);
	}

	public async collectionExists(): Promise<boolean> {
		const collectionName = this.collection.collectionName;
		const collections = await this.db.listCollections({ name: collectionName }).toArray();
		return collections.length === 1;
	}

	public async dropCollection(): Promise<void> {
		await this.collection.drop();
	}

	public async dropHistory(): Promise<void> {
		await this.collectionHistoric.drop();
	}

	/**
	 * Add a tag to an entity.
	 * If the entity already has the tag, this method has no effect.
	 *
	 * @param query the query to select the entity to tag
	 * @param userId id of the user performing the operation
	 * @param options options to customize the tag
	 */
	public async addTagToOne(query: object, userId: string, options: AddTagOptions = {}): Promise<string> {
		options.tag = options.tag || new ObjectId().toHexString();
		const update = this.buildAddTagUpdate(userId, options);
		await this.collection.findOneAndUpdate(
			query,
			update,
			{ returnOriginal: false },
		);
		return options.tag;
	}

	/**
	 * Same as addTagToOne, except the query is made by id.
	 */
	public async addTagToOneById(id: string, userId: string, options: AddTagOptions = {}): Promise<string> {
		return await this.addTagToOne({ _id: MongoUtils.oid(id) }, userId, options);
	}

	/**
	 * Same as addTagToOne, but for many entities
	 */
	public async addTagToMany(query: object, userId: string, options: AddTagOptions = {}): Promise<string> {
		options.tag = options.tag || new ObjectId().toHexString();
		const update = this.buildAddTagUpdate(userId, options);
		await this.collection.updateMany(
			query,
			update,
		);
		return options.tag;
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
	public async removeTagFromOne(query: object, tag: string, userId: string, options: RemoveTagOptions = {}): Promise<void> {
		const update = this.buildRemoveTagUpdate(tag, userId, options);
		await this.collection.findOneAndUpdate(
			query,
			update,
			{ returnOriginal: false },
		);
	}

	/**
	 * Same as removeTagFromOne, except the query is made by id.
	 */
	public async removeTagFromOneById(id: string, tag: string, userId: string, options: RemoveTagOptions = {}): Promise<void> {
		await this.removeTagFromOne({ _id: MongoUtils.oid(id) }, tag, userId, options);
	}

	/**vs
	 * Same as removeTagFromOne, but for many entities
	 */
	public async removeTagFromMany(query: object, tag: string, userId: string, options: RemoveTagOptions = {}): Promise<void> {
		const update = this.buildRemoveTagUpdate(tag, userId, options);
		await this.collection.updateMany(
			query,
			update,
		);
	}

	/**
	 * Delete all entities with the given tag
	 */
	public async deleteManyWithTag(tag: string): Promise<void> {
		await this.collection.deleteMany({ 'objectInfos.tags': tag });
	}

	private async buildUpdatesQueries(
			entities: Partial<U>[],
			userId: string,
			options: UpdateManyAtOnceOptions<U>,
	): Promise<UpdateManyQuery[]> {
		const updates: UpdateManyQuery[] = [];
		for (let entity of entities) {
			let currentValue: U;
			if (options.query) {
				if (_.isString(options.query)) {
					currentValue = await this.findOneByKey(_.get(entity, options.query), options.query);
				} else {
					currentValue = await this.findOne(options.query.call(null, entity));
				}
			}
			if (currentValue) {
				if (!!options.mapFunction) {
					entity = await options.mapFunction(entity, currentValue);
				}
				MongoClient.removeEmptyDeep(entity, false, false, true);

				if (this.conf.lockFields) {
					if (!options.forceEditLockFields) {
						entity = this.pruneEntityWithLockFields(entity, currentValue.objectInfos.lockFields);
						const newEntityMerged = this.mergeOldEntityWithNewOne(entity, currentValue, '', currentValue.objectInfos.lockFields);
						// console.log(`--  newEntityMerged --`, JSON.stringify(newEntityMerged, null, 2));
						delete newEntityMerged.objectInfos;
						delete newEntityMerged._id;

						entity = newEntityMerged;
						// TODO : add function parameter to allow validation here
					}

					if (options.lockNewFields) {
						const lockFields = currentValue.objectInfos.lockFields || [];
						const newLockFields = this.getAllLockFieldsFromEntity(entity, new Date(), userId, currentValue);

						if (!_.isEmpty(newLockFields)) {
							lockFields.push(...newLockFields);
							entity['objectInfos.lockFields'] = lockFields;
						}
					}
				}

				const toSet = _.omit(entity, options.onlyInsertFieldsKey);
				const toSetOnInsert = _.pick(entity, options.onlyInsertFieldsKey);

				let setOnInsert;
				if (!_.isEmpty(toSetOnInsert)) {
					setOnInsert = {
						$setOnInsert: {
							...toSetOnInsert as object,
						},
					};
				}

				// Unset only level 1, other are override by $set on objects
				let unsetQuery;
				if (options.unsetUndefined) {
					const toUnset: object = _.omit(currentValue, [..._.keys(entity), '_id', 'objectInfos']);
					if (!_.isEmpty(toUnset)) {
						unsetQuery = {
							$unset: {
								..._.mapValues(toUnset, () => false),
							},
						};
					}
				}

				const update = {
					$set: {
						...toSet as object,
					},
					...unsetQuery,
					...setOnInsert,
				};

				updates.push({
					id: currentValue._id,
					updateQuery: update,
				});
			} else { // on insert for upsert
				if (!!options.mapFunction) {
					entity = await options.mapFunction(entity);
				}
				MongoClient.removeEmptyDeep(entity);

				const toSet = _.omit(entity, options.onlyInsertFieldsKey);
				const toSetOnInsert = _.pick(entity, options.onlyInsertFieldsKey);

				let setOnInsert;
				if (!_.isEmpty(toSetOnInsert)) {
					setOnInsert = {
						$setOnInsert: {
							...toSetOnInsert as object,
						},
					};
				}

				const update: UpdateManyQuery = {
					updateQuery: {
						$set: {
							...toSet as object,
						},
						...setOnInsert,
					},
				};

				if (options.query) {
					if (_.isString(options.query)) {
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

	private async updateMany(newEntities: UpdateManyQuery[], userId: string, upsert?: boolean): Promise<Cursor<U>> {
		if (_.isEmpty(newEntities)) {
			return await this.getEmptyCursor<U>(this.type);
		}

		const bulkOperations: { updateOne: { filter: StringMap<any>, update: StringMap<any>, upsert?: boolean } } [] = [];
		const now = new Date();
		for (const newEnt of newEntities) {
			const updateQuery = newEnt.updateQuery;
			if (!updateQuery['$set']) {
				updateQuery['$set'] = {};
			}

			updateQuery['$set'] = {
				...updateQuery['$set'] as object,
				'objectInfos.lastUpdate': {
					date: now,
					userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
				},
			};

			if (upsert) {
				updateQuery['$setOnInsert'] = {
					...updateQuery['$setOnInsert'] as object,
					'objectInfos.creation': {
						date: new Date(),
						userId,
					},
				};
			}

			let filter: StringMap<any> = {};

			if (newEnt.id) {
				filter._id = MongoUtils.oid(newEnt.id);
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
					update: updateQuery,
					upsert,
				},
			});
		}
		let oldValuesSaved: StringMap<U>;
		if (this.conf.keepHistoric) {
			oldValuesSaved = _.keyBy(await (await this.findWithType({
				_id: {
					$in: MongoUtils.oids(_.map(newEntities, 'id')),
				},
			}, this.type, 0, _.size(newEntities))).toArray(), '_id');
		}

		// for (const bulkOperation of bulkOperations) {
		// 	console.log(`--  bulkOperation --`);
		// 	console.log(JSON.stringify(bulkOperation, null, 2));
		// 	console.log(`--                --`);
		// }

		const bulkResult = await this.collection.bulkWrite(bulkOperations);
		const newValues: Cursor<U> = await this.findWithType({
			_id: {
				$in: MongoUtils.oids(_.concat(_.map(newEntities, 'id'), _.values(bulkResult.insertedIds), _.values(bulkResult.upsertedIds))),
			},
		}, this.type, 0, _.size(newEntities));

		if (this.conf.keepHistoric) {
			while (await newValues.hasNext()) {
				const newEntity = await newValues.next();
				const oldValueSaved: U = oldValuesSaved[newEntity._id];

				if (oldValueSaved) {
					const diffs = deepDiff.diff(oldValueSaved, newEntity, (path: string[], key: string) => {
						return ['objectInfos.creation', 'objectInfos.lastUpdate'].includes([...path, key].join('.'));
					});
					if (diffs) {
						const change: EntityHistoric<U> = {
							entityId: MongoUtils.oid(newEntity._id) as any,
							date: now,
							userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) as any : userId,
							dataEdited: diffs,
							snapshot: oldValueSaved,
						};
						await this.collectionHistoric.insertOne(change);
					}
				}
			}
			newValues.rewind();
		}
		return newValues;
	}

	private getAllLockFieldsFromEntity(newEntity: Partial<U>, date: Date, userId: string, existingEntity?: U): LockField[] {
		let keys: string[];
		if (existingEntity) {
			const entityWithOnlyNewValues = this.pickOnlyNewValues(existingEntity, newEntity, '');
			// console.log(`-- entityWithOnlyNewValues  --`, JSON.stringify(entityWithOnlyNewValues, null, 2));
			keys = this.generateAllLockFields(entityWithOnlyNewValues, '');
		} else {
			keys = this.generateAllLockFields(newEntity, '');
		}
		if (_.isEmpty(keys)) return;

		const ret: LockField[] = [];
		for (const key of keys) {
			ret.push({
				path: key,
				metaDatas: {
					date,
					userId,
				},
			});
		}
		return ret;
	}

	private generateAllLockFields(newEntity: any, basePath: string, ignoreOnePath?: string): string[] {
		const keys: string[] = [];
		if (_.isNil(newEntity)) return keys;

		for (const key of _.keys(newEntity)) {
			const joinedPath = MongoClient.getJoinPaths(basePath, key);
			// excluded fields
			const newEntityElement = newEntity[key];
			if (key === ignoreOnePath || _.includes(this.conf.lockFields.excludedFields, joinedPath) || _.isNil(newEntityElement)) {
				continue;
			}

			if (MongoClient.isClassicObject(newEntityElement)) {
				// generate a.b.c
				keys.push(...this.generateAllLockFields(newEntityElement, joinedPath));
			} else if (_.isArray(newEntityElement)) {
				// a[b=1]
				if (_.keys(this.conf.lockFields.arrayWithReferences).includes(joinedPath)) {
					const arrayKey = this.conf.lockFields.arrayWithReferences[joinedPath];
					for (const element of newEntityElement) {
						if (!_.isNil(element)) {
							const arrayPath = `${joinedPath}[${arrayKey}=${element[arrayKey]}]`;
							if (_.isNil(element[arrayKey])) {
								throw new N9Error('wrong-array-definition', 400, { newEntity, basePath, ignoreOnePath, arrayPath });
							}
							if (MongoClient.isClassicObject(element)) {
								if (_.isEmpty(_.omit(element, arrayKey))) {
									keys.push(arrayPath);
								} else {
									keys.push(...this.generateAllLockFields(element, arrayPath, arrayKey));
								}
							} else { // TODO: if _.isArray(newEntity[key])
								keys.push(arrayPath);
							}
						}
					}
				} else { // a["elementValue"]
					for (const element of newEntityElement) {
						const arrayPath = `${joinedPath}[${JSON.stringify(element)}]`;
						keys.push(arrayPath);
					}
				}
			} else {
				// a
				keys.push(joinedPath);
			}
		}
		return keys;
	}

	private ifHasLockFieldsThrow(): void {
		if (this.conf.lockFields) {
			throw new N9Error('invalid-function-call', 401, { lockFields: this.conf.lockFields });
		}
	}

	private async getEmptyCursor<X extends U>(type: ClassType<X>): Promise<Cursor<X>> {
		return await this.findWithType<X>({ $and: [{ _id: false }, { _id: true }] }, type, -1, 0);
	}

	private pruneEntityWithLockFields(entity: Partial<U>, lockFields: LockField[]): Partial<U> {
		if (!_.isEmpty(lockFields)) {
			for (const lockField of lockFields) {
				let path = lockField.path;
				if (path.includes('[')) { // path : a.b.c
					path = this.translatePathToLodashPath(path, entity);
				}
				if (path) {
					_.unset(entity, path);
				}
			}
		}
		MongoClient.removeEmptyDeep(entity, true, true, true);
		return entity;
	}

	/**
	 * Convert :
	 * a[b=2]value to a[1].value
	 * @param path
	 * @param entity
	 */
	private translatePathToLodashPath(path: string, entity: Partial<U>): string {
		const objectsArrayPathRegex = /(?<basePath>.*)\[(?<code>[^\]]+)=(?<value>[^\]]+)](?<pathLeft>.*)/;
		const simpleArrayPathRegex = /(?<basePath>.*)\[(?<value>[^\]]+)](?<pathLeft>.*)/;
		const match = path.match(objectsArrayPathRegex);
		const matchSimpleArray = path.match(simpleArrayPathRegex);
		let newPath;
		if (match) {
			const groups = match.groups;
			const array: any[] = _.get(entity, groups.basePath);
			if (!_.isEmpty(array)) {
				const index = array.findIndex((item) => item && item[groups.code] === groups.value);
				if (index !== -1) {
					newPath = `${groups.basePath}[${index}]`;
				} else {
					return;
				}
			}
			if (groups.pathLeft) {
				newPath += this.translatePathToLodashPath(groups.pathLeft, _.get(entity, groups.basePath));
			}
		} else if (matchSimpleArray) {
			const groups = matchSimpleArray.groups;
			const array: any[] = _.get(entity, groups.basePath);
			if (!_.isEmpty(array)) {
				const index = array.findIndex((item) => JSON.stringify(item) === groups.value);
				if (index !== -1) {
					newPath = `${groups.basePath}[${index}]`;
				} else {
					return;
				}
			}
			if (groups.pathLeft) {
				newPath += this.translatePathToLodashPath(groups.pathLeft, _.get(entity, groups.basePath));
			}
		} else {
			return path;
		}
		return newPath;
	}

	private mergeOldEntityWithNewOne(newEntity: any, existingEntity: any, basePath: string, lockFields: LockField[]): any {
		let ret;
		if (MongoClient.isClassicObject(newEntity) && MongoClient.isClassicObject(existingEntity)) {
			const keys = _.uniq([..._.keys(newEntity), ..._.keys(existingEntity)]);
			for (const key of keys) {
				newEntity[key] = this.mergeOldEntityWithNewOne(newEntity[key], existingEntity[key], MongoClient.getJoinPaths(basePath, key), lockFields);
			}
			ret = {
				...existingEntity,
				...newEntity,
			};
		} else if (_.isArray(newEntity) && _.isArray((existingEntity))) {
			if (!_.isEmpty(lockFields) && lockFields.find((lockField) => lockField.path.startsWith(basePath))) {
				// console.log(`--  key --`, basePath, lockFields.find((lockField) => lockField.path.startsWith(basePath)));
				// console.log('--  ', JSON.stringify(existingEntity, null, 1), ` <<-- existingEntity`);
				// console.log('--  ', JSON.stringify(newEntity, null, 1), ` <<-- newEntity`);
				const fieldCodeName = this.conf.lockFields.arrayWithReferences[basePath];
				const mergedArray = [];
				// add existing locked elements
				for (const existingEntityElement of existingEntity) {
					let elementPath;
					if (fieldCodeName) {
						elementPath = `${basePath}[${fieldCodeName}=${existingEntityElement[fieldCodeName]}]`;
					} else {
						elementPath = `${basePath}["${existingEntityElement}"]`;
					}
					const lockFieldForCurrentElement = lockFields.find((lockField) => lockField.path.startsWith(elementPath));
					if (lockFieldForCurrentElement) {
						// push only if existingEntityElement is locked
						mergedArray.push(existingEntityElement);
					}
					// else field not locked
				}

				for (const newEntityElement of newEntity) {
					// merge newEntityElement with associated existingEntityElement
					if (fieldCodeName) { // array of objects
						const elementPath = `${basePath}[${fieldCodeName}=${newEntityElement[fieldCodeName]}]`;
						const alreadyAddedElementIndex = mergedArray.findIndex((mergedArrayElement) => {
							return !_.isNil(mergedArrayElement[fieldCodeName]) && mergedArrayElement[fieldCodeName] === newEntityElement[fieldCodeName];
						});
						if (alreadyAddedElementIndex !== -1) {
							mergedArray[alreadyAddedElementIndex] = this.mergeOldEntityWithNewOne(mergedArray[alreadyAddedElementIndex], newEntityElement, elementPath, lockFields);
						} else {
							mergedArray.push(newEntityElement);
						}
					} else { // array of non objects values
						const elementPath = `${basePath}["${newEntityElement[fieldCodeName]}"]`;
						const alreadyAddedElementIndex = mergedArray.findIndex((mergedArrayElement) => !_.isNil(mergedArrayElement[fieldCodeName]) && mergedArrayElement === newEntityElement);
						if (alreadyAddedElementIndex !== -1) {
							mergedArray[alreadyAddedElementIndex] = this.mergeOldEntityWithNewOne(mergedArray[alreadyAddedElementIndex], newEntityElement, elementPath, lockFields);
						} else {
							mergedArray.push(newEntityElement);
						}
					}
				}
				return mergedArray;
			} else {
				return newEntity;
			}
		} else if (_.isUndefined(newEntity)) {
			ret = existingEntity;
		} else {
			ret = newEntity;
		}
		return ret;
	}

	private pickOnlyNewValues(existingEntity: U | string | number, newEntity: Partial<U> | string | number, basePath: string): Partial<U> | string | number {
		if (_.isEmpty(newEntity)) return;
		const existingEntityKeys = _.keys(existingEntity);
		if (!_.isObject(existingEntity)) {
			if (_.isArray(existingEntity)) {
				throw new N9Error('invalid-type', 400, { existingEntity, newEntity });
			}
			if (existingEntity !== newEntity) return newEntity;
			else return;
		}

		const ret: any = {};
		for (const key of existingEntityKeys) {
			const existingEntityElement = existingEntity[key];
			const currentPath = MongoClient.getJoinPaths(basePath, key);

			if (_.includes(this.conf.lockFields.excludedFields, currentPath)) {
				continue;
			}

			if (MongoClient.isClassicObject(existingEntityElement)) {
				ret[key] = this.pickOnlyNewValues(existingEntityElement, newEntity[key], currentPath);
				if (_.isNil(ret[key])) {
					delete ret[key];
				}
			} else if (_.isArray(existingEntityElement)) {
				ret[key] = this.pickOnlyNewValuesInArray(existingEntityElement, newEntity[key], currentPath);

				if (_.isEmpty(ret[key])) delete ret[key];
			} else {
				let existingEntityElementToCompare = existingEntityElement;
				if (existingEntityElementToCompare instanceof ObjectID) {
					existingEntityElementToCompare = existingEntityElementToCompare.toHexString();
				}

				let newEntityElementToCompare = newEntity[key];
				if (newEntityElementToCompare instanceof ObjectID) {
					newEntityElementToCompare = newEntityElementToCompare.toHexString();
				}

				if (existingEntityElementToCompare !== newEntityElementToCompare && !_.isNil(newEntity[key])) {
					ret[key] = newEntity[key];
				}
			}
		}

		for (const newEntityKey of _.keys(newEntity)) {
			if (!existingEntityKeys.includes(newEntityKey)) {
				ret[newEntityKey] = newEntity[newEntityKey];
			}
		}
		// console.log(`-- pickOnlyNewValues  --`);
		// console.log(JSON.stringify(existingEntity, null, 2));
		// console.log(`-- -- -- -- -- -- -- -- -- --`);
		// console.log(JSON.stringify(newEntity, null, 2));
		// console.log(`-- -- -- -- -- == == == ====>`);
		// console.log(JSON.stringify(ret));
		if (_.isEmpty(ret)) {
			// console.log(`-- return undefined --`);
			return;
		}

		return ret;
	}

	private pickOnlyNewValuesInArray(existingEntityArray: any[], newEntityElement: any[], currentPath: string): any[] {
		const ret = [];
		for (let i = 0; i < Math.max(_.size(existingEntityArray), _.size(newEntityElement)); i++) {
			const existingEntityElementArrayElement = existingEntityArray[i];
			const newValue = this.pickOnlyNewValues(existingEntityElementArrayElement, _.get(newEntityElement, [i]), currentPath);
			const codeKeyName = this.conf.lockFields.arrayWithReferences[currentPath];

			if (!_.isNil(newValue)) {
				if (codeKeyName) {
					newValue[codeKeyName] = _.get(newEntityElement, [i, codeKeyName]);
				}
				ret.push(newValue);
			}
		}

		// If one delete an array element, we lock the others
		if (_.size(existingEntityArray) > _.size(newEntityElement)) {
			for (const newEntityElementArrayElement of newEntityElement) {
				const codeKeyName = this.conf.lockFields.arrayWithReferences[currentPath];

				if (codeKeyName) {
					const existingElementIndex = _.findIndex(ret, { [codeKeyName]: _.get(newEntityElementArrayElement, codeKeyName) });
					if (existingElementIndex === -1) {
						ret.push(newEntityElementArrayElement);
					}
				} else {
					ret.push(newEntityElementArrayElement);
				}
			}
		}
		return ret;
	}

	private async ensureExpirationIndex(collection: Collection, fieldOrSpec: string | object, ttlInDays: number, options: IndexOptions = {}): Promise<void> {
		options.expireAfterSeconds = ttlInDays * 24 * 3600;
		options.name = options.name || 'n9MongoClient_expiration';

		try {
			await collection.createIndex(fieldOrSpec, options);
		} catch (e) {
			// error 85 and 86 mean the index already exists with different parameters / fields
			// 85 means different parameters
			// 86 means different fields
			if (e.code === 85 || e.code === 86) {
				await collection.dropIndex(options.name);
				await collection.createIndex(fieldOrSpec, options);
			} else {
				throw e;
			}
		}
	}

	private buildAddTagUpdate(userId: string, options: AddTagOptions): object {
		const update = { $addToSet: { 'objectInfos.tags': options.tag } };
		const updateLastUpdate = _.isBoolean(options.updateLastUpdate) ? options.updateLastUpdate : true;
		if (updateLastUpdate) {
			update['$set'] = {
				'objectInfos.lastUpdate.date': new Date(),
				'objectInfos.lastUpdate.userId': ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			};
		}
		return update;
	}

	private buildRemoveTagUpdate(tag: string, userId: string, options: RemoveTagOptions): object {
		const update = { $pull: { 'objectInfos.tags': tag } };
		const updateLastUpdate = _.isBoolean(options.updateLastUpdate) ? options.updateLastUpdate : true;
		if (updateLastUpdate) {
			update['$set'] = {
				'objectInfos.lastUpdate.date': new Date(),
				'objectInfos.lastUpdate.userId': ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			};
		}
		return update;
	}
}
