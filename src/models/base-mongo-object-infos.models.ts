import { Expose, Transform } from 'class-transformer';
import * as DateParser from '../transformers/date-parser.transformer';

export class BaseMongoObjectInfosUpdate {
	@Expose()
	public userId: string;

	@Expose()
	@Transform(DateParser.transform)
	public date: Date;
}

export class BaseMongoObjectInfosCreation extends BaseMongoObjectInfosUpdate {
}

export class BaseMongoObjectInfos {
	@Expose()
	public creation: BaseMongoObjectInfosCreation;

	@Expose()
	public lastUpdate?: BaseMongoObjectInfosUpdate;
}
