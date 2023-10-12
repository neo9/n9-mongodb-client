import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public test: string;
}

init();

test('[EXISTS] Create collection and test existence', async (t: ExecutionContext<TestContext>) => {
	const collectionName2 = getOneCollectionName('test2');
	const mongoClient1 = new N9MongoDBClient(
		getOneCollectionName('test1'),
		SampleType,
		null,
		getBaseMongoClientSettings(t),
	);
	const mongoClient2 = new N9MongoDBClient(
		collectionName2,
		SampleType,
		null,
		getBaseMongoClientSettings(t),
	);

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
