import { N9Log } from '@neo9/n9-node-log';
import { waitFor } from '@neo9/n9-node-utils';
import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as stdMocks from 'std-mocks';

import { BaseMongoObject, MongoUtils, N9MongoDBClient, ObjectID } from '../src';
import { getOneCollectionName, init, print, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public test: string;
}

let mongod: MongoMemoryServer;

init({ avoidToStartMongodb: true });

test.beforeEach('Enable log output mock', () => {
	stdMocks.use({ print });
	stdMocks.flush();
});

test.afterEach('Disable log output mock', () => {
	stdMocks.restore();
});

test('[MONGO-UTILS] disconnect without connect', async (t: ExecutionContext<TestContext>) => {
	t.deepEqual(
		await MongoUtils.DISCONNECT(undefined, new N9Log('')),
		undefined,
		'should not block disconnect',
	);
	const output = stdMocks.flush();
	t.regex(
		output.stdout[0],
		/Trying to disconnect but native mongo client is not set/,
		'Check log that tell that client is not set',
	);
});

test('[MONGO-UTILS] TO_OBJECT_ID & TO_OBJECT_IDS', (t: ExecutionContext<TestContext>) => {
	const id = '01234567890123456789abcd';
	const objectID = new ObjectID(id);
	t.deepEqual(MongoUtils.TO_OBJECT_ID(id), objectID, 'oid equals from string');
	t.deepEqual(MongoUtils.TO_OBJECT_ID(objectID), objectID, 'oid equals');
	t.throws(
		() => MongoUtils.TO_OBJECT_ID({ notAString: 'something' } as any),
		{ message: 'Argument passed in does not match the accepted types' },
		'Should throw the native error',
	);

	t.deepEqual(MongoUtils.TO_OBJECT_IDS([id, id]), [objectID, objectID], 'oids equals');
	t.is(MongoUtils.TO_OBJECT_ID(null), null, 'oid of null is null');
	t.is(MongoUtils.TO_OBJECT_IDS(undefined), undefined, 'oids of null is undefined');
});

test('[MONGO-UTILS] mapObjectToClass null', (t: ExecutionContext<TestContext>) => {
	t.deepEqual(MongoUtils.MAP_OBJECT_TO_CLASS<null, null>(null, null), null, 'should return null');
	t.deepEqual(
		MongoUtils.MAP_OBJECT_TO_CLASS(null, undefined),
		undefined,
		'should return undefined',
	);
	t.deepEqual(MongoUtils.MAP_OBJECT_TO_CLASS(null, 0), 0 as any, 'should return 0');
	t.deepEqual(MongoUtils.MAP_OBJECT_TO_CLASS(null, ''), '' as any, 'should return ""');
});

test('[MONGO-UTILS] URI connection log', async (t: ExecutionContext<TestContext>) => {
	mongod = await MongoMemoryServer.create();
	const mongoURI = mongod.getUri();
	const mongoURIRegex = new RegExp(_.escapeRegExp(mongoURI));

	const { mongodbClient } = await MongoUtils.CONNECT(mongoURI, {
		logger: t.context.logger,
		nativeDriverOptions: {
			heartbeatFrequencyMS: 1, // high frequency for tests
			minHeartbeatFrequencyMS: 1,
			serverSelectionTimeoutMS: 200, // make tests run faster
		},
	});
	await MongoUtils.DISCONNECT(mongodbClient, t.context.logger);
	await waitFor(500);
	let output = stdMocks.flush();

	t.regex(output.stdout[0], mongoURIRegex, 'URI should be the same');

	const mongoPassword = 'PaSsw0rD';
	const mongoURIWithPassword = `mongodb://login:${mongoPassword}@localhost:27017/test-n9-mongodb-client`;
	const mongoURIPasswordRegex = new RegExp(_.escapeRegExp(mongoPassword));

	await t.throwsAsync(MongoUtils.CONNECT(mongoURIWithPassword, { logger: t.context.logger }));
	output = stdMocks.flush();

	t.notRegex(output.stdout[0], mongoURIPasswordRegex, 'Password should not be displayed in URI');
	t.regex(output.stdout[0], /localhost:27017\/test-n9-mongodb-client/, 'Log should contain URI');

	await mongod.stop();
});

