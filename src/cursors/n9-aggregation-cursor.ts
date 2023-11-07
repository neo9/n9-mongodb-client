import { AggregationCursor, Collection } from 'mongodb';

import { LodashReplacerUtils } from '../lodash-replacer.utils';
import { GroupPipelineStage, MatchPipelineStage } from '../models';
import { N9AbstractCursor } from './n9-abstract-cursor';

export class N9AggregationCursor<E> extends N9AbstractCursor<E> {
	public constructor(
		private readonly collection: Collection<any>,
		private readonly aggregationCursor: AggregationCursor<E>,
		private readonly aggregateSteps: object[],
	) {
		super(aggregationCursor);
	}

	clone(): N9AggregationCursor<E> {
		return new N9AggregationCursor<E>(
			this.collection,
			this.aggregationCursor.clone(),
			this.aggregateSteps,
		);
	}

	public async launch(): Promise<void> {
		await super.next();
	}

	map<T>(transform: (doc: E) => T): N9AggregationCursor<T> {
		super.map(transform);
		return this as any; // N9AggregationCursor<T> instead of N9AggregationCursor<E>
	}

	/**
	 * Get the count of documents for this cursor.
	 */
	public async count(keepOnlyMatchAndGroupSteps: boolean = true): Promise<number> {
		if (LodashReplacerUtils.IS_ARRAY_EMPTY(this.aggregateSteps)) {
			return await this.collection.estimatedDocumentCount();
		}
		const aggregateStepsFiltered = keepOnlyMatchAndGroupSteps
			? this.aggregateSteps.filter(
					(step: MatchPipelineStage & GroupPipelineStage) => step.$match || step.$group,
			  )
			: this.aggregateSteps;
		const countResult = await this.collection
			.aggregate([
				...aggregateStepsFiltered,
				{
					$group: {
						_id: null,
						n: { $sum: 1 },
					},
				},
			])
			.toArray();
		if (countResult.length > 0) return countResult[0].n;
		return 0; // empty cursor
	}
}
