import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject, EntityHistoric } from '../../src/models';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
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

test('[CRUD] Insert one and find it', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0);

	const randomInt = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
	await mongoClient.insertOne({
		field1String: 'string1',
		field2Number: randomInt,
	}, 'userId1');

	const sizeWithElementIn = await mongoClient.count();
	const foundObject = await mongoClient.findOne({ field1String: 'string1' });
	const foundObjectById = await mongoClient.findOneById(foundObject._id);
	const foundObjectByKey = await mongoClient.findOneByKey('string1', 'field1String');

	t.truthy(foundObject, 'found by query');
	t.is(sizeWithElementIn, 1, 'nb element in collection');
	t.is(foundObject.field2Number, randomInt, 'found right element');
	t.is(typeof foundObject._id, 'string', 'ID is a string and not ObjectID');
	t.is(foundObject._id.constructor, String, 'ID is a string and not ObjectID');
	t.truthy(foundObjectById, 'found by ID');
	t.truthy(foundObjectByKey, 'found by key');

	await mongoClient.dropCollection();
});

// TODO: Test insert object like { 'a.b': 'c' } for elasticsearch error
// TODO: Test history in collection
