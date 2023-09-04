import { Diff } from 'deep-diff';

import { BaseMongoObject } from '.';

export class EntityHistoricStored<T> extends BaseMongoObject {
	public entityId: string;
	public userId: string;
	public date: Date;
	public snapshot: T;
	public type?: string;
}

export class EntityHistoric<T> extends BaseMongoObject {
	public entityId: string;
	public userId: string;
	public date: Date;
	public dataEdited: Diff<any>[];
	public snapshot: T;
	public type?: string;
}
