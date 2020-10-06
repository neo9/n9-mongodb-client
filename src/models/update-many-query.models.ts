import { FilterQuery } from "mongodb";
import { StringMap } from './';

export class UpdateManyQuery {
	public id?: string;
	public key?: {
		name: string;
		value: string | number | boolean;
	};
	public query?: StringMap<any>;
	public updateQuery: FilterQuery<any>;
}
