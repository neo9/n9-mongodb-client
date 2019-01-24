import test from 'ava';
import { TestInterface } from 'ava';
import * as mongodb from 'mongodb';
import { MongoClient, MongoUtils } from '../../../src';
import { BaseMongoObject, StringMap } from '../../../src/models';

export class ArrayElement {
	public code: string;
	public label: StringMap<string>;
}

export class SampleEntityWithArray extends BaseMongoObject {
	public parameters: {
		items: ArrayElement[]
	};
}

export function generateMongoClient(): MongoClient<SampleEntityWithArray, null> {
	const collectionName = 'test-' + Math.ceil(Math.random() * 10000)  + '-' + Date.now();
	return new MongoClient(collectionName, SampleEntityWithArray, null, {
		lockFields: {
			arrayWithReferences: {
				'parameters.items': 'code',
			},
		},
		keepHistoric: true,
	});
}

export function init(tst: TestInterface): void {
	test.before(async () => {
		await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
	});

	test.after(async () => {
		global.log.info(`DROP DB after tests OK`);
		await (global.db as mongodb.Db).dropDatabase();
		await MongoUtils.disconnect();
	});
}
