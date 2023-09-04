import { N9Log } from '@neo9/n9-node-log';
import { waitFor } from '@neo9/n9-node-utils';
import test, { Assertions } from 'ava';

import { BaseMongoObject, MongoClient, MongoUtils, UpdateOnlyOnChangeConfiguration } from '../src';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public property1?: string;
}

export interface FindOneAndUpdateTestCaseInputParams {
	// enable / disable the updateOnlyOnChange option on mongo client
	updateOnlyOnChange?: UpdateOnlyOnChangeConfiguration;
}

export interface FindOneAndUpdateTestCaseAssertions {
	// should the returned last modification date change ?
	lastModificationDateShouldChange: boolean;
}

/**
 * Macro that will insert an entity then update it with updateManyAtOnce, changing one field
 *
 * @param t ava assertions object
 * @param inputParams input parameters to set
 * @param assertions assertions to perform
 */
async function insertThenUpdateOneFieldToNewValue(
	t: Assertions,
	inputParams: FindOneAndUpdateTestCaseInputParams,
	assertions: FindOneAndUpdateTestCaseAssertions,
): Promise<void> {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType, {
		updateOnlyOnChange: inputParams.updateOnlyOnChange,
	});

	const insertedEntity = await mongoClient.insertOne({ property1: 'value1' }, 'TEST');
	const initialLastUpdateDate = insertedEntity.objectInfos.lastUpdate.date;
	const initialLastModificationDate = insertedEntity.objectInfos.lastModification.date;
	t.truthy(insertedEntity.objectInfos.creation.date, 'Creation date is set upon insertion');
	t.truthy(initialLastUpdateDate, 'Last modification date is set upon insertion');
	t.truthy(initialLastModificationDate, 'Last modification date is set upon insertion');
	await waitFor(10);

	// check returned entity
	const returnedEntityCursor = await mongoClient.updateManyAtOnce([insertedEntity], 'TEST', {
		query: 'property1',
		mapFunction: () => ({
			property1: 'new-value1',
		}),
	});
	t.true(await returnedEntityCursor.hasNext(), 'has match a least one element');
	const returnedEntity = await returnedEntityCursor.next();
	const returnLastUpdateDate = returnedEntity?.objectInfos.lastUpdate.date;
	const returnLastModificationDate = returnedEntity?.objectInfos.lastModification.date;
	t.deepEqual('new-value1', returnedEntity.property1, 'Property 1 did change in return value');
	t.notDeepEqual(
		returnLastUpdateDate,
		initialLastUpdateDate,
		'Last update date did change in return value',
	);
	if (assertions.lastModificationDateShouldChange) {
		t.notDeepEqual(
			returnLastModificationDate,
			initialLastModificationDate,
			'Last modification date did change in return value',
		);
	} else {
		t.deepEqual(
			returnLastModificationDate,
			initialLastModificationDate,
			'Last modification date did not change in return value',
		);
	}

	// check entity in db
	const dbEntity = await mongoClient.findOne({ _id: MongoUtils.oid(insertedEntity._id) });
	const dbLastUpdateDate = dbEntity.objectInfos.lastUpdate.date;
	const dbLastModificationDate = dbEntity.objectInfos.lastModification.date;
	t.deepEqual('new-value1', dbEntity.property1, 'Property 1 did change in db');
	t.notDeepEqual(dbLastUpdateDate, initialLastUpdateDate, 'Last update date did change in db');
	if (assertions.lastModificationDateShouldChange) {
		t.notDeepEqual(
			dbLastModificationDate,
			initialLastModificationDate,
			'Last modification date did change in db',
		);
	} else {
		t.deepEqual(
			dbLastModificationDate,
			initialLastModificationDate,
			'Last modification date did not change in db',
		);
	}
}

insertThenUpdateOneFieldToNewValue.title = (
	providedTitle: string,
	inputParams: FindOneAndUpdateTestCaseInputParams,
	assertions: FindOneAndUpdateTestCaseAssertions,
): string => {
	const pick = inputParams.updateOnlyOnChange?.changeFilters?.pick ?? [];
	const omit = inputParams.updateOnlyOnChange?.changeFilters?.omit ?? [];
	const updateOnlyOnChange = inputParams.updateOnlyOnChange
		? `enabled (pick: [${pick?.join()}], omit: [${omit?.join()}])`
		: 'disabled';
	const lastModificationDateShouldChange = assertions.lastModificationDateShouldChange
		? 'last modification date did change'
		: 'last modification date did not change';
	return `${providedTitle} updateManyAtOnce when updating a field with updateOnlyOnChange ${updateOnlyOnChange} should result in ${lastModificationDateShouldChange}`;
};

/**
 * Macro that will insert an entity then update it with updateManyAtOnce, changing one field (without returning the updated entities)
 *
 * @param t ava assertions object
 * @param inputParams input parameters to set
 * @param assertions assertions to perform
 */
