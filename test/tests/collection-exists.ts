import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';

import { MongoClient } from '../../src';
import { BaseMongoObject } from '../../src/models';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public test: string;
}

global.log = new N9Log('tests');

init();

ava('[EXISTS] Create collection and test existence', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, null);

	await mongoClient.insertOne({ test: 'test' }, 'userId1');

	t.true(await mongoClient.collectionExists(), 'collection exists');

	await mongoClient.dropCollection();
});

ava('[EXISTS] Do not create collection and test existence', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, null);

	t.false(await mongoClient.collectionExists(), 'collection does not exist');
});

ava('[EXISTS] Create collection then drop it then test existence', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, null);

	await mongoClient.insertOne({ test: 'test' }, 'userId1');
	await mongoClient.dropCollection();

	t.false(await mongoClient.collectionExists(), 'collection does not exist');

	await t.throwsAsync(
		async () => {
			await mongoClient.dropCollection();
		},
		'ns not found',
		'should throw not found exception',
	);
});
