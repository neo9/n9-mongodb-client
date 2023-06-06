import { Collection, Filter, ObjectId, ReturnDocument, UpdateFilter } from 'mongodb';

import { LangUtils } from './lang-utils';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { AddTagOptions, RemoveTagOptions } from './models';
import { MongoUtils } from './mongo-utils';

/**
 * Class that can add and remvoe tags to entities in a colection
 */
export class TagManager<U> {
	private static buildAddTagUpdate(userId: string, options: AddTagOptions): UpdateFilter<any> {
		const update: UpdateFilter<any> = { $addToSet: { 'objectInfos.tags': options.tag } as any };
		const updateLastUpdate = LodashReplacerUtils.IS_BOOLEAN(options.updateLastUpdate)
			? options.updateLastUpdate
			: true;
		if (updateLastUpdate) {
			update.$set = {
				'objectInfos.lastUpdate.date': new Date(),
				'objectInfos.lastUpdate.userId': ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			};
		}
		return update;
	}

	private static buildRemoveTagUpdate(
		tag: string,
		userId: string,
		options: RemoveTagOptions,
	): UpdateFilter<any> {
		const update: UpdateFilter<any> = { $pull: { 'objectInfos.tags': tag } as any };
		const updateLastUpdate = LodashReplacerUtils.IS_BOOLEAN(options.updateLastUpdate)
			? options.updateLastUpdate
			: true;
		if (updateLastUpdate) {
			update.$set = {
				'objectInfos.lastUpdate.date': new Date(),
				'objectInfos.lastUpdate.userId': ObjectId.isValid(userId) ? MongoUtils.oid(userId) : userId,
			};
		}
		return update;
	}

	/**
	 * @param collection the mongodb collection in which the tags will be managed
	 */
	constructor(private collection: Collection<U>) {}

	/**
	 * Add a tag to an entity.
	 * If the entity already has the tag, this method has no effect.
	 *
	 * @param query the query to select the entity to tag
	 * @param userId id of the user performing the operation
	 * @param options options to customize the tag
	 * @returns New tag
	 */
	public async addTagToOne(
		query: Filter<U>,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		try {
			options.tag = options.tag || new ObjectId().toHexString();

			const update: UpdateFilter<U> = TagManager.buildAddTagUpdate(
				userId,
				options,
			) as UpdateFilter<U>;

			await this.collection.findOneAndUpdate(query, update, {
				returnDocument: ReturnDocument.AFTER,
			});

			return options.tag;
		} catch (err) {
			LangUtils.throwN9ErrorFromError(err, {
				query,
				userId,
				options,
			});
		}
	}

	/**
	 * Same as addTagToOne, except the query is made by id.
	 *
	 * @param id
	 * @param userId
	 * @param options
	 * @returns New tag
	 */
	public async addTagToOneById(
		id: string,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		const query: Filter<U> = { _id: MongoUtils.oid(id) } as Filter<U>;

		return await this.addTagToOne(query, userId, options);
	}

	/**
	 * Same as addTagToOne, but for many entities
	 */
	public async addTagToMany(
		query: Filter<U>,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		try {
			options.tag = options.tag || new ObjectId().toHexString();

			const update: UpdateFilter<U> = TagManager.buildAddTagUpdate(
				userId,
				options,
			) as UpdateFilter<U>;

			await this.collection.updateMany(query, update);
			return options.tag;
		} catch (err) {
			LangUtils.throwN9ErrorFromError(err, {
				query,
				userId,
				options,
			});
		}
	}

	/**
	 * Remove a tag from an entity.
	 * If the entity doesn't have the tag, this method has no effect.
	 *
	 * @param query the query to select the entity to tag
	 * @param tag the tag to remove
	 * @param userId id of the user performing the operation
	 * @param options options to customize the tag
	 */
	public async removeTagFromOne(
		query: Filter<U>,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		try {
			const update: UpdateFilter<U> = TagManager.buildRemoveTagUpdate(
				tag,
				userId,
				options,
			) as UpdateFilter<U>;

			await this.collection.findOneAndUpdate(query, update, {
				returnDocument: ReturnDocument.AFTER,
			});
		} catch (err) {
			LangUtils.throwN9ErrorFromError(err, {
				query,
				tag,
				userId,
				options,
			});
		}
	}

	/**
	 * Same as removeTagFromOne, except the query is made by id.
	 *
	 * @param id
	 * @param tag
	 * @param userId
	 * @param options
	 */
	public async removeTagFromOneById(
		id: string,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		const query: Filter<U> = { _id: MongoUtils.oid(id) } as Filter<U>;

		await this.removeTagFromOne(query, tag, userId, options);
	}

	/**
	 * Same as removeTagFromOne, but for many entities
	 *
	 *  @param query
	 * @param tag
	 * @param userId
	 * @param options
	 */
	public async removeTagFromMany(
		query: Filter<U>,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		try {
			const update: UpdateFilter<U> = TagManager.buildRemoveTagUpdate(
				tag,
				userId,
				options,
			) as UpdateFilter<U>;
			await this.collection.updateMany(query, update);
		} catch (err) {
			LangUtils.throwN9ErrorFromError(err, {
				query,
				tag,
				userId,
				options,
			});
		}
	}

	/**
	 * Delete all entities with the given tag
	 */
	public async deleteManyWithTag(tag: string): Promise<void> {
		const query: Filter<U> = { 'objectInfos.tags': tag } as unknown as Filter<U>;

		try {
			await this.collection.deleteMany(query);
		} catch (err) {
			LangUtils.throwN9ErrorFromError(err, { tag });
		}
	}
}