async function insertThenUpdateOneFieldToNewValueWithoutReturningNewValue(
	t: Assertions,
	inputParams: FindOneAndUpdateTestCaseInputParams,
	assertions: FindOneAndUpdateTestCaseAssertions,
): Promise<void> {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType, {
		updateOnlyOnChange: inputParams.updateOnlyOnChange,
	});

	const insertedEntity = await mongoClient.insertOne({ property1: 'value1' }, 'TEST');
	const initialLastUpdateDate = insertedEntity.objectInfos.lastUpdate.date;
	const initialLastModificationDate = insertedEntity.objectInfos.lastModification.date;
	t.truthy(insertedEntity.objectInfos.creation.date, 'Creation date is set upon insertion');
	t.truthy(initialLastUpdateDate, 'Last modification date is set upon insertion');
	t.truthy(initialLastModificationDate, 'Last modification date is set upon insertion');
	await waitFor(10);

	// check returned entity
	await mongoClient.updateManyAtOnce([insertedEntity], 'TEST', {
		query: 'property1',
		mapFunction: () => ({
			property1: 'new-value1',
		}),
		returnNewEntities: false,
	});

	// check entity in db
	const dbEntity = await mongoClient.findOne({ _id: MongoUtils.oid(insertedEntity._id) });
	const dbLastUpdateDate = dbEntity.objectInfos.lastUpdate.date;
	const dbLastModificationDate = dbEntity.objectInfos.lastModification.date;
	t.deepEqual('new-value1', dbEntity.property1, 'Property 1 did change in db');
	t.notDeepEqual(dbLastUpdateDate, initialLastUpdateDate, 'Last update date did change in db');
	if (assertions.lastModificationDateShouldChange) {
		t.notDeepEqual(
			dbLastModificationDate,
			initialLastModificationDate,
			'Last modification date did change in db',
		);
	} else {
		t.deepEqual(
			dbLastModificationDate,
			initialLastModificationDate,
			'Last modification date did not change in db',
		);
	}
}

insertThenUpdateOneFieldToNewValueWithoutReturningNewValue.title = (
	providedTitle: string,
	inputParams: FindOneAndUpdateTestCaseInputParams,
	assertions: FindOneAndUpdateTestCaseAssertions,
): string => {
	const pick = inputParams.updateOnlyOnChange?.changeFilters?.pick ?? [];
	const omit = inputParams.updateOnlyOnChange?.changeFilters?.omit ?? [];
	const updateOnlyOnChange = inputParams.updateOnlyOnChange
		? `enabled (pick: [${pick?.join()}], omit: [${omit?.join()}])`
		: 'disabled';
	const lastModificationDateShouldChange = assertions.lastModificationDateShouldChange
		? 'last modification date did change'
		: 'last modification date did not change';
	return `${providedTitle} updateManyAtOnce (without returning new value) when updating a field with updateOnlyOnChange ${updateOnlyOnChange} should result in ${lastModificationDateShouldChange}`;
};

/**
 * Macro that will insert an entity then update it with findOneAndUpdate, updating one field to same value
 *
 * @param t ava assertions object
 * @param inputParams input parameters to set
 * @param assertions assertions to perform
 */
async function insertThenUpdateOneFieldToSameValue(
	t: Assertions,
	inputParams: FindOneAndUpdateTestCaseInputParams,
	assertions: FindOneAndUpdateTestCaseAssertions,
): Promise<void> {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType, {
		updateOnlyOnChange: inputParams.updateOnlyOnChange,
	});

	const insertedEntity = await mongoClient.insertOne({ property1: 'value1' }, 'TEST');
	const initialLastUpdateDate = insertedEntity.objectInfos.lastUpdate.date;
	const initialLastModificationDate = insertedEntity.objectInfos.lastModification.date;
	t.truthy(insertedEntity.objectInfos.creation.date, 'Creation date is set upon insertion');
	t.truthy(initialLastUpdateDate, 'Last modification date is set upon insertion');
	t.truthy(initialLastModificationDate, 'Last modification date is set upon insertion');
	await waitFor(10);

	// check returned entity
	const returnedEntityCursor = await mongoClient.updateManyAtOnce([insertedEntity], 'TEST', {
		query: 'property1',
		mapFunction: () => ({
			property1: 'value1',
		}),
	});
	t.true(await returnedEntityCursor.hasNext(), 'has match a least one element');
	const returnedEntity = await returnedEntityCursor.next();

	const returnLastUpdateDate = returnedEntity.objectInfos.lastUpdate.date;
	const returnLastModificationDate = returnedEntity.objectInfos.lastModification.date;
	t.deepEqual('value1', returnedEntity.property1, 'Property 1 did not change in return value');
	t.notDeepEqual(
		returnLastUpdateDate,
		initialLastUpdateDate,
		'Last update date did change in return value',
	);
	if (assertions.lastModificationDateShouldChange) {
		t.notDeepEqual(
			returnLastModificationDate,
			initialLastModificationDate,
			'Last modification date did change in return value',
		);
	} else {
		t.deepEqual(
			returnLastModificationDate,
			initialLastModificationDate,
			'Last modification date did not change in return value',
		);
	}

	// check entity in db
	const dbEntity = await mongoClient.findOne({ _id: MongoUtils.oid(insertedEntity._id) });
	const dbLastUpdateDate = dbEntity.objectInfos.lastUpdate.date;
	const dbLastModificationDate = dbEntity.objectInfos.lastModification.date;
	t.deepEqual('value1', dbEntity.property1, 'Property 1 did not change in db');
	t.notDeepEqual(dbLastUpdateDate, initialLastUpdateDate, 'Last update date did not change in db');
	if (assertions.lastModificationDateShouldChange) {
		t.notDeepEqual(
			dbLastModificationDate,
			initialLastModificationDate,
			'Last modification date did change in db',
		);
	} else {
		t.deepEqual(
			dbLastModificationDate,
			initialLastModificationDate,
			'Last modification date did not change in db',
		);
	}
}

