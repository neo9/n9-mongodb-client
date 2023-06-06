import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';

import { BaseMongoObject, MongoClient } from '../src';
import { init } from './fixtures/utils';

global.log = new N9Log('tests');

init();

ava('[Indexes] Create index', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const mongoClient = new MongoClient(collection, BaseMongoObject, null);

	await mongoClient.createIndex('name');

	t.true(
		(await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'),
		'index exists',
	);

	await mongoClient.dropCollection();
});

ava('[Indexes] List all indexes', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const mongoClient = new MongoClient(collection, BaseMongoObject, null);

	await mongoClient.createIndex('index_1');
	await mongoClient.createIndex('index_2');
	await mongoClient.createIndex('index_3');

	const createdIndexes: any[] = await mongoClient.findAllIndexes();
	t.true(createdIndexes.length === 4, 'correct number retrieved');
	t.is(createdIndexes[1].name, 'index_1_1', 'index 1 created and listed');
	t.is(createdIndexes[2].name, 'index_2_1', 'index 2 created and listed');
	t.is(createdIndexes[3].name, 'index_3_1', 'index 3 created and listed');

	await mongoClient.dropCollection();
});

ava('[Indexes] Create unique index', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const mongoClient = new MongoClient(collection, BaseMongoObject, null);

	await mongoClient.createUniqueIndex('code');

	const createdIndex = (await collection.listIndexes().toArray()).find((i) => i.name === 'code_1');

	t.truthy(createdIndex, 'index exists');
	t.true(createdIndex.unique, 'index is unique');

	await mongoClient.dropCollection();
});

ava('[Indexes] Drop index', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	await collection.createIndex('name');
	const mongoClient = new MongoClient(collection, BaseMongoObject, null);

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

ava('[Indexes] Create expiration index', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const mongoClient = new MongoClient(collection, BaseMongoObject, null);

	await mongoClient.createExpirationIndex(1, 'objectInfos.creation.date', { name: 'expiration' });
	const index = (await collection.listIndexes().toArray()).find((i) => i.name === 'expiration');
	t.truthy(index, 'index exists and is named expiration');
	t.true(
		index.key && index.key['objectInfos.creation.date'] === 1,
		'index exists and is on `objectInfos.creation.date` field',
	);

	await mongoClient.dropCollection();
});

ava('[Indexes] Create historic expiration index', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const historicCollection = global.db.collection(`test-${Date.now()}Historic`);
	const mongoClient = new MongoClient(collection, BaseMongoObject, BaseMongoObject, {
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

ava('[Indexes] Update expiration index if it exists', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const mongoClient = new MongoClient(collection, BaseMongoObject, null);

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

ava('[Indexes] Update historic expiration index if it exists', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const historicCollection = global.db.collection(`test-${Date.now()}Historic`);
	const mongoClient = new MongoClient(collection, BaseMongoObject, BaseMongoObject, {
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
