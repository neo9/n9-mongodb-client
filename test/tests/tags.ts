import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';

import { MongoClient } from '../../src';
import { init } from './fixtures/utils';
import { BaseMongoObject } from '../../src/models';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

global.log = new N9Log('tests');

init(test);

test('[Tags] Add tag to entities then remove them', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	const mongoClient = new MongoClient(collection, SampleType, null);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const tag = await mongoClient.addTagToMany({ field1String: { $in: ['string1', 'string2'] } }, 'userId');
	let cursor = await mongoClient.find({ 'objectInfos.tags': tag });
	let items = await cursor.toArray();
	t.is(items.length, 2, '2 items are tagged');

	await mongoClient.removeTagFromMany({ field1String: { $in: ['string1', 'string2'] } }, tag, 'userId');
	cursor = await mongoClient.find({ 'objectInfos.tags': tag });
	items = await cursor.toArray();
	t.is(items.length, 0, '0 items are tagged');

	await mongoClient.dropCollection();
});

test('[Tags] Add tag to entities then delete them', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	const mongoClient = new MongoClient(collection, SampleType, null);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const tag = await mongoClient.addTagToMany({ field1String: { $in: ['string1', 'string2'] } }, 'userId');
	await mongoClient.deleteManyWithTag(tag);
	const cursor = await mongoClient.find({});
	const items = await cursor.toArray();
	t.is(items.length, 3, 'collection contains now 3 items (string3, string4, string5)');

	await mongoClient.dropCollection();
});

test('[Tags] Add tag to entities then remove them without changing last update date', async (t: Assertions) => {
	const collection = global.db.collection('test-' + Date.now());
	const mongoClient = new MongoClient(collection, SampleType, null);

	let item1 = await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	const item1LastUpdateDate = item1.objectInfos.lastUpdate.date;

	const tag = await mongoClient.addTagToOneById(item1._id, 'userId', { updateLastUpdate: false });
	item1 = await mongoClient.findOneById(item1._id);
	t.is(item1.objectInfos.lastUpdate.date.toDateString(), item1LastUpdateDate.toDateString(), 'Last update date time has not changed');

	await mongoClient.removeTagFromOneById(item1._id, tag, 'userId', { updateLastUpdate: false });
	item1 = await mongoClient.findOneById(item1._id);
	t.is(item1.objectInfos.lastUpdate.date.toDateString(), item1LastUpdateDate.toDateString(), 'Last update date time has not changed');

	await mongoClient.dropCollection();
});
