import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';

import {
	generateMongoClient,
	generateMongoClientForSimpleArray,
	init,
	SampleEntityWithArray,
	SampleEntityWithSimpleArray,
} from './fixtures/utils';

global.log = new N9Log('tests').module('lock-fields-arrays');

init();

const a = {
	code: 'a',
	label: {
		'en-GB': 'Label en a',
		'fr-FR': 'Label fr a',
	},
};
const b = {
	code: 'b',
	label: {
		'en-GB': 'Label en b',
		'fr-FR': 'Label fr b',
	},
};
const c = {
	code: 'c',
	label: {
		'en-GB': 'Label en c',
		'fr-FR': 'Label fr c',
	},
};

/**
 * E :  [a,b,c]
 * E':  undefined
 *
 * Creation of E by an operator (human) =>  all is locked => [a🔒,b🔒,c🔒]
 * Import E' => nothing should have changed => [a🔒,b🔒,c🔒]
 */
test('[LOCK-FIELDS-ARRAY E] Lock fields array should not disappear', async (t: Assertions) => {
	const vE: SampleEntityWithArray = {
		code: 'e',
		parameters: {
			items: _.cloneDeep([a, b, c]),
		},
	};

	const mongoClient = generateMongoClient();
	await mongoClient.initHistoricIndexes();

	// Simulate user creation
	const entityCreated = await mongoClient.insertOne(vE, 'userId', true);
	t.truthy(entityCreated.objectInfos.lockFields, '[entityCreated] Has all fields locked');
	t.is(entityCreated.objectInfos.lockFields.length, 6, '[entityCreated] Has all fields locked');
	t.deepEqual(
		_.map(entityCreated.parameters.items, 'code'),
		['a', 'b', 'c'],
		'[entityCreated] All values saved',
	);

	const vEp = _.cloneDeep(vE);
	vEp.parameters.items = null;

	// Simulate import
	const resultImport1: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vEp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.truthy(resultImport1[0].objectInfos.lockFields, '[resultImport1] Has lock fields');
	t.deepEqual(
		_.map(resultImport1[0].parameters.items, 'code'),
		['a', 'b', 'c'],
		'[resultImport1] Elements are still there',
	);
});
/**
 * E :  [a,b,c]
 * E':  undefined
 *
 * Creation of E by an operator (human) =>  all is locked => [a🔒,b🔒,c🔒]
 * Edit with E' => array should be null => null
 */
test('[LOCK-FIELDS-ARRAY E] Lock fields array delete array', async (t: Assertions) => {
	const vE: SampleEntityWithArray = {
		code: 'e',
		parameters: {
			items: _.cloneDeep([a, b, c]),
		},
	};

	const mongoClient = generateMongoClient();
	await mongoClient.initHistoricIndexes();

	// Simulate user creation
	const entityCreated = await mongoClient.insertOne(vE, 'userId', true);
	t.truthy(entityCreated.objectInfos.lockFields, '[entityCreated] Has all fields locked');
	t.is(entityCreated.objectInfos.lockFields.length, 6, '[entityCreated] Has all fields locked');
	t.deepEqual(
		_.map(entityCreated.parameters.items, 'code'),
		['a', 'b', 'c'],
		'[entityCreated] All values saved',
	);

	const vEp = _.cloneDeep(vE);
	vEp.parameters.items = null;

	// Simulate import
	const resultEdit1: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vEp], 'externalUser', {
			upsert: true,
			lockNewFields: true,
			query: 'code',
			forceEditLockFields: true,
		})
	).toArray();
	t.truthy(resultEdit1[0].objectInfos.lockFields, '[resultEdit1] Has lock fields');
	t.is(resultEdit1[0].parameters.items, null, '[resultEdit1] Array is null');
	t.falsy(
		resultEdit1[0].objectInfos.lockFields.find(
			(lockField) => lockField.path === 'parameters.items[code=a].label.en-GB',
		),
		'[resultEdit1[0]] Lockfields are cleaned',
	);
	t.is(
		resultEdit1[0].objectInfos.lockFields.length,
		0,
		'[resultEdit1[0]] Has no fields locked, array is empty',
	);
});

/**
 * E :  [a,b,c]
 * E':  undefined
 *
 * Creation of E by an operator (human) =>  all is locked => [a🔒,b🔒,c🔒]
 * Import E' => nothing should have changed => [a🔒,b🔒,c🔒]
 */
test('[LOCK-FIELDS-ARRAY E] Lock fields array should not disappear with simple array', async (t: Assertions) => {
	const vE: SampleEntityWithSimpleArray = {
		code: 'e',
		parameters: {
			items: ['a', 'b', 'c'],
		},
	};

	const mongoClient = generateMongoClientForSimpleArray();
	await mongoClient.initHistoricIndexes();

	// Simulate user creation
	const entityCreated = await mongoClient.insertOne(vE, 'userId', true);
	t.truthy(entityCreated.objectInfos.lockFields, '[entityCreated] Has all fields locked');
	t.is(entityCreated.objectInfos.lockFields.length, 3, '[entityCreated] Has all fields locked');
	t.deepEqual(entityCreated.parameters.items, ['a', 'b', 'c'], '[entityCreated] All values saved');

	const vEp = _.cloneDeep(vE);
	vEp.parameters.items = null;

	// Simulate import
	const resultImport1: SampleEntityWithSimpleArray[] = await (
		await mongoClient.updateManyAtOnce([vEp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.truthy(resultImport1[0].objectInfos.lockFields, '[resultImport1] Has lock fields');
	t.deepEqual(
		resultImport1[0].parameters.items,
		['a', 'b', 'c'],
		'[resultImport1] Elements are still there',
	);
});
