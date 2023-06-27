import {
	AbstractCursorEvents,
	AggregationCursor,
	CollationOptions,
	Collection,
	CommonEvents,
	CursorFlag,
	CursorStreamOptions,
	Document,
	ExplainVerbosityLike,
	Filter,
	FindCursor,
	FindOptions,
	GenericListener,
	Hint,
	Long,
	MongoClient,
	ReadConcern,
	ReadConcernLike,
	ReadPreference,
	ReadPreferenceLike,
	Sort,
	SortDirection,
} from 'mongodb';
import { next as nextCursor } from 'mongodb/lib/cursor/abstract_cursor.js';
import { MongoDBNamespace } from 'mongodb/lib/utils.js';
import { Readable } from 'stream';

import { AggregationBuilder } from './aggregation-utils';

export class N9FindCursor<U> extends Readable implements FindCursor<U> {
	private collection: Collection<any>;
	private readonly query: Filter<U>;
	private readonly _cursor: FindCursor<U>;
	private readonly options: FindOptions;
	private _readInProgress: boolean = false;

	public constructor(
		mongoClient: MongoClient,
		collection: Collection<any>,
		cursor: FindCursor,
		query: Filter<U>,
		options: FindOptions,
	) {
		super({
			objectMode: true,
			autoDestroy: false,
			highWaterMark: 1,
		});
		this._cursor = cursor;
		this.collection = collection;
		this.query = query;
		this.options = options;
	}

	/*
	 * Custom features
	 */
	public getNativeCursor(): FindCursor<U> {
		return this._cursor;
	}

	getFilter(): Filter<U> {
		return this.query;
	}

	public async count(): Promise<number> {
		// EstimatedCount or CountDocuments don't handle collation options.
		// It needs an aggregate function with the collation options to return a count value
		if (this.options?.collation) {
			const cursor: AggregationCursor<Document> = this.collection.aggregate(
				new AggregationBuilder(this.collection.collectionName)
					.match(this.query)
					.group({ _id: '1', count: { $sum: 1 } })
					.build(),
				{ collation: this.options.collation },
			);
			return (await cursor.toArray())[0].count;
		}

		return await this.collection.countDocuments(this.query);
	}

	/*
	 * Readable Overrides
	 */

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_read(size: number): void {
		if (!this._readInProgress) {
			this._readInProgress = true;
			this._readNext();
		}
	}

	_destroy(error: Error | null, callback: (error?: Error | null) => void): void {
		this._cursor.close().then(
			() => callback(error),
			(closeError) => callback(closeError),
		);
	}

	private _readNext(): void {
		// See replacing type "as any" to something else
		nextCursor(this._cursor as any, true, (err, result) => {
			if (err) {
				// NOTE: This is questionable, but we have a test backing the behavior. It seems the
				//       desired behavior is that a stream ends cleanly when a user explicitly closes
				//       a client during iteration. Alternatively, we could do the "right" thing and
				//       propagate the error message by removing this special case.
				if (err.message.match(/server is closed/)) {
					this._cursor.close().catch(() => null);
					return this.push(null);
				}

				// NOTE: This is also perhaps questionable. The rationale here is that these errors tend
				//       to be "operation was interrupted", where a cursor has been closed but there is an
				//       active getMore in-flight. This used to check if the cursor was killed but once
				//       that changed to happen in cleanup legitimate errors would not destroy the
				//       stream. There are change streams test specifically test these cases.
				if (err.message.match(/operation was interrupted/)) {
					return this.push(null);
				}

				// NOTE: The two above checks on the message of the error will cause a null to be pushed
				//       to the stream, thus closing the stream before the destroy call happens. This means
				//       that either of those error messages on a change stream will not get a proper
				//       'error' event to be emitted (the error passed to destroy). Change stream resumability
				//       relies on that error event to be emitted to create its new cursor and thus was not
				//       working on 4.4 servers because the error emitted on failover was "interrupted at
				//       shutdown" while on 5.0+ it is "The server is in quiesce mode and will shut down".
				//       See NODE-4475.
				return this.destroy(err);
			}

			// eslint-disable-next-line no-eq-null
			if (result == null) {
				this.push(null);
			} else if (this.destroyed) {
				this._cursor.close().catch(() => null);
			} else {
				if (this.push(result)) {
					return this._readNext();
				}

				this._readInProgress = false;
			}
		});
	}

	// TODO : Surcharge all function that return a findcursor and return a N9FindCursor instead to keep cascading available.
	sort(sort: Sort | string, direction?: SortDirection): this {
		this._cursor.sort(sort, direction);
		return this;
	}

	async hasNext(): Promise<boolean> {
		return this._cursor.hasNext();
	}

	collation(value: CollationOptions): this {
		this._cursor.collation(value);
		return this;
	}

	skip(value: number): this {
		this._cursor.skip(value);
		return this;
	}

