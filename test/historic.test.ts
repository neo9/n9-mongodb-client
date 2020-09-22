import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';

import * as _ from 'lodash';
import { Db } from 'mongodb';
import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
}

global.log = new N9Log('tests');

init();

ava('Create wrong configuration mongodb client', async (t: Assertions) => {
	const db = global.db;
	delete global.db;
	t.throws(
		() =>
			new MongoClient(`test-${Date.now()}`, SampleType, SampleTypeListing, {
				keepHistoric: true,
			}),
		{
			message: 'missing-db',
		},
		'missing-db',
	);
	global.db = db;
});

ava('[CRUD] Insert one update it and remove it', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleTypeListing, {
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	const initialValue = {
		field1String: 'string1',
		field2Number: intValue,
	};
	const insertedDocument = await mongoClient.insertOne(initialValue, 'userId1');

	const foundObjectById = await mongoClient.findOneById(insertedDocument._id);

	t.truthy(foundObjectById, 'found by ID');

	let historicLength = await mongoClient.countHistoricByEntityId(insertedDocument._id);
	t.is(historicLength, 0, 'not historic stored for only one insert');

	// update with same value
	await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		{
			$set: {
				field1String: 'string1',
				field2Number: intValue,
			},
		},
		'userId1',
	);

	historicLength = await mongoClient.countHistoricByEntityId(insertedDocument._id);
	t.is(historicLength, 0, 'not historic stored for only one update with no change');

	// update with same value
	await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		{
			$set: {
				field1String: 'string2',
				field2Number: intValue,
			},
		},
		'userId1',
	);

	historicLength = await mongoClient.countHistoricByEntityId(insertedDocument._id);
	t.is(historicLength, 1, 'historic stored for last update');

	const historic = await (await mongoClient.findHistoricByEntityId(insertedDocument._id)).toArray();
	t.deepEqual(
		_.omit(historic[0].snapshot, ['_id', 'objectInfos.lastModification', 'objectInfos.lastUpdate']),
		_.omit(initialValue, ['_id', 'objectInfos.lastModification', 'objectInfos.lastUpdate']),
		'historic store the previous value',
	);

	const historicSinceLength = await mongoClient.countHistoricSince(
		insertedDocument._id,
		historic[0]._id,
	);
	t.is(historicSinceLength, 0, 'not historic after last');

	await mongoClient.deleteOneById(insertedDocument._id);
	historicLength = await mongoClient.countHistoricByEntityId(insertedDocument._id);
	t.is(historicLength, 1, 'historic is keept after deletion');

	await mongoClient.dropCollection();
});

ava('Check historic drop', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();
	await mongoClient.insertOne(
		{
			field1String: 'test',
			field2Number: 1,
		},
		'test',
	);

	let collections = (await (global.db as Db).collections()).map((c) => c.collectionName);
	let foundCollection = collections.includes(collectionName);
	t.truthy(foundCollection, 'collection exists');
	foundCollection = collections.includes(`${collectionName}Historic`);
	t.truthy(foundCollection, 'collection historic exists');

	await mongoClient.dropCollection();

	collections = (await (global.db as Db).collections()).map((c) => c.collectionName);
	foundCollection = collections.includes(collectionName);
	t.falsy(foundCollection, "collection doesn't exists anymore");
	foundCollection = collections.includes(`${collectionName}Historic`);
	t.falsy(foundCollection, "collection historic doesn't exists anymore");
});

ava('Check historic drop 2', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();
	await mongoClient.insertOne(
		{
			field1String: 'test',
			field2Number: 1,
		},
		'test',
	);

	let collections = (await (global.db as Db).collections()).map((c) => c.collectionName);
	let foundCollection = collections.includes(collectionName);
	t.truthy(foundCollection, 'collection exists');
	foundCollection = collections.includes(`${collectionName}Historic`);
	t.truthy(foundCollection, 'collection historic exists');

	await mongoClient.dropCollection(false);
	await mongoClient.dropHistory();

	collections = (await (global.db as Db).collections()).map((c) => c.collectionName);
	foundCollection = collections.includes(collectionName);
	t.falsy(foundCollection, "collection doesn't exists anymore");
	foundCollection = collections.includes(`${collectionName}Historic`);
	t.falsy(foundCollection, "collection historic doesn't exists anymore");
});

ava('Check historic indexes', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();

	const collections = await (global.db as Db).collections();
	const historicCollection = collections.find(
		(collection) => collection.collectionName === `${collectionName}Historic`,
	);
	t.truthy(historicCollection, 'collection exists');

	let indexExists = await historicCollection.indexExists('entityId_1');
	t.true(indexExists, 'entityId index exists');

	await mongoClient.createHistoricUniqueIndex('test-unique-index');

	indexExists = await historicCollection.indexExists('test-unique-index_1');
	const index = (await historicCollection.listIndexes().toArray()).find(
		(i) => i.name === 'test-unique-index_1',
	);
	t.true(indexExists, 'unique index exists');
	t.is(index.unique, true, 'unique index is unique');

	await mongoClient.dropHistoryIndex('test-unique-index_1');
	indexExists = await historicCollection.indexExists('test-unique-index_1');
	t.false(indexExists, "unique index doesn't exists");

	await mongoClient.dropCollection();
});
