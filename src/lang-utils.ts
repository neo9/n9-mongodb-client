/* eslint-disable @typescript-eslint/naming-convention */
import { N9Error } from '@neo9/n9-node-utils';
import * as _ from 'lodash';
import { MongoError, ObjectID } from 'mongodb';

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
				obj[key] = _.filter(
					objElement,
					(elm) =>
						!(
							(keepNullValues && elm === undefined) ||
							(!keepNullValues && LodashReplacerUtils.IS_NIL(elm))
						),
				) as any;
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
			if (objElement && typeof objElement === 'object') {
				LangUtils.removeEmptyDeep(objElement, compactArrays, removeEmptyObjects, keepNullValues);
			} else if (
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

	public static throwN9ErrorFromError(e: Error | N9Error | MongoError, context?: object): void {
		if (e instanceof N9Error) throw e;
		let status: number = ((e as MongoError).code as number) || 500;
		if (status < 100 || status > 599) {
			status = 500;
		}
		throw new N9Error(e.message, status, {
			srcError: e,
			...context,
		});
	}
}
