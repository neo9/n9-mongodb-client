import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';

import { BaseMongoObject, MongoClient, N9AggregationCursor } from '../src';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

class AggregationResult {
	public _id: string;
	public count: number;
}

global.log = new N9Log('tests');

init();

test('[AGG] Insert some and aggregate it 2', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClient.insertOne({ field1String: 'string2' }, 'userId1');

	const sizeWithElementIn = await mongoClient.count();
	t.is(sizeWithElementIn, 5, 'nb element in collection');

	const aggResult = mongoClient.aggregateWithBuilder<AggregationResult>(
		mongoClient
			.newAggregationBuilder()
			.group({
				_id: '$field1String',
				count: { $sum: 1 },
			})
			.sort({ count: -1 }),
	);

	t.truthy(aggResult instanceof N9AggregationCursor, 'return  AggregationCursor');
	const aggResultAsArray = await aggResult.toArray();

	t.is(aggResultAsArray.length, 2, 'nb element aggregated is 2');

	t.deepEqual(
		aggResultAsArray,
		[
			{ _id: 'string2', count: 3 },
			{ _id: 'string1', count: 2 },
		],
		'All is exactly right',
	);
	await mongoClient.dropCollection();
});

test('[AGG] Insert some and aggregate with output', async (t: Assertions) => {
	const aggregationCollectionSourceName = `test-${Math.round(Math.random() * 100000)}${Date.now()}`;
	const mongoClientRead = new MongoClient(aggregationCollectionSourceName, SampleType, null);
	const mongoClientOut = new MongoClient(`test-output-${Date.now()}`, SampleType, null, {
		aggregationCollectionSource: aggregationCollectionSourceName,
	});
	const size = await mongoClientRead.count();
	t.true(size === 0, 'collection should be empty');

	await mongoClientRead.insertOne({ field1String: 'string1' }, 'userId1');
	await mongoClientRead.insertOne({ field1String: 'string2' }, 'userId1');
	await mongoClientRead.insertOne({ field1String: 'string3' }, 'userId1');
	await mongoClientRead.insertOne({ field1String: 'string4' }, 'userId1');
	await mongoClientRead.insertOne({ field1String: 'string5' }, 'userId1');

	const sizeWithElementIn = await mongoClientRead.count();
	t.is(sizeWithElementIn, 5, 'nb element in collection');
	const sizeWithElementInOutput = await mongoClientOut.count();
	t.is(sizeWithElementInOutput, 0, 'nb element in collection output');

	const query = mongoClientOut
		.newAggregationBuilder()
		.match({
			field1String: {
				$regex: /string[2345]/,
			},
		})
		.sort({
			field1String: 1,
		})
		.concatAggregationBuilder(mongoClientOut.newAggregationBuilder().skip(1).limit(2))
		.out()
		.build();

	const aggResult = mongoClientOut.aggregate<AggregationResult>(query);

	t.truthy(aggResult instanceof N9AggregationCursor, 'return  AggregationCursor');
	await aggResult.launch();

	const outputContent = await mongoClientOut
		.find({}, 0, 0, undefined, { _id: 0, field1String: 1 })
		.toArray();
	t.deepEqual(
		outputContent,
		[{ field1String: 'string3' }, { field1String: 'string4' }] as any,
		'All is exactly right',
	);

	const outputContentWithAggregationReading = await mongoClientOut
		.aggregateWithBuilder<{ field1String: string }>(
			mongoClientOut.newAggregationBuilder().project({ _id: 0, field1String: 1 }),
			{},
			true,
		)
		.toArray();
	t.deepEqual(
		outputContentWithAggregationReading,
		[{ field1String: 'string3' }, { field1String: 'string4' }],
		'All is exactly right with aggregation reading',
	);

	await mongoClientOut.dropCollection();
	await mongoClientRead.dropCollection();
});
