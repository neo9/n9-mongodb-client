import { Collection, ObjectId, UpdateQuery } from 'mongodb';

import { LangUtils } from './lang-utils';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { AddTagOptions, RemoveTagOptions } from './models';
import { MongoUtils } from './mongo-utils';

/**
 * Class that can add and remvoe tags to entities in a colection
 */
export class TagManager {
	private static buildAddTagUpdate(userId: string, options: AddTagOptions): object {
		const update: UpdateQuery<any> = { $addToSet: { 'objectInfos.tags': options.tag } as any };
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
	): object {
		const update: UpdateQuery<any> = { $pull: { 'objectInfos.tags': tag } as any };
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
	constructor(private collection: Collection) {}

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
		query: object,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		try {
			options.tag = options.tag || new ObjectId().toHexString();
			const update = TagManager.buildAddTagUpdate(userId, options);
			await this.collection.findOneAndUpdate(query, update, { returnOriginal: false });
			return options.tag;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
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
		return await this.addTagToOne({ _id: MongoUtils.oid(id) }, userId, options);
	}

	/**
	 * Same as addTagToOne, but for many entities
	 */
	public async addTagToMany(
		query: object,
		userId: string,
		options: AddTagOptions = {},
	): Promise<string> {
		try {
			options.tag = options.tag || new ObjectId().toHexString();
			const update = TagManager.buildAddTagUpdate(userId, options);
			await this.collection.updateMany(query, update);
			return options.tag;
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
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
		query: object,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		try {
			const update = TagManager.buildRemoveTagUpdate(tag, userId, options);
			await this.collection.findOneAndUpdate(query, update, { returnOriginal: false });
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
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
		await this.removeTagFromOne({ _id: MongoUtils.oid(id) }, tag, userId, options);
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
		query: object,
		tag: string,
		userId: string,
		options: RemoveTagOptions = {},
	): Promise<void> {
		try {
			const update = TagManager.buildRemoveTagUpdate(tag, userId, options);
			await this.collection.updateMany(query, update);
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, {
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
		try {
			await this.collection.deleteMany({ 'objectInfos.tags': tag });
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { tag });
		}
	}
}
