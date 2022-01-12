import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';

import { MongoUtils, ObjectId } from '../src';

global.log = new N9Log('tests').module('treat-special-character');

ava('[SPECIAL-CHARACTERS] Transform object and keep types', (t: Assertions) => {
	const origin = {
		a: new Date(),
		string: 'string test',
		number: 2,
		object: {
			date: new Date(),
			objectID: new ObjectId(),
		},
	};
	const result = MongoUtils.removeSpecialCharactersInKeys(_.cloneDeep(origin));
	t.deepEqual(origin, result, 'object should not change');
	const result2 = MongoUtils.unRemoveSpecialCharactersInKeys(result);
	t.deepEqual(origin, result2, 'object should not change without clone');
});
