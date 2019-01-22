import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import { ObjectID } from 'mongodb';
import { MongoUtils } from '../../src';

global.log = new N9Log('tests').module('mongo-utils');

test('[MONGO-UTILS] disconnect without connect', async (t: Assertions) => {
	t.deepEqual(await MongoUtils.disconnect(), undefined, 'should not block disconnect');
});

test('[MONGO-UTILS] oid & oids', async (t: Assertions) => {
	const id = '01234567890123456789abcd';
	const objectID = new ObjectID(id);
	t.deepEqual(MongoUtils.oid(id), objectID, 'oid equals from string');
	t.deepEqual(MongoUtils.oid(objectID), objectID, 'oid equals');

	t.deepEqual(MongoUtils.oids([id, id]), [objectID, objectID], 'oids equals');
	t.is(MongoUtils.oid(null), null, 'oid of null is null');
	t.is(MongoUtils.oids(undefined), undefined, 'oids of null is undefined');
});

test('[MONGO-UTILS] mapObjectToClass null', async (t: Assertions) => {
	t.deepEqual(MongoUtils.mapObjectToClass(null, null), null, 'should return null');
	t.deepEqual(MongoUtils.mapObjectToClass(null, undefined), undefined, 'should return undefined');
	t.deepEqual(MongoUtils.mapObjectToClass(null, 0), 0, 'should return 0');
	t.deepEqual(MongoUtils.mapObjectToClass(null, ''), '', 'should return ""');
});
