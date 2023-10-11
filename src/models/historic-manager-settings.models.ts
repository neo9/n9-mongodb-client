import { N9Log } from '@neo9/n9-node-log';
import { Db } from 'mongodb';

export interface HistoricManagerSettings {
	/**
	 * Logger used to print messages
	 */
	logger: N9Log;

	/**
	 * Mongo Db object used to access the database.
	 * To get one, use MongoUtils.CONNECT()
	 */
	db: Db;
}
