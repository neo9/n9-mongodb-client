import { N9Log } from '@neo9/n9-node-log';
import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';
import { Transform } from 'stream';

import { BaseMongoObject, MongoClient, MongoUtils, N9FindCursor } from '../src';
import {
	CURSOR_FLAGS,
	MongoClient as MongodbClient,
	MongoCursorExhaustedError,
} from '../src/mongodb';
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

async function getCursorContent<T>(cursor: N9FindCursor<T>): Promise<T[]> {
	const items = [];
	for await (const item of cursor) {
		items.push(item);
	}
	return items;
}

test('[Cursor] iterate using while hasNext ... next', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0, { field1String: 1 });
	const items: SampleType[] = [];
	await cursor.hasNext();
	while (await cursor.hasNext()) {
		const item = await cursor.next();
		items.push(item);
	}

	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string1'");
	t.is(items[2].field1String, 'string3', "item 3 is 'string1'");
	t.is(items[3].field1String, 'string4', "item 4 is 'string1'");
	t.is(items[4].field1String, 'string5', "item 5 is 'string1'");
});

test('[Cursor] call hasNext before using in a for async', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0);
	const items: SampleType[] = [];
	await cursor.hasNext();
	for await (const item of cursor) {
		items.push(item);
	}
	t.is(items.length, 5, 'stream contains 5 items');
});

test('[Cursor] sort and call hasNext before using in a for async', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0, { field1String: 1 });
	const items: SampleType[] = [];
	await cursor.hasNext();
	for await (const item of cursor) {
		items.push(item);
	}

	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string1'");
	t.is(items[2].field1String, 'string3', "item 3 is 'string1'");
	t.is(items[3].field1String, 'string4', "item 4 is 'string1'");
	t.is(items[4].field1String, 'string5', "item 5 is 'string1'");
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] hasNext before piping into a stream ', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0);

	await cursor.hasNext();
	const items: SampleType[] = [];
	await new Promise<void>((resolve, reject) => {
		cursor
			.once('close', () => resolve())
			.on('error', (e) => reject(e))
			.pipe(
				new Transform({
					writableObjectMode: true,
					transform: (chunk: any, encoding: string, next: any): void => {
						items.push(chunk);
						next(null, JSON.stringify(chunk));
					},
				}),
			)
			.pipe(process.stdout);
	});

	t.is(items.length, 5, 'stream contains 5 items');
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] sort and hasNext before piping into a stream ', async (t: ExecutionContext<ContextContent>) => {
	const cursor: N9FindCursor<SampleType> = t.context.mongoClient.find({}, 0, 0, {
		field1String: 1,
	});

	await cursor.hasNext();
	const items: SampleType[] = [];
	await new Promise<void>((resolve, reject) => {
		cursor
			.on('close', () => resolve())
			.on('error', (e) => reject(e))
			.pipe(
				new Transform({
					writableObjectMode: true,
					transform: (chunk: SampleType, encoding: string, next: (err, data) => void): void => {
						t.is(Array.isArray(chunk), false, 'The chunk should be an object');
						items.push(chunk);
						next(null, JSON.stringify(chunk));
					},
				}),
			)
			.on('close', () => resolve())
			.on('error', (e) => reject(e))
			.pipe(process.stdout);
	});
	t.is(items?.length, 5, 'has 5 items');
	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string2'");
	t.is(items[2].field1String, 'string3', "item 3 is 'string3'");
	t.is(items[3].field1String, 'string4', "item 4 is 'string4'");
	t.is(items[4].field1String, 'string5', "item 5 is 'string5'");
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] sort and hasNext before subscribing to data with on', async (t: ExecutionContext<ContextContent>) => {
	const cursor: N9FindCursor<SampleType> = t.context.mongoClient.find({}, 0, 0, {
		field1String: 1,
	});

	await cursor.hasNext();
	const items: SampleType[] = [];
	await new Promise<void>((resolve, reject) => {
		cursor
			.on('close', () => resolve())
			.on('error', (e) => reject(e))
			.on('data', (chunk: SampleType): void => {
				t.is(Array.isArray(chunk), false, 'The chunk should be an object');
				items.push(chunk);
			})
			.on('end', () => resolve());
	});
	t.is(items?.length, 5, 'has 5 items');
	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string2'");
	t.is(items[2].field1String, 'string3', "item 3 is 'string3'");
	t.is(items[3].field1String, 'string4', "item 4 is 'string4'");
	t.is(items[4].field1String, 'string5', "item 5 is 'string5'");
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] sort and hasNext before subscribing to data with addListener', async (t: ExecutionContext<ContextContent>) => {
	const cursor: N9FindCursor<SampleType> = t.context.mongoClient.find({}, 0, 0, {
		field1String: 1,
	});

	await cursor.hasNext();
	const items: SampleType[] = [];
	await new Promise<void>((resolve, reject) => {
		cursor
			.addListener('close', () => resolve())
			.addListener('error', (e) => reject(e))
			.addListener('data', (chunk: SampleType): void => {
				t.is(Array.isArray(chunk), false, 'The chunk should be an object');
				items.push(chunk);
			})
			.addListener('end', () => resolve());
	});
	t.is(items?.length, 5, 'has 5 items');
	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string2'");
	t.is(items[2].field1String, 'string3', "item 3 is 'string3'");
	t.is(items[3].field1String, 'string4', "item 4 is 'string4'");
	t.is(items[4].field1String, 'string5', "item 5 is 'string5'");
});

