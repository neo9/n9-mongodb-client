import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import { ObjectID } from 'mongodb';
import * as mongodb from 'mongodb';
import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject, StringMap } from '../../src/models';

global.log = new N9Log('tests').module('mongo-utils');

test('[MONGO-UTILS] oid & oids', async (t: Assertions) => {
	const id = '01234567890123456789abcd';
	const objectID = new ObjectID(id);
	t.deepEqual(MongoUtils.oid(id), objectID, 'oid equals from string');
	t.deepEqual(MongoUtils.oid(objectID), objectID, 'oid equals');

	t.deepEqual(MongoUtils.oids([id, id]), [objectID, objectID], 'oids equals');
	t.is(MongoUtils.oid(null), null, 'oid of null is null');
	t.is(MongoUtils.oids(undefined), undefined, 'oids of null is undefined');
});
