import { Cursor } from 'mongodb';
import { Readable, Writable } from 'stream';
import { MongoClient } from './client';
import { MongoUtils } from './mongo-utils';
import { BaseMongoObject } from './models';

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

export class MongoReadStream<T extends BaseMongoObject, U extends BaseMongoObject> extends Readable {

	private lastId: string = null;
	private cursor: Cursor<U> = null;

	constructor(
			private mongoClient: MongoClient<T, U>,
			private query: object,
			private pageSize: number,
			private projection: object = {},
	) {
		super({ objectMode: true });
	}

	/**
	 * Call the given callback for each page in series
	 * Return a promise that is resolved when all the items have been consumed
	 */
	public async forEachPage(consumerFn: PageConsumer<U>): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.pipe(new PageConsumerWritable(this.pageSize, consumerFn))
					.on('error', reject)
					.on('finish', resolve);
		});
	}

	/**
	 * Call the given callback for each item in series
	 * Return a promise that is resolved when all the items have been consumed
	 */
	public async forEach(consumerFn: ItemConsumer<U>): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.pipe(new ItemConsumerWritable(consumerFn))
					.on('error', reject)
					.on('finish', resolve);
		});
	}

	public async _read(size: number): Promise<void> {
		if (!(this.cursor && await this.cursor.hasNext())) {
			if (this.lastId) {
				(this.query as any)['_id'] = { $gt: MongoUtils.oid(this.lastId) };
			}
			this.cursor = await this.mongoClient.find(this.query, 0, this.pageSize, { _id: 1 }, this.projection);
		}
		let item = null;
		if (await this.cursor.hasNext()) {
			item = await this.cursor.next();
		}
		if (item) {
			this.lastId = item._id;
		}
		this.push(item);
	}

}