test('[Cursor] Check forEach function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0, { field1String: 1 });
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');
	cursor.rewind();
	const items2 = [];
	await cursor.forEach((item) => {
		items2.push(item);
	});
	t.deepEqual(items2, items, 'Data should be the same');
});

test('[Cursor] Check cursor sort function ASC', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0).sort({ field1String: 1 });
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');
	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string2'");
	t.is(items[2].field1String, 'string3', "item 3 is 'string3'");
	t.is(items[3].field1String, 'string4', "item 4 is 'string4'");
	t.is(items[4].field1String, 'string5', "item 5 is 'string5'");
});

test('[Cursor] Check cursor sort function DESC', async (t: ExecutionContext<ContextContent>) => {
	const cursor1 = t.context.mongoClient.find({}, 0, 0).sort({ field1String: -1 });
	const cursor2 = t.context.mongoClient.find({}, 0, 0).sort('field1String', 'desc');

	for (const cursor of [cursor1, cursor2]) {
		const items: SampleType[] = [];
		for await (const item of cursor) {
			items.push(item);
		}
		t.is(items?.length, 5, 'check length of items');
		t.is(items[0].field1String, 'string5', `item 1 is 'string5'`);
		t.is(items[1].field1String, 'string4', `item 2 is 'string4'`);
		t.is(items[2].field1String, 'string3', `item 3 is 'string3'`);
		t.is(items[3].field1String, 'string2', `item 4 is 'string2'`);
		t.is(items[4].field1String, 'string1', `item 5 is 'string1'`);
	}
});

test('[Cursor] Check cursor limit function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0, { field1String: 1 }).limit(2);
	const items = await getCursorContent(cursor);

	t.is(items?.length, 2, 'check length of items');
	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string2'");
});

test('[Cursor] Check cursor skip + limit function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0, { field1String: 1 }).skip(1).limit(2);
	const items = await getCursorContent(cursor);

	t.is(items?.length, 2, 'check length of items');
	t.is(await cursor.count(), 5, 'check count should not be limited by skip or limit');
	t.is(items[0].field1String, 'string2', "item 1 is 'string2'");
	t.is(items[1].field1String, 'string3', "item 2 is 'string3'");
});

test('[Cursor] Check cursor project function : exclude _id', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.find({}, 0, 0, { field1String: 1 })
		.limit(1)
		.project<Omit<SampleType, '_id'>>({ _id: 0 });
	const items = await getCursorContent(cursor);

	t.is(items?.length, 1, 'check length of items');
	t.is((items[0] as any)._id, undefined, '_id is not present');
});

test('[Cursor] Check cursor project function : exclude field1String', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.find({}, 0, 0, { field1String: 1 })
		.limit(1)
		.project<Omit<SampleType, 'field1String'>>({ field1String: 0 });
	const items = await getCursorContent(cursor);

	t.is(items?.length, 1, 'check length of items');
	t.is((items[0] as any).field1String, undefined, 'field1String is not present');
});

