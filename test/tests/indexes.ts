import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';

import { MongoClient } from '../../src';
import { init } from './fixtures/utils';

global.log = new N9Log('tests');

init(test);

test('[Indexes] Create index', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	const mongoClient = new MongoClient(collection, Object, null);

	await mongoClient.createIndex('name');
	t.true((await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'), 'index exists');

	await mongoClient.dropCollection();
});

test('[Indexes] Drop index', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	collection.createIndex('name');
	const mongoClient = new MongoClient(collection, Object, null);

	t.true((await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'), 'index exists');
	await mongoClient.dropIndex('name_1');
	t.false((await collection.listIndexes().toArray()).some((i) => i.name === 'name_1'), 'index does not exist');

	await mongoClient.dropCollection();
});

test('[Indexes] Create expiration index', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	const mongoClient = new MongoClient(collection, Object, null);

	await mongoClient.createExpirationIndex(1, { name: 'expiration' });
	t.true((await collection.listIndexes().toArray()).some((i) => i.name === 'expiration'), 'index exists');

	await mongoClient.dropCollection();
});

test('[Indexes] Create historic expiration index', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	const historicCollection = global.db.collection('test-' + Date.now() + 'Historic');
	const mongoClient = new MongoClient(collection, Object, Object, { keepHistoric: true });

	await mongoClient.createHistoricExpirationIndex(1, { name: 'expiration' });
	t.true((await historicCollection.listIndexes().toArray()).some((i) => i.name === 'expiration'), 'index exists');

	await mongoClient.dropHistory();
});

test('[Indexes] Update expiration index if it exists', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	const mongoClient = new MongoClient(collection, Object, null);

	await mongoClient.createExpirationIndex(1, { name: 'expiration' });
	let index = (await collection.listIndexes().toArray()).find((i) => i.name === 'expiration');
	t.true(index.expireAfterSeconds === 86400, 'index exists with initial ttl');
	await mongoClient.createExpirationIndex(2, { name: 'expiration' });
	index = (await collection.listIndexes().toArray()).find((i) => i.name === 'expiration');
	t.true(index.expireAfterSeconds === 172800, 'index exists with different ttl');

	await mongoClient.dropCollection();
});
