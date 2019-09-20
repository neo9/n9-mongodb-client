import { FilterQuery } from 'mongodb';

export interface UpdateManyAtOnceOptions<U> {
	/**
	 * If true, entities that do not already exist in database will be created.
	 * Defaults to false.
	 */
	upsert?: boolean;
	/**
	 * If true, all fields added in the entities will be locked (ie: added to the lock fields).
	 * Defaults to true.
	 */
	lockNewFields?: boolean;
	/**
	 * - If it's a string, it will be treated as a field name to use to retrieve the existing values of the entities in database.
	 * The value for this field will be taken from the given entities.
	 * - If it's a function, it will be called with the given value for the entity
	 * and its return value will be the query used to get the existing value for that entity
	 * - If it's null or undefined, the existing version of the entity will not be retrieved from database.
	 * Defaults to undefined.
	 */
	query?: string | ((entity: Partial<U>) => FilterQuery<Partial<U>>);
	/**
	 * Function that will be used to map the entity with its existing value.
	 * The function will be called with the given entity and the existing entity if there is one.
	 * Defaults to undefined (no mapping).
	 */
	mapFunction?: (entity: Partial<U>, existingEntity?: U) => Promise<Partial<U>>;
	/**
	 * List of field keys in the entities that will only be added upon insertion.
	 * Defaults to undefined.
	 */
	onlyInsertFieldsKey?: string[];
	/**
	 * If true, the lock fields will be ignored and the entity will be updated with these fields.
	 * If false, the lock fields will be removed from the entities so the entity will not be updated with these fields.
	 * Defaults to false.
	 */
	forceEditLockFields?: boolean;
	/**
	 * If true, all fields that are present in the existing values and not in the given entities wil be unset in database.
	 * Defaults to true.
	 */
	unsetUndefined?: boolean;
}
