export interface MongoUtilsOptions {
	/**
	 * On getting a reconnect failed event, should we kill the current processs
	 *
	 * @default true
	 */
	killProcessOnReconnectFailed?: boolean;
}
