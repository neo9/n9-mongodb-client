import { TransformFnParams } from 'class-transformer';

export function toDate(value: string): Date {
	return new Date(value);
}

export function transform(transformFnParams: TransformFnParams): Date | string {
	const value: Date | string = transformFnParams.value;
	if (typeof value === 'string') return toDate(value);
	return value;
}
