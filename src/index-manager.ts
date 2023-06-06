import { Collection, CreateIndexesOptions, IndexSpecification } from 'mongodb';

import { LangUtils } from './lang-utils';

/**
 * Class that handlez the creation, update and deletion of mongodb indexes
 */
export class IndexManager<U> {
	/**
	 * @param collection the mongodb collection in which the indexes will be managed
	 */
	constructor(private readonly collection: Collection<U>) {}

	/**
	 * Returns a list of all indexes.
	 * ListIndexesCursor.toArray() returns a promise any[]
	 */
	public async findAllIndexes(): Promise<any[]> {
		try {
			return await this.collection.listIndexes().toArray();
		} catch (err) {
			LangUtils.throwN9ErrorFromError(err);
		}
	}

	/**
	 * Create an index on the given field(s).
	 *
	 * @param fieldOrSpec name / spec of the indexed field(s)
	 * @param options extra mongodb index creation options
	 */
	public async createIndex(
		fieldOrSpec: IndexSpecification,
		options?: CreateIndexesOptions,
	): Promise<string> {
		try {
			return await Promise.resolve(this.collection.createIndex(fieldOrSpec, options));
		} catch (err) {
			// eslint-disable-next-line
			console.log('err.message', err.message);

			LangUtils.throwN9ErrorFromError(err, { fieldOrSpec, options });
		}
	}

	/**
	 * Create an index that will enforce the uniqueness of the value of the indexed field(s).
	 *
	 * @param fieldOrSpec name / spec of the indexed field(s)
	 * @param options extra mongodb index creation options
	 */
	public async createUniqueIndex(
		fieldOrSpec: IndexSpecification,
		options?: CreateIndexesOptions,
	): Promise<void> {
		await this.createIndex(fieldOrSpec, { ...options, unique: true });
	}

	/**
	 * Ensure that an expiration index is created with the given parameters.
	 * Handle the case where an index with the same names exists but with a different configuration.
	 *
	 * @param fieldOrSpec name / spec of the indexed field(s)
	 * @param ttlInDays number of days after which the documents will be expired
	 * @param options extra mongodb index creation options
	 */
	public async ensureExpirationIndex(
		fieldOrSpec: IndexSpecification,
		ttlInDays: number,
		options: CreateIndexesOptions = {},
	): Promise<string> {
		options.expireAfterSeconds = ttlInDays * 24 * 3600;
		options.name = options.name || 'n9MongoClient_expiration';

		try {
			return await Promise.resolve(this.collection.createIndex(fieldOrSpec, options));
		} catch (err) {
			// error 85 and 86 mean the index already exists with different parameters / fields
			// 85 means different parameters
			// 86 means different fields
			if (err.code === 85 || err.code === 86) {
				try {
					await this.collection.dropIndex(options.name);
					return await Promise.resolve(this.collection.createIndex(fieldOrSpec, options));
				} catch (err2) {
					LangUtils.throwN9ErrorFromError(err2, {
						fieldOrSpec,
						ttlInDays,
						options,
					});
				}
			} else {
				LangUtils.throwN9ErrorFromError(err, {
					fieldOrSpec,
					ttlInDays,
					options,
				});
			}
		}
	}

	/**
	 * Drop the given index.
	 * Ensure that it does exists before dropping it, so no exception will be thrown
	 *
	 * @param indexName name of the index to drop
	 */
	public async dropIndex(indexName: string): Promise<void> {
		try {
			if (await this.collection.indexExists(indexName)) {
				await this.collection.dropIndex(indexName);
			}
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { indexName });
		}
	}
}
