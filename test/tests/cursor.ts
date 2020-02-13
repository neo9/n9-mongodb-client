import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import { AggregationCursor, Collection } from 'mongodb';

import { MongoClient } from '../../src';
import { BaseMongoObject } from '../../src/models';
import { init } from './fixtures/utils';
import { Transform } from 'stream';
import { waitFor } from '@neo9/n9-node-utils';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

global.log = new N9Log('tests');

init(test);

test('[Cursor] call hasNext before using in a for async', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor = await mongoClient.find({}, 0, 0);
	const items: SampleType[] = [];
	await cursor.hasNext();
	for await (const item of cursor as any) {
		items.push(item);
	}
	t.is(items.length, 5, 'stream contains 5 items');

	await mongoClient.dropCollection();
});

test('[Cursor] sort and call hasNext before using in a for async', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor = await mongoClient.find({}, 0, 0, { field1String: 1 });
	const items: SampleType[] = [];
	await cursor.hasNext();
	for await (const item of cursor as any) {
		items.push(item);
	}

	t.is(items[0].field1String, 'string1', 'item 1 is \'string1\'');
	t.is(items[1].field1String, 'string2', 'item 2 is \'string1\'');
	t.is(items[2].field1String, 'string3', 'item 3 is \'string1\'');
	t.is(items[3].field1String, 'string4', 'item 4 is \'string1\'');
	t.is(items[4].field1String, 'string5', 'item 5 is \'string1\'');

	await mongoClient.dropCollection();
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] hasNext before piping into a stream ', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor = await mongoClient.find({}, 0, 0);

	await cursor.hasNext();
	const items: SampleType[] = [];
	cursor
		.pipe(
			new Transform({
				objectMode: true,
				transform: (chunk: any, encoding: string, next: any): void => {
					items.push(chunk);
					next(null, chunk);
				},
			}),
		)
		.pipe(process.stdout);

	await waitFor(1000);

	t.is(items.length, 5, 'stream contains 5 items');

	await mongoClient.dropCollection();
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] sort and hasNext before piping into a stream ', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor = await mongoClient.find({}, 0, 0, { field1String: 1 });

	await cursor.hasNext();
	const items: SampleType[] = [];
	cursor
		.pipe(
			new Transform({
				objectMode: true,
				transform: (chunk: any, encoding: string, next: any): void => {
					items.push(chunk);
					next(null, chunk);
				},
			}),
		)
		.pipe(process.stdout);

	await waitFor(1000);

	t.is(items[0].field1String, 'string1', 'item 1 is \'string1\'');
	t.is(items[1].field1String, 'string2', 'item 2 is \'string1\'');
	t.is(items[2].field1String, 'string3', 'item 3 is \'string1\'');
	t.is(items[3].field1String, 'string4', 'item 4 is \'string1\'');
	t.is(items[4].field1String, 'string5', 'item 5 is \'string1\'');

	await mongoClient.dropCollection();
});
