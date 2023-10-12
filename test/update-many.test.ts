import { waitFor } from '@neo9/n9-node-utils';
import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	value: string;
}

init();

test('[UPDATE MANY] Should update only inserted document last modification date', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		SampleType,
		getBaseMongoClientSettings(t),
	);

	const userId = 'test';
	const tag = 'abcde';
	const firstEntity = {
		value: 'existing entity',
	};
	const insertedValue = await mongoClient.insertOne({ ...firstEntity }, userId);
	await waitFor(1); // create at least 1ms difference in dates
	await mongoClient.addTagToOneById(insertedValue._id, userId, { tag });
	t.is(insertedValue.value, 'existing entity', 'value inserted');

	const newEntity: SampleType = {
		value: 'new entity',
	};
	const beforeUpdateManyTimestamp = Date.now();
	await waitFor(10); // create at least 10ms difference in dates

	const updateResult = await (
		await mongoClient.updateMany(
			[
				{
					key: {
						name: 'value',
						value: insertedValue.value,
					},
					updateQuery: {
						$pull: {
							'objectInfos.tags': tag,
						},
						$setOnInsert: firstEntity,
					},
				},
				{
					key: {
						name: 'value',
						value: newEntity.value,
					},
					updateQuery: {
						$pull: {
							'objectInfos.tags': tag,
						},
						$setOnInsert: newEntity,
					},
				},
			],
			'userId',
			true,
			undefined, // default to true
			{
				updateLastModificationDateOnlyOnInsert: true,
			},
		)
	).toArray();
	const currentValuesInCollection = await mongoClient
		.find({}, 0, 0, { 'objectInfos.creation.date': 1 })
		.toArray();
	t.is(updateResult.length, 1, '1 entity upserted');
	t.is(currentValuesInCollection.length, 2, '2 entities in collection');
	t.is(
		currentValuesInCollection[0].value,
		'existing entity',
		'first one is the already present one',
	);
	t.deepEqual(currentValuesInCollection[0].objectInfos.tags, [], 'no more tags on entity');
	t.deepEqual(
		currentValuesInCollection[0].objectInfos.lastModification.date,
		insertedValue.objectInfos.lastModification.date,
		"date of modification didn't change",
	);
	t.true(
		currentValuesInCollection[0].objectInfos.lastModification.date.getTime() <
			beforeUpdateManyTimestamp,
		"date of modification didn't change (date compare)",
	);
	t.is(currentValuesInCollection[1].value, 'new entity', '2nd one is the new entity');
	t.deepEqual(currentValuesInCollection[1].objectInfos.tags, undefined, 'still, no tag on entity');
	t.true(
		currentValuesInCollection[1].objectInfos.lastModification.date.getTime() >
			beforeUpdateManyTimestamp,
		'date of modification did change',
	);
});
