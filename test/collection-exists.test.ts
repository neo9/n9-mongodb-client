import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public test: string;
}

init();

test('[EXISTS] Create collection and test existence', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		null,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.insertOne({ test: 'test' }, 'userId1');

	t.true(await mongoClient.collectionExists(), 'collection exists');

	await mongoClient.dropCollection();
});

test('[EXISTS] Do not create collection and test existence', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		null,
		getBaseMongoClientSettings(t),
	);

	t.false(await mongoClient.collectionExists(), 'collection does not exist');
});

test('[EXISTS] Create collection then drop it then test existence', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		null,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.insertOne({ test: 'test' }, 'userId1');
	await mongoClient.dropCollection();

	t.false(await mongoClient.collectionExists(), 'collection does not exist');

	await t.throwsAsync(
		async () => {
			await mongoClient.dropCollection(true, true);
		},
		{
			message: 'mongodb-drop-collection-error',
		},
		'should throw not found exception',
	);
});
