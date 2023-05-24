import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

class SampleTypeListing extends BaseMongoObject {}

class SampleType extends SampleTypeListing {
	public code: string;
	public field1: string;
	public field2: string;
	public sub?: {
		field3: string;
		field4?: string;
	};
	public field5?: string;
}

global.log = new N9Log('tests').module('issues');

let mongod: MongoMemoryServer;

ava.before(async () => {
	mongod = await MongoMemoryServer.create();
	const uri = mongod.getUri();
	await MongoUtils.connect(uri);
});

ava.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
	await mongod.stop();
});

ava(
	'[ISSUE#1] updateManyAtOnce should remove properties if not specified',
	async (t: Assertions) => {
		const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleTypeListing);
		const size = await mongoClient.count();

		t.true(size === 0);

		const initialValue = {
			code: 'issue#1',
			field1: 'string1',
			field2: 'string2',
			field5: 'string5',
		};
		const newValue = {
			code: 'issue#1',
			field2: 'string42',
			field5: undefined,
		};
		const savedObject = await mongoClient.insertOne(initialValue, 'userId1');

		const foundObject = await mongoClient.findOneById(savedObject._id);

		t.truthy(foundObject, 'found by query');
		t.is(foundObject.field1, 'string1', 'found right element string1');
		t.is(foundObject.field2, 'string2', 'found right element string2');
		t.is(foundObject.field5, 'string5', 'found right element string5');

		global.log.debug(`updateManyAtOnce with savedObject without field1String field`);
		const updateArray = await (
			await mongoClient.updateManyAtOnce([newValue], 'userId1', {
				upsert: true,
				lockNewFields: false,
				query: 'code',
			})
		).toArray();

		const updatedObject = updateArray[0];

		global.log.debug(`Updated object : `, JSON.stringify(updatedObject));

		t.is(updatedObject.field2, 'string42', 'after update - found right element string42');
		t.is(updatedObject.field1, undefined, 'after update - field1 should not exists anymore');
		t.is(updatedObject.field5, undefined, 'after update - field5 should not exists anymore');
		t.truthy(updatedObject._id, 'after update - _id should still exists');
		t.truthy(updatedObject.objectInfos, 'after update - objectInfos should still exists');

		await mongoClient.dropCollection();
	},
);

ava(
	'[ISSUE#1] updateManyAtOnce should remove recursively properties if not specified',
	async (t: Assertions) => {
		const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleTypeListing);
		const size = await mongoClient.count();

		t.true(size === 0);

		const initialValue = {
			code: 'issue#1',
			field1: 'string1',
			field2: 'string2',
			sub: {
				field3: 'string3',
				field4: 'string4',
			},
		};
		const newValue = {
			code: 'issue#1',
			field2: 'string42',
			sub: {
				field3: 'string43',
			},
		};
		const savedObject = await mongoClient.insertOne(initialValue, 'userId1');

		const foundObject = await mongoClient.findOneById(savedObject._id);

		t.truthy(foundObject, 'found by query');
		t.is(foundObject.field1, 'string1', 'found right element string1');
		t.is(foundObject.field2, 'string2', 'found right element string2');
		t.is(foundObject.sub.field3, 'string3', 'found right element string3');
		t.is(foundObject.sub.field4, 'string4', 'found right element string4');

		global.log.debug(`updateManyAtOnce with savedObject without field1String field`);
		const updateArray = await (
			await mongoClient.updateManyAtOnce([newValue], 'userId1', {
				upsert: true,
				lockNewFields: false,
				query: 'code',
			})
		).toArray();

		const updatedObject = updateArray[0];

		global.log.debug(`Updated object : `, JSON.stringify(updatedObject));

		t.is(updatedObject.field2, 'string42', 'after update - found right element string42');
		t.is(updatedObject.field1, undefined, 'after update - field1 should not exists anymore');
		t.truthy(updatedObject._id, 'after update - _id should still exists');
		t.truthy(updatedObject.objectInfos, 'after update - objectInfos should still exists');

		t.is(updatedObject.sub.field3, 'string43', 'after update - found right element string43');
		t.is(
			updatedObject.sub.field4,
			undefined,
			'after update - sub.field4 should not exists anymore',
		);

		await mongoClient.dropCollection();
	},
);