test('[Cursor] Check cursor project function : inclue only field1String', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.find({}, 0, 0, { field1String: 1 })
		.limit(1)
		.project({ field1String: 1 });
	const items = await getCursorContent(cursor);

	t.is(items?.length, 1, 'check length of items');
	t.is((items[0] as any).objectInfos, undefined, 'objectInfos is not present');
	t.not((items[0] as any)._id, undefined, '_id is present');
	t.not((items[0] as any).field1String, undefined, 'field1String is present');
});

test('[Cursor] Check cursor returnKey function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.find({ _id: { $gte: MongoUtils.oid('000000000000000000000000') } }, 0, 0, { field1String: 1 })
		.returnKey(true);
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');
	for (const item of items) {
		t.truthy(item._id, "_id is present, because it's the index key");
		t.falsy(item.objectInfos, 'objectInfos is not present');
		t.falsy(item.field1String, 'field1String is not present');
	}
});

test('[Cursor] Check cursor showRecordId function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0, { field1String: 1 }).showRecordId(true);
	const items = await getCursorContent(cursor);

	t.is(items?.length, 5, 'check length of items');
	for (const item of items) {
		t.true(
			_.isNumber((item as any).$recordId),
			`$recordId is present on item ${item.field1String}`,
		);
	}
});

test('[Cursor] Check cursor map function : should change data', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.find({}, 0, 0, { field1String: 1 })
		.map((sampleType: SampleType) => ({
			somethingElse: sampleType.field1String,
		}));
	const items: { somethingElse: string }[] = [];
	for await (const item of cursor) {
		items.push(item);
	}

	t.is(items?.length, 5, 'check length of items');
	for (let i = 0; i < 4; i += 1) {
		t.is((items[i] as any)._id, undefined, '_id is not present');
		t.is((items[i] as any).objectInfos, undefined, 'objectInfos is not present');
		t.deepEqual(items[i], { somethingElse: `string${i + 1}` }, `item ${i + 1} is 'string${i + 1}'`);
	}
});

test('[Cursor] Check cursor map function : should be chainable', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient
		.find({}, 0, 0, { field1String: 1 })
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

test('[Cursor] Check cursor rewind function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0);
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');

	t.is(await cursor.hasNext(), false, `Cursor is ended`);
	t.deepEqual(await cursor.toArray(), [], 'Cursor is now empty');
	cursor.rewind();
	t.deepEqual(await cursor.toArray(), items, `Cursor can be rewound`);
});

test('[Cursor] Check cursor id function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0);
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');
	t.not(cursor.id, undefined, `check id is returned`);
});

test('[Cursor] Check cursor close and closed function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0);
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');
	await t.notThrowsAsync(async () => await cursor.close(), 'call close function');
	t.true(cursor.closed, `cursor is closed`);
});

test('[Cursor] Check cursor namespace function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0);
	const items = await getCursorContent(cursor);
	t.is(items?.length, 5, 'check length of items');
	t.is(cursor.namespace.db, 'test', 'check namespace');
	t.is(cursor.namespace.collection, t.context.collectionName, 'check namespace collectionName');
});

test('[Cursor] Check cursor comment function', (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0).comment('a comment on cursor');
	const nativeCursor = (cursor as any).cursor;
	const builtOptionsSymbolKey = Object.getOwnPropertySymbols(nativeCursor).find(
		(s) => s.description === 'builtOptions',
	);

	t.is(
		nativeCursor[builtOptionsSymbolKey].comment,
		'a comment on cursor',
		'check comment is stored in native client',
	);
});

test('[Cursor] Check cursor maxAwaitTimeMS function', (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0).maxAwaitTimeMS(42);
	const nativeCursor = (cursor as any).cursor;
	const builtOptionsSymbolKey = Object.getOwnPropertySymbols(nativeCursor).find(
		(s) => s.description === 'builtOptions',
	);

	t.is(
		nativeCursor[builtOptionsSymbolKey].maxAwaitTimeMS,
		42,
		'check maxAwaitTimeMS is stored in native client',
	);
});

