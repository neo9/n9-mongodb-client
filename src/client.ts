import { N9Log } from '@neo9/n9-node-log';
import { N9Error } from '@neo9/n9-node-utils';
import * as deepDiff from 'deep-diff';
import * as _ from 'lodash';
import { Collection, CollectionInsertManyOptions, Cursor, Db, FilterQuery, IndexOptions, ObjectId, UpdateQuery } from 'mongodb';
import { BaseMongoObject, EntityHistoric, StringMap, UpdateManyQuery } from './models';
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

	public static removeEmptyDeep<T>(obj: T): T {
		Object.keys(obj).forEach((key) => {
			// @ts-ignore
			if (obj[key] && typeof obj[key] === 'object') this.removeEmptyDeep(obj[key]);
			// @ts-ignore
			else if (_.isNil(obj[key])) delete obj[key];
		});
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
			this.conf.lockFields.excludedFields = _.union(this.conf.lockFields.excludedFields, ['objectInfos']);
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

	public async insertOne(newEntity: U, userId: string): Promise<U> {
		if (!newEntity) return newEntity;

		const date = new Date();
		newEntity.objectInfos = {
			creation: {
				date,
				userId,
			},
		};

		if (this.conf.lockFields) {
			const keys = this.generateAllLockFields(newEntity, '');
			if (!_.isEmpty(keys)) {
				if (!newEntity.objectInfos.lockFields) newEntity.objectInfos.lockFields = [];
				for (const key of keys) {
					newEntity.objectInfos.lockFields.push({
						path: key,
						metaDatas: {
							date,
							userId,
						},
					});
				}
			}
			// for (const key of keys) {
			// 	console.log('>> ' + key);
			// }
		}

		newEntity = MongoClient.removeEmptyDeep(newEntity);
		await this.collection.insertOne(newEntity);
		return MongoUtils.mapObjectToClass(this.type, newEntity);
	}

	public async count(query: object = {}): Promise<number> {
		return await this.collection.countDocuments(query);
	}

	public async insertMany(newEntities: U[], userId: string, options?: CollectionInsertManyOptions): Promise<number> {
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
		return insertResult.insertedCount;
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

	public async findOneAndUpdateById(id: string, updateQuery: { [id: string]: object, $set?: object }, userId: string): Promise<U> {
		return await this.findOneAndUpdate({ _id: MongoUtils.oid(id) }, updateQuery, userId);
	}

	public async findOneAndUpdateByKey(keyValue: any, updateQuery: { [id: string]: object, $set?: object }, userId: string, keyName: string = 'code'): Promise<U> {
		const query: StringMap<any> = {
			[keyName]: keyValue,
		};
		return await this.findOneAndUpdate(query, updateQuery, userId);
	}

	public async findOneAndUpdate(query: FilterQuery<U>, updateQuery: { [id: string]: object, $set?: object }, userId: string): Promise<U> {
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
				return _.get(path, '0', key) === 'objectInfos';
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

	public async updateManyToSameValue(query: FilterQuery<U>, updateQuery: UpdateQuery<U>, userId: string): Promise<Cursor<U>> {
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

	public async updateMany(newEntities: UpdateManyQuery[], userId: string, upsert?: boolean): Promise<Cursor<U>> {
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
			if (!updateQuery['$setOnInsert']) {
				updateQuery['$setOnInsert'] = {};
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
						return _.get(path, '0', key) === 'objectInfos';
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

	public async buildUpdatesQueries(
			entities: Partial<U>[],
			userId: string,
			query?: string | StringMap<(keyValue: any, entity: Partial<U>, key: string) => any>,
			mapFunction?: (entity: Partial<U>) => Promise<Partial<U>>,
			onlyInsertFieldsKey?: string[],
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

				const toSet = _.omit(entity, onlyInsertFieldsKey);
				const toSetOnInsert = _.pick(entity, onlyInsertFieldsKey);

				const update = {
					$set: {
						...toSet as object,
					},
					$setOnInsert: {
						...toSetOnInsert as object,
					},
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

				const update: UpdateManyQuery = {
					updateQuery: {
						$set: {
							...toSet as object,
						},
						$setOnInsert: {
							...toSetOnInsert as object,
						},
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

	public async dropCollection(): Promise<void> {
		await this.collection.drop();
	}

	private generateAllLockFields(newEntity: any, basePath: string): string[] {
		const keys: string[] = [];
		if (_.isNil(newEntity)) return keys;

		for (const key of Object.keys(newEntity)) {
			const joinedPaths = this.getJoinPaths(basePath, key);

			// excluded fields
			if (_.includes(this.conf.lockFields.excludedFields, joinedPaths)) {
				continue;
			}

			if (_.isPlainObject(newEntity[key])) {
				// generate a.b.c
				keys.push(...this.generateAllLockFields(newEntity[key], joinedPaths));
			} else if (_.isArray(newEntity[key])) {
				// a[b=1]
				if (_.keys(this.conf.lockFields.arrayWithReferences).includes(joinedPaths)) {
					const arrayKey = this.conf.lockFields.arrayWithReferences[joinedPaths];
					for (const element of newEntity[key]) {
						const arrayPath = `${joinedPaths}[${arrayKey}=${element[arrayKey]}]`;
						if (_.isPlainObject(newEntity[key])) {
							keys.push(...this.generateAllLockFields(newEntity[key], joinedPaths));
						} else { // TODO: if _.isArray(newEntity[key])
							keys.push(arrayPath);
						}
					}
				} else { // a[1]
					for (const element of newEntity[key]) {
						const arrayPath = `${joinedPaths}[${JSON.stringify(element)}]`;
						keys.push(arrayPath);
					}
				}
			} else {
				// a
				keys.push(joinedPaths);
			}
		}
		return keys;
	}

	private getJoinPaths(basePath: string, key: string): string {
		if (basePath) return basePath + '.' + key;
		else return key;
	}

	private removeEmpty<T>(obj: T): T {
		Object.keys(obj).forEach((key) => {
			// @ts-ignore
			if (obj[key] && typeof obj[key] === 'object') this.removeEmpty(obj[key]);
			// @ts-ignore
			else if (_.isNil(obj[key])) delete obj[key];
		});
		return obj;
	}

	private async getEmptyCursor<X extends U>(type: ClassType<X>): Promise<Cursor<X>> {
		return await this.findWithType<X>({ $and: [{ _id: false }, { _id: true }] }, type, -1, 0);
	}
}
