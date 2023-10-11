import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

init();

test('[DELETE-ONE] Delete one by id', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		BaseMongoObject,
		BaseMongoObject,
		getBaseMongoClientSettings(t),
	);

	const initialValue: any = {
		key: 'value',
	};

	const savedObject = await mongoClient.insertOne(initialValue, 'userId1', false);

	const foundObject = await mongoClient.findOneById(savedObject._id);
	t.truthy(foundObject, 'found by query');
	t.is(await mongoClient.count({}), 1, 'collection contains 1 element');

	const deletedElement = await mongoClient.deleteOneById(savedObject._id);
	t.is(await mongoClient.count({}), 0, 'collection contains 0 element');
	t.is<string, string>(
		deletedElement._id,
		savedObject._id,
		'deleted element ID is same as the created one',
	);

	await mongoClient.dropCollection();
});
