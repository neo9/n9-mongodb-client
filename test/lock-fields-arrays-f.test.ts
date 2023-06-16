import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';

import { generateMongoClient, init, SampleEntityWithArray } from './fixtures/utils';

global.log = new N9Log('tests').module('lock-fields-arrays');

init();

const a1 = {
	code: 'a',
	otherCode: 'a1',
	label: {
		'en-GB': 'Label en a1',
		'fr-FR': 'Label fr a1',
	},
};
const a1Update = {
	code: 'a',
	otherCode: 'a1',
	label: {
		'en-GB': 'Label en a1 updated',
		'fr-FR': 'Label fr a1 updated',
	},
};
const a2 = {
	code: 'a',
	otherCode: 'a2',
	label: {
		'en-GB': 'Label en a2',
		'fr-FR': 'Label fr a2',
	},
};
const b1 = {
	code: 'b',
	otherCode: 'b1',
	label: {
		'en-GB': 'Label en b1',
		'fr-FR': 'Label fr b1',
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
 * F: [a1,a2,b1]
 * F': [a1,a2]
 * F'': [a1,b1]
 * F''': [a1]
 * F'''': [a1,c]
 *
 * Import F =>  no locks => [a1,a2,b1]
 * Update F' => a1 and a2 are locked => [a1🔒,a2🔒]
 * Import F'' => a1 and a2 still in array and values unchanged, b1 created and not locked => [a1🔒,a2🔒,b1]
 * Unlock F''' => a1 is unlocked => [a1,a2🔒,b1]
 * Update F'''' => a1, a2 and c are locked => [a2🔒,a1🔒,c🔒]
 */
ava(
	'[LOCK-FIELDS-ARRAY F] Lock fields array should handle multiple unicity keys',
	async (t: Assertions) => {
		const a1AndA2LockPaths = [
			'parameters.items[code=a&otherCode=a1].label.en-GB',
			'parameters.items[code=a&otherCode=a1].label.fr-FR',
			'parameters.items[code=a&otherCode=a2].label.en-GB',
			'parameters.items[code=a&otherCode=a2].label.fr-FR',
		];
		const a1AndA2AndCLockPaths = [
			'parameters.items[code=a&otherCode=a2].label.en-GB',
			'parameters.items[code=a&otherCode=a2].label.fr-FR',
			'parameters.items[code=a&otherCode=a1].label.en-GB',
			'parameters.items[code=a&otherCode=a1].label.fr-FR',
			'parameters.items[code=c].label.en-GB',
			'parameters.items[code=c].label.fr-FR',
		];
		const a2LockPaths = [
			'parameters.items[code=a&otherCode=a2].label.en-GB',
			'parameters.items[code=a&otherCode=a2].label.fr-FR',
		];
		const vF: SampleEntityWithArray = {
			code: 'f',
			parameters: {
				items: [a1, a2, b1],
			},
		};

		const mongoClient = generateMongoClient();
		await mongoClient.initHistoricIndexes();

		// Simulate import
		const resultImport1: SampleEntityWithArray[] = await (
			await mongoClient.updateManyAtOnce([vF], 'externalUser', {
				upsert: true,
				lockNewFields: false,
				query: 'code',
			})
		).toArray();
		t.deepEqual(
			_.map(resultImport1[0].parameters.items, 'otherCode'),
			['a1', 'a2', 'b1'],
			'[resultImport1] All other code values saved',
		);

		const vFp = _.cloneDeep(vF);
		// remove b1
		vFp.parameters.items = [a1, a2];
		t.deepEqual(
			_.map(vF.parameters.items, 'otherCode'),
			['a1', 'a2', 'b1'],
			'Test preparation is OK',
		);
		t.deepEqual(_.map(vFp.parameters.items, 'otherCode'), ['a1', 'a2'], 'Test preparation is OK');

		// operator update
		const newValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
			resultImport1[0]._id,
			vFp,
			'userIdUpdate',
			true,
			true,
		);
		t.deepEqual(
			_.map(newValue2.parameters.items, 'otherCode'),
			['a1', 'a2'],
			'[newValue2] Check value updated',
		);
		t.truthy(newValue2.objectInfos.lockFields, '[newValue2] Has lock fields');
		t.is(newValue2.objectInfos.lockFields.length, 4, '[newValue2] a1 and a2 are locked');

		const vFpp = _.cloneDeep(vF);
		vFpp.parameters.items = [_.cloneDeep(a1Update), b1];

		const resultImport2: SampleEntityWithArray[] = await (
			await mongoClient.updateManyAtOnce([vFpp], 'externalUser', {
				upsert: true,
				lockNewFields: false,
				query: 'code',
			})
		).toArray();

		t.truthy(resultImport2[0].objectInfos.lockFields, '[resultImport2] Has lock fields');
		t.is(
			resultImport2[0].objectInfos.lockFields.length,
			4,
			'[resultImport2] a1 and a2 are still locked, nothing changed',
		);
		t.deepEqual(
			_.map(resultImport2[0].objectInfos.lockFields, 'path'),
			a1AndA2LockPaths,
			'[resultImport2] a1 and a2 are locked',
		);
		t.deepEqual(
			_.map(resultImport2[0].parameters.items, 'otherCode'),
			['a1', 'a2', 'b1'],
			'[resultImport2] Check value updated',
		);
		t.deepEqual(
			resultImport2[0].parameters.items[0].label,
			a1.label,
			'[resultImport2] Check a1 locked value not updated',
		);

		// Unlock a1
		const unlockResult = await mongoClient.findOneByIdAndRemoveLockSubparts(
			resultImport1[0]._id,
			'parameters.items[code=a&otherCode=a1]',
			'externalUser',
		);
		t.truthy(unlockResult.objectInfos.lockFields, '[resultImport2] Has lock fields');
		t.is(unlockResult.objectInfos.lockFields.length, 2, '[unlock] only a2 is locked');
		t.deepEqual(
			_.map(unlockResult.objectInfos.lockFields, 'path'),
			a2LockPaths,
			'[unlockResult] a2 is locked',
		);

		const vFppp = _.cloneDeep(vF);
		vFppp.parameters.items = [_.cloneDeep(a1Update), c];

		// Update a1
		const newValue3 = await mongoClient.findOneAndUpdateByIdWithLocks(
			resultImport1[0]._id,
			vFppp,
			'userIdUpdate',
			true,
			false,
		);

		t.truthy(newValue3.objectInfos.lockFields, '[resultImport3] Has lock fields');
		t.is(newValue3.objectInfos.lockFields.length, 6, '[resultImport3] a1, a1 and c are locked');
		t.deepEqual(
			_.map(newValue3.objectInfos.lockFields, 'path'),
			a1AndA2AndCLockPaths,
			'[resultImport3] a1, a2 and c locked paths are OK',
		);
		t.deepEqual(
			_.map(newValue3.parameters.items, 'code'),
			['a', 'a', 'c'],
			'[resultImport3] Check codes are OK',
		);
		t.deepEqual(
			_.map(newValue3.parameters.items, 'otherCode'),
			['a2', 'a1', undefined],
			'[resultImport3] Check otherCodes are OK',
		);
		t.deepEqual(
			newValue3.parameters.items[1].label,
			a1Update.label,
			'[resultImport3] Check a1 label value updated',
		);
	},
);
