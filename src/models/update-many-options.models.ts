/**
 * Options for updateMany function
 */
export class MongoClientUpdateManyOptions {
	/**
	 * Useful if mongoClient updateOnlyOnChange is at false. Allow skip data equality check after an edit, and add a $setOnInsert on a query.
	 * Default : false.
	 */
	public updateLastModificationDateOnlyOnInsert?: boolean;
}
