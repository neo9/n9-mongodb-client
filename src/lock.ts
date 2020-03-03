import { N9Error, waitFor } from '@neo9/n9-node-utils';
import * as mongodb from 'mongodb';
import * as mongoDbLock from 'mongodb-lock';

/**
 * Wrapper of mongodb-lock
 * https://www.npmjs.com/package/mongodb-lock
 */
export class N9MongoLock {
	private lock: mongoDbLock.MongodbLock;

	/**
	 *
	 * @param collection Collection name to use to save lock, default : n9MongoLock
	 * @param lockName : a key to identify the lock
	 * @param options : timeout default to 30s and removeExpired default to true to avoid duplication keys on expiring
	 */
	constructor(
		collection: string = 'n9MongoLock',
		lockName: string = 'default-lock',
		options: mongoDbLock.LockOptions = { timeout: 30 * 1000, removeExpired: true },
	) {
		const db = global.db as mongodb.Db;
		if (!db) {
			throw new N9Error('missing-db', 500);
		}
		this.lock = mongoDbLock(db.collection(collection), lockName, options);
	}

	/**
	 * Function to call at the beginning
	 * https://github.com/chilts/mongodb-lock#mongodb-indexes
	 */
	public async ensureIndexes(): Promise<void> {
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
	 * @param waitDurationMs check timeout every waitDurationMs ms
	 */
	public async acquireBlockingUntilAvailable(
		timeoutMs: number,
		waitDurationMs: number = 100,
	): Promise<string> {
		const startTime = Date.now();
		do {
			const code = await this.acquire();
			if (code) return code;
			await waitFor(waitDurationMs);
		} while (Date.now() - startTime < timeoutMs);
	}

	/**
	 * Release the lock
	 */
	public async release(code: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this.lock.release(code, (err: any, ok: boolean) => {
				if (err) return reject(err);
				return resolve(ok);
			});
		});
	}
}
