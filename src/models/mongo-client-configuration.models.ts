import { StringMap } from './maps.models';

export interface LockFieldConfiguration {
	/**
	 * List of fields that will never be locked.
	 * Can be defined either as a string or a regex.
	 * _id and objectInfos are always excluded.
	 * Set to empty array to disable this feature.
	 */
	excludedFields?: (string | RegExp)[];

	/**
	 * Array fields whose item unicity is determined by a key of the field,
	 * and not by its index in the array.
	 * Each key is the path to the array, and each value is the name of the field to use for unicity.
	 * Use this feature to lock specific items in the array, while still allowing to modify other items.
	 * Set to empty object to disable this feature.
	 */
	arrayWithReferences?: StringMap<string>;
}

export interface UpdateOnlyOnChangeConfiguration {
	/**
	 * Options to filter the fields to determine if a field has changed.
	 * Can be one of pick or omit. If both are set, only pick will be taken into account.
	 */
	changeFilters?: {
		/**
		 * List of fields to analyse for change detection. All other fields will not be analysed.
		 * Pick path work as prefix to allow to pick all object starting with it.
		 */
		pick?: string[];
		/**
		 * List of fields to ignore for change detection. All other fields will be analysed.
		 * Pick path work as prefix to allow to omit all object starting with it.
		 */
		omit?: string[];
	};
}

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
	 * Page size used to save historic data as bulk
	 */
	historicPageSize?: number;

	/**
	 * If set, methods to lock and unlock fields will be enabled.
	 * Fields that are locked will not be updated in later updates. This behaviour is overridable at each method call.
	 * Defaults to undefined.
	 */
	lockFields?: LockFieldConfiguration;

	/**
	 * If set, entities will not be updated if they didn't change (ie: if the update would not change the document in db).
	 * Defaults to undefined, if keepHistoric is `true` it is enabled with value `{}`.
	 */
	updateOnlyOnChange?: UpdateOnlyOnChangeConfiguration;

	/**
	 * Name of the collection to use as source for aggregations.
	 * If set, aggregations will be sourced with the given aggregation.
	 * This behaviour can be overridden at each aggregation method call.
	 * Defaults to undefined.
	 */
	aggregationCollectionSource?: string;
}
