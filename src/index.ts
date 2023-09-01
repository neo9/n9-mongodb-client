import {
	AggregateOptions,
	AnyBulkWriteOperation,
	BulkWriteOptions,
	CollationOptions,
	CreateIndexesOptions,
	Filter,
	FindCursor,
	ObjectId,
	ReadPreferenceLike,
	UpdateFilter,
} from 'mongodb';

export { ObjectId } from 'mongodb';

export * from './client';
export * from './lang-utils';
export * from './lock-fields-manager';
export * from './lock';
export * from './models';
export * from './mongo-read-stream';
export * from './mongo-utils';
export * from './aggregation-utils';
export * from './models';
export * as MongoDB from 'mongodb';

/**
 * @deprecated : Replace with ObjectId
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ObjectID = ObjectId;
/**
 * @deprecated : Replace with ObjectId
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ObjectID = ObjectId;

/**
 * @deprecated : Replace with AnyBulkWriteOperation<T>
 */
export type BulkWriteOperation<T> = AnyBulkWriteOperation<T>;
/**
 * @deprecated : Replace with CollationOptions
 */
export type CollationDocument = CollationOptions;
/**
 * @deprecated : Replace with AggregateOptions
 */
export type CollectionAggregationOptions = AggregateOptions;
/**
 * @deprecated : Replace with BulkWriteOptions
 */
export type CollectionInsertManyOptions = BulkWriteOptions;
/**
 * @deprecated : Replace with FindCursor<T>
 */
export type Cursor<T> = FindCursor<T>;
/**
 * @deprecated : Replace with  Filter<T>
 */
export type FilterQuery<T> = Filter<T>;
/**
 * @deprecated : Replace with CreateIndexesOptions
 */
export type IndexOptions = CreateIndexesOptions;
/**
 * @deprecated : Replace with  UpdateFilter<T>
 */
export type UpdateQuery<T> = UpdateFilter<T>;
/**
 * @deprecated : Replace with ReadPreferenceLike
 */
export type ReadPreferenceOrMode = ReadPreferenceLike;
