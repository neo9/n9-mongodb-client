import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';

import { BaseMongoObject, MongoUtils, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleComplexType extends BaseMongoObject {
	public property?: {
		value?: string;
	};
}

const getLockFieldsMongoClient = (
	t: ExecutionContext<TestContext>,
): N9MongoDBClient<SampleComplexType, SampleComplexType> => {
	return new N9MongoDBClient(getOneCollectionName(), SampleComplexType, null, {
		...getBaseMongoClientSettings(t),
		lockFields: {},
	});
};

init();

test('[LOCK-FIELDS] Update one field with value to null', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = getLockFieldsMongoClient(t);

	const locksDataSample: SampleComplexType = {
		property: {
			value: 'initial-value',
		},
	};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '', false);

	const entity = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		{
			property: {
				value: null,
			},
		},
		'TEST',
		false,
	);

	t.deepEqual(entity.property, { value: null }, 'value is deleted');
});

test('[LOCK-FIELDS] Insert one field with value null', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = getLockFieldsMongoClient(t);

	const locksDataSample: SampleComplexType = {
		property: {
			value: null,
		},
	};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '', false);

	t.deepEqual(insertedEntity.property, { value: null }, 'value is null');

	let entity = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		{
			property: {
				value: null,
			},
		},
		'TEST',
		false,
	);

	t.deepEqual(entity.property, { value: null }, 'value still null');

	entity = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		{
			property: {
				value: 'a value not null',
			},
		},
		'TEST',
		false,
	);

	t.deepEqual(entity.property, { value: 'a value not null' }, 'value no more null');

	entity = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		{
			property: {
				value: null,
			},
		},
		'TEST',
		false,
	);

	t.deepEqual(entity.property, { value: null }, 'value null again');
});

test('[LOCK-FIELDS] Update multiple field with value to null', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = getLockFieldsMongoClient(t);

	const locksDataSample: SampleComplexType = {
		property: {
			value: 'initial-value',
		},
	};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '', false);

	const entities = await mongoClient.updateManyAtOnce(
		[
			{
				_id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) as any,
				property: {
					value: null,
				},
			},
		],
		'TEST',
		{
			lockNewFields: false,
			query: '_id',
		},
	);

	t.deepEqual((await entities.toArray())[0].property, { value: null }, 'value is deleted');
});

test('[LOCK-FIELDS] Insert multiple entities with one field with value null', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = getLockFieldsMongoClient(t);

	const locksDataSample: SampleComplexType = {
		property: {
			value: null,
		},
	};
	const insertedEntities = await mongoClient.updateManyAtOnce(
		[_.cloneDeep(locksDataSample)],
		'TEST',
		{
			lockNewFields: false,
			upsert: true,
		},
	);

	const insertedEntity = (await insertedEntities.toArray())[0];

	t.deepEqual(insertedEntity.property, { value: null }, 'value is null');
	let entities = await mongoClient.updateManyAtOnce(
		[
			{
				_id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) as any,
				property: {
					value: null,
				},
			},
		],
		'TEST',
		{
			lockNewFields: false,
			query: '_id',
		},
	);

	t.deepEqual((await entities.toArray())[0].property, { value: null }, 'value still null');

	entities = await mongoClient.updateManyAtOnce(
		[
			{
				_id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) as any,
				property: {
					value: 'a value not null',
				},
			},
		],
		'TEST',
		{
			lockNewFields: false,
			query: '_id',
		},
	);

	t.deepEqual(
		(await entities.toArray())[0].property,
		{ value: 'a value not null' },
		'value no more null',
	);

	entities = await mongoClient.updateManyAtOnce(
		[
			{
				_id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) as any,
				property: {
					value: null,
				},
			},
		],
		'TEST',
		{
			lockNewFields: false,
			query: '_id',
		},
	);

	t.deepEqual((await entities.toArray())[0].property, { value: null }, 'value null again');
});
