import { N9Log } from '@neo9/n9-node-log';
import { N9Error } from '@neo9/n9-node-utils';
import * as deepDiff from 'deep-diff';
import * as _ from 'lodash';
import { Collection, CollectionInsertManyOptions, Cursor, Db, FilterQuery, IndexOptions, ObjectId, UpdateQuery } from 'mongodb';
import { BaseMongoObject, EntityHistoric, LockField, StringMap, UpdateManyQuery } from './models';
import { ClassType } from './models/class-type.models';
import { MongoUtils } from './mongo';

export interface MongoClientConfiguration {
	keepHistoric?: boolean;
	lockFields?: {
		excludedFields?: string[],
		arrayWithReferences?: StringMap<string>
	};
}

const defaultConfiguration: MongoClientConfiguration = {
	keepHistoric: false,
};

export class MongoClient<U extends BaseMongoObject, L extends BaseMongoObject> {
	public static removeEmptyDeep<T>(obj: T, compactArrays: boolean = false, removeEmptyObjects: boolean = false): T {
		for (const key of Object.keys(obj)) {
			if (compactArrays && _.isArray(obj[key])) {
				obj[key] = _.compact(obj[key]);
			}
			if (removeEmptyObjects && _.isEmpty(obj[key])) {
				delete obj[key];
			}
			// @ts-ignore
			if (obj[key] && typeof obj[key] === 'object') MongoClient.removeEmptyDeep(obj[key]);
			// @ts-ignore
			else if (_.isNil(obj[key])) delete obj[key];
		}
		return obj;
	}

	private readonly logger: N9Log;
	private readonly db: Db;

	private readonly type: ClassType<U>;
	private readonly typeList: ClassType<L>;
	private readonly conf: MongoClientConfiguration;
	private readonly collection: Collection<U>;
	private readonly collectionHistoric: Collection<EntityHistoric<U>>;

