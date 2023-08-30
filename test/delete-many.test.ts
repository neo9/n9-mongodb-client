import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';

import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

global.log = new N9Log('tests').module('issues');

init();

test('[DELETE-MANY] Delete many', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, BaseMongoObject, BaseMongoObject);

	const initialValue: any = {
		key: 'value',
	};
	const query = { key: 'value' };

	await mongoClient.insertOne(_.cloneDeep(initialValue), 'userId1', false, false);
	await mongoClient.insertOne(_.cloneDeep(initialValue), 'userId1', false, false);
	await mongoClient.insertOne({ key: 'something else' } as any, 'userId1', false, false);

	t.is(await mongoClient.count({}), 3, 'collection contains 3 elements');
	const nbFoundObjects = await mongoClient.count(query);
	t.is(nbFoundObjects, 2, 'found by query');

	await mongoClient.deleteMany(query);
	const nbFoundObjectsAfterDelete = await mongoClient.count(query);
	t.is(nbFoundObjectsAfterDelete, 0, 'found 0 element after by query');
	t.is(await mongoClient.count({}), 1, 'collection contains 1 element not deleted');

	await mongoClient.dropCollection();
});
