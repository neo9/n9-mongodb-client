import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import { Db } from 'mongodb';

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
	public property: {
		value: string
	};
	public objects: ArrayElement[];
	public strings: string[];
}

global.log = new N9Log('tests');

test.before(async (t) => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.beforeEach(async (t) => {
	global.log.info(`Start test >> ${t.title}`);
});

test.after(async (t) => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as Db).dropDatabase();
});

test('[CRUD] Insert one and find it', async (t: Assertions) => {
	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0);

	await mongoClient.insertOne({
		field1String: 'string1',
		field2Number: 1,
	}, 'userId1');

	const sizeWithElementIn = await mongoClient.count();
	const foundObject = await mongoClient.findOne({ field1String: 'string1' });
	t.true(sizeWithElementIn === 1);
	t.true(foundObject.field1String === 'string1');
	t.true(typeof foundObject._id === 'string');
	t.true(foundObject._id.constructor === String);

	await mongoClient.dropCollection();
});

test('[LOCK-FIELDS] Insert one and check locks', async (t: Assertions) => {
	const mongoClient = new MongoClient('test' + Date.now(), SampleComplexType, null, {
		lockFields: {
			excludedFields: ['excludedField'],
			arrayWithReferences: {
				objects: 'code',
			},
		},
	});

	const dataSample: SampleComplexType = {
		text: 'text sample',
		excludedField: 'not locked field',
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

	const insertedEntity = await mongoClient.insertOne(dataSample, '');

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
