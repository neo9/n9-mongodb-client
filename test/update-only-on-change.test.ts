import { waitFor } from '@neo9/n9-node-utils';
import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, MongoClientSettings, MongoUtils, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public property1?: string;
}

export interface FindOneAndUpdateTestCaseAssertions {
	// should the returned last modification date change ?
	lastModificationDateShouldChange: boolean;
}

/**
 * Macro that will insert an entity then update it with findOneAndUpdate, changing one field
 *
 * @param t ava assertions object
 * @param inputParams input parameters to set
 * @param userId the userId that do the update
 * @param assertions assertions to perform
 */
async function insertThenUpdateOneFieldToNewValue(
	t: ExecutionContext<TestContext>,
	inputParams: Partial<MongoClientSettings>,
	userId: string,
	assertions: FindOneAndUpdateTestCaseAssertions,
): Promise<void> {
	const mongoClient = new N9MongoDBClient(getOneCollectionName(), SampleType, SampleType, {
		...getBaseMongoClientSettings(t),
		...inputParams,
	});

	const insertedEntity = await mongoClient.insertOne({ property1: 'value1' }, userId);
	const initialLastUpdateDate = insertedEntity.objectInfos.lastUpdate.date;
	const initialLastModificationDate = insertedEntity.objectInfos.lastModification.date;
	t.truthy(insertedEntity.objectInfos.creation.date, 'Creation date is set upon insertion');
	t.truthy(initialLastUpdateDate, 'Last modification date is set upon insertion');
	t.truthy(initialLastModificationDate, 'Last modification date is set upon insertion');
	await waitFor(10);

	// check returned entity
	const returnedEntity = await mongoClient.findOneAndUpdate(
		{ _id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) as any },
		{ $set: { property1: 'new-value1' } },
		userId,
		false,
		false,
	);
	const creationUserId = returnedEntity.objectInfos.creation.userId;
	const lastUpdateUserId = returnedEntity.objectInfos.lastUpdate.userId;
	const lastModificationUserId = returnedEntity.objectInfos.lastModification.userId;
	t.is(typeof creationUserId, 'string', `creationUserId is a string`);
	t.is(typeof lastUpdateUserId, 'string', `lastUpdateUserId is a string`);
	t.is(typeof lastModificationUserId, 'string', `lastModificationUserId is a string`);

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
	const dbEntity = await mongoClient.findOne({ _id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) });
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
	inputParams: Partial<MongoClientSettings>,
	userId: string,
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
	let keepHistoric: string;
	switch (inputParams.keepHistoric) {
		case undefined:
			keepHistoric = 'not-set';
			break;
		case true:
			keepHistoric = `enabled`;
			break;
		case false:
		default:
			keepHistoric = `disabled`;
	}
	return `${providedTitle} findOneAndUpdate when updating a field with updateOnlyOnChange ${updateOnlyOnChange} and keepHistoric ${keepHistoric}, with userId ${userId}, should result in ${lastModificationDateShouldChange}`;
};

/**
 * Macro that will insert an entity then update it with findOneAndUpdate, changing one field
 *
 * @param t ava assertions object
 * @param inputParams input parameters to set
 * @param userId the userId that do the update
 * @param assertions assertions to perform
 */
async function insertThenUpdateOneFieldToNewValueWithoutReturningNewValue(
	t: ExecutionContext<TestContext>,
	inputParams: Partial<MongoClientSettings>,
	userId: string,
	assertions: FindOneAndUpdateTestCaseAssertions,
): Promise<void> {
	const mongoClient = new N9MongoDBClient(getOneCollectionName(), SampleType, SampleType, {
		...getBaseMongoClientSettings(t),
		...inputParams,
	});

	const insertedEntity = await mongoClient.insertOne({ property1: 'value1' }, userId);
	const initialLastUpdateDate = insertedEntity.objectInfos.lastUpdate.date;
	const initialLastModificationDate = insertedEntity.objectInfos.lastModification.date;
	t.truthy(insertedEntity.objectInfos.creation.date, 'Creation date is set upon insertion');
	t.truthy(initialLastUpdateDate, 'Last modification date is set upon insertion');
	t.truthy(initialLastModificationDate, 'Last modification date is set upon insertion');
	await waitFor(10);

	// check returned entity
	await mongoClient.findOneAndUpdate(
		{ _id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) as any },
		{ $set: { property1: 'new-value1' } },
		userId,
		false,
		false,
		false,
	);

	// check entity in db
	const dbEntity = await mongoClient.findOne({ _id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) });
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
	inputParams: Partial<MongoClientSettings>,
	userId: string,
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
	let keepHistoric: string;
	switch (inputParams.keepHistoric) {
		case undefined:
			keepHistoric = 'not-set';
			break;
		case true:
			keepHistoric = `enabled`;
			break;
		case false:
		default:
			keepHistoric = `disabled`;
	}
	return `${providedTitle} findOneAndUpdate (without returning new value) when updating a field with updateOnlyOnChange ${updateOnlyOnChange} and keepHistoric ${keepHistoric}, with userId ${userId}, should result in ${lastModificationDateShouldChange}`;
};

