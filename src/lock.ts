import { N9Error, waitFor } from '@neo9/n9-node-utils';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';

import { LangUtils } from './lang-utils';
import { LockOptions } from './models/lock-options.models';

export class N9MongoLock {
	private options: LockOptions;
	private defaultLock: string;
	private collection: string;
	private readonly waitDurationMsRandomPart: number;

	/**
	 *
	 * @param collection Collection name to use to save lock, default : n9MongoLock
	 * @param defaultLock : the default naem for this lock
	 * @param options : timeout default to 30s and removeExpired default to true to avoid duplication keys on expiring
	 */
	constructor(
		collection: string = 'n9MongoLock',
		defaultLock: string = 'default-lock',
		options?: LockOptions,
	) {
		this.defaultLock = defaultLock;
		this.collection = collection;
		this.options = _.defaultsDeep(options, {
			timeout: 30 * 1000,
			removeExpired: true,
			n9MongoLockOptions: {
				waitDurationMsMax: 100,
				waitDurationMsMin: 5,
			},
		});
		const db = global.db as mongodb.Db;
		if (!db) {
			throw new N9Error('missing-db', 500);
		}
		this.waitDurationMsRandomPart =
			this.options.n9MongoLockOptions.waitDurationMsMax -
			this.options.n9MongoLockOptions.waitDurationMsMin;
	}

	/**
	 * Function to call at the beginning
	 */
	public async ensureIndexes(): Promise<void> {
		const db = global.db as mongodb.Db;
		const indexes = [
			{
				name: 'name',
				key: {
					name: 1,
				},
				unique: true,
			},
		];
		try {
			return await db.collection(this.collection).createIndexes(indexes);
		} catch (error) {
			LangUtils.throwN9ErrorFromError(error, { indexes });
		}
	}

	/**
	 * Once you have a lock, you have a 30 second timeout until the lock is released. You can release it earlier by calling release
	 *
	 * @param suffix : a key to identify the specific lock
	 */
	public async acquire(suffix?: string): Promise<string | undefined> {
		const now = Date.now();
		const db = global.db as mongodb.Db;
		const lockName = suffix ? `${this.defaultLock}_${suffix}` : this.defaultLock;

		const query = {
			name: lockName,
			expire: { $lt: now },
		};
		const update = {
			$set: {
				name: `${lockName}:${now}`,
				expired: now,
			},
		};

		try {
			if (this.options.removeExpired) {
				await db.collection(this.collection).findOneAndDelete(query);
			} else {
				await db.collection(this.collection).findOneAndUpdate(query, update);
			}
			const code = crypto.randomBytes(16).toString('hex');
			const doc = {
				code,
				name: lockName,
				expire: now + this.options.timeout,
				inserted: now,
			};
			try {
				const docs: mongodb.InsertOneWriteOpResult<mongodb.WithId<{ code: string }>> = await db
					.collection(this.collection)
					.insertOne(doc);
				return docs.ops[0].code;
			} catch (error) {
				if (error.code === 11000) {
					return null;
				}
				LangUtils.throwN9ErrorFromError(error, { doc });
			}
		} catch (error) {
			LangUtils.throwN9ErrorFromError(error, { query, update });
		}
	}

	/**
	 * Acquire a lock after waiting max timeoutMs
	 *
	 * @param timeoutMs timeout in ms
	 * @param suffix : a key to identify the specific lock
	 */
	public async acquireBlockingUntilAvailable(timeoutMs: number, suffix?: string): Promise<string> {
		const startTime = Date.now();
		do {
			const code = await this.acquire(suffix);
			if (code) return code;
			await waitFor(
				this.options.n9MongoLockOptions.waitDurationMsMin +
					Math.random() * this.waitDurationMsRandomPart,
			);
		} while (Date.now() - startTime < timeoutMs);
	}

	/**
	 * Release the lock
	 *
	 * @param code the code of the lock to be released
	 * @param suffix a key to identify the specific lock
	 */
	public async release(code: string, suffix?: string): Promise<boolean> {
		const lockName = suffix ? `${this.defaultLock}_${suffix}` : this.defaultLock;
		const ret = await this.releaseLock(code, lockName);
		await waitFor(this.options.n9MongoLockOptions.waitDurationMsMax + 5);
		return ret;
	}

	private async releaseLock(code: string, lockName: string): Promise<boolean> {
		const now = Date.now();
		const db = global.db as mongodb.Db;
		const query = {
			code,
			expire: { $gt: now },
			expired: { $exists: false },
		};
		const update = {
			$set: {
				name: `${lockName}:${now}`,
				expired: now,
			},
		};

		try {
			const oldLock = this.options.removeExpired
				? await db.collection(this.collection).findOneAndDelete(query)
				: await db.collection(this.collection).findOneAndUpdate(query, update);
			if (
				(oldLock && Object.prototype.hasOwnProperty.call(oldLock, 'value') && !oldLock.value) ||
				!oldLock
			) {
				return false;
			}
			return true;
		} catch (error) {
			LangUtils.throwN9ErrorFromError(error, { query, update });
		}
	}
}
