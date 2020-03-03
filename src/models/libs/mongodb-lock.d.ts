declare module 'mongodb-lock' {
	import { Collection } from 'mongodb';

	namespace mongoDbLock {
		export interface LockOptions {
			timeout?: number;
			removeExpired?: boolean;
		}
		export declare class MongodbLock {
			public ensureIndexes(callback: (err: any, result: any) => void): void;
			public acquire(callback: (err: any, code?: string) => void): void;
			public release(code: string, callback: (err: any, ok: boolean) => void): void;
		}
	}

	function mongoDbLock(
		collection: Collection,
		lockName: string,
		options?: mongodbLock.LockOptions,
	): mongodbLock.MongodbLock;

	export = mongoDbLock;
}
