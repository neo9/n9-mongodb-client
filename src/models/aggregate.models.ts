import { FilterQuery } from 'mongodb';

import { StringMap } from './maps.models';

/* eslint-disable no-use-before-define */

export enum AggregationPipelineStageOperator {
	ADD_FIELDS = '$addFields',
	BUCKET = '$bucket',
	BUCKET_AUTO = '$bucketAuto',
	COLL_STATS = '$collStats',
	CURRENT_OP = '$currentOp',
	COUNT = '$count',
	FACET = '$facet',
	GEO_NEAR = '$geoNear',
	GRAPH_LOOKUP = '$graphLookup',
	GROUP = '$group',
	INDEX_STATS = '$indexStats',
	LIMIT = '$limit',
	LIST_LOCAL_SESSIONS = '$listLocalSessions',
	LIST_SESSIONS = '$listSessions',
	LOOKUP = '$lookup',
	OUT = '$out',
	MATCH = '$match',
	MERGE = '$merge',
	PROJECT = '$project',
	REDACT = '$redact',
	REPLACE_ROOT = '$replaceRoot',
	SAMPLE = '$sample',
	SET = '$set',
	SKIP = '$skip',
	SORT = '$sort',
	SORT_BY_COUNT = '$sortByCount',
	UNSET = '$unset',
	UNWIND = '$unwind',
}

export type Expression = string | object;

/* ADD FIELDS */
export interface AddFieldsPipelineStage {
	[AggregationPipelineStageOperator.ADD_FIELDS]: object;
}

/* BUCKET */
export interface BucketPipelineStageValue {
	/**
	 * An expression to group documents by. To specify a field path,
	 * prefix the field name with a dollar sign $ and enclose it in quotes.
	 *
	 * Unless $bucket includes a default specification, each input document must resolve
	 * the groupBy field path or expression to a value that falls within one of the ranges specified by the boundaries.
	 */
	groupBy: Expression;

	/**
	 * An array of values based on the groupBy expression that specify the boundaries for each bucket.
	 * Each adjacent pair of values acts as the inclusive lower boundary and the exclusive upper boundary for the bucket.
	 * You must specify at least two boundaries.
	 *
	 * The specified values must be in ascending order and all of the same type.
	 * The exception is if the values are of mixed numeric types.
	 */
	boundaries: any[];

	/**
	 * Optional.
	 * A literal that specifies the _id of an additional bucket that contains all documents whose groupBy expression result does not fall into a bucket specified by boundaries.
	 * If unspecified, each input document must resolve the groupBy expression to a value within one of the bucket ranges specified by boundaries or the operation throws an error.
	 * The default value must be less than the lowest boundaries value, or greater than or equal to the highest boundaries value.
	 * The default value can be of a different type than the entries in boundaries.
	 */
	default?: any;

	/**
	 * Optional.
	 * A document that specifies the fields to include in the output documents in addition to the _id field. To specify the field to include, you must use accumulator expressions.
	 * The default count field is not included in the output document when output is specified. Explicitly specify the count expression as part of the output document to include it.
	 */
	output?: object;
}

export interface BucketPipelineStage {
	[AggregationPipelineStageOperator.BUCKET]: BucketPipelineStageValue;
}

/* BUCKET AUTO */
export type Granularity =
	| 'R5'
	| 'R10'
	| 'R20'
	| 'R40'
	| 'R80'
	| '1-2-5'
	| 'E6'
	| 'E12'
	| 'E24'
	| 'E48'
	| 'E96'
	| 'E192'
	| 'POWERSOF2';

export interface BucketAutoPipelineStageValue {
	/**
	 * An expression to group documents by. To specify a field path,
	 * prefix the field name with a dollar sign $ and enclose it in quotes.
	 */
	groupBy: Expression;

	/**
	 * A positive 32-bit integer that specifies the number of buckets into which input documents are grouped.
	 */
	buckets: number;

	/**
	 * Optional.
	 * A document that specifies the fields to include in the output documents in addition to the _id field. To specify the field to include, you must use accumulator expressions.
	 * The default count field is not included in the output document when output is specified. Explicitly specify the count expression as part of the output document to include it.
	 */
	output?: object;

