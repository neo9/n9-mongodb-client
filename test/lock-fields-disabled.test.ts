import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';
import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class ArrayElement {
	public code: string;
	public value: string;
}

class SampleComplexType extends BaseMongoObject {
	public text: string;
	public excludedField: string;
	public excludedArray?: string[];
	public property: {
		value: string;
	};
	public objects: ArrayElement[];
	public strings: string[];
}

const locksDataSample: SampleComplexType = {
	text: 'text sample',
	excludedField: 'not locked field',
	excludedArray: ['excludeArrayValue1'],
	property: {
		value: undefined,
	},
	strings: ['a', undefined],
	objects: [
		{
			code: 'k1',
			value: undefined,
		},
		{
			code: 'k2',
			value: null,
		},
		{
			code: 'k3',
			value: 'v3',
		},
	],
};

const getMongoClient = () => {
	return new MongoClient(`test-${Date.now()}`, SampleComplexType, SampleComplexType, {
		keepHistoric: true,
	});
};

global.log = new N9Log('tests').module('lock-fields');

init();

ava(
	'[LOCK-FIELDS-DISABLED] Insert one, update it and check undefined values are not replace by null',
	async (t: Assertions) => {
		const mongoClient = getMongoClient();

		const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '');
		const entity = await mongoClient.findOneById(insertedEntity._id);

		t.true(_.isEmpty(entity.objectInfos.lockFields), 'no lock fields present');

		t.deepEqual(
			_.omit(entity, ['_id', 'objectInfos']) as any,
			{
				text: 'text sample',
				excludedField: 'not locked field',
				excludedArray: ['excludeArrayValue1'],
				property: {},
				strings: ['a'],
				objects: [
					{
						code: 'k1',
					},
					{
						code: 'k2',
					},
					{
						code: 'k3',
						value: 'v3',
					},
				],
			},
			'undefined fields are not kept and not replaced by null',
		);

		await t.throwsAsync(
			async () => {
				await mongoClient.findOneAndUpdateByIdWithLocks(
					entity._id,
					_.cloneDeep(locksDataSample),
					'',
				);
			},
			{ message: 'can-t-lock-fields-with-disabled-feature' },
		);
		await mongoClient.findOneAndUpdateByIdWithLocks(
			entity._id,
			_.cloneDeep(locksDataSample),
			'',
			false,
		);

		const entityUpdated = await mongoClient.findOneById(entity._id);

		const newValue: any = _.omit(entityUpdated, ['_id', 'objectInfos']);
		newValue.objects[2].value = null; // delete one value

		t.deepEqual(
			newValue,
			{
				text: 'text sample',
				excludedField: 'not locked field',
				excludedArray: ['excludeArrayValue1'],
				property: {},
				strings: ['a'],
				objects: [
					{
						code: 'k1',
					},
					{
						code: 'k2',
					},
					{
						code: 'k3',
						value: null,
					},
				],
			},
			'check after update, null are kept only while deleting values',
		);
	},
);
