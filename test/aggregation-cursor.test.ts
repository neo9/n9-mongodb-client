import { N9Log } from '@neo9/n9-node-log';
import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';
import { MongoClient as MongodbClient, ObjectId } from 'mongodb';

import { BaseMongoObject, MongoClient } from '../src';
import { N9AggregationCursor } from '../src/cursors/n9-aggregation-cursor';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

interface ContextContent {
	mongoClient: MongoClient<SampleType, SampleType>;
	collectionName: string;
	dbClient: MongodbClient;
}

global.log = new N9Log('tests');

init();
test.beforeEach(async (t: ExecutionContext<ContextContent>) => {
	const collectionName = `test-${Date.now()}`;
	const mongoClient = new MongoClient(collectionName, SampleType, SampleType);

	// insert items not sorted to avoid case where we rely on the insert order
	await mongoClient.insertMany(
		[
			{ field1String: 'string3' },
			{ field1String: 'string1' },
			{ field1String: 'string4' },
			{ field1String: 'string2' },
			{ field1String: 'string5' },
		],
		'userId1',
	);
	t.context.mongoClient = mongoClient;
	t.context.collectionName = collectionName;
	t.context.dbClient = global.dbClient;
});

test.afterEach(async (t: ExecutionContext<ContextContent>) => {
	await t.context.mongoClient.dropCollection();
});

async function getCursorContent<T>(cursor: N9AggregationCursor<T>): Promise<T[]> {
	const items = [];
	for await (const item of cursor) {
		items.push(item);
	}
	return items;
}

test('[Cursor] iterate using while hasNext ... next', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.aggregate<SampleType>([{ $sort: { field1String: 1 } }]);
	const items = await getCursorContent(cursor);
	t.is(items.length, 5, 'cursor contains 5 items');

	cursor.rewind();
	const items2: SampleType[] = [];
	await cursor.hasNext();
	while (await cursor.hasNext()) {
		const item = await cursor.next();
		items2.push(item);
	}
	t.is(items2.length, 5, 'cursor contains 5 items read with hasNext and next');
	t.is(typeof items[0]._id, 'object', '_id is an object, aggregation results are not mapped');
	t.true((items[0]._id as any) instanceof ObjectId, '_id is an ObjectId');

	t.deepEqual(items2, items, 'compare two arrays');
});

test('[Cursor] call hasNext before using in a for async', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.aggregate<SampleType>([{ $sort: { field1String: 1 } }]);
	const items: SampleType[] = [];
	await cursor.hasNext();
	for await (const item of cursor) {
		items.push(item);
	}
	t.is(items.length, 5, 'stream contains 5 items');
});

test('[Cursor] Check count function', async (t: ExecutionContext<ContextContent>) => {
	let cursor = t.context.mongoClient.aggregate<SampleType>([]);
	cursor.filterQuery = {};
	t.is(await cursor.count(), 5, 'cursor contains 5 items');

	const filterQuery = { field1String: { $regex: /[24680]$/ } };
	cursor = t.context.mongoClient.aggregateWithBuilder<SampleType>(
		t.context.mongoClient.newAggregationBuilder().match(filterQuery),
	);

	await t.throwsAsync(
		async () => await cursor.count(),
		{ message: 'filter-query-not-initialized' },
		'Should throw filter query not initialized error',
	);
	cursor.filterQuery = filterQuery;
	t.is(await cursor.count(), 2, 'cursor contains only odd => 2 elements');
});

test('[Cursor] Check cursor clone function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.aggregate<SampleType>([{ $sort: { field1String: 1 } }]);
	const cursorClone = cursor.clone();
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');

	await t.notThrowsAsync(async () => await cursor.close(), 'call close function');
	t.true(cursor.closed, `cursor is closed`);

	t.false(cursorClone.closed, 'cloned cursor should not be closed');
	const itemsFromClosedCursor = await getCursorContent(cursor);
	t.deepEqual(itemsFromClosedCursor, [], 'cursor is closed so it return no element');
	const itemsFromClonedCursor = await getCursorContent(cursorClone);
	t.deepEqual(
		itemsFromClonedCursor.length,
		items?.length,
		'cursor has been cloned so it return the elements',
	);
});

test('[Cursor] Check cursor map function : should change data', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.aggregate<SampleType>([{ $sort: { field1String: 1 } }])
		.map((sampleType: SampleType) => ({
			_id: sampleType._id.toString(),
			somethingElse: sampleType.field1String,
		}));
	const items: { somethingElse: string; _id: string }[] = [];
	for await (const item of cursor) {
		items.push(item);
	}

	t.is(items?.length, 5, 'check length of items');
	for (let i = 0; i < 4; i += 1) {
		t.is(typeof items[i]._id, 'string', '_id is a string');
		t.is(items[i]._id.length, 24, '_id is a string of length 24');
		t.is((items[i] as any).objectInfos, undefined, 'objectInfos is not present');
		t.deepEqual(
			_.pick(items[i], 'somethingElse'),
			{ somethingElse: `string${i + 1}` },
			`item ${i + 1} is 'string${i + 1}'`,
		);
	}
});

test('[Cursor] Check cursor map function : should be chainable', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.aggregate<SampleType>([{ $sort: { field1String: 1 } }])
		.map((sampleType: SampleType) => ({
			somethingElse: sampleType.field1String,
		}))
		.map((sampleType: { somethingElse: string }) => ({
			n: Number.parseInt(sampleType.somethingElse.slice(-1), 10),
		}));
	const items: { n: number }[] = [];
	for await (const item of cursor) {
		items.push(item);
	}

	t.is(items?.length, 5, 'check length of items');
	for (let i = 0; i < 4; i += 1) {
		t.deepEqual(items[i], { n: i + 1 }, `item ${i + 1} is '${i + 1}'`);
	}
});