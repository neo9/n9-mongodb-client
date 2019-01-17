import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
}

class ArrayElement {
	public code: string;
	public value: string;
}

class SampleComplexType extends BaseMongoObject {
	public text: string;
	public excludedField: string;
	public excludedArray?: string[];
	public property: {
		value: string
	};
	public objects: ArrayElement[];
	public strings: string[];
}

const locksDataSample: SampleComplexType = {
	text: 'text sample',
	excludedField: 'not locked field',
	excludedArray: ['excludeArrayValue1'],
	property: {
		value: 'v',
	},
	strings: ['a', 'b'],
	objects: [{
		code: 'k1',
		value: 'v1',
	}, {
		code: 'k2',
		value: 'v2',
	}, {
		code: 'k3',
		value: 'v3',
	}],
};

global.log = new N9Log('tests');

test.before(async (t) => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.beforeEach(async (t) => {
	global.log.info(`Start test >> ${t.title}`);
});

test.after(async (t) => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[CRUD] Insert one and find it', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0);

	const randomInt = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
	await mongoClient.insertOne({
		field1String: 'string1',
		field2Number: randomInt,
	}, 'userId1');

	const sizeWithElementIn = await mongoClient.count();
	const foundObject = await mongoClient.findOne({ field1String: 'string1' });
	const foundObjectById = await mongoClient.findOneById(foundObject._id);
	const foundObjectByKey = await mongoClient.findOneByKey('string1', 'field1String');

	t.truthy(foundObject, 'found by query');
	t.is(sizeWithElementIn, 1, 'nb element in collection');
	t.is(foundObject.field2Number, randomInt, 'found right element');
	t.is(typeof foundObject._id, 'string', 'ID is a string and not ObjectID');
	t.is(foundObject._id.constructor, String, 'ID is a string and not ObjectID');
	t.truthy(foundObjectById, 'found by ID');
	t.truthy(foundObjectByKey, 'found by key');

	await mongoClient.dropCollection();
});

test('[LOCK-FIELDS] Insert one and check locks', async (t: Assertions) => {
	const mongoClient = new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {
			excludedFields: ['excludedField', 'excludedArray'],
			arrayWithReferences: {
				objects: 'code',
			},
		},
	});

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '');

	const entity = await mongoClient.findOneById(insertedEntity._id);

	t.true(!_.isEmpty(entity.objectInfos.lockFields));
	t.deepEqual(_.map(entity.objectInfos.lockFields, 'path'), [
		'text',
		'property.value',
		'strings["a"]',
		'strings["b"]',
		'objects[code=k1]',
		'objects[code=k2]',
		'objects[code=k3]',
	]);
});

test('[LOCK-FIELDS] Insert&Update one and check locks', async (t: Assertions) => {
	const mongoClient = new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {
			excludedFields: ['excludedField', 'excludedArray'],
			arrayWithReferences: {
				objects: 'code',
			},
		},
	});

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '');
	const entity = await mongoClient.findOneById(insertedEntity._id);
	t.true(!_.isEmpty(entity.objectInfos.lockFields));

	const newValue: SampleComplexType = {
		text: 'new value',
		objects: [{
			code: 'k1',
			value: 'new value for k1',
		}, {
			code: 'kNew',
			value: 'new value for new key',
		}],
		strings: [
			'a',
			'c',
		],
		excludedField: 'new excluded fields value',
		excludedArray: ['excludeArrayValue1new'],
		property: {
			value: 'new proerty.value value',
		},
	};

	const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(insertedEntity._id, newValue, 'userId', true);

	t.is(updatedData.text, locksDataSample.text, 'text didn\'t change');
	t.is(updatedData.excludedField, newValue.excludedField, 'excludedField changed');
	t.is(_.get(updatedData, 'property.value'), locksDataSample.property.value, 'property.value changed');
	t.is(updatedData.excludedArray[0], newValue.excludedArray[0], 'excludedArray overrided');
	t.deepEqual(updatedData.objects, locksDataSample.objects.concat(newValue.objects), 'right object array');
	t.is(updatedData.strings.length, 3, 'strings array merged length');
	t.deepEqual(updatedData.strings, locksDataSample.strings.concat(newValue.strings), 'strings array merged values');
	t.is(updatedData.objectInfos.lockFields.length, 9, 'Number of lock fields');
});

