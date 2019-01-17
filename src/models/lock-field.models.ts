import { BaseMongoObjectInfosUpdate } from './base-mongo-object-infos.models';
import { StringMap } from './maps.models';

export class LockField {
	public path: string;
	public metaDatas: BaseMongoObjectInfosUpdate;
}