/**
 * Macro that will insert an entity then update it with findOneAndUpdate, updating one field to same value
 *
 * @param t ava assertions object
 * @param inputParams input parameters to set
 *  @param userId the userId that do the update
 * @param assertions assertions to perform
 */
async function insertThenUpdateOneFieldToSameValue(
	t: ExecutionContext<TestContext>,
	inputParams: Partial<MongoClientSettings>,
	userId: string,
	assertions: FindOneAndUpdateTestCaseAssertions,
): Promise<void> {
	const mongoClient = new N9MongoDBClient(getOneCollectionName(), SampleType, SampleType, {
		...getBaseMongoClientSettings(t),
		...inputParams,
	});

	const insertedEntity = await mongoClient.insertOne({ property1: 'value1' }, userId);
	const initialLastUpdateDate = insertedEntity.objectInfos.lastUpdate.date;
	const initialLastModificationDate = insertedEntity.objectInfos.lastModification.date;
	t.truthy(insertedEntity.objectInfos.creation.date, 'Creation date is set upon insertion');
	t.truthy(initialLastUpdateDate, 'Last modification date is set upon insertion');
	t.truthy(initialLastModificationDate, 'Last modification date is set upon insertion');
	await waitFor(10);

	// check returned entity
	const returnedEntity = await mongoClient.findOneAndUpdate(
		{ _id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) as any },
		{ $set: { property1: 'value1' } },
		userId,
		false,
		false,
	);
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
	const dbEntity = await mongoClient.findOne({ _id: MongoUtils.TO_OBJECT_ID(insertedEntity._id) });
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
	inputParams: Partial<MongoClientSettings>,
	userId: string,
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
	let keepHistoric: string;
	switch (inputParams.keepHistoric) {
		case undefined:
			keepHistoric = 'not-set';
			break;
		case true:
			keepHistoric = `enabled`;
			break;
		case false:
		default:
			keepHistoric = `disabled`;
	}
	return `${providedTitle} findOneAndUpdate when updating a field to same value with updateOnlyOnChange ${updateOnlyOnChange} and keepHistoric ${keepHistoric}, with userId ${userId}, should result in ${lastModificationDateShouldChange}`;
};

init();

const testPrefix = '[UPDATE-ONLY-ON-CHANGE]';
const fakeUserIdValidObjectId = '012345678901234567890123';
const fakeUserIdNotValidObjectId = 'TEST';

for (const userId of [fakeUserIdValidObjectId, fakeUserIdNotValidObjectId]) {
	// updateOnlyOnChange enabled
	test.serial(
		testPrefix,
		insertThenUpdateOneFieldToNewValue,
		{
			updateOnlyOnChange: {},
		},
		userId,
		{
			lastModificationDateShouldChange: true,
		},
	);

	test.serial(
		testPrefix,
		insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
		{
			updateOnlyOnChange: {},
		},
		userId,
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
		userId,
		{
			lastModificationDateShouldChange: false,
		},
	);

	// updateOnlyOnChange enabled by historic
	test.serial(
		testPrefix,
		insertThenUpdateOneFieldToNewValue,
		{
			keepHistoric: true,
		},
		userId,
		{
			lastModificationDateShouldChange: true,
		},
	);

	test.serial(
		testPrefix,
		insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
		{
			keepHistoric: true,
		},
		userId,
		{
			lastModificationDateShouldChange: true,
		},
	);

	test.serial(
		testPrefix,
		insertThenUpdateOneFieldToSameValue,
		{
			keepHistoric: true,
		},
		userId,
		{
			lastModificationDateShouldChange: false,
		},
	);

	for (const keepHistoric of [undefined, true, false]) {
		// updateOnlyOnChange enabled and field not picked
		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						pick: ['non-existant-property'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: false,
			},
		);

		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						pick: ['non-existant-property'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: false,
			},
		);

		// updateOnlyOnChange enabled and field picked
		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						pick: ['property1'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: true,
			},
		);

		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						pick: ['property1'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: true,
			},
		);

		// updateOnlyOnChange enabled and field omitted
		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						omit: ['property1'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: false,
			},
		);

		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						omit: ['property1'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: false,
			},
		);

		// updateOnlyOnChange enabled and field picked and omitted
		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						pick: ['property1'],
						omit: ['property1'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: true, // omit is ignored
			},
		);

		test.serial(
			testPrefix,
			insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
			{
				keepHistoric,
				updateOnlyOnChange: {
					changeFilters: {
						pick: ['property1'],
						omit: ['property1'],
					},
				},
			},
			userId,
			{
				lastModificationDateShouldChange: true, // omit is ignored
			},
		);
	}

	// updateOnlyOnChange disabled
	test.serial(
		testPrefix,
		insertThenUpdateOneFieldToNewValue,
		{
			updateOnlyOnChange: undefined,
		},
		userId,
		{
			lastModificationDateShouldChange: true,
		},
	);

	test.serial(
		testPrefix,
		insertThenUpdateOneFieldToNewValueWithoutReturningNewValue,
		{
			updateOnlyOnChange: undefined,
		},
		userId,
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
		userId,
		{
			lastModificationDateShouldChange: true,
		},
	);
}
