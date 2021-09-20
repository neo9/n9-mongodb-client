import { N9Error, waitFor } from '@neo9/n9-node-utils';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { LangUtils } from '.';
import { LockOptions } from './models/lock-options.models';

export class N9MongoLock {
	private options: LockOptions;
	private defaultLock: string;
	private collection: string;
	private readonly waitDurationMsRandomPart: number;

	/**
	 *
	 * @param collection Collection name to use to save lock, default : n9MongoLock
	 * @param lockName : a key to identify the lock
	 * @param options : timeout default to 30s and removeExpired default to true to avoid duplication keys on expiring
	 */
	constructor(
		collection: string = 'n9MongoLock',
		lockName: string = 'default-lock',
		options?: LockOptions,
	) {
		this.defaultLock = lockName;
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
	 * @param lockName : a key to identify the lock
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
	 * @param lockName : a key to identify the lock
	 */
	public async acquire(suffix?: string): Promise<string | undefined> {
		const now = Date.now();
		const db = global.db as mongodb.Db;
		const lockName = suffix ? `${this.defaultLock}_${suffix}` : this.defaultLock;

		// firstly, expire any locks if they have timed out
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
				const docs = await db.collection(this.collection).insertOne(doc);
				return docs.ops ? docs.ops[0].code : docs[0].code;
			} catch (error) {
				if (error.code === 11000) {
					// there is currently a valid lock in the datastore
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
	 * @param timeoutMs timeout in ms
	 * @param lockName : a key to identify the lock
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
	 * @param lockName : a key to identify the lock
	 */
	public async release(code: string, suffix?: string): Promise<boolean> {
		const now = Date.now();
		const db = global.db as mongodb.Db;
		const lockName = suffix ? `${this.defaultLock}_${suffix}` : this.defaultLock;
		// expire this lock if it is still valid
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

			// Wait to let enough time to someone else to pick the lock
			await waitFor(this.options.n9MongoLockOptions.waitDurationMsMax + 5);
			if ((oldLock && oldLock.hasOwnProperty('value') && !oldLock.value) || !oldLock) {
				return false;
			}
			// unlocked correctly
			return true;
		} catch (error) {
			LangUtils.throwN9ErrorFromError(error, { query, update });
		}
	}
}
