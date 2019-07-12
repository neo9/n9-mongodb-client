import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as mongodb from 'mongodb';
import { AggregationCursor } from 'mongodb';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

class SampleType extends BaseMongoObject {
	public test: string;
}

global.log = new N9Log('tests');

test.before(async () => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[EXISTS] Create collection and test existence', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);

	await mongoClient.insertOne({ test: 'test' }, 'userId1');

	t.true(await mongoClient.collectionExists(), 'collection exists');

	await mongoClient.dropCollection();
});

test('[EXISTS] Do not create collection and test existence', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);

	t.false(await mongoClient.collectionExists(), 'collection does not exist');
});

test('[EXISTS] Create collection then drop it then test existence', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);

	await mongoClient.insertOne({ test: 'test' }, 'userId1');
	await mongoClient.dropCollection();

	t.false(await mongoClient.collectionExists(), 'collection does not exist');

	await t.throwsAsync(async () => {
		await mongoClient.dropCollection();
	}, 'ns not found', 'should throw not found exception');
});
