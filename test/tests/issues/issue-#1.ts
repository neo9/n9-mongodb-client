import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as mongodb from 'mongodb';

import { MongoClient, MongoUtils } from '../../../src';
import { BaseMongoObject } from '../../../src/models';

class SampleTypeListing extends BaseMongoObject {
}

class SampleType extends SampleTypeListing {
	public code: string;
	public field1String: string;
	public field2String: string;
}

global.log = new N9Log('tests').module('issues');

test.before(async () => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[ISSUE#1] updateManyAtOnce should remove properties if not specified', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0);

	const savedObject = await mongoClient.insertOne({
		code: 'issue#1',
		field1String: 'string1',
		field2String: 'string2'
	}, 'userId1');

	const foundObject = await mongoClient.findOneById(savedObject._id);

	t.truthy(foundObject, 'found by query');
	t.is(foundObject.field1String, "string1", 'found right element string1');
	t.is(foundObject.field2String, "string2", 'found right element string2');

	global.log.debug(`updateManyAtOnce with savedObject without field1String field`);
	const updateArray = await (await mongoClient.updateManyAtOnce([{ code: 'issue#1', field2String: 'string42' }], 'userId1', true, false, 'code')).toArray();

	const updatedObject = updateArray[0];

	global.log.debug(`Updated object : `, updatedObject);

	t.is(updatedObject.field2String, "string42", 'after update - found right element string42');
	t.falsy(updatedObject.field1String, 'after update - field1String should not exists anymore');
	t.truthy(updatedObject._id, 'after update - _id should still exists');
	t.truthy(updatedObject.objectInfos, 'after update - objectInfos should still exists');

	await mongoClient.dropCollection();
});
