import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';

import { BaseMongoObject, FilterQuery, MongoClient } from '../src';
import { Db } from '../src/mongodb';
import { init } from './fixtures/utils';

global.log = new N9Log('tests').module('issues');

init();

test('[INSERT-MANY] Insert many', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, BaseMongoObject, BaseMongoObject);
	const startTestTime = Date.now();
	const value: any = {
		_id: 'test',
		key: 'value',
	};
	const value2: any = {
		_id: 'test',
		key: 'value2',
	};
	const query: FilterQuery<{ key: string }> = { $or: [{ key: 'value' }, { key: 'value2' }] };

	const insertedValues = await mongoClient.insertMany(
		[...Array(20).fill(value), value2, ...Array(29).fill(value)],
		'userId1',
		{},
		true,
	);

	t.is(insertedValues.length, 50, '50 elements inserted');
	t.is(typeof insertedValues[0]._id, 'string', '_id inserted is a string throw n9-mongodb-client');
	const insertedValueFoundWithNativeClient = await (global.db as Db)
		.collection(collectionName)
		.findOne<any>({ key: 'value2' });
	t.is(typeof insertedValueFoundWithNativeClient._id, 'object', '_id inserted is an ObjectID');

	const nbFoundObjects = await mongoClient.count(query);
	t.is(nbFoundObjects, 50, 'found by query');

	for (const insertedValue of insertedValues) {
		t.true(
			insertedValue.objectInfos.creation.date.getTime() >= startTestTime,
			'creation date set and newer than test started',
		);
		t.true(
			insertedValue.objectInfos.lastUpdate.date.getTime() >= startTestTime,
			'lastUpdate date set and newer than test started',
		);
		t.true(
			insertedValue.objectInfos.lastModification.date.getTime() >= startTestTime,
			'lastModification date set and newer than test started',
		);
		t.is(insertedValue.objectInfos.creation.userId, 'userId1', 'userId set for creation');
		t.is(insertedValue.objectInfos.lastUpdate.userId, 'userId1', 'userId set for lastUpdate');
		t.is(
			insertedValue.objectInfos.lastModification.userId,
			'userId1',
			'userId set for lastModification',
		);
	}

	await mongoClient.dropCollection();
});
