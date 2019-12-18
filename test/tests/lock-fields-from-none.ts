import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

class SampleComplexType extends BaseMongoObject {
	public property?: {
		value?: string
	};
}

const getLockFieldsMongoClient = (keepHistoric: boolean = false) => {
	return new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {
			excludedFields: ['excludedField', 'excludedArray'],
			arrayWithReferences: {
				objects: 'code',
			},
		},
		keepHistoric,
	});
};

global.log = new N9Log('tests').module('lock-fields');

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

test('[LOCK-FIELDS] Update one from no value should be locked', async (t: Assertions) => {

	const mongoClient = getLockFieldsMongoClient();

	const locksDataSample = {};
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '');

	const entity = await mongoClient.findOneAndUpdateByIdWithLocks(insertedEntity._id, {
		property: {
			value: 'test'
		}
	}, 'TEST', true);

	t.true(!!entity.objectInfos.lockFields, 'is there some lock fields');
	t.deepEqual(_.map(entity.objectInfos.lockFields, 'path'), [
		'property.value',
	], 'lock field is present');
});
