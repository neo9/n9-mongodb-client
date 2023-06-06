/* eslint-disable @typescript-eslint/naming-convention */
import { N9Error } from '@neo9/n9-node-utils';
import { ClassTransformOptions, plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import {
	ClientSession,
	Db,
	Document,
	ListCollectionsCursor,
	ListCollectionsOptions,
	MongoClient,
	MongoClientOptions,
	ObjectId,
	ReadPreferenceMode,
} from 'mongodb';

import { LodashReplacerUtils } from './lodash-replacer.utils';
import { ClassType } from './models/class-type.models';

export class MongoUtils {
	private static readonly MONGO_ID_REGEXP: RegExp = /^[0-9a-f]{24}$/;

	public static async connect(url: string, options: MongoClientOptions = {}): Promise<Db> {
		const log = global.log.module('mongo');
		const mongoClient: MongoClient = new MongoClient(url, options);
		const safeUrl: string = MongoUtils.hidePasswordFromURI(url);

		// See https://www.mongodb.com/community/forums/t/what-is-the-minimum-and-maximum-values-of-reconnecttries-and-reconnectinterval-of-mongodb-node-js-driver/155949
		// NOW we have to use serverSelectionTimeoutMS, socketTimeoutMS instead of reconnectTries and reconnectInterval

		mongoClient.on('open', () => {
			log.info(`Client connected to ${safeUrl}.`);
		});

		mongoClient.on('close', () => {
			log.info(`Client disconnected from ${safeUrl}.`);
		});

		mongoClient.on('timeout', () => {
			log.warn(`Client connection or operation timed out`);
		});

		mongoClient.on('connectionCreated', () => {
			log.warn(`Client connection created`);
		});

		mongoClient.on('serverClosed', () => {
			log.warn(`mongo server Closed`);
		});

		try {
			log.info(`Connecting to ${MongoUtils.hidePasswordFromURI(url)}...`);
			await mongoClient.connect();
			await mongoClient.db('admin').command({ ping: 1 });
			log.info(`Client connected to ${safeUrl}.`);
		} catch (err) {
			log.error(`Client failed to connect to ${safeUrl}.`);
			throw err;
		}

		global.dbClient = mongoClient;
		const db = mongoClient.db();
		global.db = db;

		return db;
	}

	public static async disconnect(): Promise<void> {
		if (!global.dbClient) return;
		const log = global.log.module('mongo');

		log.info(`Disconnecting from MongoDB...`);

		return await (global.dbClient as MongoClient).close();
	}

	public static isMongoId(id: string): boolean {
		return this.MONGO_ID_REGEXP.test(id);
	}

	public static oid(id: string | ObjectId): ObjectId | null {
		if (!id) return id as null;

		try {
			return new ObjectId(id);
		} catch (err) {
			if (typeof id === 'string' && !this.isMongoId(id)) {
				throw new N9Error('invalid-mongo-id', 400, { id });
			} else {
				throw err;
			}
		}
	}

	public static oids(ids: string[] | ObjectId[] | (string | ObjectId)[]): ObjectId[] | undefined {
		if (ids) {
			return (ids as any[]).map((id) => MongoUtils.oid(id));
		}
		return undefined;
	}

	public static mapObjectIdToStringHex(obj: any): any {
		for (const [key, value] of Object.entries(obj)) {
			if (value instanceof ObjectId) {
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
			obj instanceof ObjectId ||
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
			obj instanceof ObjectId ||
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
		filter?: Document,
		options?: {
			nameOnly?: boolean;
			batchSize?: number;
			readPreference?: ReadPreferenceMode;
			session?: ClientSession;
		},
	): ListCollectionsCursor {
		const opt: ListCollectionsOptions = {
			nameOnly: options?.nameOnly,
			batchSize: options?.batchSize,
			session: options?.session,
			readPreference: options.readPreference,
		};

		return (global.db as Db).listCollections(filter, opt);
	}

	public static async listCollectionsNames(filter?: Document): Promise<string[]> {
		const cursor: ListCollectionsCursor = MongoUtils.listCollections(filter, { nameOnly: true });
		const ret: string[] = [];

		for await (const item of cursor) {
			ret.push(item.name);
		}

		return ret;
	}
}