	/**
	 * Optional. A string that specifies the preferred number series to use to ensure that the calculated boundary edges end on preferred round numbers or their powers of 10.
	 * Available only if the all groupBy values are numeric and none of them are NaN.
	 */
	granularity?: Granularity;
}

export interface BucketAutoPipelineStage {
	[AggregationPipelineStageOperator.BUCKET_AUTO]: BucketAutoPipelineStageValue;
}

/* COLL STATS */
export interface CollStatsPipelineStageValue {
	/**
	 * Adds latency statistics to the return document.
	 */
	latencyStats?: {
		/**
		 * Adds latency histogram information to the embedded documents in latencyStats if true.
		 */
		histograms?: boolean;
	};
	/**
	 * Adds storage statistics to the return document.
	 */
	storageStats?: object;
	/**
	 * Adds the total number of documents in the collection to the return document.
	 */
	count?: object;
}

export interface CollStatsPipelineStage {
	[AggregationPipelineStageOperator.COLL_STATS]: CollStatsPipelineStageValue;
}

/* COUNT */
export interface CountPipelineStage {
	[AggregationPipelineStageOperator.COUNT]: string;
}

/* CURRENT OP */
// todo: add models
export interface CurrentOpPipelineStage {
	[AggregationPipelineStageOperator.CURRENT_OP]: object;
}

/* FACET */
export type FacetAggregationPipelineStage =
	| AddFieldsPipelineStage
	| BucketPipelineStage
	| BucketAutoPipelineStage
	| CountPipelineStage
	| CurrentOpPipelineStage
	| GraphLookupPipelineStage
	| GroupPipelineStage
	| LimitPipelineStage
	| ListLocalSessionsPipelineStage
	| ListSessionsPipelineStage
	| LookupPipelineStage
	| MatchPipelineStage
	| ProjectPipelineStage
	| RedactPipelineStage
	| ReplaceRootPipelineStage
	| SamplePipelineStage
	| SkipPipelineStage
	| SortPipelineStage
	| SortByCountPipelineStage
	| UnwindPipelineStage;

export type FacetAggregationPipeline = FacetAggregationPipelineStage[];

export interface FacetPipelineStageValue {
	[outputField: string]: FacetAggregationPipeline;
}

export interface FacetPipelineStage {
	[AggregationPipelineStageOperator.FACET]: FacetPipelineStageValue;
}

/* GEO NEAR */
export type CoordinatePair = [number, number];

export type LegacyCoordinatePair = CoordinatePair | { [key: string]: number };

export interface PointGeoJsonObject {
	type: 'Point';
	coordinates: CoordinatePair;
}

export interface LineStringGeoJsonObject {
	type: 'LineString';
	coordinates: CoordinatePair[];
}

export interface PolygonGeoJsonObject {
	type: 'Polygon';
	coordinates: CoordinatePair[][];
}

export interface MultiPointGeoJsonObject {
	type: 'MultiPoint';
	coordinates: CoordinatePair[];
}

export interface MultiLineStringGeoJsonObject {
	type: 'MultiLineString';
	coordinates: CoordinatePair[][];
}

export interface MultiPolygonGeoJsonObject {
	type: 'MultiPolygon';
	coordinates: CoordinatePair[][][];
}

export interface GeometryCollectionGeoJsonObject {
	type: 'GeometryCollection';
	geometries: GeoJsonObject[];
}

export type GeoJsonObject =
	| PointGeoJsonObject
	| LineStringGeoJsonObject
	| PolygonGeoJsonObject
	| MultiPointGeoJsonObject
	| MultiLineStringGeoJsonObject
	| MultiPolygonGeoJsonObject
	| GeometryCollectionGeoJsonObject;