test('[LOCK-FIELDS] Insert&update one without saving locks', async (t: Assertions) => {
	const mongoClient = new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {
			excludedFields: ['excludedField'],
			arrayWithReferences: {
				objects: 'code',
			},
		},
	});

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), 'userId', false);
	const entity = await mongoClient.findOneById(insertedEntity._id);
	t.true(_.isEmpty(entity.objectInfos.lockFields));

	const newValue: SampleComplexType = {
		text: 'new value',
		objects: [{
			code: 'k1',
			value: 'new value for k1',
		}, {
			code: 'kNew',
			value: 'new value for new key',
		}],
		strings: [
			'a',
			'c',
		],
		excludedField: 'new excluded fields value',
		property: {
			value: 'new proerty.value value',
		},
	};

	const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(insertedEntity._id, newValue, 'userId', true);

	t.is(updatedData.text, newValue.text, 'text changed');
	t.is(updatedData.excludedField, newValue.excludedField, 'excludedField changed');
	t.is(_.get(updatedData, 'property.value'), newValue.property.value, 'property.value changed');
	t.deepEqual(updatedData.objects, newValue.objects, 'right object array');
	t.is(updatedData.strings.length, 2, 'strings array merged length');
	t.deepEqual(updatedData.strings, newValue.strings, 'strings array merged values');
	t.is(updatedData.objectInfos.lockFields.length, 6, 'Number of lock fields');
});

test('[LOCK-FIELDS] Forbide usage of some methods', async (t: Assertions) => {
	const mongoClient = new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {},
	});

	await t.throwsAsync(async () => {
		await mongoClient.findOneAndUpdateById('', {}, 'userId');
	});
	await t.throwsAsync(async () => {
		await mongoClient.findOneAndUpdateByKey('', {}, 'userId');
	});
	await t.throwsAsync(async () => {
		await mongoClient.findOneAndUpdate({}, {}, 'userId');
	});
});

test('[LOCK-FIELDS] Update many with locks', async (t: Assertions) => {
	const mongoClient = new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {
			excludedFields: ['excludedField'],
			arrayWithReferences: {
				objects: 'code',
			},
		},
	});

	const locksDataSample1: SampleComplexType = {
		...locksDataSample,
		text: 'id1',
		excludedField: 'new ecludedFieldValue',
	};
	const locksDataSample2: SampleComplexType = {
		...locksDataSample1,
		text: 'id2',
	};
	await mongoClient.insertOne(_.cloneDeep(locksDataSample1), 'userId', true);
	await mongoClient.insertOne(_.cloneDeep(locksDataSample2), 'userId', true);

	const newValues: Partial<SampleComplexType>[] = [{
		text: 'id1',
		property: {
			value: 'new value 1',
		},
	}, {
		text: 'id2',
		property: {
			value: 'new value 2',
		},
	}];

	await mongoClient.updateManyAtOnce(newValues, 'userId', false, true, 'text');
	const listing: Partial<SampleComplexType>[] = await (await mongoClient.find({}, 0, 0)).toArray();

	t.is(listing.length, 2, 'found 2 elements');
	for (const i of listing) {
		_.unset(i, '_id');
		_.unset(i, 'text');
		_.unset(i, 'objectInfos.creation.date');
		for (const lockField of i.objectInfos.lockFields) {
			_.unset(lockField, 'metaDatas.date');
		}
	}
	t.deepEqual(listing[0], listing[1]);
	t.is(listing[0].property.value, locksDataSample.property.value);
	t.is(listing[0].excludedField, locksDataSample1.excludedField);
});
