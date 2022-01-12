import { Expose, Transform } from 'class-transformer';

import * as DateParser from '../transformers/date-parser.transformer';
import { LockField } from './lock-field.models';

export class BaseMongoObjectInfosUpdate {
	@Expose()
	public userId: string;

	@Expose()
	@Transform(DateParser.transform)
	public date: Date;
}

export class BaseMongoObjectInfosCreation extends BaseMongoObjectInfosUpdate {}

export class BaseMongoObjectInfos {
	@Expose()
	public creation: BaseMongoObjectInfosCreation;

	@Expose()
	public lastUpdate?: BaseMongoObjectInfosUpdate;

	@Expose()
	public lastModification?: BaseMongoObjectInfosUpdate;

	@Expose()
	public lockFields?: LockField[];

	@Expose()
	public tags?: string[];
}
