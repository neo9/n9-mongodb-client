import { N9Error } from '@neo9/n9-node-utils';
import * as _ from 'lodash';
import {
	AbstractCursor,
	AbstractCursorEvents,
	Collection,
	CommonEvents,
	CursorFlag,
	Document,
	GenericListener,
	Long,
	MongoDBNamespace,
	ReadConcern,
	ReadConcernLike,
	ReadPreference,
	ReadPreferenceLike,
} from 'mongodb';
import { Readable } from 'stream';

export abstract class N9AbstractCursor<E>
	extends Readable
	implements AbstractCursor<E>, AsyncIterable<E>
{
	protected constructor(
		protected readonly collection: Collection<any>,
		protected readonly cursor: AbstractCursor<E>,
	) {
		super({
			objectMode: true,
			highWaterMark: 1, // same as mongodb-native-client : https://github.com/mongodb/node-mongodb-native/blob/v5.7.0/src/cursor/abstract_cursor.ts#L339C19-L339C19
		});
	}

	abstract clone(): N9AbstractCursor<E>;

	// //////////////////
	// Readable Overrides
	// //////////////////

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
	// Src : https://github.com/mongodb/node-mongodb-native/blob/v6.0.0/src/cursor/find_cursor.ts

	async hasNext(): Promise<boolean> {
		return await this.cursor.hasNext();
	}

	map<T>(transform: (doc: E) => T): N9AbstractCursor<T> {
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
		throw new N9Error('unsupported-function-addQueryModifier', 501, { name, value });
	}

	batchSize(value: number): this {
		this.cursor.batchSize(value);
		return this;
	}

	bufferedCount(): number {
		return this.cursor.bufferedCount();
	}

	async close(): Promise<void> {
		await this.cursor.close();
	}

	// eslint-disable-next-line @typescript-eslint/member-ordering
	get closed(): boolean {
		return this.cursor.closed;
	}

	/**
	 * @deprecated Use for await ... of ... instead
	 */
	async forEach(iterator: (doc: any) => boolean | void): Promise<void> {
		return await this.cursor.forEach(iterator);
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

	maxTimeMS(value: number): this {
		this.cursor.maxTimeMS(value);
		return this;
	}

	/**
	 * @deprecated You may prefer the $lte operator for the query if possible
	 * Not implemented
	 */
	max(max: Document): this {
		throw new N9Error('unsupported-function-max', 501, { max });
	}

	/**
	 * @deprecated You may prefer the $gte operator for the query if possible
	 * Not implemented
	 */
	min(min: Document): this {
		throw new N9Error('unsupported-function-min', 501, { min });
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

	rewind(): void {
		this.cursor.rewind();
	}

	/**
	 * @deprecated You use directly the cursor as a ReadableStream
	 * Examples available in find-cursor.test.ts
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
