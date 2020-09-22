import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import { BaseMongoObject, MongoClient, MongoUtils } from '../src';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public field1Number: number;
}

global.log = new N9Log('tests').module('update-only-on-change-deep');

init();

ava('[CRUD] Find one and update with omit', async (t: Assertions) => {
	const mongoClient = new MongoClient(
		global.db.collection(`test-${Date.now()}`),
		SampleType,
		SampleType,
		{
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
		{ _id: MongoUtils.oid('012345678901234567890123') as any },
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

ava('[CRUD] Find one and update with pick', async (t: Assertions) => {
	const mongoClient = new MongoClient(
		global.db.collection(`test-${Date.now()}`),
		SampleType,
		SampleType,
		{
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
				field1Number: 2,
			},
		],
		'TEST',
		{
			query: 'property1',
			mapFunction: async () => {
				return {
					field1Number: 3,
				};
			},
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
