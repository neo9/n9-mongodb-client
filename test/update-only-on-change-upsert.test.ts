import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, MongoUtils, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public field1Number: number;
}

class SampleTypeWithKey extends BaseMongoObject {
	public property1: number;
	public field1Number: number;
}

init();

test('[CRUD] Find one and update with omit', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		t.context.db.collection(getOneCollectionName()),
		SampleType,
		SampleType,
		{
			...getBaseMongoClientSettings(t),
			updateOnlyOnChange: {
				changeFilters: {
					omit: ['subItem.property1ThatDoesNotAffectChange', 'field1StringThatDoesNotAffectChange'],
				},
			},
		},
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const insertedDocument = await mongoClient.findOneAndUpsert(
		{ _id: MongoUtils.TO_OBJECT_ID('012345678901234567890123') as any },
		{
			$set: {
				field1Number: 41,
			},
		},
		'userId1',
	);

	t.truthy(
		insertedDocument.objectInfos.lastModification?.date,
		'Last modification date is set upon upsertion',
	);

	await mongoClient.dropCollection();
});

test('[CRUD] Find one and update with pick', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		t.context.db.collection(getOneCollectionName()),
		SampleTypeWithKey,
		SampleTypeWithKey,
		{
			...getBaseMongoClientSettings(t),
			updateOnlyOnChange: {
				changeFilters: {
					omit: ['subItem.property1ThatDoesNotAffectChange', 'field1StringThatDoesNotAffectChange'],
				},
			},
		},
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	// check returned entity
	const returnedEntityCursor = await mongoClient.updateManyAtOnce(
		[
			{
				property1: 1,
				field1Number: 2,
			},
		],
		'TEST',
		{
			query: 'property1',
			mapFunction: () => ({
				field1Number: 3,
			}),
			upsert: true,
		},
	);
	t.true(await returnedEntityCursor.hasNext(), 'has match a least one element');
	const insertedDocument = await returnedEntityCursor.next();

	t.truthy(
		insertedDocument.objectInfos.lastModification?.date,
		'Last modification date is set upon upsertion',
	);

	await mongoClient.dropCollection();
});
