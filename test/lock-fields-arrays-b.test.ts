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
	value: true,
};
const b = {
	code: 'b',
	label: {
		'en-GB': 'Label en b',
		'fr-FR': 'Label fr b',
	},
	value: true,
};
const c = {
	code: 'c',
	label: {
		'en-GB': 'Label en c',
		'fr-FR': 'Label fr c',
	},
	value: true,
};
const d = {
	code: 'd',
	label: {
		'en-GB': 'Label en d',
		'fr-FR': 'Label fr d',
	},
	value: true,
};
const e = {
	code: 'e',
	label: {
		'en-GB': 'Label en e',
		'fr-FR': 'Label fr e',
	},
	value: true,
};
const f = {
	code: 'f',
	label: {
		'en-GB': 'Label en f',
		'fr-FR': 'Label fr f',
	},
	value: true,
};

/**
 * B :  [a,b,c]
 * B':  [c,b',a]
 * B'': [b,c,a]
 *
 * Import de B =>  aucun verrou => [a,b,c]
 * Modification opérateur de B par B' => b verrouillés et vaut b', c et a varrouillé pat changement de place => [c🔒,b'🔒,a🔒]
 * Import de B" => a et c toujours présent, b' reste à sa valeur => [c🔒,b'🔒,a🔒]
 */
test('[LOCK-FIELDS-ARRAY B] Import, edit one, change order, re-import datas', async (t: Assertions) => {
	const bp = _.cloneDeep(b);
	bp.label['fr-FR'] += ' mis à jour';
	bp.label['en-GB'] += ' updated';

	const bLockPaths = [
		'parameters.items[code=c].label.en-GB',
		'parameters.items[code=c].label.fr-FR',
		'parameters.items[code=c].value',
		'parameters.items[code=b].label.en-GB',
		'parameters.items[code=b].label.fr-FR',
		'parameters.items[code=a].label.en-GB',
		'parameters.items[code=a].label.fr-FR',
		'parameters.items[code=a].value',
	];

	const vB: SampleEntityWithArray = {
		code: 'b',
		parameters: {
			items: [a, b, c],
		},
	};

	const mongoClient = generateMongoClient();
	await mongoClient.initHistoricIndexes();

	// Simulate import
	const resultImport1: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vB], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		_.map(resultImport1[0].parameters.items, 'code'),
		['a', 'b', 'c'],
		'[resultImport1] All values saved',
	);

	const vBp = _.cloneDeep(vB);
	// change order and edit b to bp
	vBp.parameters.items = [c, bp, a];

	// operator update
	const newValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
		resultImport1[0]._id,
		vBp,
		'userIdUpdate',
		true,
		true,
	);
	t.deepEqual(
		_.map(newValue2.parameters.items, 'code'),
		['c', 'b', 'a'],
		'[newValue2] Check value updated',
	);
	t.deepEqual(newValue2.parameters.items, vBp.parameters.items, '[newValue2] Label updated');
	t.truthy(newValue2.objectInfos.lockFields, '[newValue2] Has lock fields');
	t.deepEqual(
		_.map(newValue2.objectInfos.lockFields, 'path'),
		bLockPaths,
		'[newValue2] Lock field b',
	);
	t.is(newValue2.objectInfos.lockFields.length, 8, '[newValue2] b is locked');

	const vBpp = _.cloneDeep(vB);
	vBpp.parameters.items = [b, c, a];
	// Simulate import
	const resultImport2: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vBpp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		_.map(resultImport2[0].parameters.items, 'code'),
		['c', 'b', 'a'],
		'[resultImport2] All values saved',
	);
	t.deepEqual(
		_.map(resultImport2[0].objectInfos.lockFields, 'path'),
		bLockPaths,
		'[resultImport2] Lock field b still alone',
	);
	t.deepEqual(resultImport2[0].parameters.items[1], bp, '[resultImport2] bp Label kept');
});

