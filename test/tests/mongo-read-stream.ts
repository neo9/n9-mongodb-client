import { N9Log } from '@neo9/n9-node-log';
import { waitFor } from '@neo9/n9-node-utils';
import test, { Assertions } from 'ava';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';
import { init } from './fixtures/utils';

export class TestItem extends BaseMongoObject {
	public key: string;
	public i?: number;
}

global.log = new N9Log('tests').module('mongo-read-stream');

init(test);

test('[MONGO-READ-STREAM] Read page by page', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	const collectionSize = 38;
	const pageSize = 10;
	for (let i = 0; i < collectionSize; i++) {
		await mongoClient.insertOne({ key: 'value-' + Math.random() }, 'userId1', false);
	}

	let length = 0;
	let pages = 0;
	await mongoClient.stream({}, pageSize).forEachPage(async (page: TestItem[]) => {
		length += page.length;
		pages++;
	});

	t.is(length, collectionSize, 'nb elements in collection');
	t.is(pages, Math.ceil(collectionSize / pageSize), 'nb pages in collection');
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Create stream with no _id in projection', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);
	await mongoClient.insertOne({ key: 'value-' + Math.random() }, 'userId1', false);

	await t.throwsAsync(async () => await mongoClient.stream({}, 1, { _id: 0 }));
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Read page by page on empty collection', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	await mongoClient.stream({}, 10).forEachPage(async () => {
		t.fail('should never be called');
	});

	t.pass('ok');
});

test('[MONGO-READ-STREAM] Read item by item', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	const collectionSize = 38;
	const pageSize = 10;
	for (let i = 0; i < collectionSize; i++) {
		await mongoClient.insertOne({ key: 'value-' + Math.random() }, 'userId1', false);
	}

	let length = 0;
	await mongoClient.stream({}, pageSize).forEach(async (item: TestItem) => {
		if (item) {
			length++;
			await waitFor(2); // add some time to simulate long process
		} else {
			t.fail('missing item');
		}
	});

	t.is(length, collectionSize, 'nb elements in collection');
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Read item by item on empty collection', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	await mongoClient.stream({}, 10).forEach(async () => {
		t.fail('should never be called');
	});

	t.pass('ok');
});

test('[MONGO-READ-STREAM] Does not override conditions on _id', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	const collectionSize = 38;
	const pageSize = 10;
	const ids: string[] = [];

	for (let i = 0; i < collectionSize; i++) {
		const doc = await mongoClient.insertOne({ key: 'value-' + Math.random(), i }, 'userId1', false);
		// save every even doc
		if (i % 2 === 0) {
			ids.push(MongoUtils.oid(doc._id) as any);
		}
	}
	let length = 0;
	// filter on even docs, lower than 21, so 11 docs
	await mongoClient.stream({ _id: { $in: ids }, $and: [{ i: { $lt: 21 } }] }, pageSize)
		.forEach(async (item: TestItem) => {
			if (item) {
				length++;
			} else {
				t.fail('missing item');
			}
	});

	t.is(length, 11, 'nb elements in collection');
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Handle errors during query', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);
	const pageSize = 10;

	await t.throwsAsync(async () => {
		// bad request: $and only accepts array values
		await mongoClient.stream({ $and: {} }, pageSize)
			.forEach(async (item: TestItem) => {
				t.fail('Should never happen');
			});
	});
});
