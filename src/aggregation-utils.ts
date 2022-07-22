import { FilterQuery } from 'mongodb';

import {
	AggregationPipeline,
	AggregationPipelineStage,
	AggregationPipelineStageOperator,
	BucketAutoPipelineStageValue,
	BucketPipelineStageValue,
	CollStatsPipelineStageValue,
	CurrentOpPipelineStage,
	Expression,
	FacetPipelineStageValue,
	GeoNearPipelineStageValue,
	GraphLookupPipelineStageValue,
	GroupPipelineStageValue,
	LookupPipelineStageValue,
	MergePipelineStageValue,
	ReplaceRootPipelineValue,
	SamplePipelineValue,
	SortPipelineStageValue,
	UnwindPipelineStageValue,
} from './models/aggregate.models';

export class AggregationBuilder<U> {
	private stages: AggregationPipeline = [];

	public constructor(private readonly collectionName: string) {}

	/*
	 * PIPELINE STAGES
	 */
	public addFields(stageValue: object): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.ADD_FIELDS]: stageValue });
	}

	public bucket(stageValue: BucketPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.BUCKET]: stageValue });
	}

	public bucketAuto(stageValue: BucketAutoPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.BUCKET_AUTO]: stageValue });
	}

	public collStats(stageValue: CollStatsPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.COLL_STATS]: stageValue });
	}

	public count(stageValue: string): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.COUNT]: stageValue });
	}

	public currentOp(stageValue: CurrentOpPipelineStage): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.CURRENT_OP]: stageValue });
	}

	public facet(stageValue: FacetPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.FACET]: stageValue });
	}

	public geoNear(stageValue: GeoNearPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.GEO_NEAR]: stageValue });
	}

	public graphLookup(stageValue: GraphLookupPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.GRAPH_LOOKUP]: stageValue });
	}

	public group(stageValue: GroupPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.GROUP]: stageValue });
	}

	public indexStats(stageValue: object): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.INDEX_STATS]: stageValue });
	}

	public limit(stageValue: number): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.LIMIT]: stageValue });
	}

	public listLocalSessions(stageValue: object): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.LIST_LOCAL_SESSIONS]: stageValue });
	}

	public listSessions(stageValue: object): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.LIST_SESSIONS]: stageValue });
	}

	public lookup(stageValue: LookupPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.LOOKUP]: stageValue });
	}

	public match<T = U>(stageValue: FilterQuery<T>): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.MATCH]: stageValue });
	}

	public merge(
		stageValue: MergePipelineStageValue,
		forceOutput: boolean = false,
	): AggregationBuilder<U> {
		if (!forceOutput) {
			stageValue.into = this.collectionName;
		}
		return this.doAddStage({ [AggregationPipelineStageOperator.MERGE]: stageValue });
	}

	public out(): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.OUT]: this.collectionName });
	}

	public project(stageValue: object): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.PROJECT]: stageValue });
	}

	public redact(stageValue: Expression): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.REDACT]: stageValue });
	}

	public replaceRoot(stageValue: ReplaceRootPipelineValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.REPLACE_ROOT]: stageValue });
	}

	public sample(stageValue: SamplePipelineValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.SAMPLE]: stageValue });
	}

	public set(stageValue: object): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.SET]: stageValue });
	}

	public skip(stageValue: number): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.SKIP]: stageValue });
	}

	public sort(stageValue: SortPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.SORT]: stageValue });
	}

	public sortByCount(stageValue: Expression): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.SORT_BY_COUNT]: stageValue });
	}

	public unset(stageValue: string | string[]): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.UNSET]: stageValue });
	}

	public unwind(stageValue: string | UnwindPipelineStageValue): AggregationBuilder<U> {
		return this.doAddStage({ [AggregationPipelineStageOperator.UNWIND]: stageValue });
	}

	/*
	 * CUSTOM PIPELINE STAGES
	 */
	public unwindAndReplaceRootWithField(fieldName: string): AggregationBuilder<U> {
		return this.unwind(fieldName).replaceRoot({ newRoot: fieldName });
	}

	/*
	 * OTHER METHODS
	 */

	/**
	 * Add a stage. Use only when none of the specialized methods work.
	 *
	 * @param stage
	 * @returns The aggregation builder
	 */
	public addStage(stage: object): AggregationBuilder<U> {
		return this.doAddStage(stage as AggregationPipelineStage);
	}

	public concatAggregationBuilder(
		aggregationBuilder: AggregationBuilder<U>,
	): AggregationBuilder<U> {
		const stagesToAdd = aggregationBuilder.build();
		for (const stageToAdd of stagesToAdd) {
			this.doAddStage(stageToAdd);
		}
		return this;
	}

	/**
	 * Return the built aggregation
	 *
	 * @returns Array of stages
	 */
	public build(): AggregationPipeline {
		return this.stages;
	}

	/*
	 * PRIVATE METHODS
	 */
	private doAddStage(stage: AggregationPipelineStage): AggregationBuilder<U> {
		this.stages.push(stage);
		return this;
	}
}

/*
 * UTILS
 */

export const mergeObjects = (...objects: (Expression | object)[]): Expression => ({
	$mergeObjects: objects,
});

export const concatArrays = (...arrays: (Expression | any[])[]): Expression => ({
	$concatArrays: arrays,
});

export const arrayToObject = (expression: Expression): Expression => ({
	$arrayToObject: expression,
});

export interface MapOptions {
	input: string;
	as: string;
	in: Expression;
}

export const map = (options: MapOptions): Expression => ({ $map: options });
