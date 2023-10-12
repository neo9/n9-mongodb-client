import test, { ExecutionContext } from 'ava';
import _ from 'lodash';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleComplexType extends BaseMongoObject {
	public property?: {
		value?: string;
	};
}

const getLockFieldsMongoClient = (
	t: ExecutionContext<TestContext>,
	keepHistoric: boolean = false,
): N9MongoDBClient<SampleComplexType, null> =>
	new N9MongoDBClient(getOneCollectionName(), SampleComplexType, null, {
		...getBaseMongoClientSettings(t),
		keepHistoric,
		lockFields: {
			excludedFields: ['excludedField', 'excludedArray'],
			arrayWithReferences: {
				objects: 'code',
			},
		},
	});

init();

test('[LOCK-FIELDS] Update one from no value should be locked', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = getLockFieldsMongoClient(t);

	const locksDataSample = {};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '');

	const entity = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		{
			property: {
				value: 'test',
			},
		},
		'TEST',
		true,
	);

	t.true(!!entity.objectInfos.lockFields, 'is there some lock fields');
	t.deepEqual(
		_.map(entity.objectInfos.lockFields, 'path'),
		['property.value'],
		'lock field is present',
	);
});
