import { N9Error } from '@neo9/n9-node-utils';
import * as _ from 'lodash';
import { AggregationCursor, Collection, Filter } from 'mongodb';

import { N9AbstractCursor } from './n9-abstract-cursor';

export class N9AggregationCursor<E> extends N9AbstractCursor<E> {
	private _filterQuery: Filter<E>; // can be edited with filter function

	public constructor(
		collection: Collection<any>,
		private readonly aggregationCursor: AggregationCursor<E>,
	) {
		super(collection, aggregationCursor);
	}

	/**
	 * Set the filterQuery used for count
	 *
	 * @param value
	 */
	set filterQuery(value: Filter<E>) {
		this._filterQuery = value;
	}

	clone(): N9AggregationCursor<E> {
		return new N9AggregationCursor<E>(this.collection, this.aggregationCursor.clone());
	}

	public async launch(): Promise<void> {
		await super.next();
	}

	map<T>(transform: (doc: E) => T): N9AggregationCursor<T> {
		super.map(transform);
		return this as any;
	}

	/**
	 * Get the count of documents for this cursor using the filterQuery.
	 *
	 * @see filterQuery
	 */
	public async count(): Promise<number> {
		if (!this._filterQuery) {
			throw new N9Error('filter-query-not-initialized', 400, {
				hint: 'Set filterQuery on the N9AggregationCursor before calling count function.',
			});
		}
		if (_.isEmpty(this._filterQuery)) {
			return await this.collection.estimatedDocumentCount();
		}
		return await this.collection.countDocuments(this._filterQuery);
	}
}
