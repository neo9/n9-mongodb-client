import * as mongoDbLock from 'mongodb-lock';

export class LockOptions implements mongoDbLock.LockOptions {
	public timeout?: number;
	public removeExpired?: boolean;
	public n9MongoLockOptions?: {
		/**
		 * Check timeout randomly computed between waitDurationMsMin and waitDurationMsMax ms
		 * to acquire the lock
		 */
		waitDurationMsMax?: number;
		/**
		 * Minimum wait duration between two checks to acquire the lock
		 */
		waitDurationMsMin?: number;
	};
}
