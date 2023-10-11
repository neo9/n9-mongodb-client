import test, { ExecutionContext } from 'ava';
import _ from 'lodash';

import { LangUtils, MongoUtils } from '../src';
import { TestContext } from './fixtures';

test('[LANG-UTILS] Test to removeEmptyDeep on object with ObjectIds', (t: ExecutionContext<TestContext>) => {
	const anObjectToTest = {
		s: '2019-01-02',
		n: 5,
		id: MongoUtils.TO_OBJECT_ID('012345678901234568790123'),
		date: new Date('2020-01-01'),
		undef: undefined,
		emptyObject: {},
		emptyArray: [],
		objectWithOnlyEmptyArray: {
			emptyArray: [undefined],
		},
		objectWithEmptyArray: {
			emptyArray: [],
			aNullValue: null,
		},
		aRootNullValue: null,
		arrayWithEmptyObject: [{}],
	};

	const resultWithOnlyNullValuesKept = LangUtils.removeEmptyDeep<any>(
		_.cloneDeep(anObjectToTest),
		true,
		true,
		true,
	);
	t.deepEqual(
		resultWithOnlyNullValuesKept,
		{
			s: '2019-01-02',
			n: 5,
			id: MongoUtils.TO_OBJECT_ID('012345678901234568790123'),
			date: new Date('2020-01-01'),
			emptyArray: [],
			objectWithOnlyEmptyArray: {
				emptyArray: [],
			},
			objectWithEmptyArray: {
				emptyArray: [],
				aNullValue: null,
			},
			aRootNullValue: null,
			arrayWithEmptyObject: [{}],
		},
		'check resultWithOnlyNullValuesKept',
	);

	const resultDefault = LangUtils.removeEmptyDeep<any>(
		_.cloneDeep(anObjectToTest),
		false,
		false,
		false,
	);
	t.deepEqual(
		resultDefault,
		{
			s: '2019-01-02',
			n: 5,
			id: MongoUtils.TO_OBJECT_ID('012345678901234568790123'),
			date: new Date('2020-01-01'),
			emptyObject: {},
			emptyArray: [],
			objectWithOnlyEmptyArray: {
				emptyArray: [undefined],
			},
			objectWithEmptyArray: {
				emptyArray: [],
			},
			arrayWithEmptyObject: [{}],
		},
		'check resultDefault',
	);
});
