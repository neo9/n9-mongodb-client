import { N9Log } from '@neo9/n9-node-log';
import { waitFor } from '@neo9/n9-node-utils';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';
import { ObjectID } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as stdMocks from 'std-mocks';

import { BaseMongoObject, MongoClient, MongoUtils } from '../src';

class SampleType extends BaseMongoObject {
	public test: string;
}

global.log = new N9Log('tests').module('mongo-utils');

let mongod: MongoMemoryServer;

ava.beforeEach('Enable log output mock', () => {
	stdMocks.use();
});

ava.afterEach('Disable log output mock', () => {
	stdMocks.restore();
});

ava('[MONGO-UTILS] disconnect without connect', async (t: Assertions) => {
	t.deepEqual(await MongoUtils.disconnect(), undefined, 'should not block disconnect');
});

ava('[MONGO-UTILS] oid & oids', (t: Assertions) => {
	const id = '01234567890123456789abcd';
	const objectID = new ObjectID(id);
	t.deepEqual(MongoUtils.oid(id), objectID, 'oid equals from string');
	t.deepEqual(MongoUtils.oid(objectID), objectID, 'oid equals');

	t.deepEqual(MongoUtils.oids([id, id]), [objectID, objectID], 'oids equals');
	t.is(MongoUtils.oid(null), null, 'oid of null is null');
	t.is(MongoUtils.oids(undefined), undefined, 'oids of null is undefined');
});

ava('[MONGO-UTILS] mapObjectToClass null', (t: Assertions) => {
	t.deepEqual(MongoUtils.mapObjectToClass<null, null>(null, null), null, 'should return null');
	t.deepEqual(MongoUtils.mapObjectToClass(null, undefined), undefined, 'should return undefined');
	t.deepEqual(MongoUtils.mapObjectToClass(null, 0), 0 as any, 'should return 0');
	t.deepEqual(MongoUtils.mapObjectToClass(null, ''), '' as any, 'should return ""');
});

ava('[MONGO-UTILS] URI connection log', async (t: Assertions) => {
	mongod = await MongoMemoryServer.create();
	const mongoURI = mongod.getUri();
	const mongoURIregex = new RegExp(_.escapeRegExp(mongoURI));

	await MongoUtils.connect(mongoURI);
	await MongoUtils.disconnect();
	await waitFor(500);
	let output = stdMocks.flush();

	t.regex(output.stdout[0], mongoURIregex, 'URI should be identic');

	const mongoPassword = 'PaSsw0rD';
	const mongoURIWithPassword = `mongodb://login:${mongoPassword}@localhost:27017/test-n9-mongo-client`;
	const mongoURIPasswordRegex = new RegExp(_.escapeRegExp(mongoPassword));

	await t.throwsAsync(MongoUtils.connect(mongoURIWithPassword));
	output = stdMocks.flush();

	t.notRegex(output.stdout[0], mongoURIPasswordRegex, 'Password should not be displayed in URI');
	t.regex(output.stdout[0], /localhost:27017\/test-n9-mongo-client/, 'Log should contain URI');

	await mongod.stop();
});

ava('[MONGO-UTILS] Ensure event logs', async (t: Assertions) => {
	mongod = await MongoMemoryServer.create();
	const mongoURI = mongod.getUri();

	await MongoUtils.connect(mongoURI, {
		autoReconnect: true,
		reconnectTries: 100,
		reconnectInterval: 50,
	});
	await waitFor(100);
	let output = stdMocks.flush();

	t.regex(output.stdout.pop(), /Client connected to/, 'Should have connection log');
	t.truthy(global.dbClient.isConnected());

	await mongod.stop(false);
	await waitFor(100);
	output = stdMocks.flush();

	t.regex(output.stdout.pop(), /Client disconnected from/, 'Should have close event log');
	t.falsy(global.dbClient.isConnected());

	await mongod.start(true);
	await waitFor(200);
	output = stdMocks.flush();

	t.regex(output.stdout.pop(), /Client reconnected to/, 'Should have reconnect event log');
	t.truthy(global.dbClient.isConnected());

	await MongoUtils.disconnect();
	await MongoUtils.connect(mongoURI, {
		socketTimeoutMS: 1,
	});

	await MongoUtils.listCollectionsNames();
	await waitFor(10);
	output = stdMocks.flush();

	t.regex(
		output.stdout.pop(),
		/Client connection or operation timed out/,
		'Should have timeout event log',
	);

	await MongoUtils.disconnect();
	await MongoUtils.connect(
		mongoURI,
		{
			autoReconnect: true,
			reconnectTries: 1,
			reconnectInterval: 50,
		},
		{ killProcessOnReconnectFailed: false },
	);

	await mongod.stop(false);
	await waitFor(100);
	output = stdMocks.flush();

	t.regex(
		output.stdout.pop(),
		/Client reconnection failed/,
		'Should have reconnect failed event log',
	);
	t.falsy(global.dbClient.isConnected());

	await MongoUtils.disconnect();
});

ava('[MONGO-UTILS] List collection names', async (t: Assertions) => {
	mongod = await MongoMemoryServer.create();
	const mongoURI = mongod.getUri();

	await MongoUtils.connect(mongoURI);

	let names = await MongoUtils.listCollectionsNames();

	t.deepEqual(names, [], 'no collection in mongodb by default');

	const collectionName1 = `test1-${Date.now()}`;
	const collectionName2 = `test2-${Date.now()}`;
	const mongoClient1 = new MongoClient(collectionName1, SampleType, null);
	const mongoClient2 = new MongoClient(collectionName2, SampleType, null);

	await mongoClient1.insertOne({ test: 'test-1' }, 'userId1');
	await mongoClient2.insertOne({ test: 'test-2' }, 'userId2');

	t.true(await mongoClient1.collectionExists(), 'collection exists');
	t.is(await mongoClient1.count(), 1, 'collection1 has one document');
	t.true(await mongoClient2.collectionExists(), 'collection2 exists');
	t.is(await mongoClient2.count(), 1, 'collection2 has one documents');

	names = await MongoUtils.listCollectionsNames();

	t.true(names.includes(collectionName1), 'collection 1 is in the listing');
	t.true(names.includes(collectionName2), 'collection 2 is in the listing');

	names = await MongoUtils.listCollectionsNames({ name: { $regex: /test1.*/g } });
	t.deepEqual(names, [collectionName1], 'collection 1 is found');

	names = await MongoUtils.listCollectionsNames({ name: { $regex: /test2.*/g } });
	t.deepEqual(names, [collectionName2], 'collection 2 is found');

	const cursor = MongoUtils.listCollections({ name: { $regex: /test1.*/g } }, { nameOnly: false });
	while (await cursor.hasNext()) {
		const item: any = await cursor.next();
		t.false(item.info.readOnly, 'Additional infos can be found on collections');
	}

	await MongoUtils.disconnect();
});
