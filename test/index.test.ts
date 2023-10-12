import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
	public field3String?: string;
}

class SubArrayType {
	public id: string;
	public filedNumber: number;
}

class ArrayType {
	public 'id': string;
	public 'sub-array': SubArrayType[];
}

class SampleArrayType extends BaseMongoObject {
	public id: number;
	public array: ArrayType[];
}

init();

test('[CRUD] Insert one and find it', async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection<SampleType>(getOneCollectionName());
	const mongoClient = new N9MongoDBClient(
		collection,
		SampleType,
		SampleTypeListing,
		getBaseMongoClientSettings(t),
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	await mongoClient.insertOne(
		{
			_id: '--', // A wrong ID
			field1String: 'string1',
			field2Number: intValue,
		},
		'userId1',
	);

	const sizeWithElementIn = await mongoClient.count();
	const foundObject = await mongoClient.findOne({ field1String: 'string1' });
	const foundObjectById = await mongoClient.findOneById(foundObject._id);
	const foundObjectByKey = await mongoClient.findOneByKey('string1', 'field1String');
	const existsById = await mongoClient.existsById(foundObject._id);
	const foundWithNativeClient = await collection.findOne<SampleType>({ field1String: 'string1' });

	t.truthy(foundObject, 'found by query');
	t.is(sizeWithElementIn, 1, 'nb element in collection');
	t.is(foundObject.field2Number, intValue, 'found right element');
	t.is(typeof foundObject._id, 'string', 'ID is a string and not ObjectId');
	t.is(foundObject._id.constructor.name, 'String', 'ID is a string and not ObjectId');
	t.is(foundWithNativeClient._id.constructor.name, 'ObjectId', 'ID is an ObjectId on MongoDB');
	t.truthy(foundObjectById, 'found by ID');
	t.truthy(foundObjectByKey, 'found by key');
	t.true(existsById, 'exists by ID');

	await mongoClient.dropCollection();
});

test('[CRUD] Find one and update', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		t.context.db.collection(getOneCollectionName()),
		SampleType,
		SampleTypeListing,
		getBaseMongoClientSettings(t),
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	const intValue2 = 42;

	const insertedDocument = await mongoClient.insertOne(
		{
			field1String: 'string1',
			field2Number: intValue,
		},
		'userId1',
	);
	const sizeAfterInsert = await mongoClient.count();

	const updateQuery = { $set: { field2Number: intValue2 } };

	const founded = await mongoClient.findOneAndUpdate(
		{
			field1String: 'string1',
			field2Number: intValue,
		},
		updateQuery,
		'userId',
	);

	let sizeAfterUpdate = await mongoClient.count();

	t.is(founded.field2Number, updateQuery.$set.field2Number, 'Element has been updated');
	t.true(
		founded.objectInfos.lastUpdate.date.getTime() >
			insertedDocument.objectInfos.lastUpdate.date.getTime(),
		'Element update has last update date changed',
	);
	t.is(sizeAfterUpdate, sizeAfterInsert, 'No new element added');

	const notFound = await mongoClient.findOneAndUpdate(
		{
			field1String: 'string1',
			field2Number: intValue, // the value is now intValue2
		},
		updateQuery,
		'userId',
	);
	sizeAfterUpdate = await mongoClient.count();

	t.true(!notFound && sizeAfterUpdate === sizeAfterInsert, 'No element updated or created');

	await mongoClient.dropCollection();
});

test('[CRUD] Find one and update with filter', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		t.context.db.collection(getOneCollectionName()),
		SampleArrayType,
		SampleTypeListing,
		getBaseMongoClientSettings(t),
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 2;
	const intValue2 = 9;

	await mongoClient.insertOne(
		{
			id: 52,
			array: [
				{
					'id': '1',
					'sub-array': [
						{ id: 'sub-1', filedNumber: 1 },
						{ id: 'sub-2', filedNumber: intValue },
					],
				},
				{
					'id': '2',
					'sub-array': [
						{ id: 'sub-1', filedNumber: 3 },
						{ id: 'sub-2', filedNumber: 4 },
					],
				},
			],
		},
		'userId1',
	);
	const sizeAfterInsert = await mongoClient.count();

	const updateQuery = {
		$set: { 'array.$[arrayParam].sub-array.$[subArrayParam].filedNumber': intValue2 },
	};

	const filters = [{ 'arrayParam.id': '1' }, { 'subArrayParam.id': 'sub-2' }];

	const founded = await mongoClient.findOneAndUpdate(
		{ id: 52 },
		updateQuery,
		'userId',
		false,
		false,
		true,
		filters,
	);

	let sizeAfterUpdate = await mongoClient.count();

	t.is(founded.array[0]['sub-array'][1].filedNumber, intValue2, 'Element has been updated');

	t.is(sizeAfterUpdate, sizeAfterInsert, 'No new element added');

	const notFound = mongoClient.find({
		'array.sub-array.filedNumber': intValue, // the value is now intValue2
	});
	sizeAfterUpdate = await mongoClient.count();

	t.true(
		(await notFound.count()) === 0 && sizeAfterUpdate === sizeAfterInsert,
		'No element updated or created',
	);

	await mongoClient.dropCollection();
});

test('[CRUD] Find one and upsert', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		SampleTypeListing,
		getBaseMongoClientSettings(t),
	);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const intValue = 41;
	const intValue2 = 42;

	await mongoClient.insertOne(
		{
			field1String: 'string1',
			field2Number: intValue,
		},
		'userId1',
	);
	const sizeAfterInsert = await mongoClient.count();

	const updateQuery = { $set: { field2Number: intValue2 } };

	const founded = await mongoClient.findOneAndUpsert(
		{
			field1String: 'string1',
			field2Number: intValue,
		},
		updateQuery,
		'userId',
	);
	const sizeAfterUpdate = await mongoClient.count();

	t.is(founded.field2Number, updateQuery.$set.field2Number, 'Element has been updated');
	t.is(sizeAfterUpdate, sizeAfterInsert, 'No new element added');

	const upserted = await mongoClient.findOneAndUpsert(
		{
			field1String: 'string3',
		},
		updateQuery,
		'userId',
	);
	const sizeAfterUpsert = await mongoClient.count();

	t.is(sizeAfterUpsert, sizeAfterUpdate + 1, 'A new element has been created');
	t.true(
		upserted.field2Number === updateQuery.$set.field2Number && upserted.field1String === 'string3',
		'Element has been created with updated value',
	);

	await mongoClient.dropCollection();
});

// TODO: Test insert object like { 'a.b': 'c' } for elasticsearch error
// TODO: Test history in collection
