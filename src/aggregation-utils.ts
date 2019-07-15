import {
	AggregationPipeline,
	AggregationPipelineStage,
	AggregationPipelineStageOperator,
	BucketAutoPipelineStageValue,
	BucketPipelineStageValue,
	CollStatsPipelineStageValue,
	CurrentOpPipelineStage,
	Expression,
	FacetPipelineStageValue, GeoNearPipelineStageValue,
	GraphLookupPipelineStageValue, GroupPipelineStageValue,
	LookupPipelineStageValue,
	ReplaceRootPipelineValue,
	SamplePipelineValue,
	SortPipelineStageValue,
	UnwindPipelineStageValue
} from "./models/aggregate.models";
import { FilterQuery } from "mongodb";

export class AggregationBuilder {

	public static create(): AggregationBuilder {
		return new AggregationBuilder();
	}

	private stages: AggregationPipeline = [];

	private constructor() {
	}

	/*
	 * PIPELINE STAGES
	 */
	public addFields(stageValue: object): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.ADD_FIELDS]: stageValue });
	}

	public bucket(stageValue: BucketPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.BUCKET]: stageValue });
	}

	public bucketAuto(stageValue: BucketAutoPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.BUCKET_AUTO]: stageValue });
	}

	public collStats(stageValue: CollStatsPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.COLL_STATS]: stageValue });
	}

	public count(stageValue: string): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.COUNT]: stageValue });
	}

	public currentOp(stageValue: CurrentOpPipelineStage): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.CURRENT_OP]: stageValue });
	}

	public facet(stageValue: FacetPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.FACET]: stageValue });
	}

	public geoNear(stageValue: GeoNearPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.GEO_NEAR]: stageValue });
	}

	public graphLookup(stageValue: GraphLookupPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.GRAPH_LOOKUP]: stageValue });
	}

	public group(stageValue: GroupPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.GROUP]: stageValue });
	}

	public indexStats(stageValue: object): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.INDEX_STATS]: stageValue });
	}

	public limit(stageValue: number): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.LIMIT]: stageValue });
	}

	public listLocalSessions(stageValue: object): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.LIST_LOCAL_SESSIONS]: stageValue });
	}

	public listSessions(stageValue: object): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.LIST_SESSIONS]: stageValue });
	}

	public lookup(stageValue: LookupPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.LOOKUP]: stageValue });
	}

	public match<T = any>(stageValue: FilterQuery<T>): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.MATCH]: stageValue });
	}

	public out(stageValue: string): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.OUT]: stageValue });
	}

	public project(stageValue: object): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.PROJECT]: stageValue });
	}

	public redact(stageValue: Expression): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.REDACT]: stageValue });
	}

	public replaceRoot(stageValue: ReplaceRootPipelineValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.REPLACE_ROOT]: stageValue });
	}

	public sample(stageValue: SamplePipelineValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.SAMPLE]: stageValue });
	}

	public skip(stageValue: number): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.SKIP]: stageValue });
	}

	public sort(stageValue: SortPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.SORT]: stageValue });
	}

	public sortByCount(stageValue: Expression): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.SORT_BY_COUNT]: stageValue });
	}

	public unwind(stageValue: string|UnwindPipelineStageValue): AggregationBuilder {
		return this.doAddStage({ [AggregationPipelineStageOperator.UNWIND]: stageValue });
	}

	/*
	* CUSTOM PIPELINE STAGES
	*/
	public unwindAndReplaceRootWithField(fieldName: string): AggregationBuilder {
		return this
			.unwind(fieldName)
			.replaceRoot({ newRoot: fieldName });
	}

	/*
	 * OTHER METHODS
	 */

	/**
	 * Add a stage. Use only when none of the specialized methods work.
	 */
	public addStage(stage: object): AggregationBuilder {
		return this.doAddStage(stage as AggregationPipelineStage);
	}

	/**
	 * Return the built aggregation
	 */
	public build(): AggregationPipeline {
		return this.stages;
	}

	/*
	 * PRIVATE METHODS
	 */
	private doAddStage(stage: AggregationPipelineStage): AggregationBuilder {
		this.stages.push(stage);
		return this;
	}
}

/*
 * UTILS
 */

export const aggregate = (): AggregationBuilder => AggregationBuilder.create();

export const mergeObjects = (...objects: (Expression|object)[]): Expression => ({ $mergeObjects: objects });

export const concatArrays = (...arrays: (Expression|any[])[]): Expression => ({ $concatArrays: arrays });

export const arrayToObject = (expression: Expression): Expression => ({ $arrayToObject: expression });

export interface MapOptions {
	input: string;
	as: string;
	in: Expression;
}
export const map = (options: MapOptions): Expression => ({ $map: options });
