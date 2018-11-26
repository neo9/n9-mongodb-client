import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';

import { MongoClient, MongoUtils } from '../src';
import { BaseMongoObject } from '../src/models';

class SampleTypeListing extends BaseMongoObject {
	public field1String: string;
}

class SampleType extends SampleTypeListing {
	public field2Number: number;
}

test('OK', async (t: Assertions) => {
	global.log = new N9Log('tests');
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');

	const mongoClient = new MongoClient('test-' + Date.now(), SampleType, SampleTypeListing);
	const size = await mongoClient.count();

	t.true(size === 0);

	await mongoClient.insertOne({
		field1String: 'string1',
		field2Number: 1,
	}, 'userId1');

	const size1 = await mongoClient.count();
	const foundObject = await mongoClient.findOne({ field1String: 'string1' });
	t.true(size1 === 1);
	t.true( foundObject.field1String === 'string1');
	t.true( typeof  foundObject._id === 'string');
	t.true( foundObject._id.constructor === String);

	await mongoClient.dropCollection();
});