/**
 * B :  [d,e,f]
 * B':  [e,f,d]
 * B'': [d,e,f]
 *
 * Import de B =>  aucun verrou => [d,e,f]
 * Modification opérateur de B par B' => d, e et f vérouillés par changement de place => [e🔒,f🔒,d🔒]
 * Import de B" => d, e et f toujours vérouillés et ordre n'a pas changé => [e🔒,f🔒,d🔒]
 */
test('[LOCK-FIELDS-ARRAY B] Import, change all order, re-import datas', async (t: Assertions) => {
	const bLockPaths = [
		'parameters.items[code=e].label.en-GB',
		'parameters.items[code=e].label.fr-FR',
		'parameters.items[code=e].value',
		'parameters.items[code=f].label.en-GB',
		'parameters.items[code=f].label.fr-FR',
		'parameters.items[code=f].value',
		'parameters.items[code=d].label.en-GB',
		'parameters.items[code=d].label.fr-FR',
		'parameters.items[code=d].value',
	];

	const vB: SampleEntityWithArray = {
		code: 'b',
		parameters: {
			items: [d, e, f],
		},
	};

	const mongoClient = generateMongoClient();
	await mongoClient.initHistoricIndexes();

	// Simulate import
	const resultImport1: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vB], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		_.map(resultImport1[0].parameters.items, 'code'),
		['d', 'e', 'f'],
		'[resultImport1] All values saved',
	);

	const vBp = _.cloneDeep(vB);
	// move a to the end of array
	vBp.parameters.items = [e, f, d];

	// operator update
	const newValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
		resultImport1[0]._id,
		vBp,
		'userIdUpdate',
		true,
		true,
	);
	t.deepEqual(
		_.map(newValue2.parameters.items, 'code'),
		['e', 'f', 'd'],
		'[newValue2] Check value updated',
	);
	t.truthy(newValue2.objectInfos.lockFields, '[newValue2] Has lock fields');
	t.is(newValue2.objectInfos.lockFields.length, 9, '[newValue2] all item keys are locked');
	t.deepEqual(
		_.map(newValue2.objectInfos.lockFields, 'path'),
		bLockPaths,
		'[newValue2] Check lock fields',
	);

	const vBpp = _.cloneDeep(vB);
	vBpp.parameters.items = [d, e, f];
	// Simulate import
	const resultImport2: SampleEntityWithArray[] = await (
		await mongoClient.updateManyAtOnce([vBpp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		_.map(resultImport2[0].parameters.items, 'code'),
		['e', 'f', 'd'],
		'[resultImport2] Order should not have changed',
	);
	t.deepEqual(
		_.map(resultImport2[0].objectInfos.lockFields, 'path'),
		bLockPaths,
		'[resultImport2] Check lock fields are still the same',
	);
});

/**
 * B :  [a,b,c]
 * B':  [c,b,a]
 * B'': [b,c,a]
 *
 * Import de B =>  aucun verrou => [a,b,c]
 * Modification opérateur de B par B' => c et a vérrouillés par changement de place => [c🔒,b,a🔒]
 * Import de B" => a, b c toujours vérouillés et ordre conservé => [c🔒,a🔒,b]
 */
