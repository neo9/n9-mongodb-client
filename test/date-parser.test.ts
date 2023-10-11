import test, { ExecutionContext } from 'ava';
import { Transform } from 'class-transformer';
import _ from 'lodash';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import * as DateParser from '../src/transformers/date-parser.transformer';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

export class WithDateEntity extends BaseMongoObject {
	@Transform(DateParser.transform, { toClassOnly: true })
	public date: Date | string;
}

export class WithDateAndNoTransformerEntity extends BaseMongoObject {
	public date: Date | string;
}

init();

test('[DATE-PARSER] Insert&update entity with date', async (t: ExecutionContext<TestContext>) => {
	const entity: WithDateEntity = {
		date: '2019-01-02',
	};

	const mongoClient = new N9MongoDBClient(
		getOneCollectionName(),
		WithDateEntity,
		null,
		getBaseMongoClientSettings(t),
	);

	const createdEntity = await mongoClient.insertOne(entity, 'userId');

	t.true(_.isDate(createdEntity.date), 'date created is Date instance');
	t.is(createdEntity.date.constructor.name, 'Date', 'date has Date constructor');

	const entityFound = await mongoClient.findOne({});
	t.true(_.isDate(entityFound.date), 'date found is Date instance');
	t.is(entityFound.date.constructor.name, 'Date', 'date found has Date constructor');
});

test('[DATE-PARSER] Insert&update entity with date and no transformer', async (t: ExecutionContext<TestContext>) => {
	const collectionName = getOneCollectionName();
	const entity: WithDateAndNoTransformerEntity = {
		date: new Date('2019-01-02'),
	};

	const mongoClientOld = new N9MongoDBClient(
		collectionName,
		WithDateAndNoTransformerEntity,
		null,
		getBaseMongoClientSettings(t),
	);

	const createdEntity = await mongoClientOld.insertOne(entity, 'userId');

	t.true(_.isDate(createdEntity.date), 'date created is Date instance');
	t.is(createdEntity.date.constructor.name, 'Date', 'date has Date constructor');
	// t.false(_.isDate(createdEntity.date), 'date is not Date instance');
	// t.true(_.isString(createdEntity.date), 'date is string due to no tranformer');

	const mongoClientNew = new N9MongoDBClient(
		collectionName,
		WithDateEntity,
		null,
		getBaseMongoClientSettings(t),
	);
	const entityFound = await mongoClientNew.findOne({});
	t.true(_.isDate(entityFound.date), 'date found is Date instance');
	t.is(entityFound.date.constructor.name, 'Date', 'date found has Date constructor');
});
