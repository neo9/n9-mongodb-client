import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';
import { Db } from 'mongodb';

import { MongoClient, MongoUtils } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public externalReferences: {
		value: string;
	}[];
	public sku: string;
	public value: string;
	public status?: string;
}

class DataSample extends BaseMongoObject {
	value: string;
}

class DataSampleWithCode extends BaseMongoObject {
	code: boolean | number;
	value: string;
}

class DataSampleWithCodes extends BaseMongoObject {
	id: number;
	codes: string[];
	value: string;
}

global.log = new N9Log('tests');

init();

function mapSampleTypeCreateToSampleType(
	sampleType: SampleType,
	existingSampleTypeEntity?: SampleType,
): SampleType {
	const reusedData: Partial<SampleType> = {};
	if (existingSampleTypeEntity) {
		const existingReferences = (existingSampleTypeEntity.externalReferences || [])
			.map((r) => r.value)
			.sort();
		const newSku = sampleType.sku;
		if (!_.isEmpty(existingReferences) && newSku) {
			const allReferences = existingSampleTypeEntity.externalReferences || [];
			allReferences.push(...sampleType.externalReferences);
			reusedData.externalReferences = _.uniqBy(allReferences, 'value');
		}
	}

	const sampleType1: SampleType = {
		sku: sampleType.sku,
		...sampleType,
		...reusedData,
	};

	if (existingSampleTypeEntity) {
		sampleType1.sku = existingSampleTypeEntity.sku;
	}
	return sampleType1;
}

ava('[UPDATE MANY AT ONCE] Should update one document', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, SampleType, SampleType, {});

	const insertedValue = await mongoClient.insertOne(
		{
			externalReferences: [
				{
					value: 'ext1',
				},
			],
			sku: 'sku-1',
			value: '0',
		},
		'test',
	);
	t.is(insertedValue.value, '0', 'value inserted');

	const newEntity1: SampleType = {
		sku: 'sku-1',
		externalReferences: [
			{
				value: 'ext1',
			},
		],
		value: '1',
	};
	const newEntity2: SampleType = {
		_id: '012345678901234567890123', // try to edit the mongodb ID, it will be ignored
		sku: 'sku-2',
		externalReferences: [
			{
				value: 'ext2',
			},
		],
		value: '2',
	};
	const newEntity3: SampleType = {
		_id: MongoUtils.oid('012345678901234567890123') as any, // try to edit the mongodb ID, it will be ignored
		sku: 'new-sku-3',
		externalReferences: [
			{
				value: 'ext3',
			},
		],
		value: '3',
	};

	const updateResult = await (
		await mongoClient.updateManyAtOnce([newEntity1, newEntity2, newEntity3], 'userId', {
			query: (entity: Partial<SampleType>) => {
				const q = {
					$or: [
						{
							sku: entity.sku,
						},
						{
							'externalReferences.value': {
								$in: _.map(entity.externalReferences, 'value'),
							},
						},
					],
				};
				return q;
			},
			upsert: true,
			lockNewFields: false,
			mapFunction: (entity: SampleType, existingEntity) =>
				mapSampleTypeCreateToSampleType(entity, existingEntity),
			onlyInsertFieldsKey: ['sku'],
			forceEditLockFields: false,
		})
	).toArray();
	const sampleTypeFoundWithNativeClient = await (global.db as Db)
		.collection(collectionName)
		.findOne<SampleType>({ sku: newEntity2.sku });

	t.is(updateResult.length, 3, '3 entities updated');
	t.is(updateResult.find((res) => res.sku === newEntity1.sku).value, '1', 'value updated');
	t.is(typeof sampleTypeFoundWithNativeClient._id, 'object', '_id is still an object');
});

