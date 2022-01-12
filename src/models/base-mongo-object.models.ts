import { Expose } from 'class-transformer';

import { BaseMongoObjectInfos } from './base-mongo-object-infos.models';

export class BaseMongoObject {
	@Expose()
	public _id?: string;

	@Expose()
	public objectInfos?: BaseMongoObjectInfos;
}
