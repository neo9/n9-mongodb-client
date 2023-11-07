import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';

import { BaseMongoObject, N9AggregationCursor, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

interface ContextContent extends TestContext {
	mongoClient: N9MongoDBClient<SampleType, SampleType>;
}

init();
test.beforeEach(async (t: ExecutionContext<ContextContent>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		SampleType,
		getBaseMongoClientSettings(t),
	);

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
		_.first(item.field1String).charAt(5); // check next returned type : type of sampleType should be deduced automatically
		items2.push(item);
	}
	t.is(items2.length, 5, 'cursor contains 5 items read with hasNext and next');
	t.is(typeof items[0]._id, 'string', '_id is a string, aggregation results are mapped');

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
	t.is(await cursor.count(), 5, 'cursor contains 5 items');

	const filterQueryOdd = { field1String: { $regex: /[24680]$/ } };
	cursor = t.context.mongoClient.aggregateWithBuilder<SampleType>(
		t.context.mongoClient.newAggregationBuilder().match(filterQueryOdd),
	);
	t.is(await cursor.count(), 2, 'cursor contains only odd => 2 elements');
	t.is(await cursor.count(false), 2, "apply only match, doesn't change anything");

	cursor = t.context.mongoClient.aggregateWithBuilder<SampleType>(
		t.context.mongoClient.newAggregationBuilder().match(filterQueryOdd).group({ _id: 1 }),
	);
	t.is(await cursor.count(), 1, 'cursor only contains the group result');

	cursor = t.context.mongoClient.aggregateWithBuilder<SampleType>(
		t.context.mongoClient
			.newAggregationBuilder()
			.match({ $and: [{ _id: { $eq: '1' } }, { _id: { $ne: '1' } }] }),
	);
	t.is(await cursor.count(), 0, 'empty cursor count is 0');

	cursor = t.context.mongoClient.aggregateWithBuilder<SampleType>(
		t.context.mongoClient.newAggregationBuilder().match(filterQueryOdd).skip(1),
	);
	t.is(await cursor.count(), 2, 'avoid skip stage');
	t.is(await cursor.count(false), 1, 'keep skip stage');
	cursor = t.context.mongoClient.aggregateWithBuilder<SampleType>(
		t.context.mongoClient.newAggregationBuilder().match(filterQueryOdd).limit(1),
	);
	t.is(await cursor.count(true), 2, 'avoid limit stage');
	t.is(await cursor.count(false), 1, 'keep limit stage');
	cursor = t.context.mongoClient.aggregateWithBuilder<SampleType>(
		t.context.mongoClient.newAggregationBuilder().match(filterQueryOdd).skip(2).limit(1),
	);
	t.is(await cursor.count(), 2, 'avoid skip and limit stages');
	t.is(await cursor.count(true), 2, 'avoid skip and limit stages');
	t.is(await cursor.count(false), 0, 'keep skip and limit stages (2 match, skip those 2 => 0)');
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
	const cursor: N9AggregationCursor<{ _id: string; somethingElse: string }> = t.context.mongoClient
		.aggregate<SampleType>([{ $sort: { field1String: 1 } }])
		.map((sampleType) => ({
			// type of sampleType should be deduced automatically
			_id: sampleType._id,
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

test('[Cursor] Check _id automatic mapping, should leave objects', async (t: ExecutionContext<ContextContent>) => {
	const cursor: N9AggregationCursor<{
		_id: {
			value: number;
			prop2: number;
		};
	}> = t.context.mongoClient.aggregate<any>([
		{
			$group: {
				_id: 1,
			},
		},
		{
			$project: {
				_id: {
					value: '$_id',
					prop2: {
						$sum: ['$_id', '$_id'],
					},
				},
			},
		},
	]);

	t.is(await cursor.count(), 1, 'check cursor length');
	const doc = await cursor.next();
	t.deepEqual(
		doc,
		{
			_id: {
				value: 1,
				prop2: 2,
			},
		},
		'_id is an object',
	);
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
