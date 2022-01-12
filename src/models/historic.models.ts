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

export class DataEditedDecorated<U> {
	public kind: 'A';
	public path?: string[];
	public lhs: any;
	public rhs: any;
	public index: number;
	public item: Diff<U, U>;

	public additionalInformations: U;
}
