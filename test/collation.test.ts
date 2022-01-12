import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import { CollationDocument } from 'mongodb';

import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
	public field3String?: string;
}

global.log = new N9Log('tests');

init();

ava('[CRUD] Insert multiples and find with collation', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleTypeListing);
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
	const collationStrength2: CollationDocument = { locale: 'fr', strength: 2 };

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

	const findWithCollationStrengthTwo = mongoClient.find(
		{ field1String: 'test' },
		undefined,
		undefined,
		undefined,
		undefined,
		collationStrength2,
	);

	t.is(sizeWithElementIn, 4, 'nb element in collection');
	t.is(await findWithCollationStrengthOne.count(), 4, 'nb element collation strength 1');
	t.is(await findWithCollationStrengthTwo.count(), 2, 'nb element collation strength 2');
	t.is(await findAllWithoutCollation.count(), 4, 'nb elements');
	t.is(await findWithoutCollation.count(), 1, 'nb element without collation');

	await mongoClient.dropCollection();
});
