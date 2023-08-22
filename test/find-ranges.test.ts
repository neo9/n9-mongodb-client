import { N9Log } from '@neo9/n9-node-log';
import ava, { ExecutionContext } from 'ava';

import { FilterQuery } from '..';
import { MongoClient, StringMap } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

class SampleType extends BaseMongoObject {
	public field1String: string;
	public index: number;
}

global.log = new N9Log('tests');

init();

interface TestContext {
	mongoClient: MongoClient<SampleType, SampleType>;
}

ava.beforeEach(async (t: ExecutionContext<TestContext>) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleType, SampleType);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	for (let i = 0; i < 50; i += 1) {
		await mongoClient.insertOne({ field1String: 'string1', index: i }, 'userId1');
	}

	const sizeWithElementIn = await mongoClient.count();
	t.is(sizeWithElementIn, 50, 'nb element in collection');

	t.context.mongoClient = mongoClient;
});

ava(
	'[GET-RANGES] Get ranges with multiple sizes without indexes',
	async (t: ExecutionContext<TestContext>) => {
		const allIds = await t.context.mongoClient.find({}, 0, 0, {}, { _id: 1 }).toArray();
		const expectedIdsByRange: StringMap<{ _id: string }[]> = {};
		for (const range of [1, 2, 3, 4, 5, 10, 20, 80]) {
			let index = 0;
			for (const id of allIds) {
				if (index % range === 0) {
					if (!expectedIdsByRange[range]) {
						expectedIdsByRange[range] = [];
					}
					expectedIdsByRange[range.toString()].push({ _id: id._id });
				}
				index += 1;
			}

			const foundIds = await t.context.mongoClient.findIdsEveryNthEntities(range);
			t.deepEqual(
				expectedIdsByRange[range],
				foundIds,
				'Found ids are the good onces in the same order',
			);
		}
		await t.context.mongoClient.dropCollection();
	},
);

ava(
	'[GET-RANGES] Get ranges with multiple sizes with ranges index',
	async (t: ExecutionContext<TestContext>) => {
		const allIds = await t.context.mongoClient.find({}, 0, 0, {}, { _id: 1 }).toArray();
		const expectedIdsByRange: StringMap<{ _id: string; value: number }[]> = {};
		for (const range of [1, 2, 3, 4, 5, 10, 20, 80]) {
			let index = 0;
			for (const id of allIds) {
				if (index % range === 0) {
					if (!expectedIdsByRange[range]) {
						expectedIdsByRange[range] = [];
					}
					expectedIdsByRange[range.toString()].push({ _id: id._id, value: index });
				}
				index += 1;
			}

			const foundIds = await t.context.mongoClient.findIdsEveryNthEntities(
				range,
				{},
				{ returnRangeIndex: true },
			);
			t.deepEqual(
				expectedIdsByRange[range],
				foundIds,
				'Found ids are the good onces in the same order',
			);
		}
		await t.context.mongoClient.dropCollection();
	},
);

ava('[GET-RANGES] Get ranges with query filter', async (t: ExecutionContext<TestContext>) => {
	const query: FilterQuery<SampleType> = { index: { $in: [2, 10, 30, 25, 41, 33] } };
	const allIds = await t.context.mongoClient.find(query, 0, 0, {}, { _id: 1 }).toArray();
	const expectedIdsByRange: StringMap<{ _id: string; value: number }[]> = {};
	for (const range of [1, 2, 3, 4, 5, 10, 20, 80]) {
		let index = 0;
		for (const id of allIds) {
			if (index % range === 0) {
				if (!expectedIdsByRange[range]) {
					expectedIdsByRange[range] = [];
				}
				expectedIdsByRange[range.toString()].push({ _id: id._id, value: index });
			}
			index += 1;
		}

		const foundIds = await t.context.mongoClient.findIdsEveryNthEntities(range, query, {
			returnRangeIndex: true,
		});
		t.deepEqual(
			expectedIdsByRange[range],
			foundIds,
			'Found ids are the good onces in the same order',
		);
	}
	await t.context.mongoClient.dropCollection();
});

ava('[GET-RANGES] Get ranges throw error', async (t: ExecutionContext<TestContext>) => {
	await t.throwsAsync(
		async () => {
			await t.context.mongoClient.findIdsEveryNthEntities(-1);
		},
		{
			message: 'range-size-should-be-greater-than-1',
		},
	);
	await t.throwsAsync(
		async () => {
			await t.context.mongoClient.findIdsEveryNthEntities(5, { $and: [] });
		},
		{
			message: '$and/$or/$nor must be a nonempty array',
		},
	);
	await t.context.mongoClient.dropCollection();
});
