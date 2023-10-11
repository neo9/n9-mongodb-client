import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, CollationDocument, MongoDB, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
	public field3String?: string;
}

init();

test('[CRUD] Insert multiples and find with collation', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		SampleTypeListing,
		getBaseMongoClientSettings(t),
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	await mongoClient.insertOne(
		{
			field1String: 'test',
			field2Number: intValue,
		},
		'userId1',
	);

	await mongoClient.insertOne(
		{
			field1String: 'Test',
			field2Number: intValue,
		},
		'userId1',
	);

	await mongoClient.insertOne(
		{
			field1String: 'Têst',
			field2Number: intValue,
		},
		'userId1',
	);

	await mongoClient.insertOne(
		{
			field1String: 'têst',
			field2Number: intValue,
		},
		'userId1',
	);

	const collationStrength1: CollationDocument = { locale: 'fr', strength: 1 };
	const collationStrength2: MongoDB.CollationOptions = { locale: 'fr', strength: 2 };

	const sizeWithElementIn = await mongoClient.count();
	const findWithoutCollation = mongoClient.find({ field1String: 'test' });
	const findAllWithoutCollation = mongoClient.find({});
	const findWithCollationStrengthOne = mongoClient.find(
		{ field1String: 'test' },
		undefined,
		undefined,
		undefined,
		undefined,
		collationStrength1,
	);
	const findWithCollationStrengthOneWithN9FindCursor = mongoClient
		.find({ field1String: 'test' })
		.collation(collationStrength1);

	const findWithCollationStrengthTwo = mongoClient.find(
		{ field1String: 'test' },
		undefined,
		undefined,
		undefined,
		undefined,
		collationStrength2,
	);

	const findWithCollationStrengthTwoWithN9FindCursor = mongoClient
		.find({ field1String: 'test' })
		.collation(collationStrength2);

	t.is(sizeWithElementIn, 4, 'nb element in collection');
	t.is(await findWithCollationStrengthOne.count(), 4, 'nb element collation strength 1');
	t.is(
		await findWithCollationStrengthOneWithN9FindCursor.count(),
		4,
		'nb element collation strength 1 with N9FindCursor',
	);
	t.is(await findWithCollationStrengthTwo.count(), 2, 'nb element collation strength 2');
	t.is(
		await findWithCollationStrengthTwoWithN9FindCursor.count(),
		2,
		'nb element collation strength 2 with N9FindCursor',
	);
	t.is(await findAllWithoutCollation.count(), 4, 'nb elements');
	t.is(await findWithoutCollation.count(), 1, 'nb element without collation');

	await mongoClient.dropCollection();
});
