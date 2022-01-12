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

/**
 * B :  [a,b,c]
 * B':  [c,b',a]
 * B'': [b,c,a]
 *
 * Import de B =>  aucun verrou => [a,b,c]
 * Modification opérateur de B par B' => b verrouillés et vaut b', c et a varrouillé pat changement de place => [c🔒,b'🔒,a🔒]
 * Import de B" => a et c toujours présent, b' reste à sa valeur => [c🔒,b'🔒,a🔒]
 */
ava(
	'[LOCK-FIELDS-ARRAY B] Import, edit one, change order, re-import datas',
	async (t: Assertions) => {
		const bp = _.cloneDeep(b);
		bp.label['fr-FR'] += ' mis à jour';
		bp.label['en-GB'] += ' updated';

		const bLockPaths = [
			'parameters.items[code=c].label.en-GB',
			'parameters.items[code=c].label.fr-FR',
			'parameters.items[code=b].label.en-GB',
			'parameters.items[code=b].label.fr-FR',
			'parameters.items[code=a].label.en-GB',
			'parameters.items[code=a].label.fr-FR',
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
		t.is(newValue2.objectInfos.lockFields.length, 6, '[newValue2] b is locked');

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
	},
);
