import { default as ava } from 'ava';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject, StringMap } from '../../src/models';

export class ArrayElement {
	public code: string;
	public label: StringMap<string>;
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

export function generateMongoClient(): MongoClient<SampleEntityWithArray, null> {
	const collectionName = `test-${Math.ceil(Math.random() * 10000)}-${Date.now()}`;
	return new MongoClient(collectionName, SampleEntityWithArray, null, {
		lockFields: {
			arrayWithReferences: {
				'parameters.items': 'code',
			},
			excludedFields: ['code'],
		},
		keepHistoric: true,
	});
}

export function init(): void {
	let mongod: MongoMemoryServer;
	let isInMemory: boolean;

	ava.before(async () => {
		let mongoConnectionString;
		try {
			await MongoUtils.connect('mongodb://127.0.0.1:27017', {});
			global.log.warn(`Using local MongoDB`);
		} catch (e) {
			if (e.name === 'MongoNetworkError') {
				global.log.warn(`Using MongoDB in memory`);
				isInMemory = true;
				// no classic mongodb available, so use one in memory
				mongod = new MongoMemoryServer({
					binary: {
						version: '4.2.12',
					},
				});
				mongoConnectionString = await mongod.getUri();
				await MongoUtils.connect(mongoConnectionString);
			} else {
				throw e;
			}
		}
	});

	ava.after(async () => {
		if (isInMemory) {
			global.log.info(`DROP DB after tests OK`);
			if (global.db) {
				await (global.db as mongodb.Db).dropDatabase();
				await MongoUtils.disconnect();
			}
			await mongod.stop();
		}
	});
}