	constructor(collection: Collection<U> | string, type: ClassType<U>, typeList: ClassType<L>, conf: MongoClientConfiguration = {}) {
		this.conf = _.merge(defaultConfiguration, conf);
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

	public async initHistoricIndexes(): Promise<void> {
		await this.createHistoricIndex('entityId');
	}

	public async createHistoricIndex(fieldOrSpec: string | any, options?: IndexOptions): Promise<void> {
		await this.collectionHistoric.createIndex(fieldOrSpec, options);
	}

	public async createHistoricUniqueIndex(fieldOrSpec: string | any = 'code'): Promise<void> {
		await this.createHistoricIndex(fieldOrSpec, { unique: true });
	}

	public async insertOne(newEntity: U, userId: string, lockFields: boolean = true): Promise<U> {
		if (!newEntity) return newEntity;

		const date = new Date();
		newEntity.objectInfos = {
			creation: {
				date,
				userId,
			},
		};

		if (this.conf.lockFields) {
			if (!newEntity.objectInfos.lockFields) newEntity.objectInfos.lockFields = [];
			if (lockFields) {
				newEntity.objectInfos.lockFields = this.getAllLockFieldsFromEntity(newEntity, date, userId);
			}
		}

		newEntity = MongoClient.removeEmptyDeep(newEntity);
		await this.collection.insertOne(newEntity);
		return MongoUtils.mapObjectToClass(this.type, newEntity);
	}

	public async count(query: object = {}): Promise<number> {
		return await this.collection.countDocuments(query);
	}

	public async insertMany(newEntities: U[], userId: string, options?: CollectionInsertManyOptions): Promise<U[]> {
		if (_.isEmpty(newEntities)) return;

		const entitiesToInsert = newEntities.map((newEntity) => {
			newEntity.objectInfos = {
				creation: {
					date: new Date(),
					userId,
				},
			};
			return newEntity;
		});

		const insertResult = await this.collection.insertMany(entitiesToInsert, options);
		return (insertResult.ops || []).map((newEntity) => MongoUtils.mapObjectToClass(this.type, newEntity));
	}

	public async findWithType<T extends U>(query: object, type: ClassType<T>, page: number = 0, size: number = 10, sort: object = {}): Promise<Cursor<T>> {
		return this.collection.find<T>(query)
				.sort(sort)
				.skip(page * size)
				.limit(size)
				.map((a: U) => {
					return MongoUtils.mapObjectToClass(type, a);
				});
	}

	public async find(query: object, page: number = 0, size: number = 10, sort: object = {}): Promise<Cursor<L>> {
		return this.findWithType<any>(query, this.typeList, page, size, sort);
	}

	public async findOneById(id: string): Promise<U> {
		return this.findOneByKey(MongoUtils.oid(id), '_id');
	}

	public async findOneByKey(keyValue: any, keyName: string = 'code'): Promise<U> {
		const query: StringMap<any> = {
			[keyName]: keyValue,
		};

		return await this.findOne(query);
	}

	public async findOne(query: object): Promise<U> {
		const entity = await this.collection.findOne(query);
		if (!entity) return null;

		return MongoUtils.mapObjectToClass(this.type, entity);
	}

	public async findOneAndUpdateById(id: string, updateQuery: { [id: string]: object, $set?: object }, userId: string, internalCall: boolean = false): Promise<U> {
		const query: StringMap<any> = {
			_id: MongoUtils.oid(id),
		};
		return await this.findOneAndUpdate(query, updateQuery, userId, internalCall);
	}

	public async findOneAndUpdateByKey(keyValue: any, updateQuery: { [id: string]: object, $set?: object }, userId: string, keyName: string = 'code', internalCall: boolean = false): Promise<U> {
		const query: StringMap<any> = {
			[keyName]: keyValue,
		};
		return await this.findOneAndUpdate(query, updateQuery, userId, internalCall);
	}

	public async findOneAndUpdate(query: FilterQuery<U>, updateQuery: { [id: string]: object, $set?: object }, userId: string, internalCall: boolean = false): Promise<U> {
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

		let saveOldValue;
		if (this.conf.keepHistoric) {
			saveOldValue = await this.findOne(query);
		}

		let newEntity = (await this.collection.findOneAndUpdate(query, updateQuery, { returnOriginal: false })).value as U;
		newEntity = MongoUtils.mapObjectToClass(this.type, newEntity);

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
					snapshot: saveOldValue,
				};
				await this.collectionHistoric.insertOne(change);
			}
		}

		return newEntity;
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
		}, userId, true);
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
			const newEntityWithOnlyDataToUpdate = this.pruneEntityWithLockFields(newEntity, existingEntity.objectInfos.lockFields);

			let newEntityToSave;
			if (!forceEditLockFields) {
				const newEntityMerged = this.mergeOldEntityWithNewOne(newEntity, existingEntity, existingEntity.objectInfos.lockFields);
				newEntityToSave = newEntityMerged;
				// TODO : add function parameter to allow validation here
			} else {
				const newEntityMerged = this.mergeOldEntityWithNewOne(newEntity, existingEntity, []);
				newEntityToSave = newEntityMerged;
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
					updateQuery.$push = {
						'objectInfos.lockFields': {
							$each: allLockFieldsFromEntity,
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

	public async updateManyAtOnce(
			entities: Partial<U>[],
			userId: string,
			upsert: boolean = false,
			lockNewFields: boolean = true,
			query?: string | StringMap<(keyValue: any, entity: Partial<U>, key: string) => any>,
			mapFunction?: (entity: Partial<U>) => Promise<Partial<U>>,
			onlyInsertFieldsKey?: string[],
			forceEditLockFields: boolean = false,
	): Promise<Cursor<U>> {
		const updateQueries = await this.buildUpdatesQueries(
				entities,
				userId,
				lockNewFields,
				query,
				mapFunction,
				onlyInsertFieldsKey,
				forceEditLockFields,
		);
		return await this.updateMany(updateQueries, userId, upsert);
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

	public async findHistoricByEntityId(id: string, page: number = 0, size: number = 10): Promise<Cursor<EntityHistoric<U>>> {
		return await this.collectionHistoric.find<EntityHistoric<U>>({ entityId: MongoUtils.oid(id) })
				.sort('_id', -1)
				.skip(page * size)
				.limit(size)
				.map((a: EntityHistoric<U>) => MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(EntityHistoric, a));
	}

	public async findOneHistoricByUserIdMostRecent(entityId: string, userId: string): Promise<EntityHistoric<U>> {
		const cursor = await this.collectionHistoric
				.find<EntityHistoric<U>>({
					entityId: MongoUtils.oid(entityId),
					userId: ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
				})
				.sort('_id', -1)
				.limit(1)
				.map((a: EntityHistoric<U>) => MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(EntityHistoric, a));
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
				.map((a: EntityHistoric<U>) => MongoUtils.mapObjectToClass<EntityHistoric<U>, EntityHistoric<U>>(EntityHistoric, a));
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

	public async dropCollection(): Promise<void> {
		await this.collection.drop();
	}

	private async buildUpdatesQueries(
			entities: Partial<U>[],
			userId: string,
			lockNewFields: boolean,
			query?: string | StringMap<(keyValue: any, entity: Partial<U>, key: string) => any>,
			mapFunction?: (entity: Partial<U>) => Promise<Partial<U>>,
			onlyInsertFieldsKey?: string[],
			forceEditLockFields?: boolean,
	): Promise<UpdateManyQuery[]> {
		const updates: UpdateManyQuery[] = [];
		for (let entity of entities) {
			let currentValue: U;
			if (query) {
				if (_.isString(query)) {
					currentValue = await this.findOneByKey(_.get(entity, query), query);
				} else {
					currentValue = await this.findOne(_.mapValues(query, (val, key) => val && val.call(null, _.get(entity, key), entity, key)));
				}
			}
			if (currentValue) {
				if (!!mapFunction) {
					entity = await mapFunction(entity);
				}
				MongoClient.removeEmptyDeep(entity);

				if (this.conf.lockFields && !forceEditLockFields) {
					const newEntityWithOnlyDataToUpdate = this.pruneEntityWithLockFields(entity, currentValue.objectInfos.lockFields);
					const newEntityMerged = _.cloneDeep(this.mergeOldEntityWithNewOne(entity, currentValue, currentValue.objectInfos.lockFields));
					delete newEntityMerged.objectInfos;
					delete newEntityMerged._id;

					entity = newEntityMerged;
					// TODO : add function parameter to allow validation here

					if (lockNewFields) {
						const lockFields = currentValue.objectInfos.lockFields || [];
						const newLockFields = this.getAllLockFieldsFromEntity(newEntityWithOnlyDataToUpdate, new Date(), userId, currentValue);
						if (!_.isEmpty(newLockFields)) {
							lockFields.push(...newLockFields);
							entity['objectInfos.lockFields'] = lockFields;
						}
					}
				}

				const toSet = _.omit(entity, onlyInsertFieldsKey);
				const toSetOnInsert = _.pick(entity, onlyInsertFieldsKey);

				let setOnInsert;
				if (!_.isEmpty(toSetOnInsert)) {
					setOnInsert = {
						$setOnInsert: {
							...toSetOnInsert as object,
						},
					};
				}

				const update = {
					$set: {
						...toSet as object,
					},
					...setOnInsert,
				};

				updates.push({
					id: currentValue._id,
					updateQuery: update,
				});
			} else { // on insert for upsert
				if (!!mapFunction) {
					entity = await mapFunction(entity);
				}
				MongoClient.removeEmptyDeep(entity);

				const toSet = _.omit(entity, onlyInsertFieldsKey);
				const toSetOnInsert = _.pick(entity, onlyInsertFieldsKey);

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

				if (query) {
					if (_.isString(query)) {
						update.key = {
							name: query,
							value: _.get(entity, query),
						};
					} else {
						update.query = _.mapValues(query, (val, key) => val && val.call(null, _.get(entity, key), entity, key));
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
			}, this.type)).toArray(), '_id');
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
		}, this.type);

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
			const entityWithOnlyNewValues = this.pickOnlyNewValues(existingEntity, newEntity);
			// console.log(`-- entityWithOnlyNewValues  --`, JSON.stringify(entityWithOnlyNewValues));
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

	private generateAllLockFields(newEntity: any, basePath: string): string[] {
		const keys: string[] = [];
		if (_.isNil(newEntity)) return keys;

		for (const key of _.keys(newEntity)) {
			const joinedPath = this.getJoinPaths(basePath, key);

			// excluded fields
			if (_.includes(this.conf.lockFields.excludedFields, joinedPath) || _.isNil(newEntity[key])) {
				continue;
			}

			if (_.isPlainObject(newEntity[key])) {
				// generate a.b.c
				keys.push(...this.generateAllLockFields(newEntity[key], joinedPath));
			} else if (_.isArray(newEntity[key])) {
				// a[b=1]
				if (_.keys(this.conf.lockFields.arrayWithReferences).includes(joinedPath)) {
					const arrayKey = this.conf.lockFields.arrayWithReferences[joinedPath];
					for (const element of newEntity[key]) {
						const arrayPath = `${joinedPath}[${arrayKey}=${element[arrayKey]}]`;
						if (_.isPlainObject(newEntity[key])) {
							keys.push(...this.generateAllLockFields(newEntity[key], joinedPath));
						} else { // TODO: if _.isArray(newEntity[key])
							keys.push(arrayPath);
						}
					}
				} else { // a[1]
					for (const element of newEntity[key]) {
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

	private getJoinPaths(basePath: string, key: string): string {
		if (basePath) return basePath + '.' + key;
		else return key;
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
		MongoClient.removeEmptyDeep(entity, true, true);
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
				}
			}
			if (groups.pathLeft) {
				newPath += this.translatePathToLodashPath(groups.pathLeft, _.get(entity, groups.basePath));
			}
		}
		return newPath;
	}

	private mergeOldEntityWithNewOne(newEntity: Partial<U>, existingEntity: U, lockFields: LockField[]): U {
		return _.mergeWith({}, existingEntity, newEntity, (objValue, srcValue, key) => {
			if (_.isArray(objValue)) {
				if (!_.isEmpty(lockFields) && lockFields.find((lockField) => lockField.path.includes(key))) {
					return objValue.concat(srcValue);
				} else {
					return srcValue;
				}
			}
		});
	}

	private pickOnlyNewValues(existingEntity: U | string | number, newEntity: Partial<U> | string | number): Partial<U> | string | number {
		if (_.isEmpty(newEntity)) return;
		const existingEntityKeys = _.keys(existingEntity);
		if (!_.isObject(existingEntity)) {
			if (_.isArray(existingEntity)) {
				throw new N9Error('invalid-type', 400, { existingEntity, newEntity });
			}
			if (existingEntity !== newEntity) return newEntity;
			else return;
		}

		const ret = {};
		for (const key of existingEntityKeys) {
			const existingEntityElement = existingEntity[key];
			if (_.isObject(existingEntityElement) && !_.isArray(existingEntityElement)) {
				ret[key] = this.pickOnlyNewValues(existingEntityElement, newEntity[key]);
				if (_.isNil(ret[key])) {
					delete ret[key];
				}
			} else if (_.isArray(existingEntityElement)) {
				ret[key] = [];
				for (let i = 0; i < existingEntityElement.length; i++) {
					const existingEntityElementArrayElement = existingEntityElement[i];
					const newValue = this.pickOnlyNewValues(existingEntityElementArrayElement, _.get(newEntity, [key, i]));
					if (!_.isNil(newValue)) ret[key][i] = newValue;
				}
				if (_.isEmpty(ret[key])) delete ret[key];
			} else {
				if (existingEntityElement !== newEntity[key] && !_.isEmpty(newEntity[key])) {
					ret[key] = newEntity[key];
				}
			}
		}
		// console.log(`-- pickOnlyNewValues  --`);
		// console.log(JSON.stringify(existingEntity));
		// console.log(`-- -- -- -- -- -- -- -- -- --`);
		// console.log(JSON.stringify(newEntity));
		if (_.isEmpty(ret)) return;
		// console.log(`-- -- -- -- -- == == == ====>`);
		// console.log(JSON.stringify(ret));

		return ret;
	}
}
