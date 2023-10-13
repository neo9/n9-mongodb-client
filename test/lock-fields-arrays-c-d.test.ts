import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';

import { generateMongoClient, init, SampleEntityWithArray, TestContext } from './fixtures';

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
const d = {
	code: 'd',
	label: {
		'en-GB': 'Label en d',
		'fr-FR': 'Label fr d',
	},
};

/**
 * C :  [a,b,c]
 * C':  [a,b]
 *
 * Import de C =>  aucun verrou => [a,b,c]
 * Import de C' => c disparait => [a,b]
 */
test('[LOCK-FIELDS-ARRAY C] Import twice should remove element', async (t: ExecutionContext<TestContext>) => {
	const vC: SampleEntityWithArray = {
		code: 'c',
		parameters: {
			items: [a, b, c],
		},
	};

	const mongoClient = generateMongoClient(t);
	await mongoClient.initHistoricIndexes();

	// Simulate import
	const resultImport1: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vC], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.is(resultImport1[0].objectInfos.lockFields, undefined, '[resultImport1] Has no lock fields');
	t.deepEqual(
		_.map(resultImport1[0].parameters.items, 'code'),
		['a', 'b', 'c'],
		'[resultImport1] All values saved',
	);

	const vCp = _.cloneDeep(vC);
	// remove c
	vCp.parameters.items = [a, b];

	// Simulate import
	const resultImport2: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vCp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.is(resultImport2[0].objectInfos.lockFields, undefined, '[resultImport2] Has no lock fields');
	t.deepEqual(
		_.map(resultImport2[0].parameters.items, 'code'),
		['a', 'b'],
		'[resultImport2] All values saved',
	);
});

/**
 * D :  [a,b,c]
 * D':  [c,a,b,d]
 *
 * Creation of D by an operator (human) =>  all is locked => [a🔒,b🔒,c🔒]
 * Import D' => order preserved, addition of d => [a🔒,b🔒,c🔒,d]
 */
test('[LOCK-FIELDS-ARRAY D] Lock fields order should be keept', async (t: ExecutionContext<TestContext>) => {
	const vD: SampleEntityWithArray = {
		code: 'd',
		parameters: {
			items: _.cloneDeep([a, b, c]),
		},
	};

	const mongoClient = generateMongoClient(t);
	await mongoClient.initHistoricIndexes();

	// Simulate import
	const entityCreated = await mongoClient.insertOne(vD, 'userId', true);
	t.truthy(entityCreated.objectInfos.lockFields, '[entityCreated] Has all fields locked');
	t.is(entityCreated.objectInfos.lockFields.length, 6, '[entityCreated] Has all fields locked');
	t.deepEqual(
		_.map(entityCreated.parameters.items, 'code'),
		['a', 'b', 'c'],
		'[entityCreated] All values saved',
	);

	const vDp = _.cloneDeep(vD);
	vDp.parameters.items = _.cloneDeep([c, a, b, d]);

	// Simulate import
	const resultImport1: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vDp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.truthy(entityCreated.objectInfos.lockFields, '[resultImport1] Has lock fields');
	t.deepEqual(
		_.map(resultImport1[0].parameters.items, 'code'),
		['a', 'b', 'c', 'd'],
		'[resultImport1] Order respected',
	);
});
