import { waitFor } from '@neo9/n9-node-utils';
import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, FilterQuery, MongoUtils, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

export class TestItem extends BaseMongoObject {
	public key: string;
	public i?: number;
}

init();

test('[MONGO-READ-STREAM] Read page by page', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);

	const collectionSize = 38;
	const pageSize = 10;
	for (let i = 0; i < collectionSize; i += 1) {
		await mongoClient.insertOne({ key: `value-${Math.random()}` }, 'userId1', false);
	}

	let length = 0;
	let pages = 0;
	const stream = mongoClient.stream({}, pageSize);
	await stream.forEachPage((page: TestItem[]) => {
		length += page.length;

		if (pages > 0) {
			t.truthy(stream.query.$and, '$and added to query');
			t.is(
				(stream.query.$and as object[]).filter((condition) =>
					Object.keys(condition).includes('_id'),
				).length,
				1,
				'$and has only 1 _id condition',
			);
		}

		pages += 1;
	});

	t.is(length, collectionSize, 'nb elements in collection');
	t.is(pages, Math.ceil(collectionSize / pageSize), 'nb pages in collection');

	length = 0;
	pages = 0;
	const stream2 = mongoClient.streamWithType({}, TestItem, pageSize);
	await stream2.forEachPage((page: TestItem[]) => {
		length += page.length;

		if (pages > 0) {
			t.truthy(stream2.query.$and, '$and added to query');
			t.is(
				(stream2.query.$and as object[]).filter((condition) =>
					Object.keys(condition).includes('_id'),
				).length,
				1,
				'$and has only 1 _id condition',
			);
		}

		pages += 1;
	});

	t.is(length, collectionSize, 'nb elements in collection');
	t.is(pages, Math.ceil(collectionSize / pageSize), 'nb pages in collection');
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Create stream with no _id in projection', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);
	await mongoClient.insertOne({ key: `value-${Math.random()}` }, 'userId1', false);

	t.throws(() => mongoClient.stream({}, 1, { _id: 0 }));
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Create stream with no or empty sort', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);
	await mongoClient.insertOne({ key: `value-${Math.random()}` }, 'userId1', false);

	t.throws(() => mongoClient.stream({}, 1, undefined, undefined, {}));
	t.throws(() => mongoClient.streamWithType({}, TestItem, 1, undefined, undefined, null));

	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Create stream with wrong hint', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);
	await mongoClient.insertOne({ key: `value-${Math.random()}` }, 'userId1', false);

	// hint KO
	const s = mongoClient.stream({}, 1, undefined, { test: 1 });
	await t.throwsAsync(
		async () =>
			await s.forEachPage(() => {
				t.fail('Should not be called');
			}),
		{
			// codeName: 'BadValue',
			code: 2,
			// message: `error processing query: ns=b02f1973-e33c-4164-a198-86c673d6e6ab.test-1643735376480 limit=1Tree: $and␊
			//   Sort: { _id: 1 }␊
			//   Proj: {}␊
			//   planner returned error :: caused by :: hint provided does not correspond to an existing index`,
		},
	);
});

