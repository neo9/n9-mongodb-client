import { BaseMongoObjectInfosUpdate } from './base-mongo-object-infos.models';
import { StringMap } from './maps.models';

export class LockField {
	public path: string;
	public params?: StringMap<string | number | boolean>;
	public metaDatas: BaseMongoObjectInfosUpdate;
}
