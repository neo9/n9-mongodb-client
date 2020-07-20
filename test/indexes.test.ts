import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';

import { MongoClient } from '../src';
import { init } from './fixtures/utils';

global.log = new N9Log('tests');

init();

ava('[Indexes] Create index', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const mongoClient = new MongoClient(collection, Object, null);

	await mongoClient.createIndex('name');
	t.true(
		(await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'),
		'index exists',
	);

	await mongoClient.dropCollection();
});

ava('[Indexes] Drop index', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	await collection.createIndex('name');
	const mongoClient = new MongoClient(collection, Object, null);

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
	const mongoClient = new MongoClient(collection, Object, null);

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
	const historicCollection = global.db.collection(`test-${Date.now()}` + 'Historic');
	const mongoClient = new MongoClient(collection, Object, Object, { keepHistoric: true });

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
	const mongoClient = new MongoClient(collection, Object, null);

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

	await mongoClient.dropCollection();
});

ava('[Indexes] Update historic expiration index if it exists', async (t: Assertions) => {
	const collection = global.db.collection(`test-${Date.now()}`);
	const historicCollection = global.db.collection(`test-${Date.now()}` + 'Historic');
	const mongoClient = new MongoClient(collection, Object, Object, { keepHistoric: true });

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
