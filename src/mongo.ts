import { ClassTransformOptions, plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import { Db, MongoClient, ObjectID } from 'mongodb';
import { ClassType } from './models/class-type.models';

export class MongoUtils {
	public static async connect(url: string): Promise<Db> {
		const log = global.log.module('mongo');
		log.info(`Connecting to ${url}...`);
		global.dbClient = await MongoClient.connect(url, { useNewUrlParser: true });
		const db = (global.dbClient as MongoClient).db();
		global.db = db;
		log.info(`Connected`);
		return db;
	}

	public static oid(id: string | ObjectID): ObjectID | null {
		return id ? new ObjectID(id) : id as null;
	}

	public static oids(ids: string[] | ObjectID[]): ObjectID[] | undefined {
		if (ids) {
			return _.map(ids, (id: string | ObjectID) => {
				return MongoUtils.oid(id);
			});
		}
		return undefined;
	}

	public static mapObjectIdToStringHex<T>(obj: any): any {
		Object.keys(obj).forEach((key) => {
			if (obj[key] && typeof obj[key] === 'object' && !(obj[key] instanceof ObjectID)) {
				MongoUtils.mapObjectIdToStringHex(obj[key]);
			} else if (obj[key] instanceof ObjectID) {
				obj[key] = (obj[key] as ObjectID).toHexString();
			}
		});
		return obj;
	}

	public static mapObjectToClass<T extends object, V>(cls: ClassType<T>, plain: V, options?: ClassTransformOptions): T {
		if (!plain) return plain as any;

		const newPlain = MongoUtils.mapObjectIdToStringHex(_.cloneDeep(plain));
		return plainToClass(cls, newPlain, options) as T;
	}

}
