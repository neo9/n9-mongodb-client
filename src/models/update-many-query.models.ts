import { FilterQuery, UpdateQuery } from 'mongodb';
import { StringMap } from './';

export class UpdateManyQuery<T> {
	public id?: string;
	public key?: {
		name: string;
		value: string | number | boolean;
	};
	public query?: FilterQuery<T>;
	public updateQuery: UpdateQuery<T>;
}
