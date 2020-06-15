import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

global.log = new N9Log('tests').module('issues');

class PrimitiveArrayHolder extends BaseMongoObject {
	public booleanArray: boolean[];
	public numberArray: number[];
	public stringArray: string[];
}

let mongod: MongoMemoryServer;

ava.before(async () => {
	mongod = new MongoMemoryServer();
	const uri = await mongod.getConnectionString();
	await MongoUtils.connect(uri);
});

ava.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
	await mongod.stop();
});

ava(
	'[ISSUE-INVALID-PRIMITIVE-VALUE] Primitive should be mapped correctly',
	async (t: Assertions) => {
		const mongoClient = new MongoClient(
			`test-${Date.now()}`,
			PrimitiveArrayHolder,
			PrimitiveArrayHolder,
		);

		const initialValue: PrimitiveArrayHolder = {
			booleanArray: [true, false],
			numberArray: [42, 3.14],
			stringArray: ['xxx', 'yyy'],
		};

		const savedObject = await mongoClient.insertOne(_.cloneDeep(initialValue), 'userId1', false);
		const foundObject = await mongoClient.findOneById(savedObject._id);

		t.deepEqual(savedObject.booleanArray, initialValue.booleanArray);
		t.deepEqual(savedObject.numberArray, initialValue.numberArray);
		t.deepEqual(savedObject.stringArray, initialValue.stringArray);

		t.deepEqual(foundObject.booleanArray, initialValue.booleanArray);
		t.deepEqual(foundObject.numberArray, initialValue.numberArray);
		t.deepEqual(foundObject.stringArray, initialValue.stringArray);

		await mongoClient.dropCollection();
	},
);
