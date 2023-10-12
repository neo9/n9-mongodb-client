import test, { ExecutionContext } from 'ava';
import _ from 'lodash';

import { BaseMongoObject, N9MongoDBClient } from '../../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from '../fixtures';

class PrimitiveArrayHolder extends BaseMongoObject {
	public booleanArray: boolean[];
	public numberArray: number[];
	public stringArray: string[];
}
init();

test('[ISSUE-INVALID-PRIMITIVE-VALUE] Primitive should be mapped correctly', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		PrimitiveArrayHolder,
		PrimitiveArrayHolder,
		getBaseMongoClientSettings(t),
	);

	const initialValue: PrimitiveArrayHolder = {
		booleanArray: [true, false],
		numberArray: [42, 3.14],
		stringArray: ['xxx', 'yyy'],
	};

	const savedObject = await mongoClient.insertOne(_.cloneDeep(initialValue), 'userId1', false);
	const foundObject = await mongoClient.findOneById(savedObject._id);

	t.deepEqual(savedObject.booleanArray, initialValue.booleanArray);
	t.deepEqual(savedObject.numberArray, initialValue.numberArray);
	t.deepEqual(savedObject.stringArray, initialValue.stringArray);

	t.deepEqual(foundObject.booleanArray, initialValue.booleanArray);
	t.deepEqual(foundObject.numberArray, initialValue.numberArray);
	t.deepEqual(foundObject.stringArray, initialValue.stringArray);

	await mongoClient.dropCollection();
});
