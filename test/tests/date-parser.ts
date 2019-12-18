import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import { Transform } from 'class-transformer';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';
import * as DateParser from '../../src/transformers/date-parser.transformer';

export class WithDateEntity extends BaseMongoObject {
	@Transform(DateParser.transform, { toClassOnly: true })
	public date: Date | string;
}

export class WithDateAndNoTransformerEntity extends BaseMongoObject {
	public date: Date | string;
}

global.log = new N9Log('tests').module('date-parser');

let mongod: MongoMemoryServer;

test.before(async () => {
	mongod = new MongoMemoryServer();
	const uri = await mongod.getConnectionString();
	await MongoUtils.connect(uri);
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
	await mongod.stop();
});

test('[DATE-PARSER] Insert&update entity with date', async (t: Assertions) => {
	const entity: WithDateEntity = {
		date: '2019-01-02',
	};

	const mongoClient = new MongoClient('test' + Date.now(), WithDateEntity, null);

	const createdEntity = await mongoClient.insertOne(entity, 'userId');

	t.true(_.isDate(createdEntity.date), 'date created is Date instance');
	t.is(createdEntity.date.constructor.name, 'Date', 'date has Date constructor');

	const entityFound = await mongoClient.findOne({});
	t.true(_.isDate(entityFound.date), 'date found is Date instance');
	t.is(entityFound.date.constructor.name, 'Date', 'date found has Date constructor');
});

test('[DATE-PARSER] Insert&update entity with date and no transformer', async (t: Assertions) => {
	const collectionName = 'test' + Date.now();
	const entity: WithDateAndNoTransformerEntity = {
		date: new Date('2019-01-02'),
	};

	const mongoClientOld = new MongoClient(collectionName, WithDateAndNoTransformerEntity, null);

	const createdEntity = await mongoClientOld.insertOne(entity, 'userId');

	t.true(_.isDate(createdEntity.date), 'date created is Date instance');
	t.is(createdEntity.date.constructor.name, 'Date', 'date has Date constructor');
	// t.false(_.isDate(createdEntity.date), 'date is not Date instance');
	// t.true(_.isString(createdEntity.date), 'date is string due to no tranformer');

	const mongoClientNew = new MongoClient(collectionName, WithDateEntity, null);
	const entityFound = await mongoClientNew.findOne({});
	t.true(_.isDate(entityFound.date), 'date found is Date instance');
	t.is(entityFound.date.constructor.name, 'Date', 'date found has Date constructor');
});
