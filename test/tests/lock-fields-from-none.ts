import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import { MongoClient } from '../../src';
import { BaseMongoObject } from '../../src/models';
import { init } from './fixtures/utils';

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

init(test);

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
