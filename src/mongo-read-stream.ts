import { Readable, Writable } from 'stream';
import { MongoClient } from './client';
import { MongoUtils } from './mongo-utils';
import { BaseMongoObject } from "./models";

export type PageConsumer<T> = (data: T[]) => Promise<void>;
export type ItemConsumer<T> = (data: T) => Promise<void>;

export class PageConsumerWritable<T> extends Writable {

	private buffer: T[] = [];

	constructor(
		private pageSize: number,
		private consumerFn: PageConsumer<T>) {
		super({ objectMode: true });
	}

	public async _write(chunk: T, encoding: string, callback?: (error?: any) => void): Promise<boolean> {
		try {
			this.buffer.push(chunk);
			if (this.buffer.length >= this.pageSize) {
				await this.consumerFn(this.buffer);
				this.buffer = [];
			}
		} catch (err) {
			callback(err);
			return;
		}
		callback();
	}

	public async _final(callback: (error?: Error | null) => void): Promise<void> {
		if (this.buffer.length) await this.consumerFn(this.buffer);
		callback();
	}
}

export class ItemConsumerWritable<T> extends Writable {
	constructor(private consumerFn: ItemConsumer<T>) {
		super({ objectMode: true });
	}

	public async _write(chunk: T, encoding: string, callback?: (error?: any) => void): Promise<boolean> {
		try {
			await this.consumerFn(chunk);
		} catch (err) {
			callback(err);
			return;
		}
		callback();
	}
}

/**
 * Readable stream that streams the content of a collection.
 * This stream implement pagination without using cursor.skip() but rather by using limit and a comparison
 * with _id. This behaviour has better performance when reading large collections.
 */
export class MongoReadStream<T extends BaseMongoObject, U extends BaseMongoObject> extends Readable {

	private first: boolean = true;
	private lastId: string = null;

	constructor(
		private mongoClient: MongoClient<T, U>,
		private query: object,
		private pageSize: number,
		private projection: object = {}) {
		super({ objectMode: true });
	}

	/**
	 * Call the given callback for each page in series
	 * Return a promise that is resolved when all the items have been consumed
	 */
	public async forEachPage(consumerFn: PageConsumer<U>): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.pipe(new PageConsumerWritable(this.pageSize, consumerFn))
				.on("error", reject)
				.on("finish", resolve);
		});
	}

	/**
	 * Call the given callback for each item in series
	 * Return a promise that is resolved when all the items have been consumed
	 */
	public async forEach(consumerFn: ItemConsumer<U>): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.pipe(new ItemConsumerWritable(consumerFn))
				.on("error", reject)
				.on("finish", resolve);
		});
	}

	public async _read(size: number): Promise<void> {
		this.pause();
		if (this.first) {
			this.first = false;
		} else {
			(this.query as any)['_id'] = { $gt: MongoUtils.oid(this.lastId) };
		}

		const cursor = await this.mongoClient.find(this.query, 0, this.pageSize, { _id: 1 }, this.projection);
		let resultLength = 0;
		let item = null;
		while (await cursor.hasNext()) {
			resultLength++;
			item = await cursor.next();
			if (item) this.push(item);
		}
		if (item != null) {
			this.lastId = item._id;
		}

		if (resultLength < this.pageSize) {
			this.push(null);
		}
		this.resume();
	}

}