export interface GeoNearPipelineStageValue<T = any> {
	/**
	 * Determines how MongoDB calculates the distance between two points:
	 * - When true, MongoDB uses $nearSphere semantics and calculates distances using spherical geometry.
	 * - When false, MongoDB uses $near semantics: spherical geometry for 2dsphere indexes and planar geometry for 2d indexes.
	 * Default: false.
	 */
	spherical: boolean;
	/**
	 * Optional. The maximum number of documents to return. The default value is 100. See also the num option.
	 */
	limit?: number;
	/**
	 * The num option provides the same function as the limit option. Both define the maximum number of documents to return.
	 * If both options are included, the num value overrides the limit value.
	 */
	num?: number;
	/**
	 * The maximum distance from the center point that the documents can be.
	 * MongoDB limits the results to those documents that fall within the specified distance from the center point.
	 * Specify the distance in meters if the specified point is GeoJSON and in radians if the specified point is legacy coordinate pairs.
	 */
	maxDistance?: number;
	/**
	 * Optional.
	 * Limits the results to the documents that match the query. The query syntax is the usual MongoDB read operation query syntax.
	 * You cannot specify a $near predicate in the query field of the $geoNear stage.
	 */
	query?: FilterQuery<T>;
	/**
	 * Optional.
	 * The factor to multiply all distances returned by the query.
	 * For example, use the distanceMultiplier to convert radians, as returned by a spherical query,
	 * to kilometers by multiplying by the radius of the Earth.
	 */
	distanceMultiplier?: number;
	/**
	 * Optional.
	 * If this value is true, the query returns a matching document once,
	 * even if more than one of the document’s location fields match the query.
	 */
	uniqueDocs?: boolean;
	/**
	 * The point for which to find the closest documents.
	 * If using a 2dsphere index, you can specify the point as either a GeoJSON point or legacy coordinate pair.
	 * If using a 2d index, specify the point as a legacy coordinate pair.
	 */
	near: GeoJsonObject | LegacyCoordinatePair;
	/**
	 * The output field that contains the calculated distance. To specify a field within an embedded document, use dot notation.
	 */
	distanceField: string;
	/**
	 * Optional.
	 * This specifies the output field that identifies the location used to calculate the distance.
	 * This option is useful when a location field contains multiple locations.
	 * To specify a field within an embedded document, use dot notation.
	 */
	includeLocs?: string;
	/**
	 * Optional.
	 * The minimum distance from the center point that the documents can be.
	 * MongoDB limits the results to those documents that fall outside the specified distance from the center point.
	 * Specify the distance in meters for GeoJSON data and in radians for legacy coordinate pairs.
	 */
	minDistance?: number;
	/**
	 * Optional.
	 * Specify the geospatial indexed field to use when calculating the distance.
	 * If your collection has multiple 2d and/or multiple 2dsphere indexes, you must use the key option to specify
	 * the indexed field path to use. Specify Which Geospatial Index to Use provides a full example.
	 * If there is more than one 2d index or more than one 2dsphere index and you do not specify a key, MongoDB will return an error.
	 * If you do not specify the key, and you have at most only one 2d index and/or only one 2dsphere index, MongoDB looks first for a 2d index to use.
	 * If a 2d index does not exists, then MongoDB looks for a 2dsphere index to use.
	 */
	key?: string;
}

export interface GeoNearPipelineStage {
	[AggregationPipelineStageOperator.GEO_NEAR]: GeoNearPipelineStageValue;
}

/* GRAPH LOOKUP */
export interface GraphLookupPipelineStageValue<T = any> {
	/**
	 * Target collection for the $graphLookup operation to search, recursively matching the connectFromField to the connectToField.
	 * The from collection cannot be sharded and must be in the same database as any other collections used in the operation.
	 */
	from: string;
	/**
	 * Expression that specifies the value of the connectFromField with which to start the recursive search.
	 * Optionally, startWith may be array of values, each of which is individually followed through the traversal process.
	 */
	startWith: Expression;
	/**
	 * Field name whose value $graphLookup uses to recursively match against the connectToField of other documents in the collection.
	 * If the value is an array, each element is individually followed through the traversal process.
	 */
	connectFromField: string;
	/**
	 * Field name in other documents against which to match the value of the field specified by the connectFromField parameter.
	 */
	connectToField: string;
	/**
	 * Name of the array field added to each output document. Contains the documents traversed in the $graphLookup stage to reach the document.
	 * Documents returned in the as field are not guaranteed to be in any order.
	 */
	as: string;
	/**
	 * Optional. Non-negative integral number specifying the maximum recursion depth.
	 */
	maxDepth: number;
	/**
	 * Optional. Name of the field to add to each traversed document in the search path.
	 * The value of this field is the recursion depth for the document, represented as a NumberLong.
	 * Recursion depth value starts at zero, so the first lookup corresponds to zero depth.
	 */
	depthField: string;
	/**
	 * Optional. A document specifying additional conditions for the recursive search. The syntax is identical to query filter syntax.
	 * You cannot use any aggregation expression in this filter.
	 */
	restrictSearchWithMatch: FilterQuery<T>;
}

