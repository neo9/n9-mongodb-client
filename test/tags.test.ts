import { waitFor } from '@neo9/n9-node-utils';
import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

init();

test('[Tags] Add tag to entities then remove them', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		SampleType,
		getBaseMongoClientSettings(t),
	);
	await mongoClient.initTagsIndex();

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const tag = await mongoClient.addTagToMany(
		{ field1String: { $in: ['string1', 'string2'] } },
		'userId',
	);
	let cursor = mongoClient.find({ 'objectInfos.tags': tag });
	let items = await cursor.toArray();
	t.is(items.length, 2, '2 items are tagged');

	await mongoClient.removeTagFromMany(
		{ field1String: { $in: ['string1', 'string2'] } },
		tag,
		'userId',
	);
	cursor = mongoClient.find({ 'objectInfos.tags': tag });
	items = await cursor.toArray();
	t.is(items.length, 0, '0 items are tagged');

	await mongoClient.dropCollection();
});

test('[Tags] Add tag to entities then delete them', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		SampleType,
		getBaseMongoClientSettings(t),
	);
	await mongoClient.initTagsIndex();

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const tag = await mongoClient.addTagToMany(
		{ field1String: { $in: ['string1', 'string2'] } },
		'userId',
	);
	await mongoClient.deleteManyWithTag(tag);
	const cursor = mongoClient.find({});
	const items = await cursor.toArray();
	t.is(items.length, 3, 'collection contains now 3 items (string3, string4, string5)');

	await mongoClient.dropCollection();
});

test(`[Tags] Add tag to entities then remove them without changing last update date`, async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		null,
		getBaseMongoClientSettings(t),
	);
	await mongoClient.initTagsIndex();

	let item1 = await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	const item1LastUpdateDate = item1.objectInfos.lastUpdate.date;

	const tag = await mongoClient.addTagToOneById(item1._id, 'userId', { updateLastUpdate: false });
	item1 = await mongoClient.findOneById(item1._id);
	t.is(
		item1.objectInfos.lastUpdate.date.getTime(),
		item1LastUpdateDate.getTime(),
		'Last update date time has not changed',
	);

	await mongoClient.removeTagFromOneById(item1._id, tag, 'userId', { updateLastUpdate: false });
	item1 = await mongoClient.findOneById(item1._id);
	t.is(
		item1.objectInfos.lastUpdate.date.getTime(),
		item1LastUpdateDate.getTime(),
		'Last update date time has not changed',
	);

	await mongoClient.dropCollection();
});
for (const userId of ['userId', '012345678901234567890123']) {
	test(`[Tags] Add tag to entities then remove them with changing last update date  with userId : ${userId}`, async (t: ExecutionContext<TestContext>) => {
		const mongoClient = new N9MongoDBClient(
			getOneCollectionName(),
			SampleType,
			null,
			getBaseMongoClientSettings(t),
		);
		await mongoClient.initTagsIndex();

		let item1 = await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
		const item1LastUpdateDate = item1.objectInfos.lastUpdate.date;
		await waitFor(10);

		const tag = await mongoClient.addTagToOneById(item1._id, userId, { updateLastUpdate: true });
		item1 = await mongoClient.findOneById(item1._id);
		t.not(
			item1.objectInfos.lastUpdate.date.getTime(),
			item1LastUpdateDate.getTime(),
			'Last update date time has changed on add',
		);
		t.true(
			item1.objectInfos.lastUpdate.date.getTime() > item1LastUpdateDate.getTime(),
			'Last update date time has changed and is after previous one',
		);
		await waitFor(10);

		await mongoClient.removeTagFromOneById(item1._id, tag, userId, { updateLastUpdate: true });
		item1 = await mongoClient.findOneById(item1._id);
		t.not(
			item1.objectInfos.lastUpdate.date.getTime(),
			item1LastUpdateDate.getTime(),
			'Last update date time has changed on remove',
		);

		await mongoClient.dropCollection();
	});
}
