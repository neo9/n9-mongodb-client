import test, { ExecutionContext } from 'ava';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

class SampleType extends BaseMongoObject {
	public field1String: string;
}

interface ContextContent extends TestContext {
	mongoClientBasic: N9MongoDBClient<SampleType, SampleType>;
}

init();

test.beforeEach((t: ExecutionContext<ContextContent>) => {
	t.context.mongoClientBasic = new N9MongoDBClient(
		getOneCollectionName(),
		SampleType,
		SampleType,
		getBaseMongoClientSettings(t),
	);
});

test('Check aggregation builder', (t: ExecutionContext<ContextContent>) => {
	const aggregationQuery = t.context.mongoClientBasic
		.newAggregationBuilder()
		.addFields({
			foo: 'bar',
		})
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/bucket/#examples
		.bucket({
			groupBy: '$year_born', // Field to group by
			boundaries: [1840, 1850, 1860, 1870, 1880], // Boundaries for the buckets
			default: 'Other', // Bucket ID for documents which do not fall into a bucket
			output: {
				// Output for each bucket
				count: { $sum: 1 },
				artists: {
					$push: {
						name: { $concat: ['$first_name', ' ', '$last_name'] },
						year_born: '$year_born',
					},
				},
			},
		})
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/bucketAuto/#single-facet-aggregation
		.bucketAuto({
			groupBy: '$price',
			buckets: 4,
		})
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/collStats/#definition
		.collStats({
			latencyStats: { histograms: true },
			count: {},
			storageStats: { scale: 1024 },
		})
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/count/#example
		.count('passing_scores')
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/currentOp/#examples
		.currentOp({ allUsers: true, idleSessions: true })
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/densify/#examples
		.densify({
			field: 'timestamp',
			range: {
				step: 1,
				unit: 'hour',
				bounds: [new Date('2021-05-18T00:00:00.000Z'), new Date('2021-05-18T08:00:00.000Z')],
			},
		})
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/documents/#examples
		.documents([{ x: 10 }, { x: 2 }, { x: 5 }])
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/facet/#examples
		.facet({
			categorizedByTags: [{ $unwind: '$tags' }, { $sortByCount: '$tags' }],
			categorizedByPrice: [
				// Filter out documents without a price e.g., _id: 7
				{ $match: { price: { $exists: 1 } } },
				{
					$bucket: {
						groupBy: '$price',
						boundaries: [0, 150, 200, 300, 400],
						default: 'Other',
						output: {
							count: { $sum: 1 },
							titles: { $push: '$title' },
						},
					},
				},
			],
		})
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/fill/#examples
		.fill({
			output: {
				bootsSold: { value: 0 },
				sandalsSold: { value: 0 },
				sneakersSold: { value: 0 },
			},
		})
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/geoNear/#examples
		.geoNear({
			near: { type: 'Point', coordinates: [-73.99279, 40.719296] },
			distanceField: 'dist.calculated',
			maxDistance: 2,
			query: { category: 'Parks' },
			includeLocs: 'dist.location',
			spherical: true,
		})
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/graphLookup/#examples
		.graphLookup({
			from: 'employees',
			startWith: '$reportsTo',
			connectFromField: 'reportsTo',
			connectToField: 'name',
			as: 'reportingHierarchy',
		})
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/group/#examples
		.group({
			_id: null,
			count: { $count: {} },
		})
		.indexStats()
		.limit(5)
		.listLocalSessions({
			allUsers: true,
		})
		.listSessions({
			allUsers: true,
		})
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/lookup/#examples
		.lookup({
			from: 'inventory',
			localField: 'item',
			foreignField: 'sku',
			as: 'inventory_docs',
		})
		.match({ field1String: 'string1' })
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/planCacheStats/#examples
		.planCacheStats()
		.project({ _id: 0 })
		// src : https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/redact/#exclude-all-fields-at-a-given-level
		.redact({
			$cond: {
				if: { $eq: ['$level', 5] },
				then: '$$PRUNE',
				else: '$$DESCEND',
			},
		})
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/replaceRoot/
		.replaceRoot({ newRoot: '$name' })
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/sample/
		.sample({ size: 3 })
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/set/#examples
		.set({
			totalHomework: { $sum: '$homework' },
			totalQuiz: { $sum: '$quiz' },
		})
		.skip(1)
		.sort({ _id: 1 })
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/sortByCount/#example
		.sortByCount('$tags')
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/unset/#example
		.unset('copies')
		// src https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/unwind/#example
		.unwind('sizes')
		.unwindAndReplaceRootWithField('newField')
		.addStage({
			$unknownStageByTheMongoClient: {
				param: 1,
			},
		})
		.build();

	t.deepEqual(
		aggregationQuery,
		[
			{
				$addFields: {
					foo: 'bar',
				},
			},
			{
				$bucket: {
					boundaries: [1840, 1850, 1860, 1870, 1880],
					default: 'Other',
					groupBy: '$year_born',
					output: {
						// Output for each bucket
						count: { $sum: 1 },
						artists: {
							$push: {
								name: { $concat: ['$first_name', ' ', '$last_name'] },
								year_born: '$year_born',
							},
						},
					},
				},
			},
			{
				$bucketAuto: {
					buckets: 4,
					groupBy: '$price',
				},
			},
			{
				$collStats: {
					count: {},
					latencyStats: {
						histograms: true,
					},
					storageStats: {
						scale: 1024,
					},
				},
			},
			{
				$count: 'passing_scores',
			},
			{
				$currentOp: {
					allUsers: true,
					idleSessions: true,
				},
			},
			{
				$densify: {
					field: 'timestamp',
					range: {
						step: 1,
						unit: 'hour',
						bounds: [new Date('2021-05-18T00:00:00.000Z'), new Date('2021-05-18T08:00:00.000Z')],
					},
				},
			},
			{
				$documents: [
					{
						x: 10,
					},
					{
						x: 2,
					},
					{
						x: 5,
					},
				],
			},
			{
				$facet: {
					categorizedByTags: [{ $unwind: '$tags' }, { $sortByCount: '$tags' }],
					categorizedByPrice: [
						// Filter out documents without a price e.g., _id: 7
						{ $match: { price: { $exists: 1 } } },
						{
							$bucket: {
								groupBy: '$price',
								boundaries: [0, 150, 200, 300, 400],
								default: 'Other',
								output: {
									count: { $sum: 1 },
									titles: { $push: '$title' },
								},
							},
						},
					],
				},
			},
			{
				$fill: {
					output: {
						bootsSold: { value: 0 },
						sandalsSold: { value: 0 },
						sneakersSold: { value: 0 },
					},
				},
			},
			{
				$geoNear: {
					near: { type: 'Point', coordinates: [-73.99279, 40.719296] },
					distanceField: 'dist.calculated',
					maxDistance: 2,
					query: { category: 'Parks' },
					includeLocs: 'dist.location',
					spherical: true,
				},
			},
			{
				$graphLookup: {
					as: 'reportingHierarchy',
					connectFromField: 'reportsTo',
					connectToField: 'name',
					from: 'employees',
					startWith: '$reportsTo',
				},
			},
			{
				$group: {
					_id: null,
					count: {
						$count: {},
					},
				},
			},
			{
				$indexStats: {},
			},
			{
				$limit: 5,
			},
			{
				$listLocalSessions: {
					allUsers: true,
				},
			},
			{
				$listSessions: {
					allUsers: true,
				},
			},
			{
				$lookup: {
					as: 'inventory_docs',
					foreignField: 'sku',
					from: 'inventory',
					localField: 'item',
				},
			},
			{
				$match: {
					field1String: 'string1',
				},
			},
			{
				$planCacheStats: {},
			},
			{
				$project: {
					_id: 0,
				},
			},
			{
				$redact: {
					$cond: {
						if: { $eq: ['$level', 5] },
						then: '$$PRUNE',
						else: '$$DESCEND',
					},
				},
			},
			{
				$replaceRoot: {
					newRoot: '$name',
				},
			},
			{
				$sample: {
					size: 3,
				},
			},
			{
				$set: {
					totalHomework: {
						$sum: '$homework',
					},
					totalQuiz: {
						$sum: '$quiz',
					},
				},
			},
			{
				$skip: 1,
			},
			{
				$sort: {
					_id: 1,
				},
			},
			{
				$sortByCount: '$tags',
			},
			{
				$unset: 'copies',
			},
			{
				$unwind: 'sizes',
			},
			{
				$unwind: 'newField',
			},
			{
				$replaceRoot: {
					newRoot: 'newField',
				},
			},
			{
				$unknownStageByTheMongoClient: {
					param: 1,
				},
			},
		],
		'check aggregationQuery',
	);
});
