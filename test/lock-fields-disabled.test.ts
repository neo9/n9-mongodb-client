import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';

import { BaseMongoObject, MongoClient } from '../src';
import { ArrayElement, init } from './fixtures/utils';

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

const getMongoClient = (): MongoClient<SampleComplexType, SampleComplexType> =>
	new MongoClient(`test-${Date.now()}`, SampleComplexType, SampleComplexType, {
		keepHistoric: true,
	});

global.log = new N9Log('tests').module('lock-fields');

init();

test('[LOCK-FIELDS-DISABLED] Insert one, update it and check undefined values are not replace by null', async (t: Assertions) => {
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
			await mongoClient.findOneAndUpdateByIdWithLocks(entity._id, _.cloneDeep(locksDataSample), '');
		},
		{ message: 'can-t-lock-fields-with-disabled-feature' },
	);

	const newValue: any = _.omit(entity, ['_id', 'objectInfos']);
	newValue.objects[2].value = null; // delete one value
	newValue.text = null; // delete one value
	await mongoClient.findOneAndUpdateByIdWithLocks(entity._id, _.cloneDeep(newValue), '', false);

	const entityUpdated = await mongoClient.findOneById(entity._id);

	t.deepEqual(
		_.omit(entityUpdated, ['_id', 'objectInfos']),
		{
			text: null,
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
		} as any,
		'check after update, null values delete the values',
	);
});