	limit(value: number): this {
		this._cursor.limit(value);
		return this;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	project<T extends Document = Document>(value: Document): N9FindCursor<U> {
		this._cursor.project(value);
		return this;
	}

	map<T>(transform: (doc: any) => T): N9FindCursor<U> {
		this._cursor.map(transform);
		return this;
	}

	addCursorFlag(flag: CursorFlag, value: boolean): this {
		this._cursor.addCursorFlag(flag, value);
		return this;
	}

	addQueryModifier(name: string, value: string | boolean | number | Document): this {
		this._cursor.addQueryModifier(name, value);
		return this;
	}

	allowDiskUse(allow: boolean | undefined): this {
		this._cursor.allowDiskUse(allow);
		return this;
	}

	batchSize(value: number): this {
		this._cursor.batchSize(value);
		return this;
	}

	bufferedCount(): number {
		return this._cursor.bufferedCount();
	}

	clone(): FindCursor<any> {
		return this._cursor.clone();
	}

	async close(): Promise<void> {
		return this._cursor.close();
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get closed(): boolean {
		return this._cursor.closed;
	}

	comment(value: string): this {
		this._cursor.comment(value);
		return this;
	}

	async explain(verbosity: ExplainVerbosityLike | undefined): Promise<Document> {
		return this._cursor.explain(verbosity);
	}

	filter(filter: Document): this {
		this._cursor.filter(filter);
		return this;
	}

	async forEach(iterator: (doc: any) => boolean | void): Promise<void> {
		return this._cursor.forEach(iterator);
	}

	hint(hint: Hint): this {
		this._cursor.hint(hint);
		return this;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get id(): Long | undefined {
		return this._cursor.id;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get killed(): boolean {
		return this._cursor.killed;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get loadBalanced(): boolean {
		return this._cursor.loadBalanced;
	}

	max(max: Document): this {
		this._cursor.max(max);
		return this;
	}

	maxAwaitTimeMS(value: number): this {
		this._cursor.maxAwaitTimeMS(value);
		return this;
	}

	maxTimeMS(value: number): this {
		this._cursor.maxTimeMS(value);
		return this;
	}

	min(min: Document): this {
		this._cursor.min(min);
		return this;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get namespace(): MongoDBNamespace {
		return this._cursor.namespace;
	}

	async next(): Promise<any> {
		return this._cursor.next();
	}

	readBufferedDocuments(number: number | undefined): any[] {
		return this._cursor.readBufferedDocuments(number);
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get readConcern(): ReadConcern | undefined {
		return this._cursor.readConcern;
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get readPreference(): ReadPreference {
		return this._cursor.readPreference;
	}

	returnKey(value: boolean): this {
		this._cursor.returnKey(value);
		return this;
	}

	rewind(): void {
		this._cursor.rewind();
	}

	showRecordId(value: boolean): this {
		this._cursor.showRecordId(value);
		return this;
	}

	stream(options: CursorStreamOptions | undefined): Readable & AsyncIterable<any> {
		return this._cursor.stream(options);
	}

	async toArray(): Promise<any[]> {
		return this._cursor.toArray();
	}

	async tryNext(): Promise<any> {
		return this._cursor.tryNext();
	}

	withReadConcern(readConcern: ReadConcernLike): this {
		this._cursor.withReadConcern(readConcern);
		return this;
	}

	withReadPreference(readPreference: ReadPreferenceLike): this {
		this._cursor.withReadPreference(readPreference);
		return this;
	}

	[Symbol.asyncIterator](): AsyncGenerator<any, void, void> {
		return this._cursor[Symbol.asyncIterator]();
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
		this._cursor.addListener(event, listener);
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
		return this._cursor.emit(event, args);
	}

	eventNames(): string[];
	// eslint-disable-next-line no-dupe-class-members
	eventNames(): (string | symbol)[];
	// eslint-disable-next-line no-dupe-class-members
	eventNames(): string[] | (string | symbol)[] {
		return this._cursor.eventNames();
	}

	getMaxListeners(): number {
		return this._cursor.getMaxListeners();
	}

	listenerCount<EventKey extends keyof AbstractCursorEvents>(
		type: CommonEvents | symbol | string | EventKey,
	): number;
	// eslint-disable-next-line no-dupe-class-members
	listenerCount(eventName: string | symbol): number;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	listenerCount(type): number {
		return this._cursor.listenerCount(type);
	}

	listeners<EventKey extends keyof AbstractCursorEvents>(
		event: CommonEvents | symbol | string | EventKey,
	): AbstractCursorEvents[EventKey][];
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/ban-types
	listeners(eventName: string | symbol): Function[];
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	listeners(event): any {
		return this._cursor.listeners(event);
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
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	off(event, listener): this {
		this._cursor.off(event, listener);
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
		this._cursor.on(event, listener);
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
		this._cursor.once(event, listener);
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
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	prependListener(event, listener): this {
		this._cursor.prependListener(event, listener);
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
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	prependOnceListener(event, listener): this {
		this._cursor.prependOnceListener(event, listener);
		return this;
	}

	rawListeners<EventKey extends keyof AbstractCursorEvents>(
		event: CommonEvents | symbol | string | EventKey,
	): AbstractCursorEvents[EventKey][];
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/ban-types
	rawListeners(eventName: string | symbol): Function[];
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	rawListeners(event): any {
		return this._cursor.rawListeners(event);
	}

	removeAllListeners<EventKey extends keyof AbstractCursorEvents>(
		event?: CommonEvents | symbol | string | EventKey,
	): this;
	// eslint-disable-next-line no-dupe-class-members
	removeAllListeners(event?: string | symbol): this;
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	removeAllListeners(event?): this {
		this._cursor.removeAllListeners(event);
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
	// eslint-disable-next-line no-dupe-class-members,@typescript-eslint/typedef
	removeListener(event, listener): this {
		this._cursor.removeListener(event, listener);
		return this;
	}

	setMaxListeners(n: number): this;
	// eslint-disable-next-line no-dupe-class-members
	setMaxListeners(n: number): this;
	// eslint-disable-next-line no-dupe-class-members
	setMaxListeners(n: number): this {
		this._cursor.setMaxListeners(n);
		return this;
	}
}