test('[MONGO-UTILS] Ensure event logs', async (t: ExecutionContext<TestContext>) => {
	mongod = await MongoMemoryServer.create();
	const mongoURI = mongod.getUri();

	const { mongodbClient } = await MongoUtils.CONNECT(mongoURI, {
		logger: t.context.logger,
		nativeDriverOptions: {
			// view https://mongodb.github.io/node-mongodb-native/3.6/reference/unified-topology/
			heartbeatFrequencyMS: 1, // high frequency for tests
			minHeartbeatFrequencyMS: 1,
			serverSelectionTimeoutMS: 200, // make tests run faster
		},
	});
	await waitFor(100);
	let output = stdMocks.flush();
	t.regex(output.stdout.pop(), /Client connected to/, 'Should have connection log');
	t.truthy(MongoUtils.IS_CONNECTED());
	await waitFor(500);
	stdMocks.flush();

	await mongod.stop({
		force: true,
		doCleanup: false,
	});
	await waitFor(500);
	output = stdMocks.flush();

	t.truthy(
		output.stdout.find((line) => /Ping KO/.test(line)),
		'Should have a ping KO log',
	);
	t.truthy(
		output.stdout.find((line) => /Topology description changed/.test(line)),
		'Should have a Topology description changed event',
	);
	stdMocks.flush();

	t.false(MongoUtils.IS_CONNECTED(), 'Check server is not writable');
	const logs = stdMocks.flush();
	t.true(
		_.isEmpty(logs.stdout),
		'No log printed when calling isConnected, avoid to flood app logs',
	);
	stdMocks.flush();
	await mongod.start(true);
	await waitFor(500);
	output = stdMocks.flush();
	// With new client version v5, connected and reconnected logs are the same :/
	t.regex(output.stdout.pop(), /Client reconnected to/, 'Should have reconnect event log');
	t.true(MongoUtils.IS_CONNECTED(), 'Check server is writable');

	// Reconnect failed event doesn't exist with mongodb native driver 5
	await MongoUtils.DISCONNECT(mongodbClient, t.context.logger);
});

test('[MONGO-UTILS] IsConnected', async (t: ExecutionContext<TestContext>) => {
	t.false(MongoUtils.IS_CONNECTED(), 'is not yet connected, check read only');

	mongod = await MongoMemoryServer.create();
	const mongoURI = mongod.getUri();
	await MongoUtils.CONNECT(mongoURI, { logger: t.context.logger });
	await waitFor(100);

	t.true(MongoUtils.IS_CONNECTED(), 'is connected, check read only');
});

test('[MONGO-UTILS] List collection names', async (t: ExecutionContext<TestContext>) => {
	mongod = await MongoMemoryServer.create();
	const mongoURI = mongod.getUri();

	const { db, mongodbClient } = await MongoUtils.CONNECT(mongoURI);

	let names = await MongoUtils.LIST_COLLECTIONS_NAMES(db);

	t.deepEqual(names, [], 'no collection in mongodb by default');

	const collectionName1 = getOneCollectionName('test1');
	const collectionName2 = getOneCollectionName('test2');
	const mongoClient1 = new N9MongoDBClient(collectionName1, SampleType, null, {
		db,
		logger: t.context.logger,
	});
	const mongoClient2 = new N9MongoDBClient(collectionName2, SampleType, null, {
		db,
		logger: t.context.logger,
	});

	await mongoClient1.insertOne({ test: 'test-1' }, 'userId1');
	await mongoClient2.insertOne({ test: 'test-2' }, 'userId2');

	t.true(await mongoClient1.collectionExists(), 'collection exists');
	t.is(await mongoClient1.count(), 1, 'collection1 has one document');
	t.true(await mongoClient2.collectionExists(), 'collection2 exists');
	t.is(await mongoClient2.count(), 1, 'collection2 has one documents');

	names = await MongoUtils.LIST_COLLECTIONS_NAMES(db);

	t.true(names.includes(collectionName1), 'collection 1 is in the listing');
	t.true(names.includes(collectionName2), 'collection 2 is in the listing');

	names = await MongoUtils.LIST_COLLECTIONS_NAMES(db, { name: { $regex: /test1.*/g } });
	t.deepEqual(names, [collectionName1], 'collection 1 is found');

	names = await MongoUtils.LIST_COLLECTIONS_NAMES(db, { name: { $regex: /test2.*/g } });
	t.deepEqual(names, [collectionName2], 'collection 2 is found');

	const cursor = MongoUtils.LIST_COLLECTIONS(
		db,
		{ name: { $regex: /test1.*/g } },
		{ nameOnly: false },
	);
	while (await cursor.hasNext()) {
		const item: any = await cursor.next();
		t.false(item.info.readOnly, 'Additional infos can be found on collections');
	}

	await MongoUtils.DISCONNECT(mongodbClient, t.context.logger);
});

test('[MONGO-UTILS] Check ping without db', async (t: ExecutionContext<TestContext>) => {
	stdMocks.use({ print });
	t.false(
		await MongoUtils.PING({
			logger: t.context.logger,
			db: undefined,
		}),
		`Missing db for ping`,
	);
	const { stdout } = stdMocks.flush();
	t.regex(stdout[0], /missing db for ping/i, 'Log is printed to telle user');
});
