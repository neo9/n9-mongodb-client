import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import { CollationDocument } from 'mongodb';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
	public field3String?: string;
}

global.log = new N9Log('tests');

let mongod: MongoMemoryServer;

test.before(async () => {
	mongod = new MongoMemoryServer();
	const uri = await mongod.getConnectionString();
	await MongoUtils.connect(uri);
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
	await mongod.stop();
});

test('[CRUD] Insert multiples and find with collation', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	await mongoClient.insertOne({
		field1String: 'test',
		field2Number: intValue
	}, 'userId1');

	await mongoClient.insertOne({
		field1String: 'Test',
		field2Number: intValue
	}, 'userId1');

	await mongoClient.insertOne({
		field1String: 'Têst',
		field2Number: intValue
	}, 'userId1');

	await mongoClient.insertOne({
		field1String: 'têst',
		field2Number: intValue
	}, 'userId1');

	const collationStrength1: CollationDocument = { locale: 'fr', strength: 1 };
	const collationStrength2: CollationDocument = { locale: 'fr', strength: 2 };

	const sizeWithElementIn = await mongoClient.count();
	const findWithoutCollation = await mongoClient.find({ field1String: 'test' });
	const findAllWithoutCollation = await mongoClient.find({});
	const findWithCollationStrengthOne = await mongoClient.find(
		{ field1String: 'test' },
		undefined,
		undefined,
		undefined,
		undefined,
		collationStrength1);

	const findWithCollationStrengthTwo = await mongoClient.find(
		{ field1String: 'test' },
		undefined,
		undefined,
		undefined,
		undefined,
		collationStrength2);

	t.is(sizeWithElementIn, 4, 'nb element in collection');
	t.is(await findWithCollationStrengthOne.count(), 4, 'nb element collation strength 1');
	t.is(await findWithCollationStrengthTwo.count(), 2, 'nb element collation strength 2');
	t.is(await findAllWithoutCollation.count(), 4, 'nb elements');
	t.is(await findWithoutCollation.count(), 1, 'nb element without collation');

	await mongoClient.dropCollection();
});