ava('[UPDATE MANY AT ONCE] Should update one document by _id ObjectID', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, DataSample, DataSample, {});

	const dataSample: DataSample = {
		value: 'init',
	};
	const insertedValue = await mongoClient.insertOne(_.cloneDeep(dataSample), '', false, true);

	const entities = await mongoClient.updateManyAtOnce(
		[
			{
				_id: insertedValue._id,
				value: 'update',
			},
		],
		'TEST',
		{
			query: (e) => ({ _id: MongoUtils.oid(e._id) as any }),
		},
	);

	const dataUpdatedArray = await entities.toArray();
	t.is(dataUpdatedArray.length, 1, '1 value updated');
	t.deepEqual(dataUpdatedArray[0].value, 'update', 'value is updated');
});

ava(
	'[UPDATE MANY AT ONCE] Should call mapAfterLockFieldsApplied with merged entity on update',
	async (t: Assertions) => {
		const collectionName = `test-${Date.now()}`;
		const mongoClient = new MongoClient(collectionName, SampleType, SampleType, {
			lockFields: {
				arrayWithReferences: {
					externalReferences: 'value',
				},
				excludedFields: ['sku', 'status'],
			},
		});

		const insertedValue = await mongoClient.insertOne(
			{
				externalReferences: [
					{
						value: 'ext1',
					},
				],
				sku: 'sku-1',
				value: '0',
			},
			'test',
		);
		t.is(insertedValue.value, '0', 'value inserted');
		t.is(insertedValue.status, undefined, 'status is undefined');
		t.is(insertedValue.objectInfos.lockFields.length, 2, 'should lock new fields');

		const newEntity: SampleType = {
			sku: 'sku-1',
			externalReferences: [
				{
					value: 'ext1',
				},
			],
			value: '1',
		};

		const updateResult = await (
			await mongoClient.updateManyAtOnce([newEntity], 'userId', {
				query: (e) => ({ sku: e.sku }),
				upsert: true,
				lockNewFields: false,
				forceEditLockFields: false,
				mapFunction: (entity: SampleType, existingEntity) =>
					mapSampleTypeCreateToSampleType(entity, existingEntity),
				hooks: {
					mapAfterLockFieldsApplied: (entity) => {
						t.is(entity.value, '0', 'entity merged with existing value should have locked value');
						return {
							...entity,
							status: 'OK',
						};
					},
				},
			})
		).toArray();

		t.is(updateResult.length, 1, '1 entity updated');
		t.is(updateResult[0].value, '0', 'value not updated');
		t.is(updateResult[0].status, 'OK', 'status updated');
	},
);

ava(
	'[UPDATE MANY AT ONCE] Should call mapAfterLockFieldsApplied with new entity on insert',
	async (t: Assertions) => {
		const collectionName = `test-${Date.now()}`;
		const mongoClient = new MongoClient(collectionName, SampleType, SampleType, {});

		const newEntity: SampleType = {
			sku: 'sku-1',
			externalReferences: [
				{
					value: 'ext1',
				},
			],
			value: '1',
		};

		const updateResult = await (
			await mongoClient.updateManyAtOnce([newEntity], 'userId', {
				upsert: true,
				lockNewFields: false,
				forceEditLockFields: false,
				mapFunction: (entity: SampleType, existingEntity) =>
					mapSampleTypeCreateToSampleType(entity, existingEntity),
				hooks: {
					mapAfterLockFieldsApplied: (entity) => {
						t.is(entity.value, '1', 'entity value should be the same');
						return {
							...entity,
							status: 'OK',
						};
					},
				},
			})
		).toArray();

		t.is(updateResult.length, 1, '1 entity updated');
		t.is(updateResult[0].value, '1', 'value not updated');
		t.is(updateResult[0].status, 'OK', 'status updated');
	},
);

ava('[UPDATE MANY AT ONCE] Should update nothing with empty array', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;

	const mongoClient = new MongoClient(collectionName, DataSample, DataSample, {});

	const dataSample: DataSample = {
		value: 'init',
	};
	await mongoClient.insertOne(_.cloneDeep(dataSample), '', false, true);

	const entities = await mongoClient.updateManyAtOnce([], 'TEST', {
		query: (e) => ({ _id: MongoUtils.oid(e._id) as any }),
	});

	const dataUpdatedArray = await entities.toArray();
	t.is(dataUpdatedArray.length, 0, '0 value updated');
});

