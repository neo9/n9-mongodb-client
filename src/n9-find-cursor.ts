import { N9Error } from '@neo9/n9-node-utils';
import * as _ from 'lodash';
import {
	AbstractCursor,
	AbstractCursorEvents,
	AggregationCursor,
	CollationOptions,
	Collection,
	CommonEvents,
	CursorFlag,
	Document,
	ExplainVerbosityLike,
	Filter,
	FindCursor,
	FindOptions,
	GenericListener,
	Hint,
	Long,
	MongoDBNamespace,
	ReadConcern,
	ReadConcernLike,
	ReadPreference,
	ReadPreferenceLike,
	Sort,
	SortDirection,
} from 'mongodb';
import { Readable } from 'stream';

import { AggregationBuilder } from './aggregation-utils';

export class N9FindCursor<E> extends Readable implements FindCursor<E> {
	public constructor(
		private readonly collection: Collection<any>,
		private readonly cursor: FindCursor<E>,
		private filterQuery: Filter<E>, // can be edited with filter function
		private readonly options: Pick<FindOptions, 'collation'> = {},
	) {
		super({
			objectMode: true,
			highWaterMark: 1, // same as mongodb-native-client : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/abstract_cursor.ts#L339C19-L339C19
		});
	}

	public async count(): Promise<number> {
		// EstimatedCount or CountDocuments don't handle collation options.
		// It needs an aggregate function with the collation options to return a count value
		if (this.options.collation) {
			const cursor: AggregationCursor<Document> = this.collection.aggregate(
				new AggregationBuilder(this.collection.collectionName)
					.match(this.filterQuery)
					.group({ _id: '1', count: { $sum: 1 } })
					.build(),
				{ collation: this.options.collation },
			);
			return (await cursor.toArray())[0].count;
		}

		return await this.collection.countDocuments(this.filterQuery);
	}

	// //////////////////
	// Readable Overrides
	// //////////////////

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async _read(size: number): Promise<void> {
		try {
			this.pause();
			for (let i = 0; i < size; i += 1) {
				const next = await this.cursor.next();
				// avoid a promise call with .hasNext
				if (!_.isNil(next)) {
					this.push(next);
				} else {
					// push `null` for last item to trigger end event
					this.push(null);
					break;
				}
			}
			this.resume();
		} catch (e) {
			this.destroy(e);
		}
	}

	_destroy(error: Error | null, callback: (error?: Error | null) => void): void {
		this.cursor.stream()._destroy(error, callback);
		this.cursor.close().then(
			() => callback(error),
			(closeError) => callback(closeError),
		);
	}

	// Surcharge all function that return a findcursor and return a N9FindCursor instead to keep cascading available.
	// Src : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/find_cursor.ts

	/**
	 * @deprecated Use MongoClient.find parameter `sort` instead
	 */
	sort(sort: Sort | string, direction?: SortDirection): this {
		this.cursor.sort(sort, direction);
		return this;
	}

	async hasNext(): Promise<boolean> {
		return this.cursor.hasNext();
	}

	/**
	 * @deprecated Use MongoClient.find parameter `collation` instead
	 */
	collation(value: CollationOptions): this {
		this.cursor.collation(value);
		this.options.collation = value;
		return this;
	}

	/**
	 * @deprecated Use MongoClient.find parameter `page` and `pageSize` instead
	 */
	skip(value: number): this {
		this.cursor.skip(value);
		return this;
	}

	/**
	 * @deprecated Use MongoClient.find parameter `page` and `pageSize` instead
	 */
	limit(value: number): this {
		this.cursor.limit(value);
		return this;
	}

	/**
	 * @deprecated Use MongoClient.find parameter `project` instead
	 */
	project<T>(value: Document): N9FindCursor<T> {
		this.cursor.project(value);
		return this as any;
	}

	map<T>(transform: (doc: E) => T): N9FindCursor<T> {
		this.cursor.map(transform);
		return this as any;
	}

