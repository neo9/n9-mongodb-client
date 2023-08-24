/* eslint-disable @typescript-eslint/naming-convention */
import { N9Error } from '@neo9/n9-node-utils';
import { ClassTransformOptions, plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { ListCollectionsOptions } from 'mongodb';

import { ReadPreferenceOrMode } from './index';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { ClassType } from './models/class-type.models';

export class MongoUtils {
	private static readonly MONGO_ID_REGEXP: RegExp = /^[0-9a-f]{24}$/;
	private static wasConnected: boolean = false;
	private static isHeartbeatKO: boolean = true;

	public static async connect(
		url: string,
		options: mongodb.MongoClientOptions = {},
	): Promise<mongodb.Db> {
		const log = global.log.module('mongo');

		const mongoClient = new mongodb.MongoClient(url, options);
		const safeUrl = MongoUtils.hidePasswordFromURI(url);
		// See https://www.mongodb.com/community/forums/t/what-is-the-minimum-and-maximum-values-of-reconnecttries-and-reconnectinterval-of-mongodb-node-js-driver/155949
		// NOW we have to use serverSelectionTimeoutMS, socketTimeoutMS instead of reconnectTries and reconnectInterval

		mongoClient.on('serverOpening', () => {
			log.info(`Connection to the mongodb server is being established...`);
		});
		mongoClient.on('open', () => {
			log.info(`Client connected to ${safeUrl}.`);
		});
		mongoClient.on('close', () => {
			this.isHeartbeatKO = true;
			log.info(`Client disconnected from ${safeUrl}.`);
		});
		mongoClient.on('reconnect', () => {
			log.info(`Client reconnected to ${safeUrl}.`);
		});
		mongoClient.on('timeout', () => {
			log.warn(`Client connection or operation timed out`);
		});
		mongoClient.on('serverHeartbeatFailed', () => {
			this.isHeartbeatKO = true;
		});
		mongoClient.on('serverHeartbeatSucceeded', () => {
			this.isHeartbeatKO = false;
		});

		mongoClient.on('connectionCreated', () => {
			log.warn(`Client connection created`);
		});
		mongoClient.on('topologyClosed', () => {
			this.isHeartbeatKO = true;
			log.warn(`Topology closed`);
		});
		mongoClient.on(
			'topologyDescriptionChanged',
			(change: mongodb.TopologyDescriptionChangedEvent) => {
				log.warn(`Topology description changed`, {
					argString: JSON.stringify(change),
				});
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				this.ping();
			},
		);

		mongoClient.on('serverClosed', () => {
			log.warn(`Mongo server closed`);
		});

		try {
			log.info(`Connecting to ${MongoUtils.hidePasswordFromURI(url)}...`);
			await mongoClient.connect();
			await mongoClient.db().admin().ping();
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

	public static isConnected(): boolean {
		return !this.isHeartbeatKO;
		// const dbClient = global.dbClient as MongodbClient;
		// if (!dbClient) {
		// 	return false;
		// }
		// const log = global.log.module('mongo');
		// try {
		// 	if (!checkWritable) {
		// 		return this.isConnected;
		// 	}
		// 	// await dbClient.db().admin().serverStatus({
		// 	// 	retryWrites: false,
		// 	// 	willRetryWrite: false,
		// 	// 	readPreference: ReadPreference.PRIMARY,
		// 	// });
		// 	// inspired from : https://www.mongodb.com/docs/v6.0/reference/method/db.hello/#db.hello
		// 	const helloResponse = await dbClient.db().admin().command({ hello: 1 });
		// 	if (helloResponse) return true;
		// } catch (e) {
		// 	log.warn(`Mongo isConnected error ${e.message}`, { errString: JSON.stringify(e) });
		// 	return false;
		// }
	}

	public static async ping(): Promise<boolean> {
		const start = Date.now();
		const log = global.log.module('mongo');
		try {
			const dbClient: mongodb.MongoClient = global.dbClient;
			if (!dbClient) {
				log.warn(`Missing dbClient for ping`);
				return false;
			}
			// serverSelectionTimeoutMS cannot be reduced for this request :
			// https://github.com/mongodb/specifications/blob/3ff380031d7f4295335f0d63585acf24c96f8d7b/source/server-selection/server-selection.rst#serverselectiontimeoutms
			const pingResponse: Partial<{ ok: 1 }> = await dbClient.db().admin().ping();
			if (!this.wasConnected) {
				log.info(`Client reconnected to MongoDB`, { durationMs: Date.now() - start });
				this.wasConnected = true;
			}
			return pingResponse.ok === 1;
		} catch (e) {
			log.warn('Ping KO', { durationMs: Date.now() - start, errString: JSON.stringify(e) });
			this.wasConnected = false;
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

	public static async listCollectionsNames(
		filter?: object,
		options?: ListCollectionsOptions,
	): Promise<string[]> {
		const cursor = MongoUtils.listCollections(filter, { ...options, nameOnly: true });
		const ret: string[] = [];
		while (await cursor.hasNext()) {
			const item: any = await cursor.next();
			ret.push(item.name);
		}
		return ret;
	}
}