insertThenUpdateOneFieldToSameValue.title = (
	providedTitle: string,
	inputParams: FindOneAndUpdateTestCaseInputParams,
	assertions: FindOneAndUpdateTestCaseAssertions,
): string => {
	const pick = inputParams.updateOnlyOnChange?.changeFilters?.pick ?? [];
	const omit = inputParams.updateOnlyOnChange?.changeFilters?.omit ?? [];
	const updateOnlyOnChange = inputParams.updateOnlyOnChange
		? `enabled (pick: [${pick?.join()}], omit: [${omit?.join()}])`
		: 'disabled';
	const lastModificationDateShouldChange = assertions.lastModificationDateShouldChange
		? 'last modification date changed'
		: 'last modification date did not change';
	return `${providedTitle} findOneAndUpdate when updating a field to same value with updateOnlyOnChange ${updateOnlyOnChange} should result in ${lastModificationDateShouldChange}`;
};

global.log = new N9Log('tests').module('update-only-on-change');

init();

const testPrefix = '[UPDATE-ONLY-ON-CHANGE]';

// updateOnlyOnChange enabled
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValue,
	{
		updateOnlyOnChange: {},
	},
	{
		lastModificationDateShouldChange: true,
	},
);

// updateOnlyOnChange enabled
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
	{
		updateOnlyOnChange: {},
	},
	{
		lastModificationDateShouldChange: true,
	},
);

test.serial(
	testPrefix,
	insertThenUpdateOneFieldToSameValue,
	{
		updateOnlyOnChange: {},
	},
	{
		lastModificationDateShouldChange: false,
	},
);

// updateOnlyOnChange enabled and field not picked
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				pick: ['non-existant-property'],
			},
		},
	},
	{
		lastModificationDateShouldChange: false,
	},
);

// updateOnlyOnChange enabled and field not picked
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				pick: ['non-existant-property'],
			},
		},
	},
	{
		lastModificationDateShouldChange: false,
	},
);

// updateOnlyOnChange enabled and field picked
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				pick: ['property1'],
			},
		},
	},
	{
		lastModificationDateShouldChange: true,
	},
);

// updateOnlyOnChange enabled and field picked
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				pick: ['property1'],
			},
		},
	},
	{
		lastModificationDateShouldChange: true,
	},
);

// updateOnlyOnChange enabled and field omitted
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				omit: ['property1'],
			},
		},
	},
	{
		lastModificationDateShouldChange: false,
	},
);

// updateOnlyOnChange enabled and field omitted
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				omit: ['property1'],
			},
		},
	},
	{
		lastModificationDateShouldChange: false,
	},
);

// updateOnlyOnChange enabled and field picked and omitted
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				pick: ['property1'],
				omit: ['property1'],
			},
		},
	},
	{
		lastModificationDateShouldChange: true, // omit is ignored
	},
);

// updateOnlyOnChange enabled and field picked and omitted
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
	{
		updateOnlyOnChange: {
			changeFilters: {
				pick: ['property1'],
				omit: ['property1'],
			},
		},
	},
	{
		lastModificationDateShouldChange: true, // omit is ignored
	},
);

// updateOnlyOnChange disabled
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValue,
	{
		updateOnlyOnChange: undefined,
	},
	{
		lastModificationDateShouldChange: true,
	},
);

// updateOnlyOnChange disabled
test.serial(
	testPrefix,
	insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
	{
		updateOnlyOnChange: undefined,
	},
	{
		lastModificationDateShouldChange: true,
	},
);

test.serial(
	testPrefix,
	insertThenUpdateOneFieldToSameValue,
	{
		updateOnlyOnChange: undefined,
	},
	{
		lastModificationDateShouldChange: true,
	},
);