export interface GraphLookupPipelineStage {
	[AggregationPipelineStageOperator.GRAPH_LOOKUP]: GraphLookupPipelineStageValue;
}

/* GROUP */
export interface GroupPipelineStageValue {
	_id: Expression;
	[fieldName: string]: Expression;
}
export interface GroupPipelineStage {
	[AggregationPipelineStageOperator.GROUP]: GroupPipelineStageValue;
}

/* INDEX STATS */
export interface IndexStatsPipelineStage {
	[AggregationPipelineStageOperator.INDEX_STATS]: object;
}

/* LIMIT */
export interface LimitPipelineStage {
	[AggregationPipelineStageOperator.LIMIT]: number;
}

/* LIST LOCAL SESSIONS */
// todo: add models
export interface ListLocalSessionsPipelineStage {
	[AggregationPipelineStageOperator.LIST_LOCAL_SESSIONS]: object;
}

/* LIST SESSIONS */
// todo: add models
export interface ListSessionsPipelineStage {
	[AggregationPipelineStageOperator.LIST_SESSIONS]: object;
}

/* LOOKUP */
export interface EqualityLookupPipelineStageValue {
	/**
	 * Specifies the collection in the same database to perform the join with. The from collection cannot be sharded.
	 */
	from: string;
	/**
	 * Specifies the field from the documents input to the $lookup stage.
	 * $lookup performs an equality match on the localField to the foreignField from the documents of the from collection.
	 * If an input document does not contain the localField, the $lookup treats the field as having a value of null for matching purposes.
	 */
	localField: string;
	/**
	 * Specifies the field from the documents in the from collection.
	 * $lookup performs an equality match on the foreignField to the localField from the input documents.
	 * If a document in the from collection does not contain the foreignField, the $lookup treats the value as null for matching purposes.
	 */
	foreignField: string;
	/**
	 * Specifies the name of the new array field to add to the input documents.
	 * The new array field contains the matching documents from the from collection.
	 * If the specified name already exists in the input document, the existing field is overwritten.
	 */
	as: string;
}

export interface SubPipelineLookupPipelineStageValue {
	/**
	 * Specifies the collection in the same database to perform the join with. The from collection cannot be sharded.
	 */
	from: string;
	/**
	 * Optional. Specifies variables to use in the pipeline field stages.
	 * Use the variable expressions to access the fields from the documents input to the $lookup stage.
	 * The pipeline cannot directly access the input document fields. Instead, first define the variables for the input document fields, and then reference the variables in the stages in the pipeline.
	 * To access the let variables in the pipeline, use the $expr operator.
	 * The let variables are accessible by the stages in the pipeline, including additional $lookup stages nested in the pipeline.
	 * The let variables are accessible by the stages in the pipeline, including additional $lookup stages nested in the pipeline.
	 */
	let: {
		[field: string]: Expression;
	};
	/**
	 * Specifies the pipeline to run on the joined collection.
	 * The pipeline determines the resulting documents from the joined collection.
	 * To return all documents, specify an empty pipeline [].
	 * The pipeline cannot directly access the input document fields. Instead, first define the variables for the input document fields, and then reference the variables in the stages in the pipeline.
	 * To access the let variables in the pipeline, use the $expr operator.
	 */
	pipeline: AggregationPipeline;
	/**
	 * Specifies the name of the new array field to add to the input documents.
	 * The new array field contains the matching documents from the from collection.
	 * If the specified name already exists in the input document, the existing field is overwritten.
	 */
	as: string;
}

export type LookupPipelineStageValue =
	| EqualityLookupPipelineStageValue
	| SubPipelineLookupPipelineStageValue;

export interface LookupPipelineStage {
	[AggregationPipelineStageOperator.LOOKUP]: LookupPipelineStageValue;
}

/* MATCH */
export interface MatchPipelineStage<T = any> {
	[AggregationPipelineStageOperator.MATCH]: FilterQuery<T>;
}

export interface MergePipelineStage {
	[AggregationPipelineStageOperator.MERGE]: MergePipelineStageValue;
}

