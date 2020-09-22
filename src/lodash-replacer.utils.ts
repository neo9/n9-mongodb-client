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
		return value != null && typeof value === 'object';
	}

	public static IS_ARRAY_EMPTY(array: any[]): boolean {
		return !array || array.length === 0;
	}

	public static IS_OBJECT_EMPTY(value: object | string | number): boolean {
		return !value || !Object.keys(value).length;
	}
}
