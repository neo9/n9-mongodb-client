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
}

global.log = new N9Log('tests');

init();

async function mapSampleTypeCreateToSampleType(
	sampleType: SampleType,
	existingSampleTypeEntity?: SampleType,
): Promise<SampleType> {
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
