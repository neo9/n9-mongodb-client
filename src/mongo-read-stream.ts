import { N9Error } from '@neo9/n9-node-utils';
import * as _ from 'lodash';
import { Filter, FindCursor } from 'mongodb';
import { Readable, Writable } from 'stream';

import { MongoClient } from './client';
import { LangUtils } from './lang-utils';
import { LodashReplacerUtils } from './lodash-replacer.utils';
import { BaseMongoObject, ClassType } from './models';
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
	private lastItem: any;
	private cursor: FindCursor<Partial<U | L>> = null;
	private hasAlreadyAddedIdConditionOnce: boolean = false;
	private readonly _query: Filter<any>;

	constructor(
		private readonly mongoClient: MongoClient<U, L>,
		_query: Filter<any>,
		private readonly pageSize: number,
		private readonly projection: object = {},
		private readonly customType?: ClassType<Partial<U | L>>,
		private readonly hint?: string | object,
		private readonly sort: object = { _id: 1 },
		private limit?: number,
	) {
		super({ objectMode: true });
		try {
			// @ts-ignore-next-line
			if ((projection as Filter<BaseMongoObject>)._id === 0) {
				throw new N9Error('can-t-create-projection-without-_id', 400, { projection });
			}
			if (LodashReplacerUtils.IS_OBJECT_EMPTY(sort)) {
				throw new N9Error('sort-cannot-be-empty', 400, { sort });
			}
			this._query = { ..._query };
		} catch (err) {
			LangUtils.throwN9ErrorFromError(err, {
				pageSize,
				projection,
				customType,
				query: _query,
				sort,
				limit,
			});
		}
	}

	get query(): Filter<any> {
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
			if (this.limit === 0) {
				this.push(null);
				return;
			}
			if (!(this.cursor && (await this.cursor.hasNext()))) {
				if (this.lastItem) {
					this.updateQueryWithSortParams();
				}

				const limit = Math.min(this.pageSize, this.limit ?? this.pageSize);
				if (this.customType) {
					this.cursor = this.mongoClient.findWithType(
						this._query,
						this.customType,
						0,
						limit,
						this.sort,
						this.projection,
					);
				} else {
					this.cursor = this.mongoClient.find(this._query, 0, limit, this.sort, this.projection);
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
				this.lastItem = { ...LodashReplacerUtils.PICK_PROPERTIES(item, Object.keys(this.sort)) };
				if (this.limit) this.limit -= 1;
			}
			this.push(item);
		} catch (e) {
			this.emit('error', e);
		}
	}

	private updateQueryWithSortParams(): void {
		this._query.$and = this._query.$and ?? [];

		const andConditions: FilterQuery<any>[] = (this._query as any).$and;
		const sortConditions: FilterQuery<any>[] = [];
		const previousFields: string[] = [];

		for (const [field, sortType] of Object.entries(this.sort)) {
			const condition: FilterQuery<any> = {};

			if (previousFields.length > 0) {
				for (const previousField of previousFields) {
					condition[previousField] = this.getValueFromLastItem(previousField);
				}
			}

			const fieldValue = this.getValueFromLastItem(field);
			condition[field] = sortType === 1 ? { $gt: fieldValue } : { $lt: fieldValue };

			previousFields.push(field);
			sortConditions.push(condition);
		}

		const conditionsToAdd = sortConditions.length > 1 ? { $or: sortConditions } : sortConditions[0];
		if (this.hasAlreadyAddedIdConditionOnce) {
			andConditions[andConditions.length - 1] = conditionsToAdd;
		} else {
			andConditions.push(conditionsToAdd);
			this.hasAlreadyAddedIdConditionOnce = true;
		}
	}

	private getValueFromLastItem(field: string): any {
		let fieldValue = _.get(this.lastItem, field);
		if (typeof fieldValue === 'string' && MongoUtils.isMongoId(fieldValue)) {
			fieldValue = MongoUtils.oid(fieldValue);
		}

		return fieldValue;
	}
}
