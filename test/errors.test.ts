import { N9Log } from '@neo9/n9-node-log';
import { N9Error, waitFor } from '@neo9/n9-node-utils';
import ava, { Assertions } from 'ava';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { BaseMongoObject, MongoClient, MongoUtils } from '../src';

global.log = new N9Log('tests');

ava('[Errors] Check error thrown on every client function', async (t: Assertions) => {
	const mongoMemoryServer = await MongoMemoryServer.create();
	const uri = mongoMemoryServer.getUri();

	await t.notThrowsAsync(mongoMemoryServer.ensureInstance(), 'ensure mongo is up');

	await MongoUtils.connect(uri, {
		// maxIdleTimeMS: 100,
		connectTimeoutMS: 100,
		socketTimeoutMS: 100,
		// waitQueueTimeoutMS: 100,
		// wtimeout: 100,
		// reconnectTries: 0,
	});

	const client = new MongoClient(`test-${Date.now()}`, BaseMongoObject, BaseMongoObject, {
		lockFields: {},
	});
	const client2 = new MongoClient(`test-${Date.now()}`, BaseMongoObject, BaseMongoObject, {});

	await t.throwsAsync(
		client.createIndex('$.test'),
		{
			instanceOf: N9Error,
			message:
				'Error in specification { name: "$.test_1", key: { $.test: 1 } } :: caused by :: Index key contains an illegal field name: field name starts with \'$\'.',
		},
		'createIndex error',
	);

	await t.throwsAsync(
		client.createUniqueIndex('$test'),
		{
			instanceOf: N9Error,
			message:
				'Error in specification { unique: true, name: "$test_1", key: { $test: 1 } } :: caused by :: Index key contains an illegal field name: field name starts with \'$\'.',
		},
		'createUniqueIndex error',
	);

	await t.throwsAsync(
		client.createExpirationIndex(10, '$test'),
		{
			instanceOf: N9Error,
			message:
				'Error in specification { expireAfterSeconds: 864000, name: "n9MongoClient_expiration", key: { $test: 1 } } :: caused by :: Index key contains an illegal field name: field name starts with \'$\'.',
		},
		'createExpirationIndex error',
	);

	await t.throwsAsync(
		client.createHistoricIndex('$test'),
		{
			instanceOf: N9Error,
			message:
				'Error in specification { name: "$test_1", key: { $test: 1 } } :: caused by :: Index key contains an illegal field name: field name starts with \'$\'.',
		},
		'createHistoricIndex error',
	);

	await t.throwsAsync(
		client.createHistoricUniqueIndex('$test'),
		{
			instanceOf: N9Error,
			message:
				'Error in specification { unique: true, name: "$test_1", key: { $test: 1 } } :: caused by :: Index key contains an illegal field name: field name starts with \'$\'.',
		},
		'createHistoricUniqueIndex error',
	);

	await t.throwsAsync(
		client.createHistoricExpirationIndex(10, '$test'),
		{
			instanceOf: N9Error,
			message:
				'Error in specification { expireAfterSeconds: 864000, name: "n9MongoClient_expiration", key: { $test: 1 } } :: caused by :: Index key contains an illegal field name: field name starts with \'$\'.',
		},
		'createHistoricExpirationIndex error',
	);

	await t.throwsAsync(
		client.count({ $or: {} }),
		{ instanceOf: N9Error, message: '$or must be an array' },
		'count error',
	);

	let error: N9Error;

	try {
		await client.count({ $or: {} });
	} catch (err) {
		error = err;
	}

	t.is(error.status, 500, 'error status is translate to an HTTP status');
	t.is(error.context.srcError.code, 2, 'error original status is still accessible');

	// STOP MONGO
	await client.dropCollection();
	await client2.dropCollection();
	await MongoUtils.disconnect();
	await waitFor(50);
	await mongoMemoryServer.stop();

	await t.throwsAsync(
		client.dropIndex('test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'dropIndex error',
	);

	await t.throwsAsync(
		client.dropHistoryIndex('test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'dropHistoryIndex error',
	);

	await t.throwsAsync(
		client.insertOne({}, 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'insertOne error',
	);

	await t.throwsAsync(
		client.insertMany([{}], 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'insertMany error',
	);

	await t.throwsAsync(
		client.findOneById('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneById error',
	);

	await t.throwsAsync(
		client.findOneByKey('test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOneByKey error',
	);

	await t.throwsAsync(
		client.findOne({}),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOne error',
	);

	await t.throwsAsync(
		client.existsById('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'existsById error',
	);

	await t.throwsAsync(
		client.existsByKey('test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'existsByKey error',
	);

	await t.throwsAsync(
		client.exists({}),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'exists error',
	);
	await t.throwsAsync(
		client.findOneAndUpdateById('test', {}, 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneAndUpdateById error',
	);

	await t.throwsAsync(
		client.findOneAndUpdateByKey('test', {}, 'test', undefined, true),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOneAndUpdateByKey error',
	);

	await t.throwsAsync(
		client.findOneAndUpdate({}, {}, 'test', true),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOneAndUpdate error',
	);

	await t.throwsAsync(
		client.findOneAndUpsert({}, {}, 'test', true),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOneAndUpsert error',
	);
	await t.throwsAsync(
		client.findOneByIdAndRemoveLock('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneByIdAndRemoveLock error',
	);

	await t.throwsAsync(
		client.findOneByKeyAndRemoveLock('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOneByKeyAndRemoveLock error',
	);

	await t.throwsAsync(
		client.findOneAndRemoveLock({}, 'test', 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOneAndRemoveLock error',
	);

	await t.throwsAsync(
		client.findOneByIdAndRemoveLockSubparts('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneByIdAndRemoveLock error',
	);

	await t.throwsAsync(
		client.findOneByKeyAndRemoveLockSubparts('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'findOneByKeyAndRemoveLock error',
	);

	await t.throwsAsync(
		client.findOneAndUpdateByIdWithLocks('test', {}, 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneAndUpdateBy error',
	);

	await t.throwsAsync(
		client.deleteOneById('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'deleteOneById error',
	);

	await t.throwsAsync(
		client.deleteOneByKey('test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'deleteOneByKey error',
	);

	await t.throwsAsync(
		client.deleteOne({}),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'deleteOne error',
	);

	await t.throwsAsync(
		client.deleteMany({}),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'deleteMany error',
	);

	await t.throwsAsync(
		client.updateManyAtOnce([{}], 'test'),
		{ instanceOf: N9Error, message: 'MongoClient must be connected to perform this operation' },
		'updateManyAtOnce error',
	);

	await t.throwsAsync(
		client2.updateManyToSameValue({}, {}, 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'updateManyToSameValue error',
	);

	await t.throwsAsync(
		client.findHistoricByEntityId('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findHistoricByEntityId error',
	);

	await t.throwsAsync(
		client.findOneHistoricByUserIdMostRecent('test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneHistoricByUserIdMostRecent error',
	);

	await t.throwsAsync(
		client.countHistoricByEntityId('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'countHistoricByEntityId error',
	);

	await t.throwsAsync(
		client.countHistoricSince('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'countHistoricSince error',
	);

	await t.throwsAsync(
		client.addTagToOne({}, 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'addTagToOne error',
	);

	await t.throwsAsync(
		client.addTagToOneById('test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'addTagToOneBy error',
	);

	await t.throwsAsync(
		client.addTagToMany({}, 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'addTagToMany error',
	);

	await t.throwsAsync(
		client.removeTagFromOne({}, 'test', 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'removeTagFromOne error',
	);

	await t.throwsAsync(
		client.removeTagFromOneById('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'removeTagFromOneBy error',
	);

	await t.throwsAsync(
		client.removeTagFromMany({}, 'test', 'test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'removeTagFromMany error',
	);

	await t.throwsAsync(
		client.deleteManyWithTag('test'),
		{ instanceOf: N9Error, message: 'Client must be connected before running operations' },
		'deleteManyWithTag error',
	);
});
