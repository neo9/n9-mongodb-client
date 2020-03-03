export function toDate(value: string): Date {
	return new Date(value);
}

export function transform(value: Date | string): Date | string {
	if (typeof value === 'string') return toDate(value);
	return value;
}
