import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';
import { ObjectID } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as stdMocks from 'std-mocks';
import { MongoUtils } from '../../src';

global.log = new N9Log('tests').module('mongo-utils');

let mongod: MongoMemoryServer;

ava('[MONGO-UTILS] disconnect without connect', async (t: Assertions) => {
	t.deepEqual(await MongoUtils.disconnect(), undefined, 'should not block disconnect');
});

ava('[MONGO-UTILS] oid & oids', async (t: Assertions) => {
	const id = '01234567890123456789abcd';
	const objectID = new ObjectID(id);
	t.deepEqual(MongoUtils.oid(id), objectID, 'oid equals from string');
	t.deepEqual(MongoUtils.oid(objectID), objectID, 'oid equals');

	t.deepEqual(MongoUtils.oids([id, id]), [objectID, objectID], 'oids equals');
	t.is(MongoUtils.oid(null), null, 'oid of null is null');
	t.is(MongoUtils.oids(undefined), undefined, 'oids of null is undefined');
});

ava('[MONGO-UTILS] mapObjectToClass null', async (t: Assertions) => {
	t.deepEqual(MongoUtils.mapObjectToClass(null, null), null, 'should return null');
	t.deepEqual(MongoUtils.mapObjectToClass(null, undefined), undefined, 'should return undefined');
	t.deepEqual(MongoUtils.mapObjectToClass(null, 0), 0 as any, 'should return 0');
	t.deepEqual(MongoUtils.mapObjectToClass(null, ''), '' as any, 'should return ""');
});

ava('[MONGO-UTILS] URI connection log', async (t: Assertions) => {
	mongod = new MongoMemoryServer();
	const mongoURI = await mongod.getConnectionString();
	const mongoURIregex = new RegExp(_.escapeRegExp(mongoURI));

	stdMocks.use();
	await MongoUtils.connect(mongoURI);
	await MongoUtils.disconnect();
	let output = stdMocks.flush();
	stdMocks.restore();

	t.regex(output.stdout[0], mongoURIregex, 'URI should be identic');

	const mongoPassword = 'PaSsw0rD';
	const mongoURIWithPassword = `mongodb://login:${mongoPassword}@localhost:27017/test-n9-mongo-client`;
	const mongoURIPasswordRegex = new RegExp(_.escapeRegExp(mongoPassword));

	stdMocks.use();
	await t.throwsAsync(MongoUtils.connect(mongoURIWithPassword));
	output = stdMocks.flush();
	stdMocks.restore();

	t.notRegex(output.stdout[0], mongoURIPasswordRegex, 'Password should not be displayed in URI');

	await mongod.stop();
});
