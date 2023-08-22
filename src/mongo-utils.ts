/* eslint-disable @typescript-eslint/naming-convention */
import { N9Error } from '@neo9/n9-node-utils';
import { ClassTransformOptions, plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { ListCollectionsOptions, MongoClient as MongodbClient, ReadPreference } from 'mongodb';

import { ReadPreferenceOrMode } from './index';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { ClassType } from './models/class-type.models';
import { MongoUtilsOptions } from './models/mongo-utils-options.models';

const defaultConnectOptions: MongoUtilsOptions = {
	killProcessOnReconnectFailed: true,
};

export class MongoUtils {
	private static readonly MONGO_ID_REGEXP: RegExp = /^[0-9a-f]{24}$/;

	public static async connect(
		url: string,
		options: mongodb.MongoClientOptions = {},
		connectOptions: MongoUtilsOptions = {},
	): Promise<mongodb.Db> {
		const baseConnectOptions: MongoUtilsOptions = {
			...defaultConnectOptions,
			...connectOptions,
		};
		const log = global.log.module('mongo');
		log.info(`Connecting to ${MongoUtils.hidePasswordFromURI(url)}...`);

		const mongoClient = new mongodb.MongoClient(url, options);
		const safeUrl = MongoUtils.hidePasswordFromURI(url);

		mongoClient.on('serverOpening', () => {
			log.info(`Connection to the mongodb server is being established...`);
		});
		mongoClient.on('open', () => {
			log.info(`Client connected to ${safeUrl}.`);
		});
		mongoClient.on('close', () => {
			log.info(`Client disconnected from ${safeUrl}.`);
		});
		mongoClient.on('reconnect', () => {
			log.info(`Client reconnected to ${safeUrl}.`);
		});
		mongoClient.on('timeout', () => {
			log.warn(`Client connection or operation timed out`);
		});

		const dbClient = await mongoClient.connect();
		global.dbClient = dbClient;
		const db = dbClient.db();
		global.db = db;

		(db as any).s.topology.on('reconnectFailed', () => {
			log.warn(`Client reconnection failed.`);
			if (baseConnectOptions.killProcessOnReconnectFailed) {
				log.warn(`Sending SIGTERM to stop process.`);
				process.kill(process.pid, 'SIGTERM');
			}
		});

		return db;
	}

	public static async isConnected(checkWritable: boolean = true): Promise<boolean> {
		const dbClient = global.dbClient as MongodbClient;
		if (!dbClient) {
			return false;
		}
		try {
			if (!checkWritable) {
				await dbClient.db().admin().ping({
					retryWrites: false,
					willRetryWrite: false,
					readPreference: ReadPreference.PRIMARY,
				});
				// TODO : check response content
				return true;
			}
			await dbClient.db().admin().serverStatus({
				retryWrites: false,
				willRetryWrite: false,
				readPreference: ReadPreference.PRIMARY,
			});
			return true;
		} catch (e) {
			return false;
		}
	}

	public static async disconnect(): Promise<void> {
		if (!global.dbClient) return;

		const log = global.log.module('mongo');
		log.info(`Disconnecting from MongoDB...`);
		await (global.dbClient as mongodb.MongoClient).close();
	}

	public static isMongoId(id: string): boolean {
		return this.MONGO_ID_REGEXP.test(id);
	}

	public static oid(id: string | mongodb.ObjectId): mongodb.ObjectId | null {
		if (!id) return id as null;
		try {
			return new mongodb.ObjectId(id);
		} catch (e) {
			if (typeof id === 'string' && !this.isMongoId(id)) {
				throw new N9Error('invalid-mongo-id', 400, { id });
			} else {
				throw e;
			}
		}
	}

	public static oids(
		ids: string[] | mongodb.ObjectId[] | (string | mongodb.ObjectId)[],
	): mongodb.ObjectId[] | undefined {
		if (ids) {
			return (ids as any[]).map((id) => MongoUtils.oid(id));
		}
		return undefined;
	}

	public static mapObjectIdToStringHex(obj: any): any {
		for (const [key, value] of Object.entries(obj)) {
			if (value instanceof mongodb.ObjectId) {
				obj[key] = value.toHexString();
			} else if (value && typeof value === 'object') {
				MongoUtils.mapObjectIdToStringHex(value);
			}
		}
		return obj;
	}

	public static mapObjectToClass<T extends object, V>(
		cls: ClassType<T>,
		plain: V,
		options?: ClassTransformOptions,
	): T {
		if (!plain) return plain as any;

		const newPlain = MongoUtils.mapObjectIdToStringHex(plain);
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
		return plainToClass(cls, newPlain, options) as T;
	}

	public static removeSpecialCharactersInKeys(obj: any): any {
		if (
			LodashReplacerUtils.IS_NIL(obj) ||
			LodashReplacerUtils.IS_STRING(obj) ||
			LodashReplacerUtils.IS_BOOLEAN(obj) ||
			LodashReplacerUtils.IS_NUMBER(obj) ||
			obj instanceof mongodb.ObjectId ||
			LodashReplacerUtils.IS_DATE(obj)
		) {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map((element) => this.removeSpecialCharactersInKeys(element));
		}
		for (const key of Object.keys(obj)) {
			if (obj[key] && typeof obj[key] === 'object') {
				obj[key] = this.removeSpecialCharactersInKeys(obj[key]);
			}
		}

		// eslint-disable-next-line no-param-reassign
		obj = _.mapKeys(obj, (val, key: string) => MongoUtils.escapeSpecialCharacters(key)) as any;
		return obj;
	}

	public static unRemoveSpecialCharactersInKeys(obj: any): any {
		if (
			LodashReplacerUtils.IS_NIL(obj) ||
			LodashReplacerUtils.IS_STRING(obj) ||
			LodashReplacerUtils.IS_BOOLEAN(obj) ||
			LodashReplacerUtils.IS_NUMBER(obj) ||
			obj instanceof mongodb.ObjectId ||
			LodashReplacerUtils.IS_DATE(obj)
		) {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map((element) => this.unRemoveSpecialCharactersInKeys(element));
		}
		for (const key of Object.keys(obj)) {
			if (obj[key] && typeof obj[key] === 'object') {
				obj[key] = this.unRemoveSpecialCharactersInKeys(obj[key]);
			}
		}

		// eslint-disable-next-line no-param-reassign
		obj = _.mapKeys(obj, (val, key: string) => MongoUtils.unescapeSpecialCharacters(key)) as any;
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

	public static listCollections(
		filter?: object,
		options?: {
			nameOnly?: boolean;
			batchSize?: number;
			readPreference?: ReadPreferenceOrMode;
			session?: mongodb.ClientSession;
		} & ListCollectionsOptions,
	): mongodb.ListCollectionsCursor {
		return (global.db as mongodb.Db).listCollections(filter, options);
	}

	public static async listCollectionsNames(filter?: object): Promise<string[]> {
		const cursor = MongoUtils.listCollections(filter, { nameOnly: true });
		const ret: string[] = [];
		while (await cursor.hasNext()) {
			const item: any = await cursor.next();
			ret.push(item.name);
		}
		return ret;
	}
}
