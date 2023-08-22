import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import { Transform } from 'stream';

import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { N9FindCursor } from '../src/n9-find-cursor';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

global.log = new N9Log('tests');

init();

test('[Cursor] call hasNext before using in a for async', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor = mongoClient.find({}, 0, 0);
	const items: SampleType[] = [];
	await cursor.hasNext();
	for await (const item of cursor as any) {
		items.push(item);
	}
	t.is(items.length, 5, 'stream contains 5 items');

	await mongoClient.dropCollection();
});

test('[Cursor] sort and call hasNext before using in a for async', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor = mongoClient.find({}, 0, 0, { field1String: 1 });
	const items: SampleType[] = [];
	await cursor.hasNext();
	for await (const item of cursor as any) {
		items.push(item);
	}

	t.is(items[0].field1String, 'string1', "item 1 is 'string1'");
	t.is(items[1].field1String, 'string2', "item 2 is 'string1'");
	t.is(items[2].field1String, 'string3', "item 3 is 'string1'");
	t.is(items[3].field1String, 'string4', "item 4 is 'string1'");
	t.is(items[4].field1String, 'string5', "item 5 is 'string1'");

	await mongoClient.dropCollection();
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] hasNext before piping into a stream ', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor = mongoClient.find({}, 0, 0);

	await cursor.hasNext();
	const items: SampleType[] = [];
	await new Promise<void>((resolve, reject) => {
		cursor
			.on('close', () => resolve())
			.on('error', (e) => reject(e))
			.pipe(
				new Transform({
					readableObjectMode: false,
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

	await mongoClient.dropCollection();
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] sort and hasNext before piping into a stream ', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor: N9FindCursor<SampleType> = mongoClient.find({}, 0, 0, { field1String: 1 });

	await cursor.hasNext();
	const items: SampleType[] = [];
	await new Promise<void>((resolve, reject) => {
		cursor
			.on('close', () => resolve())
			.on('error', (e) => reject(e))
			.pipe(
				new Transform({
					readableObjectMode: true,
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

	await mongoClient.dropCollection();
});

// Test for https://jira.mongodb.org/browse/NODE-2454
test('[Cursor] sort and hasNext before piping into a stream with events', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType);

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string5' }, 'userId1');

	const cursor: N9FindCursor<SampleType> = mongoClient.find({}, 0, 0, { field1String: 1 });

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

	await mongoClient.dropCollection();
});
