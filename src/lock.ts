import { N9Error, waitFor } from '@neo9/n9-node-utils';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { LockOptions } from './models/lock-options.models';
import { MongodbLock } from './mongodb-lock';

/**
 * Wrapper of mongodb-lock
 * https://www.npmjs.com/package/mongodb-lock
 */
export class N9MongoLock {
	private options: LockOptions;
	private defaultLock: string;
	private lock: MongodbLock;
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
		this.options = _.defaultsDeep(options, {
			timeout: 30 * 1000,
			removeExpired: true,
			n9MongoLockOptions: {
				waitDurationMsMax: 100,
				waitDurationMsMin: 5,
			},
		});
		this.lock = new MongodbLock(collection, this.options);
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
	 * https://github.com/chilts/mongodb-lock#mongodb-indexes
	 * @param lockName : a key to identify the lock
	 */
	public async ensureIndexes(): Promise<void> {
		return this.lock.ensureIndexes();
	}

	/**
	 * Once you have a lock, you have a 30 second timeout until the lock is released. You can release it earlier by calling release
	 * @param lockName : a key to identify the lock
	 */
	public async acquire(suffix?: string): Promise<string | undefined> {
		return new Promise<string>((resolve, reject) => {
			this.lock.acquireLock(
				(err: any, code: string) => {
					if (err) return reject(err);
					return resolve(code);
				},
				suffix ? `${this.defaultLock}_${suffix}` : this.defaultLock,
			);
		});
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
		const db = global.db as mongodb.Db;
		const ret: boolean = await new Promise<boolean>((resolve, reject) => {
			this.lock.releaseLock(
				code,
				(err: any, ok: boolean) => {
					if (err) return reject(err);
					return resolve(ok);
				},
				suffix ? `${this.defaultLock}_${suffix}` : this.defaultLock,
			);
		});
		// Wait to let enough time to someone else to pick the lock
		await waitFor(this.options.n9MongoLockOptions.waitDurationMsMax + 5);
		return ret;
	}
}
