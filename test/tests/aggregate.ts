import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import { AggregationCursor } from 'mongodb';

import { MongoClient } from '../../src';
import { BaseMongoObject } from '../../src/models';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

class AggregationResult {
	public _id: string;
	public count: number;
}

global.log = new N9Log('tests');

init(test);

test('[AGG] Insert some and aggregate it 2', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, null);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');

	const sizeWithElementIn = await mongoClient.count();
	t.is(sizeWithElementIn, 5, 'nb element in collection');

	const aggResult = await mongoClient.aggregateWithBuilder<AggregationResult>(
			mongoClient.newAggregationBuilder()
			.group({
				_id: '$field1String',
				count: { $sum: 1 },
			})
			.sort({ count: -1 })
	);

	t.truthy(aggResult instanceof AggregationCursor, 'return  AggregationCursor');
	const aggResultAsArray = await aggResult.toArray();

	t.is(aggResultAsArray.length, 2, 'nb element aggregated is 2');

	t.deepEqual(aggResultAsArray, [{ _id: 'string2', count: 3 }, { _id: 'string1', count: 2 }], 'All is exactly right');
	await mongoClient.dropCollection();
});
