import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';

import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
}

global.log = new N9Log('tests');

init();

ava('[UPDATE MANY TO SAME VALUE] Should update many documents', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {});

	await mongoClient.insertOne(
		{
			field1String: 'test',
			field2Number: 1,
		},
		'test',
	);

	await mongoClient.insertOne(
		{
			field1String: 'test2',
			field2Number: 2,
		},
		'test',
	);

	await mongoClient.insertOne(
		{
			field1String: 'test2',
			field2Number: 3,
		},
		'test',
	);

	const size = await mongoClient.count();
	t.true(size === 3, 'collection should have 3 items');

	const updateResult = await mongoClient.updateManyToSameValue(
		{
			field1String: 'test2',
		},
		{
			$set: { field1String: 'updated' },
		},
		'test',
	);

	const sizeUpdated = await mongoClient.count({ field1String: 'updated' });
	t.true(sizeUpdated === 2, 'collection should have 2 documents updated');

	t.is(updateResult.modifiedCount, 2, 'should return a count of modified documents');

	const sizeWithNumber3 = await mongoClient.count({ field2Number: 3 });
	const sizeWithNumber2 = await mongoClient.count({ field2Number: 2 });
	const sizeWithNumber1 = await mongoClient.count({ field2Number: 1 });

	t.true(
		sizeWithNumber3 === 1 && sizeWithNumber2 === 1 && sizeWithNumber1 === 1,
		'other properties should remain inchanged',
	);

	const cursor = mongoClient.find({});
	const dateCheck = (await cursor.toArray()).every(
		(doc) =>
			doc.objectInfos.lastUpdate.date.getTime() ===
				doc.objectInfos.lastModification.date.getTime() &&
			doc.objectInfos.creation.date <= doc.objectInfos.lastUpdate.date,
	);

	t.true(dateCheck, 'all dates should have been updated correclty');
});

ava('[UPDATE MANY TO SAME VALUE] Should throw if lock field are setted', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {
		lockFields: {},
	});

	await mongoClient.insertOne(
		{
			field1String: 'test',
			field2Number: 1,
		},
		'test',
	);

	await mongoClient.insertOne(
		{
			field1String: 'test2',
			field2Number: 2,
		},
		'test',
	);

	await mongoClient.insertOne(
		{
			field1String: 'test2',
			field2Number: 3,
		},
		'test',
	);

	const size = await mongoClient.count();
	t.true(size === 3, 'collection should have 3 items');

	await t.throwsAsync(
		async () => {
			await mongoClient.updateManyToSameValue(
				{
					field1String: 'test2',
				},
				{
					$set: { field1String: 'updated' },
				},
				'test',
			);
		},
		{
			message: 'invalid-function-call',
		},
	);
});

ava(
	'[UPDATE MANY TO SAME VALUE] Should throw if historic is kept for collection',
	async (t: Assertions) => {
		const collectionName = `test-${Date.now()}`;
		const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {
			keepHistoric: true,
		});

		await mongoClient.insertOne(
			{
				field1String: 'test',
				field2Number: 1,
			},
			'test',
		);

		await mongoClient.insertOne(
			{
				field1String: 'test2',
				field2Number: 2,
			},
			'test',
		);

		await mongoClient.insertOne(
			{
				field1String: 'test2',
				field2Number: 3,
			},
			'test',
		);

		const size = await mongoClient.count();
		t.true(size === 3, 'collection should have 3 items');

		await t.throwsAsync(
			async () => {
				await mongoClient.updateManyToSameValue(
					{
						field1String: 'test2',
					},
					{
						$set: { field1String: 'updated' },
					},
					'test',
				);
			},
			{
				message: 'not-supported-operation-for-collection-with-historic',
			},
		);
	},
);

ava(
	'[UPDATE MANY TO SAME VALUE] Should throw if updateOnlyOnChange is setted without options to force lastModificationDate update',
	async (t: Assertions) => {
		const collectionName = `test-${Date.now()}`;
		const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {
			updateOnlyOnChange: {},
		});

		await mongoClient.insertOne(
			{
				field1String: 'test',
				field2Number: 1,
			},
			'test',
		);

		await mongoClient.insertOne(
			{
				field1String: 'test2',
				field2Number: 2,
			},
			'test',
		);

		await mongoClient.insertOne(
			{
				field1String: 'test2',
				field2Number: 3,
			},
			'test',
		);

		const size = await mongoClient.count();
		t.true(size === 3, 'collection should have 3 items');

		await t.throwsAsync(
			async () => {
				await mongoClient.updateManyToSameValue(
					{
						field1String: 'test2',
					},
					{
						$set: { field1String: 'updated' },
					},
					'test',
				);
			},
			{
				message: 'force-last-modification-required',
			},
		);
	},
);

ava(
	'[UPDATE MANY TO SAME VALUE] Should allow update when updateOnlyOnChange is setted with options to force lastModificationDate update',
	async (t: Assertions) => {
		const collectionName = `test-${Date.now()}`;
		const mongoClient = new MongoClient(collectionName, SampleType, SampleTypeListing, {
			updateOnlyOnChange: {},
		});

		await mongoClient.insertOne(
			{
				field1String: 'test',
				field2Number: 1,
			},
			'test',
		);

		await mongoClient.insertOne(
			{
				field1String: 'test2',
				field2Number: 2,
			},
			'test',
		);

		await mongoClient.insertOne(
			{
				field1String: 'test2',
				field2Number: 3,
			},
			'test',
		);

		const size = await mongoClient.count();
		t.true(size === 3, 'collection should have 3 items');

		const updateResult = await mongoClient.updateManyToSameValue(
			{
				field1String: 'test2',
			},
			{
				$set: { field1String: 'updated' },
			},
			'test',
			{
				forceLastModificationDate: true,
			},
		);

		const sizeUpdated = await mongoClient.count({ field1String: 'updated' });
		t.true(sizeUpdated === 2, 'collection should have 2 documents updated');
		t.is(updateResult.modifiedCount, 2, 'should return a count of modified documents');

		const sizeWithNumber3 = await mongoClient.count({ field2Number: 3 });
		const sizeWithNumber2 = await mongoClient.count({ field2Number: 2 });
		const sizeWithNumber1 = await mongoClient.count({ field2Number: 1 });

		t.true(
			sizeWithNumber3 === 1 && sizeWithNumber2 === 1 && sizeWithNumber1 === 1,
			'other properties should remain inchanged',
		);
	},
);
