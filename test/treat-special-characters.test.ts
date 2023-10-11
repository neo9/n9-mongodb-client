import test, { ExecutionContext } from 'ava';
import _ from 'lodash';

import { MongoUtils, ObjectId } from '../src';
import { TestContext } from './fixtures';

test('[SPECIAL-CHARACTERS] Transform object and keep types', (t: ExecutionContext<TestContext>) => {
	const origin = {
		a: new Date(),
		string: 'string test',
		number: 2,
		object: {
			date: new Date(),
			objectID: new ObjectId(),
		},
	};
	const result = MongoUtils.REMOVE_SPECIAL_CHARACTERS_IN_KEYS(_.cloneDeep(origin));
	t.deepEqual(origin, result, 'object should not change');
	const result2 = MongoUtils.UN_REMOVE_SPECIAL_CHARACTERS_IN_KEYS(result);
	t.deepEqual(origin, result2, 'object should not change without clone');
});
