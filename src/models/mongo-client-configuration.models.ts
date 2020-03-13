import { StringMap } from './maps.models';

/**
 * Options to pass to n9-mongo-client to configure its behaviour
 */
export interface MongoClientConfiguration {
	/**
	 * If true, each update will create a document describing the update in a separate history collection.
	 * Defaults to false
	 */
	keepHistoric?: boolean;

	/**
	 * If set, methods to lock and unlock fields will be enabled.
	 * Fields that are locked will not be updated in later updates. This behaviour is overridable at each method call.
	 * Defaults to undefined.
	 */
	lockFields?: {
		/**
		 * List of fields that will never be locked.
		 * _id and objectInfos are always excluded.
		 * Set to empty array to disable this feature.
		 */
		excludedFields?: string[];

		/**
		 * Array fields whose item unicity is determined by a key of the field,
		 * and not by its index in the array.
		 * Each key is the path to the array, and each value is the name of the field to use for unicity.
		 * Use this feature to lock specific items in the array, while still allowing to modify other items.
		 * Set to empty object to disable this feature.
		 */
		arrayWithReferences?: StringMap<string>;
	};

	/**
	 * Name of the collection to use as source for aggregations.
	 * If set, aggregations will be sourced with the given aggregation.
	 * This behaviour can be overridden at each aggregation method call.
	 * Defaults to undefined.
	 */
	aggregationCollectionSource?: string;
}
