import { ObjectId } from 'bson';
import {
	AggregateOptions,
	AnyBulkWriteOperation,
	BulkWriteOptions,
	CollationOptions,
	CreateIndexesOptions,
	Filter,
	FindCursor,
	ReadPreferenceLike,
	UpdateFilter,
} from 'mongodb';

export { ObjectId } from 'bson';

export * from './client';
export * from './lang-utils';
export * from './lock-fields-manager';
export * from './lock';
export * from './models';
export * from './mongo-read-stream';
export * from './mongo-utils';
export * from './aggregation-utils';
export * from './models';
export { Filter, CollationOptions, IndexSpecification } from 'mongodb';

/**
 * @deprecated
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ObjectID = ObjectId;
/**
 * @deprecated
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ObjectID = ObjectId;

/**
 * @deprecated
 */
export type BulkWriteOperation = AnyBulkWriteOperation;
/**
 * @deprecated
 */
export type CollationDocument = CollationOptions;
/**
 * @deprecated
 */
export type CollectionAggregationOptions = AggregateOptions;
/**
 * @deprecated
 */
export type CollectionInsertManyOptions = BulkWriteOptions;
/**
 * @deprecated
 */
export type Cursor<T> = FindCursor<T>;
/**
 * @deprecated
 */
export type FilterQuery<T> = Filter<T>;
/**
 * @deprecated
 */
export type IndexOptions = CreateIndexesOptions;
/**
 * @deprecated
 */
export type UpdateQuery<T> = UpdateFilter<T>;
/**
 * @deprecated
 */
export type ReadPreferenceOrMode = ReadPreferenceLike;
