import { N9Log } from '@neo9/n9-node-log';
import { N9Error } from '@neo9/n9-node-utils';
import * as fastDeepEqual from 'fast-deep-equal/es6';
import * as _ from 'lodash';
import * as mingo from 'mingo-fork-no-hash';
import {
	AggregationCursor,
	BulkWriteOperation,
	ClientSession,
	CollationDocument,
	Collection,
	CollectionAggregationOptions,
	CollectionInsertManyOptions,
	Cursor,
	Db,
	FilterQuery,
	IndexOptions,
	IndexSpecification,
	MatchKeysAndValues,
	MongoClient as MongodbClient,
	ObjectId,
	OptionalId,
	UpdateQuery,
} from 'mongodb';
import { PromisePoolExecutor } from 'promise-pool-executor';

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
import { MongoClientUpdateManyOptions } from './models/update-many-options.models';
import { UpdateManyToSameValueOptions } from './models/update-many-to-same-value-options.models';
import { MongoReadStream } from './mongo-read-stream';
import { MongoUtils } from './mongo-utils';
import { TagManager } from './tag-manager';

const defaultConfiguration: MongoClientConfiguration = {
	keepHistoric: false,
	historicPageSize: 100,
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
		if (this.conf.keepHistoric) {
			this.conf.updateOnlyOnChange = { ...this.conf.updateOnlyOnChange };
		}
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

	public async renameCollection(
		newName: string,
		dropTarget: boolean = false,
		options?: { session?: ClientSession },
	): Promise<MongoClient<U, L>> {
		await this.collection.rename(newName, { ...options, dropTarget });
		return new MongoClient<U, L>(newName, this.type, this.typeList, this.conf);
	}

	public async findAllIndexes(): Promise<IndexSpecification[]> {
		return await this.indexManager.findAllIndexes();
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
		await this.indexManager.createIndex({ 'objectInfos.tags': 1 }, { sparse: true });
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
		try {
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
					newEntityWithoutForbiddenCharacters.objectInfos.lockFields =
						this.lockFieldsManager.getAllLockFieldsFromEntity(
							newEntityWithoutForbiddenCharacters,
							date,
							userId,
						);
				}
			}

			newEntityWithoutForbiddenCharacters = LangUtils.removeEmptyDeep(
				newEntityWithoutForbiddenCharacters,
				true,
				undefined,
				!!this.conf.lockFields,
			);
			await this.collection.insertOne(newEntityWithoutForbiddenCharacters as OptionalId<U>);
			if (returnNewValue) {
				return MongoUtils.mapObjectToClass(
					this.type,
					MongoUtils.unRemoveSpecialCharactersInKeys(newEntityWithoutForbiddenCharacters),
				);
			}
			return;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { newEntity, userId, lockFields, returnNewValue });
		}
	}

	public async count(query: object = {}): Promise<number> {
		try {
			return await this.collection.countDocuments(query);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { query });
		}
	}

	public async insertMany(
		newEntities: U[],
		userId: string,
		options?: CollectionInsertManyOptions,
		returnNewValue: boolean = true,
	): Promise<U[]> {
		try {
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
				if (newEntity._id) {
					this.logger.warn(
						`Trying to set _id field to ${newEntity._id} (${newEntity._id.constructor.name})`,
					);
					delete newEntity._id;
				}
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
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { count: newEntities?.length });
		}
	}

	public findWithType<T extends Partial<U | L>>(
		query: object,
		type: ClassType<T>,
		page: number = 0,
		size: number = 10,
		sort: object = {},
		projection: object = {},
		collation?: CollationDocument,
	): Cursor<T> {
		let findCursor: Cursor<U> = this.collection.find(query);

		if (collation) {
			findCursor = findCursor.collation(collation);
		}

		let transformFunction: (a: Partial<U | L>) => any;
		if (type) {
			transformFunction = (a: Partial<U | L>): T => {
				const b = MongoUtils.unRemoveSpecialCharactersInKeys(a);
				return MongoUtils.mapObjectToClass(type, b);
			};
		} else if (
			LodashReplacerUtils.IS_NIL(type) &&
			!LodashReplacerUtils.IS_OBJECT_EMPTY(projection)
		) {
			transformFunction = this.mapEntityFromMongoWithoutClassTransformer;
		} else {
			throw new N9Error('type or projection is required', 400, {
				query,
				collectionName: this.collection.collectionName,
			});
		}

		return findCursor
			.sort(sort)
			.skip(page * size)
			.limit(size)
			.project(projection)
			.map<T>(transformFunction);
	}

	public stream(
		query: object,
		pageSize: number,
		projection: object = {},
		hint?: string | object,
	): MongoReadStream<Partial<U>, Partial<L>> | MongoReadStream<U, L> {
		return new MongoReadStream<U, L>(this, query, pageSize, projection, undefined, hint);
	}

	public streamWithType<T extends Partial<U | L>>(
		query: object,
		type: ClassType<T>,
		pageSize: number,
		projection: object = {},
		hint?: string | object,
	): MongoReadStream<Partial<U>, Partial<L>> | MongoReadStream<U, L> {
		return new MongoReadStream<U, L>(this, query, pageSize, projection, type, hint);
	}

	public find(
		query: object,
		page: number = 0,
		size: number = 10,
		sort: object = {},
		projection: object = {},
		collation?: CollationDocument,
	): Cursor<L> {
		return this.findWithType<L>(query, this.typeList, page, size, sort, projection, collation);
	}

	public async findOneById(id: string, projection?: object): Promise<U> {
		return this.findOneByKey(MongoUtils.oid(id), '_id', projection);
	}

	public async findOneByKey(
		keyValue: any,
		keyName: string = 'code',
		projection?: object,
	): Promise<U> {
		try {
			const query: StringMap<any> = {
				[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
			};

			return await this.findOne(query, projection);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { keyValue, keyName, projection });
		}
	}

	public async findOne(query: object, projection?: object): Promise<U> {
		try {
			const internalEntity = await this.collection.findOne(query, { projection });
			if (!internalEntity) return null;
			const entity = MongoUtils.unRemoveSpecialCharactersInKeys(internalEntity);
			return MongoUtils.mapObjectToClass(this.type, entity);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { query, projection });
		}
	}

	public async existsById(id: string): Promise<boolean> {
		return this.existsByKey(MongoUtils.oid(id), '_id');
	}

	public async existsByKey(keyValue: any, keyName: string = 'code'): Promise<boolean> {
		try {
			const query: StringMap<any> = {
				[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
			};

			return await this.exists(query);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { keyValue, keyName });
		}
	}

	public async exists(query: object): Promise<boolean> {
		try {
			const found = await this.collection.findOne<U>(query, { projection: { _id: 1 } });
			return !!found;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { query });
		}
	}

	public async findOneAndUpdateById(
		id: string,
		updateQuery: UpdateQuery<U>,
		userId: string,
		internalCall: boolean = false,
		returnNewValue: boolean = true,
		arrayFilters: FilterQuery<U>[] = [],
	): Promise<U> {
		try {
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
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				id,
				updateQuery,
				userId,
				internalCall,
				returnNewValue,
				arrayFilters,
			});
		}
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
		try {
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
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				keyValue,
				updateQuery,
				userId,
				keyName,
				internalCall,
				returnNewValue,
				arrayFilters,
			});
		}
	}

	/**
	 * To upsert you should use findOneAndUpsert
	 *
	 * @param query The selection criteria for the update. The same query selectors as in the find() method are available.
	 * @param updateQuery The update document
	 * @param userId user identifier
	 * @param internalCall activate the lock field management.
	 * @param upsert Optional. When true, findOneAndUpdate() either:<ul><li>Creates a new document
	 * if no documents match the filter. For more details see upsert behavior. Returns null after
	 * inserting the new document, unless returnNewDocument is true.</li><li>Updates a single
	 * document that matches the filter.</li></ul><br/>To avoid multiple upserts, ensure that the
	 * filter fields are uniquely indexed.<br/> Defaults to false.
	 * @param returnNewValue Optional. When true, returns the updated document instead of the
	 * original document.<br/> Defaults to true.
	 * @param arrayFilters Optional. An array of filter documents that determine which array
	 * elements to modify for an update operation on an array field. <br/> In the update document,
	 * use the $[<identifier>] filtered positional operator to define an identifier, which you then
	 * reference in the array filter documents. You cannot have an array filter document for an
	 * identifier if the identifier is not included in the update document.
	 * @returns U
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
		try {
			if (!internalCall) {
				this.ifHasLockFieldsThrow();
			}

			if (!updateQuery.$set) {
				updateQuery.$set = {};
			}

			const now = new Date();
			const formattedUserId = (
				ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId
			) as string;

			updateQuery.$set = {
				...updateQuery.$set,
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
					...updateQuery.$setOnInsert,
					'objectInfos.creation': {
						date: now,
						userId: formattedUserId,
					},
				} as any;

				if (updateQuery.$set._id) {
					this.logger.warn(
						`Trying to set _id field to ${updateQuery.$set._id} (${updateQuery.$set._id.constructor.name})`,
					);
					delete (updateQuery.$set as any)._id;
				}

				if (this.conf.updateOnlyOnChange) {
					(updateQuery.$setOnInsert as any)['objectInfos.lastModification'] = {
						date: now,
						userId: formattedUserId,
					};
				}
			}

			let snapshot;
			if (this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
				snapshot = await this.findOne(query);
			}

			let newEntity = (
				await this.collection.findOneAndUpdate(query, updateQuery, {
					upsert,
					arrayFilters,
					returnOriginal: !returnNewValue,
				})
			).value;
			if (returnNewValue || this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
				newEntity = MongoUtils.mapObjectToClass(
					this.type,
					MongoUtils.unRemoveSpecialCharactersInKeys(newEntity),
				);
			}

			if (this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
				if (snapshot && !this.historicManager.areValuesEquals(snapshot, newEntity)) {
					if (this.conf.keepHistoric) {
						await this.historicManager.insertOne(newEntity._id, snapshot, now, userId);
					}
					if (this.conf.updateOnlyOnChange) {
						const newUpdate = await this.updateLastModificationDate(
							snapshot,
							newEntity,
							now,
							userId,
						);

						if (returnNewValue && newUpdate) {
							newEntity = MongoUtils.mapObjectToClass(
								this.type,
								MongoUtils.unRemoveSpecialCharactersInKeys(newUpdate),
							);
						}
					}
				}
			}
			if (returnNewValue) return newEntity;
			return;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				query,
				updateQuery,
				userId,
				internalCall,
				upsert,
				returnNewValue,
				arrayFilters,
			});
		}
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
		try {
			const query: FilterQuery<any> = {
				_id: MongoUtils.oid(id),
			};
			return await this.findOneAndRemoveLock(query, lockFieldPath, userId);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { id, lockFieldPath, userId });
		}
	}

	public async findOneByKeyAndRemoveLock(
		keyValue: any,
		lockFieldPath: string,
		userId: string,
		keyName: string = 'code',
	): Promise<U> {
		try {
			const query: FilterQuery<any> = {
				[keyName]: keyValue,
			};
			return await this.findOneAndRemoveLock(query, lockFieldPath, userId);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				keyValue,
				lockFieldPath,
				userId,
				keyName,
			});
		}
	}

	public async findOneByIdAndRemoveLockSubparts(
		id: string,
		baseLockFieldPath: string,
		userId: string,
	): Promise<U> {
		try {
			const query: FilterQuery<any> = {
				_id: MongoUtils.oid(id),
			};
			return await this.findOneAndRemoveLock(query, baseLockFieldPath, userId, true);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { id, baseLockFieldPath, userId });
		}
	}

	public async findOneByKeyAndRemoveLockSubparts(
		keyValue: any,
		baseLockFieldPath: string,
		userId: string,
		keyName: string = 'code',
	): Promise<U> {
		try {
			const query: FilterQuery<any> = {
				[keyName]: keyValue,
			};
			return await this.findOneAndRemoveLock(query, baseLockFieldPath, userId, true);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				keyValue,
				baseLockFieldPath,
				userId,
				keyName,
			});
		}
	}

	public async findOneAndRemoveLock(
		query: FilterQuery<U>,
		lockFieldPath: string,
		userId: string,
		removeSubParts: boolean = false,
	): Promise<U> {
		try {
			if (!this.conf.lockFields) {
				throw new N9Error('invalid-function-call', 500, {
					query,
					lockFieldPath,
					removeSubParts,
					name: 'findOneAndRemoveLock',
				});
			}

			const path = removeSubParts ? { $regex: `^${_.escapeRegExp(lockFieldPath)}` } : lockFieldPath;

			return await this.findOneAndUpdate(
				query,
				{
					$pull: {
						'objectInfos.lockFields': {
							path,
						},
					},
				} as any as UpdateQuery<U>,
				userId,
				true,
				false,
				true,
			);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				query,
				lockFieldPath,
				userId,
				removeSubParts,
			});
		}
	}

	public async findOneAndUpdateByIdWithLocks(
		id: string,
		newEntity: Partial<U>,
		userId: string,
		lockNewFields: boolean = true,
		forceEditLockFields: boolean = false,
	): Promise<U> {
		try {
			LangUtils.removeEmptyDeep(newEntity, true, false, true);
			if (this.conf.lockFields) {
				const existingEntity = await this.collection.findOne<U>({ _id: MongoUtils.oid(id) as any }); // avoid mapping ObjectId to string
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
							if (
								!existingEntity.objectInfos.lockFields?.find((lf) => lf.path === lockField.path)
							) {
								lockFields.push(lockField);
							}
						}

						updateQuery.$push = {
							'objectInfos.lockFields': {
								$each: lockFields,
							},
						} as any;
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

			if (lockNewFields) {
				throw new N9Error('can-t-lock-fields-with-disabled-feature', 400, { lockNewFields });
			}

			delete newEntity._id;
			delete newEntity.objectInfos;
			return await this.findOneAndUpdateById(id, { $set: newEntity }, userId, true);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				id,
				newEntity,
				userId,
				lockNewFields,
				forceEditLockFields,
			});
		}
	}

	public async deleteOneById(id: string): Promise<U> {
		return this.deleteOneByKey(MongoUtils.oid(id), '_id');
	}

	public async deleteOneByKey(keyValue: any, keyName: string = 'code'): Promise<U> {
		try {
			const query: StringMap<any> = {
				[MongoUtils.escapeSpecialCharacters(keyName)]: keyValue,
			};

			return await this.deleteOne(query);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { keyValue, keyName });
		}
	}

	public async deleteOne(query: object): Promise<U> {
		try {
			const entity = await this.findOne(query);
			await this.collection.deleteOne(query);
			return entity;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { query });
		}
	}

	public async deleteMany(query: object): Promise<void> {
		try {
			await this.collection.deleteMany(query);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { query });
		}
	}

	/**
	 * Update multiple entities in one update. The update will be performed through a bulkWrite.
	 * This function doesn't support dot key notation yet.
	 *
	 * @param entities list of entities to update
	 * @param userId id of the user that is performing the operation. Will be stored in objectInfos.
	 * @param options see UpdateManyAtOnceOptions for more details
	 * @returns Cursor<U>
	 */
	public async updateManyAtOnce(
		entities: Partial<U>[],
		userId: string,
		options: UpdateManyAtOnceOptions<U> = {},
	): Promise<Cursor<U>> {
		try {
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
			options.returnNewEntities = LodashReplacerUtils.IS_BOOLEAN(options.returnNewEntities)
				? options.returnNewEntities
				: true;
			options.pool = {
				...options.pool,
				nbMaxConcurency: options.pool?.nbMaxConcurency ?? 1,
			};
			const updateQueries = await this.buildUpdatesQueries(entities, userId, options);
			// console.log(`-- client.ts>updateManyAtOnce updateQueries --`, JSON.stringify(updateQueries, null, 2));
			return await this.updateMany(
				updateQueries,
				userId,
				options.upsert,
				options.returnNewEntities,
			);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { userId, options });
		}
	}

	public async updateManyToSameValue(
		query: FilterQuery<U>,
		updateQuery: UpdateQuery<U>,
		userId: string,
		options: UpdateManyToSameValueOptions = {},
	): Promise<{ matchedCount: number; modifiedCount: number }> {
		try {
			if (!options.ignoreLockFields) {
				this.ifHasLockFieldsThrow();
			}

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
				...updateQuery.$set,
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
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				query,
				updateQuery,
				userId,
				options,
			});
		}
	}

	/**
	 * Do an aggregation on mongodb, use it carefully
	 *
	 * @param aggregateSteps steps of the aggregation
	 * @param options options to send to the client
	 * @param readInOutputCollection to read in the main mongoClient collection
	 * @returns AggregationCursor<T>
	 */
	public aggregate<T = void>(
		aggregateSteps: object[],
		options?: CollectionAggregationOptions,
		readInOutputCollection: boolean = false,
	): AggregationCursor<T> {
		if (readInOutputCollection) {
			return this.collection.aggregate<T>(aggregateSteps, options);
		}
		return this.collectionSourceForAggregation.aggregate<T>(aggregateSteps, options);
	}

	public aggregateWithBuilder<T = void>(
		aggregationBuilder: AggregationBuilder<U>,
		options?: CollectionAggregationOptions,
		readInOutputCollection: boolean = false,
	): AggregationCursor<T> {
		return this.aggregate<T>(aggregationBuilder.build(), options, readInOutputCollection);
	}

	public newAggregationBuilder(): AggregationBuilder<U> {
		return new AggregationBuilder<U>(this.collection.collectionName);
	}

	/**
	 * Function to get the id of every `rangeSize` entity. The ids are sort asc.
	 *
	 * @param rangeSize Step size between ids
	 * @param query Filter query to target only some entities
	 * @param options Object to specify options, to get the index of each id for instance.
	 * @returns Array of _id and value
	 */
	public async findIdsEveryNthEntities(
		rangeSize: number,
		query: FilterQuery<U> = {},
		options: {
			returnRangeIndex?: boolean;
		} = {},
	): Promise<{ _id: string; value?: number }[]> {
		try {
			if (rangeSize < 1) {
				throw new N9Error('range-size-should-be-greater-than-1', 500, { rangeSize });
			}
			let lastId: ObjectId;
			let pageNb = 0;
			const results: { _id: string; value?: number }[] = [];

			do {
				let cursor: Cursor<BaseMongoObject>;
				if (!lastId) {
					cursor = this.collection.find(query).project({ _id: 1 }).sort({ _id: 1 }).limit(1);
				} else {
					cursor = this.collection
						.find({
							...query,
							_id: { $gt: MongoUtils.oid(lastId) },
						})
						.project({ _id: 1 })
						.sort({ _id: 1 })
						.skip(rangeSize - 1)
						.limit(1);
				}
				if (await cursor.hasNext()) {
					lastId = (await cursor.next())._id as unknown as ObjectId;
					const range: { _id: string; value?: number } = {
						_id: lastId.toHexString(),
					};
					if (options.returnRangeIndex) range.value = pageNb * rangeSize;
					results.push(range);
				} else {
					return results;
				}

				pageNb += 1;
			} while (lastId);
			return results;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				rangeSize,
				query,
			});
		}
	}

	public async findHistoricByEntityId(
		entityId: string,
		page: number = 0,
		size: number = 10,
	): Promise<Cursor<EntityHistoric<U>>> {
		const latestEntityVersion: U = await this.findOneById(entityId);
		return this.historicManager.findByEntityId(entityId, latestEntityVersion, page, size);
	}

	public async findOneHistoricByUserIdMostRecent(
		entityId: string,
		userId: string,
	): Promise<EntityHistoric<U>> {
		const latestEntityVersion: U = await this.findOneById(entityId);
		return await this.historicManager.findOneByUserIdMostRecent(
			entityId,
			userId,
			latestEntityVersion,
		);
	}

	public async countHistoricByEntityId(id: string): Promise<number> {
		return await this.historicManager.countByEntityId(id);
	}

	public async countHistoricSince(entityId: string, historicIdReference?: string): Promise<number> {
		return await this.historicManager.countSince(entityId, historicIdReference);
	}

	public async collectionExists(): Promise<boolean> {
		const { collectionName }: { collectionName: string } = this.collection;
		const collections = await this.db.listCollections({ name: collectionName }).toArray();
		return collections.length === 1;
	}

	public async dropCollection(
		dropHistoryIfExists: boolean = true,
		throwIfNotExists: boolean = false,
	): Promise<void> {
		try {
			if (dropHistoryIfExists && this.conf.keepHistoric) {
				await this.dropHistory();
			}
			try {
				if (throwIfNotExists || (await this.collectionExists())) {
					await this.collection.drop();
				}
			} catch (e) {
				throw new N9Error('mongodb-drop-collection-error', 500, { srcError: e });
			}
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				dropHistoryIfExists,
				throwIfNotExists,
			});
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
	 * @returns New tag
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
	 *
	 * @param id
	 * @param userId
	 * @param options
	 * @returns New tag
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
	 *
	 * @param query
	 * @param userId
	 * @param options
	 * @returns New tag
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
	 *
	 *  @param id
	 * @param tag
	 * @param userId
	 * @param options
	 */
	public async removeTagFromOneById(
		id: string,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		await this.tagManager.removeTagFromOneById(id, tag, userId, options);
	}

	/**
	 * Same as removeTagFromOne, but for many entities
	 *
	 * @param query
	 * @param tag
	 * @param userId
	 * @param options
	 */
	public async removeTagFromMany(
		query: object,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		await this.tagManager.removeTagFromMany(query, tag, userId, options);
	}

	/**
	 * Delete all entities with the given tag
	 *
	 *  @param tag
	 */
	public async deleteManyWithTag(tag: string): Promise<void> {
		await this.tagManager.deleteManyWithTag(tag);
	}

	/**
	 * Function to run multiple updateOne queries as bulk.
	 * Prefer usage of {@link updateManyAtOnce} that build queries for you.
	 *
	 * @param newEntities information to run queries
	 * @param userId userId that do the change
	 * @param upsert upsert values or not
	 * @param returnNewEntities return new values or not
	 * @param options options to use
	 * @returns Cursor<U>
	 */
	public async updateMany(
		newEntities: UpdateManyQuery<U>[],
		userId: string,
		upsert?: boolean,
		returnNewEntities: boolean = true,
		options: MongoClientUpdateManyOptions = {},
	): Promise<Cursor<U>> {
		try {
			if (LodashReplacerUtils.IS_ARRAY_EMPTY(newEntities)) {
				return this.getEmptyCursor<U>(this.type);
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
					...updateQuery.$set,
					'objectInfos.lastUpdate': {
						date: now,
						userId: formattedUserId,
					},
				};

				if (!this.conf.updateOnlyOnChange && !options.updateLastModificationDateOnlyOnInsert) {
					(updateQuery.$set as any)['objectInfos.lastModification'] = {
						date: now,
						userId: formattedUserId,
					};
				}
				if (updateQuery.$set._id) {
					this.logger.warn(
						`Trying to set _id field to ${updateQuery.$set._id} (${updateQuery.$set._id.constructor.name})`,
					);
					delete (updateQuery.$set as any)._id;
				}

				if (upsert) {
					updateQuery.$setOnInsert = {
						...updateQuery.$setOnInsert,
						'objectInfos.creation': {
							userId,
							date: now,
						},
					};
					if (this.conf.updateOnlyOnChange || options.updateLastModificationDateOnlyOnInsert) {
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
				const oldValues = await this.findWithType(
					{
						_id: {
							$in: MongoUtils.oids(newEntities.map((newEntity) => newEntity.id)),
						},
					},
					this.type,
					0,
					newEntities.length,
				).toArray();
				oldValuesSaved = _.keyBy<U>(oldValues, '_id');
			}

			// for (const bulkOperation of bulkOperations) {
			// 	console.log(`--  bulkOperation --`);
			// 	console.log(JSON.stringify(bulkOperation));
			// 	console.log(`--                --`);
			// }

			const bulkResult = await this.collection.bulkWrite(bulkOperations);

			if (returnNewEntities) {
				const newValuesQuery = {
					_id: {
						$in: MongoUtils.oids([
							...newEntities.map((newEntity) => newEntity.id),
							...(Object.values(bulkResult.insertedIds ?? {}) as string[]),
							...(Object.values(bulkResult.upsertedIds ?? {}) as string[]),
						]),
					},
				};

				if (this.conf.keepHistoric || this.conf.updateOnlyOnChange) {
					const newValuesStream = this.streamWithType(
						newValuesQuery,
						this.type,
						this.conf.historicPageSize,
					);

					await newValuesStream.forEachPage(async (newValuesEntities: U[]) => {
						const modifications: { snapshot: U; newEntity: U }[] = [];

						for (const newEntity of newValuesEntities) {
							const snapshot: U = oldValuesSaved[newEntity._id];

							if (snapshot) {
								if (!this.historicManager.areValuesEquals(snapshot, newEntity)) {
									modifications.push({
										snapshot,
										newEntity,
									});
								}
							}
						}
						if (this.conf.keepHistoric) {
							await this.historicManager.insertMany(
								modifications.map((modification) => modification.snapshot),
								now,
								userId,
							);
						}

						if (this.conf.updateOnlyOnChange) {
							await this.updateLastModificationDateBulk(modifications, now, userId);
						}
					});
				}
				return this.findWithType(newValuesQuery, this.type, 0, newEntities?.length);
			}
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
				userId,
				upsert,
				returnNewEntities,
				options,
				newEntities,
			});
		}
	}

	private async buildUpdatesQueries(
		entities: MatchKeysAndValues<U>[],
		userId: string,
		options: UpdateManyAtOnceOptions<U>,
	): Promise<UpdateManyQuery<U>[]> {
		const updates: UpdateManyQuery<U>[] = [];
		if (LodashReplacerUtils.IS_ARRAY_EMPTY(entities)) return updates;

		let now: Date;
		if (options.lockNewFields) now = new Date();

		const currentValues: StringMap<U> = {};

		if (options.query) {
			if (LodashReplacerUtils.IS_STRING(options.query)) {
				const queries: StringMap<number> = {};
				const values: any[] = [];
				for (const [index, entity] of entities.entries()) {
					if (!_.isNil(entity[options.query])) {
						queries[entity[options.query].toString()] = index;
						values.push(entity[options.query]);
					} else {
						throw new N9Error('entity-value-missing', 404, { entity, index, query: options.query });
					}
				}
				const allEntities: U[] = (await this.collection
					.find({
						[options.query]: {
							$in: values,
						},
					} as any)
					.toArray()) as any;
				for (const entity of allEntities) {
					currentValues[queries[entity[options.query]]] = entity;
				}
				// for (const [index, entity] of entities.entries()) {
				// 	currentValues[index] = await this.findOneByKey(entity[options.query], options.query);
				// }
			} else {
				const queries: FilterQuery<Partial<U>>[] = [];
				for (const entity of entities) {
					queries.push(options.query.call(null, entity));
				}
				const allEntities = await this.findWithType(
					{
						$or: queries,
					},
					this.type,
					0,
					0,
				).toArray();
				for (const [index, query] of Object.entries(queries)) {
					// mingo all use to find in the array like mongo search in collection
					const matchElements = mingo.find(allEntities, MongoUtils.mapObjectIdToStringHex(query));
					if (matchElements.hasNext()) {
						currentValues[index] = matchElements.next();
					}
					// else the entity is not in the bd, will do an insert with upsert true
				}
				// for (const [index, entity] of entities.entries()) {
				// 	currentValues[index] = await this.findOne(options.query.call(null, entity));
				// }
			}
		}

		const pool =
			options.pool.executor ??
			new PromisePoolExecutor({
				concurrencyLimit: options.pool.nbMaxConcurency,
			});

		await pool
			.addEachTask({
				data: entities,
				generator: async (entity: MatchKeysAndValues<U>, index: number): Promise<void> => {
					const update = await this.buildUpdateQuery(
						entity,
						currentValues[index],
						options,
						now,
						userId,
					);
					if (update) {
						updates.push(update);
					}
				},
			})
			.promise();

		return updates;
	}

	private async buildUpdateQuery(
		entity: MatchKeysAndValues<U>,
		currentValue: U,
		options: UpdateManyAtOnceOptions<U>,
		now: Date,
		userId: string,
	): Promise<UpdateManyQuery<U>> {
		let updateManyQuery: UpdateManyQuery<U>;
		let updateEntity = entity;

		if (options.mapFunction) {
			updateEntity = await options.mapFunction(updateEntity, currentValue);
		}

		if (currentValue) {
			LangUtils.removeEmptyDeep(updateEntity, false, false, true);

			if (this.conf.lockFields) {
				if (!options.forceEditLockFields) {
					updateEntity = this.lockFieldsManager.pruneEntityWithLockFields(
						updateEntity,
						currentValue.objectInfos.lockFields,
					);
					const newEntityMerged = this.lockFieldsManager.mergeOldEntityWithNewOne(
						updateEntity,
						currentValue,
						'',
						currentValue.objectInfos.lockFields,
					);
					// console.log(`--  newEntityMerged --`, JSON.stringify(newEntityMerged, null, 2));
					delete newEntityMerged.objectInfos;
					delete newEntityMerged._id;

					updateEntity = newEntityMerged;
				}

				if (options.lockNewFields) {
					const lockFields = currentValue.objectInfos.lockFields || [];
					const newLockFields = this.lockFieldsManager.getAllLockFieldsFromEntity(
						updateEntity,
						now,
						userId,
						currentValue,
					);

					delete (updateEntity as any)?.objectInfos;
					if (!LodashReplacerUtils.IS_ARRAY_EMPTY(newLockFields)) {
						lockFields.push(...newLockFields);
					}
					if (options.forceEditLockFields && options.unsetUndefined) {
						// we can delete lock fields only if we change there values
						const newLockFieldsCleaned = this.lockFieldsManager.cleanObsoleteLockFields(
							lockFields,
							updateEntity,
						);
						if (
							!(
								LodashReplacerUtils.IS_ARRAY_EMPTY(newLockFieldsCleaned) &&
								LodashReplacerUtils.IS_ARRAY_EMPTY(currentValue.objectInfos.lockFields)
							)
						) {
							(updateEntity as any)['objectInfos.lockFields'] = newLockFieldsCleaned;
						}
					} else if (!LodashReplacerUtils.IS_ARRAY_EMPTY(newLockFields)) {
						(updateEntity as any)['objectInfos.lockFields'] = lockFields;
					}
				}
			}

			if (options.hooks?.mapAfterLockFieldsApplied) {
				const mappedEntity = await options.hooks.mapAfterLockFieldsApplied({
					...updateEntity,
					_id: currentValue._id,
				});
				if (!mappedEntity) return;

				delete mappedEntity._id;

				updateEntity = mappedEntity;
			}

			const toSet = LodashReplacerUtils.OMIT_PROPERTIES(updateEntity, options.onlyInsertFieldsKey);
			const toSetOnInsert = LodashReplacerUtils.PICK_PROPERTIES(
				updateEntity,
				options.onlyInsertFieldsKey,
			);

			let setOnInsert;
			if (!LodashReplacerUtils.IS_OBJECT_EMPTY(toSetOnInsert)) {
				setOnInsert = {
					$setOnInsert: {
						...toSetOnInsert,
					},
				};
			}

			// Unset only level 1, other are override by $set on objects
			let unsetQuery;
			if (options.unsetUndefined) {
				const toUnset: object = LodashReplacerUtils.OMIT_PROPERTIES(currentValue, [
					..._.keys(updateEntity),
					'_id',
					'objectInfos',
				]);
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
					...toSet,
				},
				...unsetQuery,
				...setOnInsert,
			};

			updateManyQuery = {
				id: currentValue._id,
				updateQuery: update,
			};
		} else {
			if (options.hooks?.mapAfterLockFieldsApplied) {
				updateEntity = await options.hooks.mapAfterLockFieldsApplied(updateEntity);
				if (!updateEntity) return;
			}

			LangUtils.removeEmptyDeep(updateEntity, undefined, undefined, !!this.conf.lockFields); // keep null values for lockfields

			const toSet = LodashReplacerUtils.OMIT_PROPERTIES(updateEntity, options.onlyInsertFieldsKey);
			const toSetOnInsert = LodashReplacerUtils.PICK_PROPERTIES(
				updateEntity,
				options.onlyInsertFieldsKey,
			);

			let setOnInsert;
			if (!LodashReplacerUtils.IS_OBJECT_EMPTY(toSetOnInsert)) {
				setOnInsert = {
					$setOnInsert: {
						...toSetOnInsert,
					},
				};
			}

			updateManyQuery = {
				updateQuery: {
					$set: {
						...toSet,
					},
					...setOnInsert,
				},
			};

			if (options.query) {
				if (LodashReplacerUtils.IS_STRING(options.query)) {
					updateManyQuery.key = {
						name: options.query,
						value: updateEntity[options.query],
					};
				} else {
					updateManyQuery.query = options.query.call(null, updateEntity);
				}
			}
		}

		return updateManyQuery;
	}

	private ifHasLockFieldsThrow(): void {
		if (this.conf.lockFields) {
			throw new N9Error('invalid-function-call', 401, { lockFields: this.conf.lockFields });
		}
	}

	private getEmptyCursor<X extends U>(type: ClassType<X>): Cursor<X> {
		return this.findWithType<X>({ $and: [{ _id: false }, { _id: true }] }, type, -1, 0);
	}

	private async updateLastModificationDate(
		snapshot: U,
		newEntity: U,
		updateDate: Date,
		userId: string,
	): Promise<U> {
		// if no change were detected, don't update lastModification
		if (this.areEntitiesEqualToUpdateOnlyOnChange(snapshot, newEntity)) {
			return newEntity;
		}

		const updateResult = await this.collection.findOneAndUpdate(
			{ _id: MongoUtils.oid(newEntity._id) as any },
			{
				$set: {
					'objectInfos.lastModification': {
						date: updateDate,
						userId: (ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId) as string,
					},
				} as any,
			},
			{
				returnOriginal: false,
			},
		);
		return updateResult.value;
	}

	private async updateLastModificationDateBulk(
		modifications: { snapshot: U; newEntity: U }[],
		updateDate: Date,
		userId: string,
	): Promise<void> {
		const idsToUpdate: string[] = [];

		for (const modification of modifications) {
			if (
				!this.areEntitiesEqualToUpdateOnlyOnChange(modification.snapshot, modification.newEntity)
			) {
				idsToUpdate.push(modification.newEntity._id);
			}
		}

		if (LodashReplacerUtils.IS_ARRAY_EMPTY(idsToUpdate)) return;

		await this.collection.updateMany(
			{ _id: { $in: MongoUtils.oids(idsToUpdate) as any[] } },
			{
				$set: {
					'objectInfos.lastModification': {
						date: updateDate,
						userId: (ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId) as string,
					},
				} as any,
			},
		);
	}

	private areEntitiesEqualToUpdateOnlyOnChange(snapshot: U, newEntity: U): boolean {
		// determine if the document has changed
		// if omit is not empty, field names must not be in omit to be taken into account
		// if pick is not empty, field names must be in pick to be taken into account
		const pickPaths = this.conf.updateOnlyOnChange?.changeFilters?.pick;
		const omitPaths = !pickPaths?.length
			? this.conf.updateOnlyOnChange?.changeFilters?.omit
			: undefined;

		let snapshotOmitted: Partial<U> = { ...snapshot };
		let newEntityOmitted: Partial<U> = { ...newEntity };
		if (snapshotOmitted.objectInfos) {
			snapshotOmitted.objectInfos = { ...snapshotOmitted.objectInfos };
			delete snapshotOmitted.objectInfos.creation;
			delete snapshotOmitted.objectInfos.lastUpdate;
			delete snapshotOmitted.objectInfos.lastModification;
		}

		if (newEntityOmitted.objectInfos) {
			newEntityOmitted.objectInfos = { ...newEntityOmitted.objectInfos };
			delete newEntityOmitted.objectInfos.creation;
			delete newEntityOmitted.objectInfos.lastUpdate;
			delete newEntityOmitted.objectInfos.lastModification;
		}
		if (omitPaths) {
			snapshotOmitted = _.omit(snapshotOmitted, omitPaths);
			newEntityOmitted = _.omit(newEntityOmitted, omitPaths);
		}

		let snapshotFiltered: Partial<U>;
		let newEntityFiltered: Partial<U>;
		if (pickPaths) {
			snapshotFiltered = _.pick(snapshotOmitted, pickPaths);
			newEntityFiltered = _.pick(newEntityOmitted, pickPaths);
		} else {
			snapshotFiltered = snapshotOmitted;
			newEntityFiltered = newEntityOmitted;
		}

		return fastDeepEqual(snapshotFiltered, newEntityFiltered);
	}

	// Method is not static to use U and L
	// eslint-disable-next-line class-methods-use-this
	private mapEntityFromMongoWithoutClassTransformer(entity: Partial<U | L>): U {
		return MongoUtils.unRemoveSpecialCharactersInKeys(entity);
	}
}
