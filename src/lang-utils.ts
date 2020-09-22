/* tslint:disable:function-name */
import * as _ from 'lodash';
import { ObjectID } from 'mongodb';
import { LodashReplacerUtils } from './lodash-replacer.utils';

export class LangUtils {
	/**
	 * Remove all empty values from an object, deeply.
	 *
	 * @param obj object to modify
	 * @param compactArrays if true, empty values in arrays will be removed. Defaults to false.
	 * @param removeEmptyObjects if true, properties that are empty plain objects will be removed. Defaults to false.
	 * @param keepNullValues if true, properties that are set to null will be not be removed. Defaults to false.
	 */
	public static removeEmptyDeep<T>(
		obj: T,
		compactArrays: boolean = false,
		removeEmptyObjects: boolean = false,
		keepNullValues: boolean = false,
	): T {
		for (const key of Object.keys(obj)) {
			const objElement = obj[key];
			if (compactArrays && Array.isArray(objElement)) {
				obj[key] = _.filter(objElement, (elm) => !LodashReplacerUtils.IS_NIL(elm));
			}
			if (
				removeEmptyObjects &&
				LodashReplacerUtils.IS_OBJECT(objElement) &&
				!Array.isArray(objElement) &&
				LodashReplacerUtils.IS_OBJECT_EMPTY(objElement) &&
				!LodashReplacerUtils.IS_DATE(objElement) // _.isEmpty return true for Date instance
			) {
				delete obj[key];
			}
			// @ts-ignore
			if (objElement && typeof objElement === 'object') {
				LangUtils.removeEmptyDeep(objElement, compactArrays, removeEmptyObjects, keepNullValues);
			}
			// @ts-ignore
			else if (
				(keepNullValues && objElement === undefined) ||
				(!keepNullValues && LodashReplacerUtils.IS_NIL(objElement))
			) {
				delete obj[key];
			}
		}
		return obj;
	}

	/**
	 * Join field paths, handling empty values
	 */
	public static getJoinPaths(basePath: string, key: string): string {
		if (basePath) return `${basePath}.${key}`;
		return key;
	}

	/**
	 * Return true if the given parameter is a plain javascript object
	 * (ie: extends Object, not an array, not a date, not an object id and not a function)
	 */
	public static isClassicObject(existingEntityElement: any): boolean {
		return (
			LodashReplacerUtils.IS_OBJECT(existingEntityElement) &&
			!(existingEntityElement instanceof ObjectID) &&
			!(existingEntityElement instanceof Date) &&
			!Array.isArray(existingEntityElement)
		);
	}
}
