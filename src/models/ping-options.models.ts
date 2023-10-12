import { N9Log } from '@neo9/n9-node-log';
import * as mongodb from 'mongodb';

export interface PingSettings {
	logger: N9Log;
	db: mongodb.Db;
}