test('[Cursor] Check cursor maxTimeMS function', (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0).maxTimeMS(42);
	const nativeCursor = (cursor as any).cursor;
	const builtOptionsSymbolKey = Object.getOwnPropertySymbols(nativeCursor).find(
		(s) => s.description === 'builtOptions',
	);

	t.is(
		nativeCursor[builtOptionsSymbolKey].maxTimeMS,
		42,
		'check maxTimeMS is stored in native client',
	);
});

test('[Cursor] Check cursor readConcern function', (t: ExecutionContext<ContextContent>) => {
	const cursor2 = t.context.mongoClient.find({}, 0, 0);
	t.is(cursor2.readConcern?.level, undefined, 'check readConcern default');
	const cursor = t.context.mongoClient.find({}, 0, 0).withReadConcern('available');
	t.is(cursor.readConcern?.level, 'available', 'check readConcern');
});

test('[Cursor] Check cursor readPreference function', (t: ExecutionContext<ContextContent>) => {
	const cursor2 = t.context.mongoClient.find({}, 0, 0);
	t.is(cursor2.readPreference?.mode, 'primary', 'check readPreference default');
	const cursor = t.context.mongoClient.find({}, 0, 0).withReadPreference('secondary');
	t.is(cursor.readPreference?.mode, 'secondary' as any, 'check readPreference');
});

test('[Cursor] Check cursor explain function', async (t: ExecutionContext<ContextContent>) => {
	let explanation = await t.context.mongoClient.find({}, 0, 0).explain();
	t.is(explanation?.queryPlanner.winningPlan.stage, 'COLLSCAN', 'check explanation content');
	t.truthy(explanation?.executionStats, 'default mode should return `executionStats`');
	explanation = await t.context.mongoClient.find({}, 0, 0).explain('queryPlanner');
	t.falsy(explanation?.executionStats, '`queryPlanner` mode should not return `executionStats`');
});

test('[Cursor] Check cursor addCursorFlag function', (t: ExecutionContext<ContextContent>) => {
	for (const flag of CURSOR_FLAGS) {
		const baseCursor = t.context.mongoClient.find({}, 0, 1);
		const nativeBaseCursor = (baseCursor as any).cursor;
		const builtOptionsSymbolKey = Object.getOwnPropertySymbols(nativeBaseCursor).find(
			(s) => s.description === 'options',
		);
		t.is(
			nativeBaseCursor[builtOptionsSymbolKey][flag],
			undefined,
			`check ${flag} is stored in native client default value is 'undefined'`,
		);

		for (const bool of [true, false]) {
			const cursor = t.context.mongoClient.find({}, 0, 0).addCursorFlag(flag, bool);
			t.is(
				(cursor as any).cursor[builtOptionsSymbolKey][flag],
				bool,
				`check ${flag} is stored in native client (${bool})`,
			);
		}
	}
});

test('[Cursor] Check cursor allowDiskUse function', (t: ExecutionContext<ContextContent>) => {
	for (const bool of [true, false]) {
		const cursor = t.context.mongoClient.find({}, 0, 0, { field1String: 1 }).allowDiskUse(bool);
		const nativeCursor = (cursor as any).cursor;
		const builtOptionsSymbolKey = Object.getOwnPropertySymbols(nativeCursor).find(
			(s) => s.description === 'builtOptions',
		);

		t.is(
			nativeCursor[builtOptionsSymbolKey].allowDiskUse,
			bool,
			`check allowDiskUse is stored in native client at ${bool}`,
		);
	}
});

