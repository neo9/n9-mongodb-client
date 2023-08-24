import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';

import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public test: string;
}

global.log = new N9Log('tests');

init();

test('[EXISTS] Create collection and test existence', async (t: Assertions) => {
	const collectionName1 = `test1-${Date.now()}`;
	const collectionName2 = `test2-${Date.now()}`;
	const mongoClient1 = new MongoClient(collectionName1, SampleType, null);
	const mongoClient2 = new MongoClient(collectionName2, SampleType, null);

	await mongoClient1.insertOne({ test: 'test-1' }, 'userId1');
	await mongoClient2.insertOne({ test: 'test-2' }, 'userId2');
	await mongoClient2.insertOne({ test: 'test-2bis' }, 'userId2');

	t.true(await mongoClient1.collectionExists(), 'collection exists');
	t.is(await mongoClient1.count(), 1, 'collection1 has one document');
	t.true(await mongoClient2.collectionExists(), 'collection2 exists');
	t.is(await mongoClient2.count(), 2, 'collection2 has 2 documents');

	await t.throwsAsync(
		mongoClient1.renameCollection(collectionName2, false),
		{
			code: 48,
			message: 'target namespace exists',
		},
		'Throw an error due to the target collection existence',
	);
	const newMongoClient = await mongoClient1.renameCollection(collectionName2, true);

	t.true(await newMongoClient.collectionExists(), 'collection2 exists');
	t.true(await mongoClient2.collectionExists(), 'collection2 exists');
	t.false(await mongoClient1.collectionExists(), 'collection1 disappeared');

	t.is(
		await mongoClient2.count(),
		1,
		'collection2 has now 1 document, the one created in collection 1',
	);

	await mongoClient2.dropCollection();
});
