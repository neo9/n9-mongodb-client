import _ from 'lodash';
import {
	AggregationCursor,
	CollationOptions,
	Collection,
	Document,
	ExplainVerbosityLike,
	Filter,
	FindCursor,
	FindOptions,
	Hint,
	Sort,
	SortDirection,
} from 'mongodb';

import { AggregationBuilder } from '../aggregation-utils';
import { AggregationPipelineStage } from '../models';
import { N9AbstractCursor } from './n9-abstract-cursor';

export class N9FindCursor<E> extends N9AbstractCursor<E> implements FindCursor<E> {
	private readonly aggregateCountPipeline: AggregationPipelineStage[] = new AggregationBuilder(
		this.collection.collectionName,
	)
		.match(this.filterQuery)
		.group({ _id: '1', count: { $sum: 1 } })
		.build();

	public constructor(
		private readonly collection: Collection<any>,
		private readonly findCursor: FindCursor<E>,
		private filterQuery: Filter<E>, // can be edited with filter function
		private readonly options: Pick<FindOptions, 'collation'> = {},
	) {
		super(findCursor);
	}

	/**
	 * Get the count of documents for this cursor, without using skip or limit
	 */
	public async count(): Promise<number> {
		// EstimatedCount or CountDocuments don't handle collation options.
		// It needs an aggregate function with the collation options to return a count value
		if (this.options.collation) {
			const cursor: AggregationCursor<Document> = this.collection.aggregate(
				this.aggregateCountPipeline,
				{ collation: this.options.collation },
			);
			return (await cursor.toArray())[0].count;
		}

		if (_.isEmpty(this.filterQuery)) {
			return await this.collection.estimatedDocumentCount();
		}
		return await this.collection.countDocuments(this.filterQuery);
	}

	// Surcharge all function that return a findcursor and return a N9FindCursor instead to keep cascading available.
	// Src : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/find_cursor.ts

	/**
	 * @deprecated Use MongoClient.find parameter `sort` instead
	 */
	sort(sort: Sort | string, direction?: SortDirection): this {
		this.findCursor.sort(sort, direction);
		return this;
	}

	/**
	 * @deprecated Use MongoClient.find parameter `collation` instead
	 */
	collation(value: CollationOptions): this {
		this.findCursor.collation(value);
		this.options.collation = value;
		return this;
	}

	/**
	 * @deprecated Use MongoClient.find parameter `page` and `pageSize` instead
	 */
	skip(value: number): this {
		this.findCursor.skip(value);
		return this;
	}

	/**
	 * @deprecated Use MongoClient.find parameter `page` and `pageSize` instead
	 */
	limit(value: number): this {
		this.findCursor.limit(value);
		return this;
	}

	/**
	 * @deprecated Use MongoClient.find parameter `project` instead
	 */
	project<T>(value: Document): N9FindCursor<T> {
		this.findCursor.project(value);
		return this as any; // N9FindCursor<T> instead of N9FindCursor<E>
	}

	map<T>(transform: (doc: E) => T): N9FindCursor<T> {
		super.map(transform);
		return this as any; // N9FindCursor<T> instead of N9FindCursor<E>
	}

	allowDiskUse(allow: boolean | undefined): this {
		this.findCursor.allowDiskUse(allow);
		return this;
	}

	clone(): N9FindCursor<E> {
		return new N9FindCursor<E>(
			this.collection,
			this.findCursor.clone(),
			this.filterQuery,
			this.options,
		);
	}

	async close(): Promise<void> {
		await this.findCursor.close();
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get closed(): boolean {
		return this.findCursor.closed;
	}

	comment(value: string): this {
		this.findCursor.comment(value);
		return this;
	}

	async explain(verbosity?: ExplainVerbosityLike | undefined): Promise<Document> {
		return this.findCursor.explain(verbosity);
	}

	filter(filter: Filter<E> | Document): this {
		this.findCursor.filter(filter);
		this.filterQuery = filter as Filter<E>;
		return this;
	}

	hint(hint: Hint): this {
		this.findCursor.hint(hint);
		return this;
	}

	maxAwaitTimeMS(value: number): this {
		this.findCursor.maxAwaitTimeMS(value);
		return this;
	}

	returnKey(value: boolean): this {
		this.findCursor.returnKey(value);
		return this;
	}

	showRecordId(value: boolean): this {
		this.findCursor.showRecordId(value);
		return this;
	}
}
