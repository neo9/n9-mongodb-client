import { FilterQuery, UpdateQuery } from 'mongodb';

/**
 * Queries to run bulk of update one
 *
 * Order of target fields priority : id, key, query
 *
 * If none provided the target is `_id does not exist`
 */
export class UpdateManyQuery<T> {
	/**
	 * If provided the _id of the target
	 */
	public id?: string;
	/**
	 * If provided the name and value of the target pointed with one field only
	 */
	public key?: {
		name: string;
		value: string | number | boolean;
	};
	/**
	 * If provided the target of the entity to update
	 */
	public query?: FilterQuery<T>;

	/**
	 * The update to run, will be filled with objectInfos update
	 */
	public updateQuery: UpdateQuery<T>;
}
