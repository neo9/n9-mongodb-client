import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as mongodb from 'mongodb';
import * as _ from 'lodash';

import { MongoClient, MongoUtils } from '../../../src';
import { BaseMongoObject } from '../../../src/models';

global.log = new N9Log('tests').module('issues');

class PrimitiveArrayHolder extends BaseMongoObject {
	public booleanArray: boolean[];
	public numberArray: number[];
	public stringArray: string[];
}

test.before(async () => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[ISSUE-INVALID-PRIMITIVE-VALUE] Primitive should be mapped correctly', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), PrimitiveArrayHolder, PrimitiveArrayHolder);

	const initialValue: PrimitiveArrayHolder = {
		booleanArray: [true, false],
		numberArray: [42, 3.14],
		stringArray: ["xxx", "yyy"]
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
});
