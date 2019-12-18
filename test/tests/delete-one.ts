import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

global.log = new N9Log('tests').module('issues');

let mongod: MongoMemoryServer;

test.before(async () => {
	mongod = new MongoMemoryServer();
	const uri = await mongod.getConnectionString();
	await MongoUtils.connect(uri);
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
	await mongod.stop();
});

test('[DELETE-ONE] Delete one by id', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), BaseMongoObject, BaseMongoObject);

	const initialValue: any = {
		key: 'value'
	};

	const savedObject = await mongoClient.insertOne(initialValue, 'userId1', false);

	const foundObject = await mongoClient.findOneById(savedObject._id);
	t.truthy(foundObject, 'found by query');
	t.is(await mongoClient.count({}), 1, 'collection contains 1 element');

	const deletedElement = await mongoClient.deleteOneById(savedObject._id);
	t.is(await mongoClient.count({}), 0, 'collection contains 0 element');
	t.is<string>(deletedElement._id, savedObject._id, 'deleted element ID is same as the created one');

	await mongoClient.dropCollection();
});
