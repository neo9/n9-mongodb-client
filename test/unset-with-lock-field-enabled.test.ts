import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';
import { MongoClient, MongoUtils } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class SampleComplexType extends BaseMongoObject {
	public property?: {
		value?: string;
	};
}

const getLockFieldsMongoClient = (keepHistoric: boolean = false) => {
	return new MongoClient(`test-${Date.now()}`, SampleComplexType, null, {
		keepHistoric,
		lockFields: {},
	});
};

global.log = new N9Log('tests').module('lock-fields');

init();

ava('[LOCK-FIELDS] Update one field with value to null', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

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

ava('[LOCK-FIELDS] Insert one field with value null', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

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

ava('[LOCK-FIELDS] Update multiple field with value to null', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

	const locksDataSample: SampleComplexType = {
		property: {
			value: 'initial-value',
		},
	};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '', false);

	const entities = await mongoClient.updateManyAtOnce(
		[
			{
				_id: MongoUtils.oid(insertedEntity._id) as any,
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

ava(
	'[LOCK-FIELDS] Insert multiple entities with one field with value null',
	async (t: Assertions) => {
		const mongoClient = getLockFieldsMongoClient();

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
					_id: MongoUtils.oid(insertedEntity._id) as any,
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
					_id: MongoUtils.oid(insertedEntity._id) as any,
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
					_id: MongoUtils.oid(insertedEntity._id) as any,
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
	},
);