/**
 *  into: <collection> -or- { db: <db>, coll: <collection> },
 *  on: <identifier field> -or- [ <identifier field1>, ...],  // Optional
 *  let: <variables>,                                         // Optional
 *  whenMatched: <replace|keepExisting|merge|fail|pipeline>,  // Optional
 *  whenNotMatched: <insert|discard|fail>                     // Optional
 */
export interface MergePipelineStageValue {
	into?:
		| string
		| {
				db: string;
				coll: string;
		  };
	on?: string | string[];
	let?: StringMap<string>;
	whenMatched?:
		| 'replace'
		| 'keepExisting'
		| 'merge'
		| 'fail'
		| MergeMatchedAggregationPipelineStage;
	whenNotMatched?: 'insert' | 'discard' | 'fail';
}

export type MergeMatchedAggregationPipelineStage =
	| AddFieldsPipelineStage
	| ProjectPipelineStage
	| ReplaceRootPipelineStage;

/* OUT */
export interface OutPipelineStage {
	[AggregationPipelineStageOperator.OUT]: string;
}

/* PROJECT */
export interface ProjectPipelineStage {
	[AggregationPipelineStageOperator.PROJECT]: object;
}

/* REDACT */
export interface RedactPipelineStage {
	[AggregationPipelineStageOperator.REDACT]: Expression;
}

/* REPLACE ROOT */
export interface ReplaceRootPipelineValue {
	newRoot: Expression;
}
export interface ReplaceRootPipelineStage {
	[AggregationPipelineStageOperator.REPLACE_ROOT]: ReplaceRootPipelineValue;
}

/* SAMPLE */
export interface SamplePipelineValue {
	size: number;
}

export interface SamplePipelineStage {
	[AggregationPipelineStageOperator.SAMPLE]: SamplePipelineValue;
}

export interface SetPipelineStage {
	[AggregationPipelineStageOperator.SET]: object;
}

/* SKIP */
export interface SkipPipelineStage {
	[AggregationPipelineStageOperator.SKIP]: number;
}

/* SORT */
export interface MetadataSort {
	$meta: string;
}

export interface SortPipelineStageValue {
	[field: string]: 1 | -1 | MetadataSort;
}

export interface SortPipelineStage {
	[AggregationPipelineStageOperator.SORT]: SortPipelineStageValue;
}

/* SORT BY COUNT */
export interface SortByCountPipelineStage {
	[AggregationPipelineStageOperator.SORT_BY_COUNT]: Expression;
}

/* UNWIND */
export interface UnwindPipelineStageValue {
	/**
	 * Field path to an array field. To specify a field path, prefix the field name with a dollar sign $ and enclose in quotes.
	 */
	path: string;
	/**
	 * Optional. The name of a new field to hold the array index of the element. The name cannot start with a dollar sign $.
	 */
	includeArrayIndex?: string;
	/**
	 *  Optional.
	 * If true, if the path is null, missing, or an empty array, $unwind outputs the document.
	 * If false, $unwind does not output a document if the path is null, missing, or an empty array.
	 * The default value is false.
	 */
	preserveNullAndEmptyArrays?: boolean;
}

export interface UnsetPipelineStage {
	[AggregationPipelineStageOperator.UNSET]: string | string[];
}

export interface UnwindPipelineStage {
	[AggregationPipelineStageOperator.UNWIND]: string | UnwindPipelineStageValue;
}

export type AggregationPipelineStage =
	| AddFieldsPipelineStage
	| BucketPipelineStage
	| BucketAutoPipelineStage
	| CollStatsPipelineStage
	| CountPipelineStage
	| CurrentOpPipelineStage
	| FacetPipelineStage
	| GeoNearPipelineStage
	| GraphLookupPipelineStage
	| GroupPipelineStage
	| IndexStatsPipelineStage
	| LimitPipelineStage
	| ListSessionsPipelineStage
	| ListLocalSessionsPipelineStage
	| LookupPipelineStage
	| MatchPipelineStage
	| MergePipelineStage
	| OutPipelineStage
	| ProjectPipelineStage
	| RedactPipelineStage
	| ReplaceRootPipelineStage
	| SamplePipelineStage
	| SetPipelineStage
	| SkipPipelineStage
	| SortPipelineStage
	| SortByCountPipelineStage
	| UnsetPipelineStage
	| UnwindPipelineStage;

export type AggregationPipeline = AggregationPipelineStage[];