	addCursorFlag(flag: CursorFlag, value: boolean): this {
		this.cursor.addCursorFlag(flag, value);
		return this;
	}

	/**
	 * @deprecated Use specific cursor method instead
	 * https://www.mongodb.com/docs/v6.0/release-notes/6.0-compatibility/#removed-operators
	 * Not implemented
	 */
	addQueryModifier(name: string, value: string | boolean | number | Document): this {
		throw new N9Error('unsupported-function-addQueryModifier', 501, {
			argString: JSON.stringify({ name, value }),
		});
	}

	allowDiskUse(allow: boolean | undefined): this {
		this.cursor.allowDiskUse(allow);
		return this;
	}

	batchSize(value: number): this {
		this.cursor.batchSize(value);
		return this;
	}

	bufferedCount(): number {
		return this.cursor.bufferedCount();
	}

	clone(): N9FindCursor<E> {
		return new N9FindCursor<E>(
			this.collection,
			this.cursor.clone(),
			this.filterQuery,
			this.options,
		);
	}

	async close(): Promise<void> {
		await this.cursor.close();
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get closed(): boolean {
		return this.cursor.closed;
	}

	comment(value: string): this {
		this.cursor.comment(value);
		return this;
	}

	async explain(verbosity?: ExplainVerbosityLike | undefined): Promise<Document> {
		return this.cursor.explain(verbosity);
	}

	filter(filter: Filter<E>): this {
		this.cursor.filter(filter);
		this.filterQuery = filter;
		return this;
	}

	/**
	 * @deprecated Use for await ... of ... instead
	 */
	async forEach(iterator: (doc: any) => boolean | void): Promise<void> {
		return await this.cursor.forEach(iterator);
	}

	hint(hint: Hint): this {
		this.cursor.hint(hint);
		return this;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get id(): Long | undefined {
		return this.cursor.id;
	}

	/**
	 * @deprecated No use case found
	 * Not implemented
	 */
	// eslint-disable-next-line @typescript-eslint/member-ordering
	get killed(): boolean {
		throw new N9Error('unsupported-function-killed', 501);
	}

	/**
	 * @deprecated No use case found
	 * Not implemented
	 */
	// eslint-disable-next-line @typescript-eslint/member-ordering
	get loadBalanced(): boolean {
		throw new N9Error('unsupported-function-loadBalanced', 501);
	}

	maxAwaitTimeMS(value: number): this {
		this.cursor.maxAwaitTimeMS(value);
		return this;
	}

	maxTimeMS(value: number): this {
		this.cursor.maxTimeMS(value);
		return this;
	}

	/**
	 * @deprecated You may prefer the $lte operator for the query if possible
	 * Not implemented
	 */
	max(max: Document): this {
		throw new N9Error('unsupported-function-max', 501, { agrString: JSON.stringify({ max }) });
	}

	/**
	 * @deprecated You may prefer the $gte operator for the query if possible
	 * Not implemented
	 */
	min(min: Document): this {
		throw new N9Error('unsupported-function-min', 501, { agrString: JSON.stringify({ min }) });
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get namespace(): MongoDBNamespace {
		return this.cursor.namespace;
	}

	async next(): Promise<any> {
		return await this.cursor.next();
	}

	readBufferedDocuments(number?: number | undefined): any[] {
		return this.cursor.readBufferedDocuments(number);
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get readConcern(): ReadConcern | undefined {
		return this.cursor.readConcern;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get readPreference(): ReadPreference {
		return this.cursor.readPreference;
	}

	returnKey(value: boolean): this {
		this.cursor.returnKey(value);
		return this;
	}

	rewind(): void {
		this.cursor.rewind();
	}

	showRecordId(value: boolean): this {
		this.cursor.showRecordId(value);
		return this;
	}

	/**
	 * @deprecated You use directly the cursor as a ReadableStream
	 * Examples available in cursor.test.ts
	 * Not implemented
	 */
	stream(): Readable & AsyncIterable<any> {
		throw new N9Error('unsupported-function-stream', 501);
	}

	async toArray(): Promise<E[]> {
		return this.cursor.toArray();
	}

	async tryNext(): Promise<E> {
		return this.cursor.tryNext();
	}

	withReadConcern(readConcern: ReadConcernLike): this {
		this.cursor.withReadConcern(readConcern);
		return this;
	}

	withReadPreference(readPreference: ReadPreferenceLike): this {
		this.cursor.withReadPreference(readPreference);
		return this;
	}

	[Symbol.asyncIterator](): AsyncGenerator<E, void, void> {
		return this.cursor[Symbol.asyncIterator]();
	}

	addListener<EventKey extends keyof AbstractCursorEvents>(
		event: EventKey,
		listener: AbstractCursorEvents[EventKey],
	): this;
	// eslint-disable-next-line no-dupe-class-members
	addListener(
		event: CommonEvents,
		listener: (eventName: string | symbol, listener: GenericListener) => void,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	addListener(event: string | symbol, listener: GenericListener): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/unified-signatures
	addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	addListener(event, listener): this {
		// Source : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/abstract_cursor.ts#L128
		if (event === AbstractCursor.CLOSE) {
			this.cursor.on(event, listener);
		}
		super.addListener(event, listener);
		return this;
	}

	emit<EventKey extends keyof AbstractCursorEvents>(
		event: symbol | EventKey,
		...args: Parameters<AbstractCursorEvents[EventKey]>
	): boolean;
	// eslint-disable-next-line no-dupe-class-members
	emit(eventName: string | symbol, ...args: any[]): boolean;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef,@typescript-eslint/no-unused-vars
	emit(event, ...args: any[]): boolean {
		if (event === AbstractCursor.CLOSE) {
			return (this.cursor.emit as any)(event, ...args);
		}
		return super.emit(event, ...args);
	}

	eventNames(): string[];
	// eslint-disable-next-line no-dupe-class-members
	eventNames(): (string | symbol)[];
	// eslint-disable-next-line no-dupe-class-members
	eventNames(): string[] | (string | symbol)[] {
		return this.cursor.eventNames();
	}

	getMaxListeners(): number {
		return this.cursor.getMaxListeners();
	}

	listenerCount<EventKey extends keyof AbstractCursorEvents>(
		type: CommonEvents | symbol | string | EventKey,
	): number;
	// eslint-disable-next-line no-dupe-class-members
	listenerCount(eventName: string | symbol): number;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	listenerCount(type): number {
		return this.cursor.listenerCount(type);
	}

	listeners<EventKey extends keyof AbstractCursorEvents>(
		event: CommonEvents | symbol | string | EventKey,
	): AbstractCursorEvents[EventKey][];
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/ban-types
	listeners(eventName: string | symbol): Function[];
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	listeners(event): any {
		return this.cursor.listeners(event);
	}

	off<EventKey extends keyof AbstractCursorEvents>(
		event: EventKey,
		listener: AbstractCursorEvents[EventKey],
	): this;
	// eslint-disable-next-line no-dupe-class-members
	off(
		event: CommonEvents,
		listener: (eventName: string | symbol, listener: GenericListener) => void,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	off(event: string | symbol, listener: GenericListener): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/unified-signatures
	off(eventName: string | symbol, listener: (...args: any[]) => void): this;
	// istanbul ignore next
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	off(event, listener): this {
		this.cursor.off(event, listener);
		return this;
	}

	on<EventKey extends keyof AbstractCursorEvents>(
		event: EventKey,
		listener: AbstractCursorEvents[EventKey],
	): this;
	// eslint-disable-next-line no-dupe-class-members
	on(
		event: CommonEvents,
		listener: (eventName: string | symbol, listener: GenericListener) => void,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	on(event: string | symbol, listener: GenericListener): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/unified-signatures
	on(eventName: string | symbol, listener: (...args: any[]) => void): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	on(event, listener): this {
		// Source : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/abstract_cursor.ts#L128
		if (event === AbstractCursor.CLOSE) {
			this.cursor.on(event, listener);
		}
		super.on(event, listener);
		return this;
	}

	once<EventKey extends keyof AbstractCursorEvents>(
		event: EventKey,
		listener: AbstractCursorEvents[EventKey],
	): this;
	// eslint-disable-next-line no-dupe-class-members
	once(
		event: CommonEvents,
		listener: (eventName: string | symbol, listener: GenericListener) => void,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	once(event: string | symbol, listener: GenericListener): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/unified-signatures
	once(eventName: string | symbol, listener: (...args: any[]) => void): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	once(event, listener): this {
		// Source : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/abstract_cursor.ts#L128
		if (event === AbstractCursor.CLOSE) {
			this.cursor.once(event, listener);
		}
		super.once(event, listener);
		return this;
	}

	prependListener<EventKey extends keyof AbstractCursorEvents>(
		event: EventKey,
		listener: AbstractCursorEvents[EventKey],
	): this;
	// eslint-disable-next-line no-dupe-class-members
	prependListener(
		event: CommonEvents,
		listener: (eventName: string | symbol, listener: GenericListener) => void,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	prependListener(event: string | symbol, listener: GenericListener): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/unified-signatures
	prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
	// istanbul ignore next
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	prependListener(event, listener): this {
		// Source : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/abstract_cursor.ts#L128
		if (event === AbstractCursor.CLOSE) {
			this.cursor.prependListener(event, listener);
		}
		super.prependListener(event, listener);
		return this;
	}

	prependOnceListener<EventKey extends keyof AbstractCursorEvents>(
		event: EventKey,
		listener: AbstractCursorEvents[EventKey],
	): this;
	// eslint-disable-next-line no-dupe-class-members
	prependOnceListener(
		event: CommonEvents,
		listener: (eventName: string | symbol, listener: GenericListener) => void,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	prependOnceListener(event: string | symbol, listener: GenericListener): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/unified-signatures
	prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
	// istanbul ignore next
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	prependOnceListener(event, listener): this {
		// Source : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/abstract_cursor.ts#L128
		if (event === AbstractCursor.CLOSE) {
			this.cursor.prependOnceListener(event, listener);
		}
		super.prependOnceListener(event, listener);
		return this;
	}

	rawListeners<EventKey extends keyof AbstractCursorEvents>(
		event: CommonEvents | symbol | string | EventKey,
	): AbstractCursorEvents[EventKey][];
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/ban-types
	rawListeners(eventName: string | symbol): Function[];
	// istanbul ignore next
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	rawListeners(event): any {
		return super.rawListeners(event);
	}

	removeAllListeners<EventKey extends keyof AbstractCursorEvents>(
		event?: CommonEvents | symbol | string | EventKey,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	removeAllListeners(event?: string | symbol): this;
	// istanbul ignore next
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	removeAllListeners(event?): this {
		this.cursor.removeAllListeners(event);
		super.removeAllListeners(event);
		return this;
	}

	removeListener<EventKey extends keyof AbstractCursorEvents>(
		event: EventKey,
		listener: AbstractCursorEvents[EventKey],
	): this;
	// eslint-disable-next-line no-dupe-class-members
	removeListener(
		event: CommonEvents,
		listener: (eventName: string | symbol, listener: GenericListener) => void,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	removeListener(event: string | symbol, listener: GenericListener): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/unified-signatures
	removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
	// istanbul ignore next
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	removeListener(event, listener): this {
		this.cursor.removeListener(event, listener);
		super.removeListener(event, listener);
		return this;
	}

	setMaxListeners(n: number): this;
	// eslint-disable-next-line no-dupe-class-members
	setMaxListeners(n: number): this;
	// istanbul ignore next
	// eslint-disable-next-line no-dupe-class-members
	setMaxListeners(n: number): this {
		this.cursor.setMaxListeners(n);
		super.setMaxListeners(n);
		return this;
	}
}
