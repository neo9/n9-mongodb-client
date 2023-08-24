import { N9Log } from '@neo9/n9-node-log';
import { waitFor } from '@neo9/n9-node-utils';
import test, { Assertions } from 'ava';

import { BaseMongoObject, MongoClient } from '../src';
import { init } from './fixtures/utils';

class SampleTypeListing extends BaseMongoObject {
	public field1StringThatDoesNotAffectChange: string;
}

class SubItem {
	property1ThatDoesNotAffectChange: string;
	property2: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
	public subItem: SubItem;
}
global.log = new N9Log('tests').module('update-only-on-change-deep');

init();

test('[CRUD] Find one and update with omit', async (t: Assertions) => {
	const mongoClient = new MongoClient(
		global.db.collection(`test-${Date.now()}`),
		SampleType,
		SampleTypeListing,
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

	const intValue = 41;
	const intValue2 = 42;

	const insertedDocument = await mongoClient.insertOne(
		{
			field1StringThatDoesNotAffectChange: 'string1',
			field2Number: intValue,
			subItem: {
				property1ThatDoesNotAffectChange: 'v1',
				property2: 'v1',
			},
		},
		'userId1',
	);

	let updateQuery: any = { $set: { field2Number: intValue2 } };
	const updatedDocument = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.truthy(insertedDocument.objectInfos.lastModification, 'Last modification set on insert');
	t.notDeepEqual(
		insertedDocument.objectInfos.lastModification.date,
		updatedDocument.objectInfos.lastModification.date,
		'Last modification changed',
	);

	updateQuery = {
		$set: {
			field1StringThatDoesNotAffectChange: "new value that doesn't affect modification date",
		},
	};
	const updatedDocument2 = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.deepEqual(
		updatedDocument.objectInfos.lastModification,
		updatedDocument2.objectInfos.lastModification,
		"Last modification didn't changed",
	);
	t.notDeepEqual(
		updatedDocument.objectInfos.lastUpdate.date,
		updatedDocument2.objectInfos.lastUpdate.date,
		'Last update did changed',
	);
	t.is(
		updatedDocument2.field1StringThatDoesNotAffectChange,
		"new value that doesn't affect modification date",
		'new value is saved',
	);

	updateQuery = {
		$set: {
			'subItem.property2': 'v2',
		},
	};
	const updatedDocument3 = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.notDeepEqual(
		updatedDocument2.objectInfos.lastModification,
		updatedDocument3.objectInfos.lastModification,
		"Last modification did changed du to 'subItem.property2' changed",
	);
	t.notDeepEqual(
		updatedDocument2.objectInfos.lastUpdate.date,
		updatedDocument3.objectInfos.lastUpdate.date,
		'Last update did changed',
	);
	t.is(updatedDocument3.subItem.property2, 'v2', 'new value is saved to v2');

	updateQuery = {
		$set: {
			'subItem.property1ThatDoesNotAffectChange': "new value that doesn't affect modification date",
		},
	};
	const updatedDocument4 = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.deepEqual(
		updatedDocument3.objectInfos.lastModification,
		updatedDocument4.objectInfos.lastModification,
		"Last modification didn't changed du to 'subItem.property1ThatDoesNotAffectChange' changed",
	);
	t.notDeepEqual(
		updatedDocument3.objectInfos.lastUpdate.date,
		updatedDocument4.objectInfos.lastUpdate.date,
		'Last update did changed',
	);
	t.is(
		updatedDocument4.subItem.property1ThatDoesNotAffectChange,
		"new value that doesn't affect modification date",
		'new value is saved to something else',
	);

	await mongoClient.dropCollection();
});

test('[CRUD] Find one and update with pick', async (t: Assertions) => {
	const mongoClient = new MongoClient(
		global.db.collection(`test-${Date.now()}`),
		SampleType,
		SampleTypeListing,
		{
			updateOnlyOnChange: {
				changeFilters: {
					pick: ['subItem', 'field2Number'],
				},
			},
		},
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	const intValue2 = 42;

	const insertedDocument = await mongoClient.insertOne(
		{
			field1StringThatDoesNotAffectChange: 'string1',
			field2Number: intValue,
			subItem: {
				property1ThatDoesNotAffectChange: 'v1',
				property2: 'v1',
			},
		},
		'userId1',
	);
	await waitFor(10);

	let updateQuery: any = { $set: { field2Number: intValue2 } };
	const updatedDocument = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.truthy(insertedDocument.objectInfos.lastModification, 'Last modification set on insert');
	t.notDeepEqual(
		insertedDocument.objectInfos.lastModification.date,
		updatedDocument.objectInfos.lastModification.date,
		'Last modification changed',
	);

	updateQuery = {
		$set: {
			field1StringThatDoesNotAffectChange: "new value that doesn't affect modification date",
		},
	};
	const updatedDocument2 = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.deepEqual(
		updatedDocument.objectInfos.lastModification,
		updatedDocument2.objectInfos.lastModification,
		"Last modification didn't changed",
	);
	t.notDeepEqual(
		updatedDocument.objectInfos.lastUpdate.date,
		updatedDocument2.objectInfos.lastUpdate.date,
		'Last update did changed',
	);
	t.is(
		updatedDocument2.field1StringThatDoesNotAffectChange,
		"new value that doesn't affect modification date",
		'new value is saved',
	);

	updateQuery = {
		$set: {
			'subItem.property2': 'v2',
		},
	};
	const updatedDocument3 = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.notDeepEqual(
		updatedDocument2.objectInfos.lastModification,
		updatedDocument3.objectInfos.lastModification,
		"Last modification did changed du to 'subItem.property2' changed",
	);
	t.notDeepEqual(
		updatedDocument2.objectInfos.lastUpdate.date,
		updatedDocument3.objectInfos.lastUpdate.date,
		'Last update did changed',
	);
	t.is(updatedDocument3.subItem.property2, 'v2', 'new value is saved to v2');

	updateQuery = {
		$set: {
			'subItem.property1ThatDoesNotAffectChange': "new value that doesn't affect modification date",
		},
	};
	const updatedDocument4 = await mongoClient.findOneAndUpdateById(
		insertedDocument._id,
		updateQuery,
		'userId',
	);

	t.notDeepEqual(
		updatedDocument3.objectInfos.lastModification,
		updatedDocument4.objectInfos.lastModification,
		"Last modification did changed du to 'subItem.property1ThatDoesNotAffectChange' changed",
	);
	t.notDeepEqual(
		updatedDocument3.objectInfos.lastUpdate.date,
		updatedDocument4.objectInfos.lastUpdate.date,
		'Last update did changed',
	);
	t.is(
		updatedDocument4.subItem.property1ThatDoesNotAffectChange,
		"new value that doesn't affect modification date",
		'new value is saved to something else',
	);

	await mongoClient.dropCollection();
});
