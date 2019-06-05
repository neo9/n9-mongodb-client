import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as mongodb from 'mongodb';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

export class TestItem extends BaseMongoObject {
	public key: string;
}

global.log = new N9Log('tests').module('mongo-read-stream');

test.before(async () => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[MONGO-READ-STREAM] Read page by page', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	await Promise.all(
		new Array(38).fill(0)
			.map(async () => mongoClient.insertOne({ key: 'value-' + Math.random() }, 'userId1', false))
	);

	let length = 0;
	let pages = 0;
	await mongoClient.stream({}, 10).forEachPage(async (page: TestItem[]) => {
		length += page.length;
		pages++;
	});

	t.is(length, 38, 'nb elements in collection');
	t.is(pages, 4, 'nb pages in collection');
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Read page by page on empty collection', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	await mongoClient.stream({}, 10).forEachPage(async (page: TestItem[]) => {
		t.fail('should never be called');
	});

	t.pass('ok');
});

test('[MONGO-READ-STREAM] Read item by item', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	await Promise.all(
		new Array(38).fill(0)
			.map(async () => mongoClient.insertOne({ key: 'value-' + Math.random() }, 'userId1', false))
	);

	let length = 0;
	await mongoClient.stream({}, 10).forEach(async (item: TestItem) => {
		length++;
	});

	t.is(length, 38, 'nb elements in collection');
	await mongoClient.dropCollection();
});

test('[MONGO-READ-STREAM] Read item by item on empty collection', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), TestItem, TestItem);

	await mongoClient.stream({}, 10).forEach(async (item: TestItem) => {
		t.fail('should never be called');
	});

	t.pass('ok');
});
