import { N9Error } from '@neo9/n9-node-utils';
import { Cursor, FilterQuery } from 'mongodb';
import { Readable, Writable } from 'stream';

import { MongoClient } from './client';
import { LangUtils } from './lang-utils';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { BaseMongoObject } from './models';
import { ClassType } from './models/class-type.models';
import { MongoUtils } from './mongo-utils';

export type PageConsumer<T> = ((data: T[]) => Promise<void>) | ((data: T[]) => void);
export type ItemConsumer<T> = ((data: T) => Promise<void>) | ((data: T) => void);

export class PageConsumerWritable<T> extends Writable {
	private buffer: T[] = [];

	constructor(private pageSize: number, private consumerFn: PageConsumer<T>) {
		super({ objectMode: true });
	}

	public async _write(
		chunk: T,
		encoding: string,
		callback?: (error?: any) => void,
	): Promise<boolean> {
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

	public async _write(
		chunk: T,
		encoding: string,
		callback?: (error?: any) => void,
	): Promise<boolean> {
		try {
			await this.consumerFn(chunk);
		} catch (err) {
			callback(err);
			return;
		}
		callback();
	}
}

export class MongoReadStream<
	U extends BaseMongoObject,
	L extends BaseMongoObject,
> extends Readable {
	private lastId: string = null;
	private cursor: Cursor<Partial<U | L>> = null;
	private hasAlreadyAddedIdConditionOnce: boolean = false;
	private readonly _query: FilterQuery<any>;

	constructor(
		private readonly mongoClient: MongoClient<U, L>,
		_query: FilterQuery<any>,
		private readonly pageSize: number,
		private readonly projection: object = {},
		private readonly customType?: ClassType<Partial<U | L>>,
		private readonly hint?: string | object,
	) {
		super({ objectMode: true });
		try {
			if ((projection as FilterQuery<BaseMongoObject>)._id === 0) {
				throw new N9Error('can-t-create-projection-without-_id', 400, { projection });
			}
			this._query = { ..._query };
		} catch (e) {
			LangUtils.throwN9ErrorFromError(e, { pageSize, projection, customType, query: _query });
		}
	}

	get query(): FilterQuery<any> {
		return LodashReplacerUtils.CLONE_DEEP(this._query);
	}

	/**
	 * Call the given callback for each page in series
	 * Return a promise that is resolved when all the items have been consumed
	 *
	 * @param consumerFn
	 */
	public async forEachPage(consumerFn: PageConsumer<Partial<U | L>>): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.on('error', reject)
				.pipe(new PageConsumerWritable(this.pageSize, consumerFn))
				.on('error', reject)
				.on('finish', resolve);
		});
	}

	/**
	 * Call the given callback for each item in series
	 * Return a promise that is resolved when all the items have been consumed
	 */
	public async forEach(consumerFn: ItemConsumer<Partial<U | L>>): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.on('error', reject)
				.pipe(new ItemConsumerWritable(consumerFn))
				.on('error', reject)
				.on('finish', resolve);
		});
	}

	/**
	 * Alias to foreach
	 */
	public async forEachAsync(consumerFn: ItemConsumer<Partial<U | L>>): Promise<void> {
		return await this.forEach(consumerFn);
	}

	public async _read(): Promise<void> {
		try {
			if (!(this.cursor && (await this.cursor.hasNext()))) {
				if (this.lastId) {
					this._query.$and = this._query.$and || [];
					const andConditions: FilterQuery<any>[] = (this._query as any).$and;
					// avoid to add multiple time the _id condition
					if (this.hasAlreadyAddedIdConditionOnce) {
						andConditions[andConditions.length - 1]._id.$gt = MongoUtils.oid(this.lastId);
					} else {
						andConditions.push({ _id: { $gt: MongoUtils.oid(this.lastId) as any } });
						this.hasAlreadyAddedIdConditionOnce = true;
					}
				}
				if (this.customType) {
					this.cursor = this.mongoClient.findWithType(
						this._query,
						this.customType,
						0,
						this.pageSize,
						{ _id: 1 },
						this.projection,
					);
				} else {
					this.cursor = this.mongoClient.find(
						this._query,
						0,
						this.pageSize,
						{ _id: 1 },
						this.projection,
					);
				}

				if (this.hint) {
					this.cursor = this.cursor.hint(this.hint);
				}
			}

			let item = null;
			if (await this.cursor.hasNext()) {
				item = await this.cursor.next();
			}
			if (item) {
				this.lastId = item._id;
			}
			this.push(item);
		} catch (e) {
			this.emit('error', e);
		}
	}
}
