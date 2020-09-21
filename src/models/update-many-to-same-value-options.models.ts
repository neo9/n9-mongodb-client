export interface UpdateManyToSameValueOptions<U> {
	/**
	 * This options need to be set to true when trying to update many document to same value
	 * when the updateOnlyOnChange is setted for this collection.
	 * If set to true the query will be executed and all lastModificationDate will be updated
	 * even if no modification is done to a document.
	 */
	forceLastModificationDate?: boolean;
}
