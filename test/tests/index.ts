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
	public field3String?: string;
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

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	await mongoClient.insertOne({
		field1String: 'string1',
		field2Number: intValue,
	}, 'userId1');

	const sizeWithElementIn = await mongoClient.count();
	const foundObject = await mongoClient.findOne({ field1String: 'string1' });
	const foundObjectById = await mongoClient.findOneById(foundObject._id);
	const foundObjectByKey = await mongoClient.findOneByKey('string1', 'field1String');

	t.truthy(foundObject, 'found by query');
	t.is(sizeWithElementIn, 1, 'nb element in collection');
	t.is(foundObject.field2Number, intValue, 'found right element');
	t.is(typeof foundObject._id, 'string', 'ID is a string and not ObjectID');
	t.is(foundObject._id.constructor, String, 'ID is a string and not ObjectID');
	t.truthy(foundObjectById, 'found by ID');
	t.truthy(foundObjectByKey, 'found by key');

	await mongoClient.dropCollection();
});

test('[CRUD] Find one and update', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	const intValue2 = 42;

	await mongoClient.insertOne({
		field1String: 'string1',
		field2Number: intValue,
	}, 'userId1');
	const sizeAfterInsert = await mongoClient.count();

	const updateQuery = { $set: { field2Number: intValue2 }};

	const founded = await mongoClient.findOneAndUpdate({
			field1String: 'string1',
			field2Number: intValue,
		}, updateQuery, 'userId');

	let sizeAfterUpdate = await mongoClient.count();

	t.is(founded.field2Number, updateQuery.$set.field2Number, 'Element has been updated');
	t.is(sizeAfterUpdate, sizeAfterInsert, 'No new element added');

	const notFound = await mongoClient.findOneAndUpdate({
		field1String: 'string1',
		field2Number: intValue,	// the value is now intValue2
	}, updateQuery, 'userId');
	sizeAfterUpdate = await mongoClient.count();

	t.true(!notFound && (sizeAfterUpdate === sizeAfterInsert), 'No element updated or created');

	await mongoClient.dropCollection();
});

test('[CRUD] Find one and upsert', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	const intValue2 = 42;

	await mongoClient.insertOne({
		field1String: 'string1',
		field2Number: intValue,
	}, 'userId1');
	const sizeAfterInsert = await mongoClient.count();

	const updateQuery = { $set: { field2Number: intValue2 }};

	const founded = await mongoClient.findOneAndUpsert({
			field1String: 'string1',
			field2Number: intValue,
		}, updateQuery, 'userId');
	const sizeAfterUpdate = await mongoClient.count();

	t.is(founded.field2Number, updateQuery.$set.field2Number, 'Element has been updated');
	t.is(sizeAfterUpdate, sizeAfterInsert, 'No new element added');

	const upserted = await mongoClient.findOneAndUpsert({
		field1String: 'string3',
	}, updateQuery, 'userId');
	const sizeAfterUpsert = await mongoClient.count();

	t.is(sizeAfterUpsert, sizeAfterUpdate + 1, 'A new element has been created');
	t.true((upserted.field2Number === updateQuery.$set.field2Number) && upserted.field1String === 'string3', 'Element has been created with updated value');

	await mongoClient.dropCollection();
});

// TODO: Test insert object like { 'a.b': 'c' } for elasticsearch error
// TODO: Test history in collection
