import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

init();

test('[Indexes] Create index', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const mongoClient = new N9MongoDBClient(
		collection,
		BaseMongoObject,
		null,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.createIndex('name');
	t.true(
		(await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'),
		'index exists',
	);

	await mongoClient.dropCollection();
});

test('[Indexes] List all indexes', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const mongoClient = new N9MongoDBClient(
		collection,
		BaseMongoObject,
		null,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.createIndex('index_1');
	await mongoClient.createIndex('index_2');
	await mongoClient.createIndex('index_3');

	const createdIndexes = await mongoClient.findAllIndexes();

	t.true(createdIndexes.length === 4, 'correct number retrieved');
	t.is(createdIndexes[1].name, 'index_1_1', 'index 1 created and listed');
	t.is(createdIndexes[2].name, 'index_2_1', 'index 2 created and listed');
	t.is(createdIndexes[3].name, 'index_3_1', 'index 3 created and listed');

	await mongoClient.dropCollection();
});

test('[Indexes] Create unique index', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const mongoClient = new N9MongoDBClient(
		collection,
		BaseMongoObject,
		null,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.createUniqueIndex('code');

	const createdIndex = (await collection.listIndexes().toArray()).find((i) => i.name === 'code_1');

	t.truthy(createdIndex, 'index exists');
	t.true(createdIndex.unique, 'index is unique');

	await mongoClient.dropCollection();
});

test('[Indexes] Drop index', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	await collection.createIndex('name');
	const mongoClient = new N9MongoDBClient(
		collection,
		BaseMongoObject,
		null,
		getBaseMongoClientSettings(t),
	);

	t.true(
		(await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'),
		'index exists',
	);
	await mongoClient.dropIndex('name_1');
	t.false(
		(await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'),
		'index does not exist',
	);

	await mongoClient.dropCollection();
});

test('[Indexes] Create expiration index', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const mongoClient = new N9MongoDBClient(
		collection,
		BaseMongoObject,
		null,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.createExpirationIndex(1, 'objectInfos.creation.date', { name: 'expiration' });
	const index = (await collection.listIndexes().toArray()).find((i) => i.name === 'expiration');
	t.truthy(index, 'index exists and is named expiration');
	t.true(
		index.key && index.key['objectInfos.creation.date'] === 1,
		'index exists and is on `objectInfos.creation.date` field',
	);

	await mongoClient.dropCollection();
});

test('[Indexes] Create historic expiration index', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const historicCollection = t.context.db.collection(`${collection.collectionName}Historic`);
	const mongoClient = new N9MongoDBClient(collection, BaseMongoObject, BaseMongoObject, {
		// ..getBaseMongoClientSettings(t),
		db: t.context.db,
		logger: t.context.logger,
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();

	await mongoClient.createHistoricExpirationIndex(1, 'date', { name: 'expiration' });
	const index = (await historicCollection.listIndexes().toArray()).find(
		(i) => i.name === 'expiration',
	);
	t.truthy(index, 'index exists and is named expiration');
	t.true(index.key && index.key.date === 1, 'index exists and is on `date` field');

	await mongoClient.dropHistory();
});

test('[Indexes] Update expiration index if it exists', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const mongoClient = new N9MongoDBClient(
		collection,
		BaseMongoObject,
		null,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.createExpirationIndex(1, 'objectInfos.creation.date', { name: 'expiration' });
	let index = (await collection.listIndexes().toArray()).find((i) => i.name === 'expiration');
	t.true(index.expireAfterSeconds === 86400, 'index exists with initial ttl');

	await mongoClient.createExpirationIndex(2, 'objectInfos.lastUpdate.date', { name: 'expiration' });
	index = (await collection.listIndexes().toArray()).find((i) => i.name === 'expiration');
	t.true(index.expireAfterSeconds === 172800, 'index exists with different ttl');
	t.true(
		index.key && index.key['objectInfos.lastUpdate.date'] === 1,
		'index exists and is on `objectInfos.lastUpdate.date` field',
	);
	// with default options
	await mongoClient.dropIndex('expiration');
	await mongoClient.createExpirationIndex(2, 'objectInfos.lastUpdate.date');
	index = (await collection.listIndexes().toArray()).find(
		(i) => i.name === 'n9MongoClient_expiration',
	);
	t.true(index.expireAfterSeconds === 172800, 'index exists with ttl different name');
	t.true(
		index.key && index.key['objectInfos.lastUpdate.date'] === 1,
		'index n9MongoClient_expiration exists and is on `objectInfos.lastUpdate.date` field',
	);
	await mongoClient.dropIndex('objectInfos.lastUpdate.date');
	await t.notThrowsAsync(
		async () => await mongoClient.dropIndex('objectInfos.lastUpdate.date'),
		'should drop index that does not exists is ok',
	);

	await mongoClient.dropCollection();
});

test('[Indexes] Update historic expiration index if it exists', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const historicCollection = t.context.db.collection(`${collection.collectionName}Historic`);
	const mongoClient = new N9MongoDBClient(collection, BaseMongoObject, BaseMongoObject, {
		...getBaseMongoClientSettings(t),
		keepHistoric: true,
	});

	await mongoClient.createHistoricExpirationIndex(1, 'date', { name: 'expiration' });

	let index = (await historicCollection.listIndexes().toArray()).find(
		(i) => i.name === 'expiration',
	);
	t.true(index.expireAfterSeconds === 86400, 'index exists with initial ttl');

	await mongoClient.createHistoricExpirationIndex(2, 'customDate', { name: 'expiration' });
	index = (await historicCollection.listIndexes().toArray()).find((i) => i.name === 'expiration');
	t.true(index.expireAfterSeconds === 172800, 'index exists with different ttl');
	t.true(index.key && index.key.customDate === 1, 'index exists and is on `customDate` field');

	await mongoClient.dropHistory();
});
