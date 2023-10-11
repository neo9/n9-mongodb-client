import { N9Log } from '@neo9/n9-node-log';
import test, { ExecutionContext } from 'ava';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { BaseMongoObject, MongoUtils, N9MongoDBClient, StringMap } from '../../src';
import * as mongodb from '../../src/mongodb';

export const print = true;

export interface TestContext {
	db: mongodb.Db;
	mongodbClient: mongodb.MongoClient;
	logger: N9Log;
}
export class ArrayElement {
	public code: string;
	public otherCode?: string;
	public label?: StringMap<string>;
	public value?: string | number | boolean;
}

export class SampleEntityWithArray extends BaseMongoObject {
	public code: string;
	public parameters: {
		items: ArrayElement[];
	};
}

export class SampleEntityWithSimpleArray extends BaseMongoObject {
	public code: string;
	public parameters: {
		items: string[];
	};
}
export function getOneCollectionName(prefix: string = 'test'): string {
	return `${prefix}-${Math.round(Math.random() * 100000)}${Date.now()}`;
}

export function getBaseMongoClientSettings(t: ExecutionContext<TestContext>): {
	logger: N9Log;
	db: mongodb.Db;
} {
	return {
		logger: t.context.logger,
		db: t.context.db,
	};
}

export function generateMongoClient(
	t: ExecutionContext<TestContext>,
): N9MongoDBClient<SampleEntityWithArray, null> {
	return new N9MongoDBClient(getOneCollectionName(), SampleEntityWithArray, null, {
		...getBaseMongoClientSettings(t),
		lockFields: {
			arrayWithReferences: {
				'parameters.items': ['code', 'otherCode'],
			},
			excludedFields: ['code'],
		},
		keepHistoric: true,
	});
}

export function generateMongoClientForSimpleArray(
	t: ExecutionContext<TestContext>,
): N9MongoDBClient<SampleEntityWithSimpleArray, null> {
	return new N9MongoDBClient(getOneCollectionName(), SampleEntityWithSimpleArray, null, {
		...getBaseMongoClientSettings(t),
		lockFields: {
			arrayWithReferences: {
				'parameters.items': [],
			},
			excludedFields: ['code'],
		},
		keepHistoric: true,
	});
}

export interface InitOptions {
	avoidToStartMongodb?: boolean;
}

export function init(initOptions?: InitOptions): void {
	let mongod: MongoMemoryServer;
	let isInMemory: boolean;

	test.before(async (t: ExecutionContext<TestContext>) => {
		const logger = new N9Log('test-logger', { formatJSON: false });
		t.context.logger = logger;
		if (!initOptions?.avoidToStartMongodb) {
			let mongoConnectionString: string;
			try {
				const { db, mongodbClient } = await MongoUtils.CONNECT('mongodb://127.0.0.1:27017', {
					logger,
					nativeDriverOptions: {
						serverSelectionTimeoutMS: 650, // 650ms, default is 30000ms
					},
				});
				logger.warn(`Using local MongoDB`);
				t.context.db = db;
				t.context.mongodbClient = mongodbClient;
			} catch (err) {
				if (err.name === 'MongoServerSelectionError') {
					logger.warn(`Using MongoDB in memory`);
					isInMemory = true;

					// no classic mongodb available, so use one in memory
					mongod = await MongoMemoryServer.create({
						binary: {
							version: '6.0.4',
						},
					});

					mongoConnectionString = mongod.getUri();
					const { db, mongodbClient } = await MongoUtils.CONNECT(mongoConnectionString, {
						logger,
					});
					t.context.db = db;
					t.context.mongodbClient = mongodbClient;
				} else {
					throw err;
				}
			}
		}
	});

	test.after(async (t: ExecutionContext<TestContext>) => {
		if (isInMemory) {
			t.context.logger.info(`DROP DB after tests OK`);
			if (t.context.db) {
				await t.context.db.dropDatabase();
				await MongoUtils.DISCONNECT(t.context.mongodbClient, t.context.logger);
			}
			await mongod.stop();
			delete t.context.mongodbClient;
		}
	});
}