test('[Cursor] Check cursor bufferedCount, readBufferedDocuments and batchSize functions', async (t: ExecutionContext<ContextContent>) => {
	let cursor = t.context.mongoClient.find({}, 0, 0);
	await cursor.hasNext();
	t.is(cursor.bufferedCount(), 5, 'All documents are buffered');
	t.is(cursor.readBufferedDocuments(1).length, 1, 'Read 1st document from the buffer');
	t.is(cursor.bufferedCount(), 4, '4 left documents');
	t.is(cursor.readBufferedDocuments().length, 4, 'read the others documents');

	cursor = t.context.mongoClient
		.find({ field1String: { $exists: true } }, 0, 0, { field1String: 1 })
		.batchSize(1);
	const nativeCursor = cursor as any;
	const optionsSymbolKey = Object.getOwnPropertySymbols(nativeCursor.cursor).find(
		(s) => s.description === 'options',
	);
	t.is(
		nativeCursor.cursor[optionsSymbolKey].batchSize,
		1,
		'batchSize is well stored in native cursor',
	);
	await cursor.hasNext();
	t.is(cursor.bufferedCount(), 1, 'Only one document is buffered');
	t.is((await cursor.tryNext())?.field1String, 'string1', 'First element is present');
	t.is(cursor.bufferedCount(), 0, 'Buffer is cleaned');
});

test('[Cursor] Check cursor tryNext function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0);
	await cursor.close();
	await t.throwsAsync(
		async () => await cursor.tryNext(),
		{ message: 'Cursor is exhausted', instanceOf: MongoCursorExhaustedError },
		'should throw exhausted error, verify that we try to use the cursor',
	);
});

test('[Cursor] Check cursor clone function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({}, 0, 0).sort('field1String');
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

test('[Cursor] Check cursor filter function', async (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find(
		{
			field1String: {
				$in: ['string1', 'string2'],
			},
		},
		0,
		0,
		{ field1String: 1 },
	);
	let items = await getCursorContent(cursor);

	t.is(items?.length, 2, 'check length of items');
	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string2'");
	t.throws(
		() => cursor.filter({}),
		{ message: 'Cursor is already initialized' },
		"Filter can't be change after find execution",
	);

	const cursor2 = cursor.clone();
	items = await getCursorContent(cursor2.filter({ field1String: 'string2' }));
	t.is(items?.length, 1, 'check length of items with new filter');
	t.is(items[0].field1String, 'string2', "item 1 is 'string2'");
	t.is(await cursor2.count(), 1, 'count is 1 for new filter');
});

test('[Cursor] Check cursor not implemented functions', (t: ExecutionContext<ContextContent>) => {
	const cursor = t.context.mongoClient.find({});

	t.throws(
		() => cursor.addQueryModifier('$orderby', 'field1String'),
		{ message: 'unsupported-function-addQueryModifier' },
		'addQueryModifier should throw 501',
	);
	t.throws(
		() => cursor.killed,
		{ message: 'unsupported-function-killed' },
		'killed read should throw 501',
	);
	t.throws(
		() => cursor.loadBalanced,
		{ message: 'unsupported-function-loadBalanced' },
		'loadBalanced read should throw 501',
	);
	t.throws(() => cursor.max({}), { message: 'unsupported-function-max' }, 'max should throw 501');
	t.throws(() => cursor.min({}), { message: 'unsupported-function-min' }, 'min should throw 501');
	t.throws(
		() => cursor.stream(),
		{ message: 'unsupported-function-stream' },
		'stream should throw 501',
	);
});

test('[Cursor] Check events listing functions', async (t: ExecutionContext<ContextContent>) => {
	const cursor: N9FindCursor<SampleType> = t.context.mongoClient.find({});

	const items: SampleType[] = [];
	let onClose: any;
	await new Promise<void>((resolve, reject) => {
		onClose = (): void => {
			resolve();
		};
		cursor
			.on('close', onClose)
			.once('error', (e) => reject(e))
			.pipe(
				new Transform({
					writableObjectMode: true,
					transform: (chunk: SampleType, encoding: string, next: (err, data) => void): void => {
						items.push(chunk);
						next(null, undefined);
					},
				}),
			)
			.on('error', (e) => reject(e))
			.pipe(process.stdout);
	});
	t.is(items?.length, 5, 'has 5 items');

	t.deepEqual(cursor.eventNames(), ['close'], 'eventNames are only close');
	t.is(
		cursor.listeners('close')?.[0],
		onClose,
		"listeners('close') should return the onClose function",
	);
	cursor.setMaxListeners(42);
	t.is(cursor.getMaxListeners(), 42, 'Should be able to change max listener');
});
