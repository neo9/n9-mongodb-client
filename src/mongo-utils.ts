/* tslint:disable:function-name */
import { ClassTransformOptions, plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { ClassType } from './models/class-type.models';

export class MongoUtils {
	public static async connect(
		url: string,
		options: mongodb.MongoClientOptions = { useNewUrlParser: true },
	): Promise<mongodb.Db> {
		const log = global.log.module('mongo');
		log.info(`Connecting to ${MongoUtils.hidePasswordFromURI(url)}...`);
		global.dbClient = await mongodb.MongoClient.connect(url, options);
		const db = (global.dbClient as mongodb.MongoClient).db();
		global.db = db;
		log.info(`Connected`);
		return db;
	}

	public static async disconnect(): Promise<void> {
		if (!global.dbClient) return;

		const log = global.log.module('mongo');
		log.info(`Disconnect from MongoDB.`);
		await new Promise((resolve) => {
			(global.dbClient as mongodb.MongoClient).logout(resolve);
		});
	}

	public static oid(id: string | mongodb.ObjectID): mongodb.ObjectID | null {
		return id ? new mongodb.ObjectID(id) : (id as null);
	}

	public static oids(ids: string[] | mongodb.ObjectID[]): mongodb.ObjectID[] | undefined {
		if (ids) {
			return (ids as any[]).map((id) => MongoUtils.oid(id));
		}
		return undefined;
	}

	public static mapObjectIdToStringHex<T>(obj: any): any {
		Object.keys(obj).forEach((key) => {
			if (obj[key] && typeof obj[key] === 'object' && !(obj[key] instanceof mongodb.ObjectID)) {
				MongoUtils.mapObjectIdToStringHex(obj[key]);
			} else if (obj[key] instanceof mongodb.ObjectID) {
				obj[key] = (obj[key] as mongodb.ObjectID).toHexString();
			}
		});
		return obj;
	}

	public static mapObjectToClass<T extends object, V>(
		cls: ClassType<T>,
		plain: V,
		options?: ClassTransformOptions,
	): T {
		if (!plain) return plain as any;

		const newPlain = MongoUtils.mapObjectIdToStringHex(plain);
		return plainToClass(cls, newPlain, options) as T;
	}

	public static removeSpecialCharactersInKeys(obj: any): any {
		if (
			_.isNil(obj) ||
			_.isString(obj) ||
			_.isBoolean(obj) ||
			_.isNumber(obj) ||
			obj instanceof mongodb.ObjectID ||
			_.isDate(obj)
		) {
			return obj;
		}

		if (_.isArray(obj)) {
			return obj.map((element) => this.removeSpecialCharactersInKeys(element));
		}
		for (const key of Object.keys(obj)) {
			if (obj[key] && typeof obj[key] === 'object') {
				obj[key] = this.removeSpecialCharactersInKeys(obj[key]);
			}
		}

		// tslint:disable-next-line:no-parameter-reassignment
		obj = _.mapKeys(obj, (val, key: string) => {
			return MongoUtils.escapeSpecialCharacters(key);
		}) as any;
		return obj;
	}

	public static unRemoveSpecialCharactersInKeys(obj: any): any {
		if (
			_.isNil(obj) ||
			_.isString(obj) ||
			_.isBoolean(obj) ||
			_.isNumber(obj) ||
			obj instanceof mongodb.ObjectID ||
			_.isDate(obj)
		) {
			return obj;
		}

		if (_.isArray(obj)) {
			return obj.map((element) => this.unRemoveSpecialCharactersInKeys(element));
		}
		for (const key of Object.keys(obj)) {
			if (obj[key] && typeof obj[key] === 'object') {
				obj[key] = this.unRemoveSpecialCharactersInKeys(obj[key]);
			}
		}

		// tslint:disable-next-line:no-parameter-reassignment
		obj = _.mapKeys(obj, (val, key: string) => {
			return MongoUtils.unescapeSpecialCharacters(key);
		}) as any;
		return obj;
	}

	public static escapeSpecialCharacters(key: string): string {
		if (!key.includes('.') && !key.includes('$')) return key;

		return key.replace(/\$/g, '\\u0024').replace(/\./g, '\\u002e');
	}

	public static unescapeSpecialCharacters(key: string): string {
		return key.replace(/\\u0024/g, '$').replace(/\\u002e/g, '.');
	}

	public static hidePasswordFromURI(uri: string): string {
		if (!uri) return '';

		const regex = /(?<=:)([^@:]+)(?=@[^@]+$)/;

		return uri.replace(regex, '********');
	}
}
