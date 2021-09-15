import { N9Error } from '@neo9/n9-node-utils';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { LockOptions } from './models/lock-options.models';

/**
 * Wrapper of mongodb-lock
 * https://www.npmjs.com/package/mongodb-lock
 */
export class MongodbLock {
	private collection: string;
	private timeOut: number;
	private removeExpired: boolean;

	/**
	 *
	 * @param collection Collection name to use to save lock, default : n9MongoLock
	 * @param options : timeout default to 30s and removeExpired default to true to avoid duplication keys on expiring
	 */
	constructor(collection: string = 'n9MongoLock', options?: LockOptions) {
		this.collection = collection;
		this.timeOut = options.timeout;
		this.removeExpired = options.removeExpired;
		const db = global.db as mongodb.Db;
		if (!db) {
			throw new N9Error('missing-db', 500);
		}
	}

	public async ensureIndexes(): Promise<void> {
		const db = global.db as mongodb.Db;
		return new Promise<void>((resolve, reject) => {
			const indexes = [
				{
					name: 'name',
					key: {
						name: 1,
					},
					unique: true,
				},
			];
			db.collection(this.collection).createIndexes(
				indexes,
				// { unique : true },
				(err: any, result: any) => {
					if (err) return reject(err);
					return resolve(result);
				},
			);
		});
	}

	public acquireLock(callback: any, lockName: string): void {
		const now = Date.now();

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

		this.handleExpiredLocks(query, update, (err: any) => {
			if (err) return callback(err);
			// now, try and insert a new lock
			const code = crypto.randomBytes(16).toString('hex');
			const doc = {
				code,
				name: lockName,
				expire: now + this.timeOut,
				inserted: now,
			};
			const db = global.db as mongodb.Db;
			db.collection(this.collection).insertOne(doc, (error, docs) => {
				if (error) {
					if (error.code === 11000) {
						// there is currently a valid lock in the datastore
						return callback(null, null);
					}
					// don't know what this error is
					return callback(error);
				}
				callback(null, docs.ops ? docs.ops[0].code : docs[0].code);
			});
		});
	}

	public releaseLock(code: string, callback: any, lockName: string): void {
		const now = Date.now();

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

		this.handleExpiredLocks(query, update, (err: any, oldLock: any) => {
			if (err) return callback(err);

			if (oldLock && oldLock.hasOwnProperty('value') && !oldLock.value) {
				return callback(null, false);
			}

			if (!oldLock) {
				// there was nothing to unlock
				return callback(null, false);
			}

			// unlocked correctly
			return callback(null, true);
		});
	}

	private handleExpiredLocks(query: any, update: any, callback: any): void {
		const db = global.db as mongodb.Db;
		if (this.removeExpired) {
			db.collection(this.collection).findOneAndDelete(query, callback);
			return;
		}
		db.collection(this.collection).findOneAndUpdate(query, update, callback);
	}
}
