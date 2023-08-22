export type SchemaMember<T, V> = { [P in keyof T]?: V } | { [key: string]: V };
/**
 * Values for the $meta aggregation pipeline operator
 *
 * @see https://docs.mongodb.com/v3.6/reference/operator/aggregation/meta/#proj._S_meta
 */
export type MetaSortOperators = 'textScore' | 'indexKey';

export type MetaProjectionOperators =
	| MetaSortOperators
	/** Only for Atlas Search https://docs.atlas.mongodb.com/reference/atlas-search/scoring/ */
	| 'searchScore'
	/** Only for Atlas Search https://docs.atlas.mongodb.com/reference/atlas-search/highlighting/ */
	| 'searchHighlights';

/**
 * Possible projection operators
 *
 * @see https://docs.mongodb.com/v3.6/reference/operator/projection/
 */
export interface ProjectionOperators {
	/** @see https://docs.mongodb.com/v3.6/reference/operator/projection/elemMatch/#proj._S_elemMatch */
	$elemMatch?: object | undefined;
	/** @see https://docs.mongodb.com/v3.6/reference/operator/projection/slice/#proj._S_slice */
	$slice?: number | [number, number] | undefined;
	$meta?: MetaProjectionOperators | undefined;
}

export type ProjectionQuery<T> = SchemaMember<T, ProjectionOperators | number | boolean | any>;
