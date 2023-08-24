import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import { Db } from 'mongodb';

import { MongoClient, MongoUtils } from '../src';
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

test('Create wrong configuration mongodb client', (t: Assertions) => {
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

test('[CRUD] Insert one update it and remove it', async (t: Assertions) => {
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
	t.deepEqual(
		JSON.parse(JSON.stringify(historic[0].dataEdited[0])),
		{
			kind: 'E',
			path: ['field1String'],
			lhs: 'string1',
			rhs: 'string2',
		},
		'historic store the edited data',
	);
	const lastestUserIdEdition = await mongoClient.findOneHistoricByUserIdMostRecent(
		insertedDocument._id,
		insertedDocument.objectInfos.lastUpdate.userId,
	);

	t.is(lastestUserIdEdition._id, historic[0]._id, 'historic found for latest user');
	t.truthy(lastestUserIdEdition.dataEdited, 'data edited is set');
	t.deepEqual(
		JSON.parse(JSON.stringify(lastestUserIdEdition.dataEdited)),
		[
			{
				kind: 'E',
				path: ['field1String'],
				lhs: 'string1',
				rhs: 'string2',
			},
		],
		'historic store the edited data by the user',
	);

	const historicSinceLength = await mongoClient.countHistoricSince(
		insertedDocument._id,
		historic[0]._id,
	);
	t.is(historicSinceLength, 0, 'not historic after last');

	await mongoClient.deleteOneById(insertedDocument._id);
	historicLength = await mongoClient.countHistoricByEntityId(insertedDocument._id);
	t.is(historicLength, 1, 'historic is kept after deletion');

	await mongoClient.dropCollection();
});

test('Check historic drop', async (t: Assertions) => {
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

test('Check historic drop 2', async (t: Assertions) => {
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

test('Check historic indexes', async (t: Assertions) => {
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

test('[CRUD] Update many at once check modificationDate and historic', async (t: Assertions) => {
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
	const insertedDocuments = await mongoClient.insertMany(
		[{ ...initialValue }, { ...initialValue }, { ...initialValue }],
		'userId1',
	);

	for (const insertedDocument of insertedDocuments) {
		const historicLength = await mongoClient.countHistoricByEntityId(insertedDocument._id);
		t.is(historicLength, 0, 'not historic stored for only one insert');
	}

	const updatedDocuments = await (
		await mongoClient.updateManyAtOnce(
			insertedDocuments.map((insertedDocument) => ({ ...initialValue, _id: insertedDocument._id })),
			'userId1',
			{
				query: (e) => ({ _id: MongoUtils.oid(e._id) as any }),
			},
		)
	).toArray();

	t.is(updatedDocuments.length, 3, '3 documents updated');

	for (const insertedDocument of insertedDocuments) {
		const historicLength = await mongoClient.countHistoricByEntityId(insertedDocument._id);
		t.is(historicLength, 0, 'not historic stored for only updates with no change');

		const document = await mongoClient.findOneById(insertedDocument._id);
		t.notDeepEqual(
			document.objectInfos.lastUpdate.date,
			insertedDocument.objectInfos.lastUpdate.date,
			'lastUpdateDate change',
		);
		t.deepEqual(
			document.objectInfos.lastModification.date,
			insertedDocument.objectInfos.lastModification.date,
			"lastModificationDate doesn't change if the value doesn't change",
		);
	}

	await mongoClient.dropCollection();
});
