import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';
import { generateMongoClient, init, SampleEntityWithArray } from './fixtures/utils';

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
const d = {
	code: 'd',
	label: {
		'en-GB': 'Label en d',
		'fr-FR': 'Label fr d',
	},
};

/**
 * A : [a,b,c]
 * A': [a,b]
 * A'': [a,c]
 * A''': [a,c,d]
 * A'''': [a,d]
 *
 * Import de A =>  aucun verrou   => [a,b,c]
 * Modification opérateur de A par A' => a et b verrouillés => [a🔒,b🔒]
 * Import de A'' => a et b toujours présent, c créé non verrouillé => [a🔒,b🔒,c]
 * Import de A''' => a, b, c toujours présent, ajout de d => [a🔒,b🔒,c,d]
 * Import de A'''' => a, b, d toujours présent, suppression de c => [a🔒,b🔒,d]
 */
ava(
	'[LOCK-FIELDS-ARRAY A] Import, remove one, import others, import new one',
	async (t: Assertions) => {
		const aAndbLockPaths = [
			'parameters.items[code=a].label.en-GB',
			'parameters.items[code=a].label.fr-FR',
			'parameters.items[code=b].label.en-GB',
			'parameters.items[code=b].label.fr-FR',
		];
		const vA: SampleEntityWithArray = {
			parameters: {
				items: [a, b, c],
			},
		};

		const mongoClient = generateMongoClient();
		await mongoClient.initHistoricIndexes();

		// Simulate import
		const resultImport1: SampleEntityWithArray[] = await (
			await mongoClient.updateManyAtOnce([vA], 'externalUser', {
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

		const vAp = _.cloneDeep(vA);
		// remove c
		vAp.parameters.items = [a, b];
		t.deepEqual(_.map(vA.parameters.items, 'code'), ['a', 'b', 'c'], 'Test preparation is OK');
		t.deepEqual(_.map(vAp.parameters.items, 'code'), ['a', 'b'], 'Test preparation is OK');

		// operator update
		const newValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
			resultImport1[0]._id,
			vAp,
			'userIdUpdate',
			true,
			true,
		);
		t.deepEqual(
			_.map(newValue2.parameters.items, 'code'),
			['a', 'b'],
			'[newValue2] Check value updated',
		);
		t.truthy(newValue2.objectInfos.lockFields, '[newValue2] Has lock fields');
		t.is(newValue2.objectInfos.lockFields.length, 4, '[newValue2] a and b are locked');

		const vApp = _.cloneDeep(vA);
		vApp.parameters.items = [a, c];

		const resultImport2: SampleEntityWithArray[] = await (
			await mongoClient.updateManyAtOnce([vApp], 'externalUser', {
				upsert: true,
				lockNewFields: false,
				query: 'code',
			})
		).toArray();

		t.truthy(resultImport2[0].objectInfos.lockFields, '[resultImport2] Has lock fields');
		t.is(
			resultImport2[0].objectInfos.lockFields.length,
			4,
			'[resultImport2] a and b are still locked, nothing changed',
		);
		t.deepEqual(
			_.map(resultImport2[0].objectInfos.lockFields, 'path'),
			aAndbLockPaths,
			'[resultImport2] a and b are locked',
		);
		t.deepEqual(
			_.map(resultImport2[0].parameters.items, 'code'),
			['a', 'b', 'c'],
			'[resultImport2] Check value updated',
		);

		const vAppp = _.cloneDeep(vA);
		vAppp.parameters.items = [a, c, d];

		const resultImport3: SampleEntityWithArray[] = await (
			await mongoClient.updateManyAtOnce([vAppp], 'externalUser', {
				upsert: true,
				lockNewFields: false,
				query: 'code',
			})
		).toArray();
		t.truthy(resultImport3[0].objectInfos.lockFields, '[resultImport3] Stil has lock fields');
		t.is(
			resultImport3[0].objectInfos.lockFields.length,
			4,
			'[resultImport3] a and b are still locked, nothing changed',
		);
		t.deepEqual(
			_.map(resultImport3[0].objectInfos.lockFields, 'path'),
			aAndbLockPaths,
			'[resultImport3] a and b are locked',
		);
		t.deepEqual(
			_.map(resultImport3[0].parameters.items, 'code'),
			['a', 'b', 'c', 'd'],
			'[resultImport3] Check value updated',
		);

		const vApppp = _.cloneDeep(vA);
		vApppp.parameters.items = [a, d];

		const resultImport4: SampleEntityWithArray[] = await (
			await mongoClient.updateManyAtOnce([vApppp], 'externalUser', {
				upsert: true,
				lockNewFields: false,
				query: 'code',
			})
		).toArray();
		t.truthy(resultImport4[0].objectInfos.lockFields, '[resultImport4] Stil has lock fields');
		t.is(
			resultImport4[0].objectInfos.lockFields.length,
			4,
			'[resultImport4] a and b are still locked, nothing changed',
		);
		t.deepEqual(
			_.map(resultImport4[0].objectInfos.lockFields, 'path'),
			aAndbLockPaths,
			'[resultImport4] a and b are locked',
		);
		t.deepEqual(
			_.map(resultImport4[0].parameters.items, 'code'),
			['a', 'b', 'd'],
			'[resultImport4] Check value updated',
		);
	},
);
