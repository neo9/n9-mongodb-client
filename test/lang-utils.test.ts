import test, { Assertions } from 'ava';
import * as _ from 'lodash';

import { LangUtils, MongoUtils } from '../src';

test('[LANG-UTILS] Test to removeEmptyDeep on object with ObjectIds', (t: Assertions) => {
	const anObjectToTest = {
		s: '2019-01-02',
		n: 5,
		id: MongoUtils.oid('012345678901234568790123'),
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
			id: MongoUtils.oid('012345678901234568790123'),
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
			id: MongoUtils.oid('012345678901234568790123'),
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
