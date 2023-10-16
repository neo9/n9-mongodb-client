import { N9Log } from '@neo9/n9-node-log';
import { N9Error } from '@neo9/n9-node-utils';
import { ClassTransformOptions, plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { ListCollectionsOptions } from 'mongodb';

import { PingSettings, ReadPreferenceOrMode } from './index';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { ClassType } from './models/class-type.models';
import { MongoUtilsOptions } from './models/mongo-utils-options.models';

export class MongoUtils {
	private static readonly mongoIdRegexp: RegExp = /^[0-9a-f]{24}$/;
	private static wasConnected: boolean = false;
	private static isHeartbeatKO: boolean = true;

	/**
	 *
	 * @param url
	 * @param connectOptions Options for connection, use nativeDriverOptions  Default heartbeatFrequencyMS at 3_000
	 */
	public static async CONNECT(
		url: string,
		connectOptions: MongoUtilsOptions = {},
	): Promise<{ db: mongodb.Db; mongodbClient: mongodb.MongoClient }> {
		let log: N9Log;
		if (connectOptions.logger) {
			log = connectOptions.logger.module('n9-mongodb-client').module('connect');
		} else {
			log = new N9Log('n9-mongodb-client').module('connect');
		}

		const optionsWithDefaultValuesApplied: mongodb.MongoClientOptions = {
			readPreference: 'primary', // https://www.mongodb.com/docs/manual/core/read-preference/
			heartbeatFrequencyMS: 3_000,
			driverInfo: {
				name: '@neo9/n9-mongodb-client',
			},
			...connectOptions.nativeDriverOptions,
		};

		const mongodbClient = new mongodb.MongoClient(url, optionsWithDefaultValuesApplied);
		const db = mongodbClient.db();
		const safeUrl = MongoUtils.HIDE_PASSWORD_FROM_URI(url);
		// See https://www.mongodb.com/community/forums/t/what-is-the-minimum-and-maximum-values-of-reconnecttries-and-reconnectinterval-of-mongodb-node-js-driver/155949
		// NOW we have to use serverSelectionTimeoutMS, socketTimeoutMS instead of reconnectTries and reconnectInterval

		mongodbClient.on('serverOpening', () => {
			log.info(`Connection to the mongodb server is being established...`);
		});
		mongodbClient.on('open', () => {
			log.info(`Client connected to ${safeUrl}.`);
		});
		mongodbClient.on('close', () => {
			this.isHeartbeatKO = true;
			log.info(`Client disconnected from ${safeUrl}.`);
		});
		mongodbClient.on('reconnect', () => {
			log.info(`Client reconnected to ${safeUrl}.`);
		});
		mongodbClient.on('timeout', () => {
			log.warn(`Client connection or operation timed out`);
		});
		mongodbClient.on('serverHeartbeatFailed', () => {
			this.isHeartbeatKO = true;
		});
		mongodbClient.on('serverHeartbeatSucceeded', () => {
			this.isHeartbeatKO = false;
		});

		mongodbClient.on('connectionCreated', () => {
			log.warn(`Client connection created`);
		});
		mongodbClient.on('topologyClosed', () => {
			this.isHeartbeatKO = true;
			log.warn(`Topology closed`);
		});
		mongodbClient.on(
			'topologyDescriptionChanged',
			(change: mongodb.TopologyDescriptionChangedEvent) => {
				log.warn(`Topology description changed`, {
					argString: JSON.stringify(change),
				});
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				this.PING({ logger: log, db });
			},
		);

		mongodbClient.on('serverClosed', () => {
			log.warn(`Mongo server closed`);
		});

		try {
			log.info(`Connecting to ${MongoUtils.HIDE_PASSWORD_FROM_URI(url)}...`);
			await mongodbClient.connect();
			await mongodbClient.db().admin().ping();
			log.info(`Client connected to ${safeUrl}.`);
		} catch (err) {
			log.error(`Client failed to connect to ${safeUrl}.`);
			throw err;
		}

		return {
			db,
			mongodbClient,
		};
	}

	/**
	 * Check if db is reachable. For now the n9-mongodb-client manage only one connection to MongoDB at a time.
	 */
	public static IS_CONNECTED(): boolean {
		return !this.isHeartbeatKO;
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

	public static async PING(pingSettings: PingSettings): Promise<boolean> {
		const start = Date.now();
		const log = pingSettings.logger.module('ping');
		try {
			if (!pingSettings.db) {
				log.warn(`Missing db for ping`);
				return false;
			}
			// serverSelectionTimeoutMS cannot be reduced for this request :
			// https://github.com/mongodb/specifications/blob/3ff380031d7f4295335f0d63585acf24c96f8d7b/source/server-selection/server-selection.rst#serverselectiontimeoutms
			const pingResponse: Partial<{ ok: 1 }> = await pingSettings.db.admin().ping();
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

	public static async DISCONNECT(mongodbClient: mongodb.MongoClient, logger: N9Log): Promise<void> {
		if (!mongodbClient) {
			logger.warn(`Trying to disconnect but native mongo client is not set.`);
			return;
		}

		const log = logger.module('mongo');
		log.info(`Disconnecting from MongoDB...`);
		await mongodbClient.close();
	}

	public static IS_MONGO_ID(id: string): boolean {
		return this.mongoIdRegexp.test(id);
	}

	public static TO_OBJECT_ID(id: string | mongodb.ObjectId): mongodb.ObjectId | null {
		if (!id) return id as null;
		try {
			return new mongodb.ObjectId(id);
		} catch (e) {
			if (typeof id === 'string' && !this.IS_MONGO_ID(id)) {
				throw new N9Error('invalid-mongo-id', 400, { id });
			} else {
				throw e;
			}
		}
	}

	public static TO_OBJECT_IDS(
		ids: string[] | mongodb.ObjectId[] | (string | mongodb.ObjectId)[],
	): mongodb.ObjectId[] | undefined {
		if (ids) {
			return (ids as any[]).map((id) => MongoUtils.TO_OBJECT_ID(id));
		}
		return undefined;
	}

	public static MAP_OBJECT_ID_TO_STRING_HEX(obj: any): any {
		for (const [key, value] of Object.entries(obj)) {
			if (value instanceof mongodb.ObjectId) {
				obj[key] = value.toHexString();
			} else if (value && typeof value === 'object') {
				MongoUtils.MAP_OBJECT_ID_TO_STRING_HEX(value);
			}
		}
		return obj;
	}

	public static MAP_OBJECT_TO_CLASS<T extends object, V>(
		cls: ClassType<T>,
		plain: V,
		options?: ClassTransformOptions,
	): T {
		if (!plain) return plain as any;

		const newPlain = MongoUtils.MAP_OBJECT_ID_TO_STRING_HEX(plain);
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
		return plainToClass(cls, newPlain, options) as T;
	}

	public static REMOVE_SPECIAL_CHARACTERS_IN_KEYS(obj: any): any {
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
			return obj.map((element) => this.REMOVE_SPECIAL_CHARACTERS_IN_KEYS(element));
		}
		for (const key of Object.keys(obj)) {
			if (obj[key] && typeof obj[key] === 'object') {
				obj[key] = this.REMOVE_SPECIAL_CHARACTERS_IN_KEYS(obj[key]);
			}
		}

		// eslint-disable-next-line no-param-reassign
		obj = _.mapKeys(obj, (val, key: string) => MongoUtils.ESCAPE_SPECIAL_CHARACTERS(key)) as any;
		return obj;
	}

	public static UN_REMOVE_SPECIAL_CHARACTERS_IN_KEYS(obj: any): any {
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
			return obj.map((element) => this.UN_REMOVE_SPECIAL_CHARACTERS_IN_KEYS(element));
		}
		for (const key of Object.keys(obj)) {
			if (obj[key] && typeof obj[key] === 'object') {
				obj[key] = this.UN_REMOVE_SPECIAL_CHARACTERS_IN_KEYS(obj[key]);
			}
		}

		// eslint-disable-next-line no-param-reassign
		obj = _.mapKeys(obj, (val, key: string) => MongoUtils.UNESCAPE_SPECIAL_CHARACTERS(key)) as any;
		return obj;
	}

	public static ESCAPE_SPECIAL_CHARACTERS(key: string): string {
		if (!key.includes('.') && !key.includes('$')) return key;

		return key.replace(/\$/g, '\\u0024').replace(/\./g, '\\u002e');
	}

	public static UNESCAPE_SPECIAL_CHARACTERS(key: string): string {
		return key.replace(/\\u0024/g, '$').replace(/\\u002e/g, '.');
	}

	public static HIDE_PASSWORD_FROM_URI(uri: string): string {
		if (!uri) return '';

		const regex = /(?<=:)([^@:]+)(?=@[^@]+$)/;

		return uri.replace(regex, '********');
	}

	public static LIST_COLLECTIONS(
		db: mongodb.Db,
		filter?: object,
		options?: {
			nameOnly?: boolean;
			batchSize?: number;
			readPreference?: ReadPreferenceOrMode;
			session?: mongodb.ClientSession;
		} & ListCollectionsOptions,
	): mongodb.ListCollectionsCursor {
		return db.listCollections(filter, options);
	}

	public static async LIST_COLLECTIONS_NAMES(
		db: mongodb.Db,
		filter?: object,
		options?: ListCollectionsOptions,
	): Promise<string[]> {
		const collections = MongoUtils.LIST_COLLECTIONS(db, filter, { ...options, nameOnly: true });
		const collectionNames: string[] = [];
		for await (const collection of collections) {
			collectionNames.push(collection.name);
		}
		return collectionNames;
	}
}