test('[MONGO-READ-STREAM] Create stream with hint OK', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);
	for (let i = 0; i < 50; i += 1) {
		await mongoClient.insertOne({ key: `value-${Math.random()}` }, 'userId1', false);
	}

	// hint OK
	const s2 = mongoClient.stream({}, 5, undefined, { _id: 1 });
	await t.notThrowsAsync(
		async () =>
			await s2.forEachPage(() => {
				t.pass('Should be called');
			}),
	);
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Create stream with sort OK', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);

	for (let i = 0; i < 5; i += 1) {
		// alternate value for testing sort on i
		const value = i % 2 ? i : i + 20;
		for (let j = 0; j < 2; j += 1) {
			await mongoClient.insertOne({ key: `${j}`, i: value }, 'userId1', false);
		}
	}

	// sort OK
	let lastItem: TestItem;
	let length = 0;
	let stream = mongoClient.stream({}, 2, undefined, undefined, { i: 1 });
	await stream.forEachAsync(async (item: TestItem) => {
		if (!item) t.fail('missing item');
		if (lastItem && lastItem.i > item.i) t.fail('bad sorting');

		lastItem = item;
		length += 1;
		await waitFor(2); // add some time to simulate long process
	});
	t.is(length, 10);

	lastItem = null;
	length = 0;
	stream = mongoClient.stream({}, 2, undefined, undefined, { key: 1, i: 1 });
	await stream.forEachAsync(async (item: TestItem) => {
		if (!item) t.fail('missing item');
		if (lastItem) {
			if (lastItem.key > item.key || (lastItem.key === item.key && lastItem.i > item.i)) {
				t.fail('bad sorting');
			}
		}

		length += 1;
		lastItem = item;
		await waitFor(2); // add some time to simulate long process
	});
	t.is(length, 10);

	lastItem = null;
	length = 0;
	stream = mongoClient.streamWithType({}, TestItem, 2, undefined, undefined, { i: -1 });
	await stream.forEachAsync(async (item: TestItem) => {
		if (!item) t.fail('missing item');
		if (lastItem && lastItem.i < item.i) t.fail('bad sorting');

		length += 1;
		lastItem = item;
		await waitFor(2); // add some time to simulate long process
	});
	t.is(length, 10);

	lastItem = null;
	length = 0;
	stream = mongoClient.streamWithType({}, TestItem, 2, undefined, undefined, { key: -1, i: 1 });
	await stream.forEachAsync(async (item: TestItem) => {
		if (!item) t.fail('missing item');
		if (lastItem) {
			if (lastItem.key < item.key || (lastItem.key === item.key && lastItem.i > item.i)) {
				t.fail('bad sorting');
			}
		}

		length += 1;
		lastItem = item;
		await waitFor(2); // add some time to simulate long process
	});
	t.is(length, 10);

	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Create stream with limit OK', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);
	for (let i = 0; i < 20; i += 1) {
		await mongoClient.insertOne({ key: `value-${Math.random()}` }, 'userId1', false);
	}

	// limit OK
	let length = 0;
	await mongoClient
		.stream({}, 5, undefined, undefined, undefined, 7)
		.forEachAsync(async (item: TestItem) => {
			if (!item) t.fail('missing item');

			length += 1;
			await waitFor(2); // add some time to simulate long process
		});
	t.is(length, 7, 'should stream only 7 elements');

	length = 0;
	await mongoClient
		.streamWithType({}, TestItem, 5, undefined, undefined, undefined, 17)
		.forEachAsync(async (item: TestItem) => {
			if (!item) t.fail('missing item');

			length += 1;
			await waitFor(2); // add some time to simulate long process
		});
	t.is(length, 17, 'should stream only 17 elements');

	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Read page by page on empty collection', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.stream({}, 10).forEachPage(() => {
		t.fail('should never be called');
	});

	t.pass('ok');
});

test('[MONGO-READ-STREAM] Read item by item', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);

	const collectionSize = 38;
	const pageSize = 10;
	for (let i = 0; i < collectionSize; i += 1) {
		await mongoClient.insertOne({ key: `value-${Math.random()}` }, 'userId1', false);
	}

	let length = 0;
	await mongoClient.stream({}, pageSize).forEachAsync(async (item: TestItem) => {
		if (item) {
			length += 1;
			await waitFor(2); // add some time to simulate long process
		} else {
			t.fail('missing item');
		}
	});

	t.is(length, collectionSize, 'nb elements in collection');

	length = 0;
	await mongoClient.streamWithType({}, TestItem, pageSize).forEachAsync(async (item: TestItem) => {
		if (item) {
			length += 1;
			await waitFor(2); // add some time to simulate long process
		} else {
			t.fail('missing item');
		}
	});
	t.is(length, collectionSize, 'nb elements in collection');

	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Read item by item on empty collection', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);

	await mongoClient.stream({}, 10).forEach(() => {
		t.fail('should never be called');
	});

	t.pass('ok');
});

test('[MONGO-READ-STREAM] Does not override conditions on _id', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);

	const collectionSize = 38;
	const pageSize = 10;
	const ids: string[] = [];

	for (let i = 0; i < collectionSize; i += 1) {
		const doc = await mongoClient.insertOne({ i, key: `value-${Math.random()}` }, 'userId1', false);
		// save every even doc
		if (i % 2 === 0) {
			ids.push(MongoUtils.TO_OBJECT_ID(doc._id) as any);
		}
	}
	let length = 0;
	// filter on even docs, lower than 21, so 11 docs
	const query: FilterQuery<TestItem> = {
		_id: { $in: ids },
		$and: [{ i: { $lt: 21 } }],
	};
	const stream = mongoClient.stream(query, pageSize);
	await stream.forEachAsync((item: TestItem) => {
		if (item) {
			length += 1;
		} else {
			t.fail('missing item');
		}
	});

	t.not(query, stream.query, 'query fetched from mongo read stream is a copy');
	t.deepEqual(
		MongoUtils.MAP_OBJECT_ID_TO_STRING_HEX(query),
		MongoUtils.MAP_OBJECT_ID_TO_STRING_HEX(stream.query),
		'query fetched from mongo read stream has the same body',
	);
	t.is(length, 11, 'nb elements in collection');
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Handle errors during query', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		TestItem,
		TestItem,
		getBaseMongoClientSettings(t),
	);
	const pageSize = 10;

	await t.throwsAsync(async () => {
		// bad request: $and only accepts array values
		await mongoClient.stream({ $and: {} }, pageSize).forEachAsync(() => {
			t.fail('Should never happen');
		});
	});
});
