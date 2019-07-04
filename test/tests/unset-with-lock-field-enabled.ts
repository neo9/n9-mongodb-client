import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

class SampleComplexType extends BaseMongoObject {
	public property?: {
		value?: string
	};
}

const getLockFieldsMongoClient = (keepHistoric: boolean = false) => {
	return new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {},
		keepHistoric,
	});
};

global.log = new N9Log('tests').module('lock-fields');

test.before(async () => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[LOCK-FIELDS] Update one field with value to null', async (t: Assertions) => {

	const mongoClient = getLockFieldsMongoClient();

	const locksDataSample: SampleComplexType = {
		property: {
			value: 'initial-value',
		},
	};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '', false);

	const entity = await mongoClient.findOneAndUpdateByIdWithLocks(insertedEntity._id, {
		property: {
			value: null,
		},
	}, 'TEST', false);

	t.deepEqual(entity.property, { value: null }, 'value is deleted');
});

test('[LOCK-FIELDS] Update multiple field with value to null', async (t: Assertions) => {

	const mongoClient = getLockFieldsMongoClient();

	const locksDataSample: SampleComplexType = {
		property: {
			value: 'initial-value',
		},
	};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '', false);

	const entities = await mongoClient.updateManyAtOnce([{
		_id: MongoUtils.oid(insertedEntity._id) as any,
		property: {
			value: null,
		},
	}], 'TEST', false, false, '_id');

	t.deepEqual((await entities.toArray())[0].property, { value: null }, 'value is deleted');
});
