import { N9Error, waitFor } from '@neo9/n9-node-utils';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import * as mongoDbLock from 'mongodb-lock';
import { LockOptions } from './models/lock-options.models';

/**
 * Wrapper of mongodb-lock
 * https://www.npmjs.com/package/mongodb-lock
 */
export class N9MongoLock {
	private lock: mongoDbLock.MongodbLock;
	private options: LockOptions;
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
		this.lock = mongoDbLock(db.collection(collection), lockName, options);
	}

	/**
	 * Function to call at the beginning
	 * https://github.com/chilts/mongodb-lock#mongodb-indexes
	 */
	public async ensureIndexes() {
		return new Promise<void>((resolve, reject) => {
			this.lock.ensureIndexes((err: any, result: any) => {
				if (err) return reject(err);
				return resolve(result);
			});
		});
	}

	/**
	 * Once you have a lock, you have a 30 second timeout until the lock is released. You can release it earlier by calling release
	 */
	public async acquire(): Promise<string | undefined> {
		return new Promise<string>((resolve, reject) => {
			this.lock.acquire((err: any, code: string) => {
				if (err) return reject(err);
				return resolve(code);
			});
		});
	}

	/**
	 * Acquire a lock after waiting max timeoutMs
	 * @param timeoutMs timeout in ms
	 */
	public async acquireBlockingUntilAvailable(timeoutMs: number): Promise<string> {
		const startTime = Date.now();
		do {
			const code = await this.acquire();
			if (code) return code;
			await waitFor(
				this.options.n9MongoLockOptions.waitDurationMsMin +
					Math.random() * this.waitDurationMsRandomPart,
			);
		} while (Date.now() - startTime < timeoutMs);
	}

	/**
	 * Release the lock
	 */
	public async release(code: string): Promise<boolean> {
		const ret: boolean = await new Promise<boolean>((resolve, reject) => {
			this.lock.release(code, (err: any, ok: boolean) => {
				if (err) return reject(err);
				return resolve(ok);
			});
		});
		// Wait to let enough time to someone else to pick the lock
		await waitFor(this.options.n9MongoLockOptions.waitDurationMsMax + 5);

		return ret;
	}
}