test('[LOCK-FIELDS-ARRAY B] Import, change order, re-import datas with simple array', async (t: Assertions) => {
	const bLockPaths = ['parameters.items["c"]', 'parameters.items["a"]'];

	const vB: SampleEntityWithSimpleArray = {
		code: 'b',
		parameters: {
			items: ['a', 'b', 'c'],
		},
	};
	const mongoClient = generateMongoClientForSimpleArray();
	await mongoClient.initHistoricIndexes();

	// Simulate import
	const resultImport1: SampleEntityWithSimpleArray[] = await (
		await mongoClient.updateManyAtOnce([vB], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		resultImport1[0].parameters.items,
		['a', 'b', 'c'],
		'[resultImport1] All values saved',
	);

	const vBp = _.cloneDeep(vB);
	// change order and edit b to bp
	vBp.parameters.items = ['c', 'b', 'a'];

	// operator update
	const newValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
		resultImport1[0]._id,
		vBp,
		'userIdUpdate',
		true,
		true,
	);
	t.deepEqual(newValue2.parameters.items, ['c', 'b', 'a'], '[newValue2] Order updated');
	t.truthy(newValue2.objectInfos.lockFields, '[newValue2] Has lock fields');
	t.is(newValue2.objectInfos.lockFields.length, 2, '[newValue2] Should have only 2 locked paths');
	t.deepEqual(
		_.map(newValue2.objectInfos.lockFields, 'path'),
		bLockPaths,
		'[newValue2] A and B should be locked',
	);

	const vBpp = _.cloneDeep(vB);
	vBpp.parameters.items = ['b', 'c', 'a'];
	// Simulate import
	const resultImport2: SampleEntityWithSimpleArray[] = await (
		await mongoClient.updateManyAtOnce([vBpp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		resultImport2[0].parameters.items,
		['c', 'a', 'b'],
		'[resultImport2] All values saved, locked items c and a should be first',
	);
	t.deepEqual(
		_.map(resultImport2[0].objectInfos.lockFields, 'path'),
		bLockPaths,
		'[resultImport2] b still not locked',
	);
});

/**
 * B :  [a,b,c]
 * B':  [b,c,a]
 * B'': [a,b,c]
 *
 * Import de B =>  aucun verrou => [a,b,c]
 * Modification opérateur de B par B' => a, b et c vérouillés par changement de place => [b🔒,c🔒,a🔒]
 * Import de B" => a, b et c toujours vérouillés et ordre n'a pas changé => [b🔒,c🔒,a🔒]
 */
test('[LOCK-FIELDS-ARRAY B] Import, change all order, re-import datas with simple array', async (t: Assertions) => {
	const bLockPaths = ['parameters.items["b"]', 'parameters.items["c"]', 'parameters.items["a"]'];

	const vB: SampleEntityWithSimpleArray = {
		code: 'b',
		parameters: {
			items: ['a', 'b', 'c'],
		},
	};
	const mongoClient = generateMongoClientForSimpleArray();
	await mongoClient.initHistoricIndexes();

	// Simulate import
	const resultImport1: SampleEntityWithSimpleArray[] = await (
		await mongoClient.updateManyAtOnce([vB], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		resultImport1[0].parameters.items,
		['a', 'b', 'c'],
		'[resultImport1] All values saved',
	);

	const vBp = _.cloneDeep(vB);
	// move a to the end of array
	vBp.parameters.items = ['b', 'c', 'a'];

	// operator update
	const newValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
		resultImport1[0]._id,
		vBp,
		'userIdUpdate',
		true,
		true,
	);
	t.deepEqual(newValue2.parameters.items, ['b', 'c', 'a'], '[newValue2] Order updated');
	t.truthy(newValue2.objectInfos.lockFields, '[newValue2] Has lock fields');
	t.is(newValue2.objectInfos.lockFields.length, 3, '[newValue2] All items are locked');
	t.deepEqual(
		_.map(newValue2.objectInfos.lockFields, 'path'),
		bLockPaths,
		'[newValue2] a, b and c should be locked',
	);

	const vBpp = _.cloneDeep(vB);
	vBpp.parameters.items = ['a', 'b', 'c'];
	// Simulate import
	const resultImport2: SampleEntityWithSimpleArray[] = await (
		await mongoClient.updateManyAtOnce([vBpp], 'externalUser', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	t.deepEqual(
		resultImport2[0].parameters.items,
		['b', 'c', 'a'],
		'[resultImport2] Order should not have changed',
	);
	t.deepEqual(
		_.map(resultImport2[0].objectInfos.lockFields, 'path'),
		bLockPaths,
		'[resultImport2] a, b and c should still be locked',
	);
});