ava(
	'[UPDATE MANY AT ONCE] Update entity by query on attribut type number',
	async (t: Assertions) => {
		const collectionName = `test-${Date.now()}`;
		const mongoClient = new MongoClient(collectionName, DataSampleWithCode, DataSampleWithCode, {});

		const dataSample: DataSampleWithCode = {
			code: 1,
			value: 'init',
		};
		await mongoClient.insertOne(_.cloneDeep(dataSample), '', false, false);

		const entities = await mongoClient.updateManyAtOnce(
			[
				{
					code: 1,
					value: 'update',
				},
			],
			'TEST',
			{
				query: 'code',
			},
		);

		t.deepEqual((await entities.toArray())[0].value, 'update', 'value is updated');
	},
);

/**
 * This test fail due to a hash computed in `mingo`. This hash is the same for `KNE_OC42-midas` and `KNE_OCS3-midas`.
 */
ava('[UPDATE MANY AT ONCE] Update with mingo hash collision ', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, DataSampleWithCodes, DataSampleWithCodes, {});
	await mongoClient.createUniqueIndex('codes');
	const dataSample1: DataSampleWithCodes = {
		id: 1,
		codes: ['KNE_OC42-midas'],
		value: 'init',
	};
	const dataSample2: DataSampleWithCodes = {
		id: 2,
		codes: ['KNE_OCS3-midas'],
		value: 'init',
	};
	await mongoClient.insertOne(_.cloneDeep(dataSample1), '', false, false);
	await mongoClient.insertOne(_.cloneDeep(dataSample2), '', false, false);

	await t.notThrowsAsync(
		async () =>
			await mongoClient.updateManyAtOnce(
				[
					{
						id: 1,
						codes: ['KNE_OC42-midas'],
						value: 'init',
					},
					{
						id: 2,
						codes: ['KNE_OCS3-midas'],
						value: 'init',
					},
				],
				'TEST',
				{
					query: (entity) => {
						const q = {
							$or: [
								{
									id: entity.id,
								},
								{
									codes: {
										$in: entity.codes,
									},
								},
							],
						};
						return q;
					},
					mapFunction: (entity: DataSampleWithCodes, existingEntity) => {
						t.is(entity.id, existingEntity.id, `Existing entity and new one have the same id`);
						return {
							...entity,
							codes: [...entity.codes, ...existingEntity.codes],
						};
					},
				},
			),
	);
	await mongoClient.dropCollection();
});

ava(
	'[UPDATE MANY AT ONCE] Update entity by query on attribut type boolean',
	async (t: Assertions) => {
		const collectionName = `test-${Date.now()}`;
		const mongoClient = new MongoClient(collectionName, DataSampleWithCode, DataSampleWithCode, {});

		const dataSample: DataSampleWithCode = {
			code: true,
			value: 'init',
		};
		await mongoClient.insertOne(_.cloneDeep(dataSample), '', false);

		const entities = await mongoClient.updateManyAtOnce(
			[
				{
					code: true,
					value: 'update',
				},
			],
			'TEST',
			{
				query: 'code',
			},
		);

		t.deepEqual((await entities.toArray())[0].value, 'update', 'value is updated');
	},
);

ava('[UPDATE MANY AT ONCE] Throw on missing value', async (t: Assertions) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, DataSample, DataSample, {});

	const dataSample: DataSample = {
		value: 'init',
	};
	await mongoClient.insertOne(_.cloneDeep(dataSample), '', false);

	await t.throwsAsync(
		mongoClient.updateManyAtOnce(
			[
				{
					value: 'update',
				},
			],
			'TEST',
			{
				query: 'code', // wrong property
			},
		),
		{
			message: 'entity-value-missing',
		},
		'throw error due to missing `code` in entity but requested with query',
	);
});
