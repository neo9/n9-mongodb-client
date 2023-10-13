import * as _ from 'lodash';
import * as v8 from 'v8';

export class LodashReplacerUtils {
	public static IS_NIL(value: any): value is null | undefined {
		return value === undefined || value === null;
	}

	public static IS_STRING(value: any): value is string {
		return value && typeof value.valueOf() === 'string';
	}

	public static IS_BOOLEAN(value: any): value is boolean {
		return value === true || value === false;
	}

	public static IS_NUMBER(value: any): value is number {
		return typeof value === 'number';
	}

	public static IS_DATE(value: any): value is Date {
		return value instanceof Date;
	}

	public static IS_OBJECT(value: any): value is object {
		// eslint-disable-next-line no-eq-null
		return value != null && typeof value === 'object';
	}

	public static IS_ARRAY_EMPTY(array: any[]): boolean {
		return !array || array.length === 0;
	}

	public static IS_OBJECT_EMPTY(value: object | string | number): boolean {
		return !value || !Object.keys(value).length;
	}

	public static OMIT_PROPERTIES<T extends object, K extends keyof T>(
		originalObject: T | null | undefined,
		keysToOmit: K[] | string[],
	): Omit<T, K> {
		if (!originalObject) return originalObject;
		if (!keysToOmit) return originalObject;

		const clonedObject = { ...originalObject };
		for (const path of keysToOmit) {
			delete clonedObject[path as K];
		}
		return clonedObject;
	}

	public static PICK_PROPERTIES<T extends object, K extends keyof T>(
		originalObject: T | null | undefined,
		props: K[],
	): Pick<T, K> {
		if (!originalObject || !props) return;

		const picked: any = {};
		for (const prop of props) {
			picked[prop] = originalObject[prop];
		}

		return picked;
	}

	public static CLONE_DEEP<T>(value: T): T {
		if (v8.deserialize) {
			// Added in Node 11
			return v8.deserialize(v8.serialize(value));
		}
		return _.cloneDeep(value);
	}
}
