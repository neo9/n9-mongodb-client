import { N9Log } from '@neo9/n9-node-log';
import * as mongodb from 'mongodb';

export interface MongoUtilsOptions {
	logger?: N9Log;
	nativeDriverOptions?: mongodb.MongoClientOptions;
}
