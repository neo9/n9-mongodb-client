import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';

import { N9Error, waitFor } from '@neo9/n9-node-utils';
import { MongoClient as MongodbClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { BaseMongoObject, MongoClient, MongoUtils } from '../src';

global.log = new N9Log('tests');

ava('[Errors] Check error thrown on every client function', async (t: Assertions) => {
	const mongoMemoryServer = await MongoMemoryServer.create();
	await mongoMemoryServer.start();
	const uri = await mongoMemoryServer.getUri();

	await t.notThrowsAsync(mongoMemoryServer.ensureInstance(), 'ensure mongo is up');

	await MongoUtils.connect(uri, {
		maxIdleTimeMS: 100,
		connectTimeoutMS: 100,
		socketTimeoutMS: 100,
		waitQueueTimeoutMS: 100,
		wtimeout: 100,
		reconnectTries: 0,
	});

	const client = new MongoClient(`test-${Date.now()}`, BaseMongoObject, BaseMongoObject, {
		lockFields: {},
	});
	const client2 = new MongoClient(`test-${Date.now()}`, BaseMongoObject, BaseMongoObject, {});

	await t.throwsAsync(
		client.createIndex('$.test'),
		{
			instanceOf: N9Error,
			message: "Index key contains an illegal field name: field name starts with '$'.",
		},
		'createIndex error',
	);
	await t.throwsAsync(
		client.createUniqueIndex('$test'),
		{
			instanceOf: N9Error,
			message: "Index key contains an illegal field name: field name starts with '$'.",
		},
		'createUniqueIndex error',
	);
	await t.throwsAsync(
		client.createExpirationIndex(10, '$test'),
		{
			instanceOf: N9Error,
			message: "Index key contains an illegal field name: field name starts with '$'.",
		},
		'createExpirationIndex error',
	);
	await t.throwsAsync(
		client.createHistoricIndex('$test'),
		{
			instanceOf: N9Error,
			message: "Index key contains an illegal field name: field name starts with '$'.",
		},
		'createHistoricIndex error',
	);
	await t.throwsAsync(
		client.createHistoricUniqueIndex('$test'),
		{
			instanceOf: N9Error,
			message: "Index key contains an illegal field name: field name starts with '$'.",
		},
		'createHistoricUniqueIndex error',
	);
	await t.throwsAsync(
		client.createHistoricExpirationIndex(10, '$test'),
		{
			instanceOf: N9Error,
			message: "Index key contains an illegal field name: field name starts with '$'.",
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
	} catch (e) {
		error = e;
	}
	await t.is(error.status, 500, 'error status is translate to an HTTP status');
	await t.is(error.context.srcError.code, 2, 'error original status is still accessible');

	// STOP MONGO
	await client.dropCollection();
	await client2.dropCollection();
	while ((global.dbClient as MongodbClient).isConnected()) {
		await MongoUtils.disconnect();
		await waitFor(50);
	}
	await mongoMemoryServer.stop();

	await t.throwsAsync(
		client.dropIndex('test'),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'dropIndex error',
	);
	await t.throwsAsync(
		client.dropHistoryIndex('test'),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'dropHistoryIndex error',
	);
	await t.throwsAsync(
		client.insertOne({}, 'test'),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
		'insertOne error',
	);
	await t.throwsAsync(
		client.insertMany([{}], 'test'),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
		'insertMany error',
	);
	await t.throwsAsync(
		client.findOneById('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneById error',
	);
	await t.throwsAsync(
		client.findOneByKey('test'),
		{ instanceOf: N9Error, message: 'pool destroyed' },
		'findOneByKey error',
	);
	await t.throwsAsync(
		client.findOne({}),
		{ instanceOf: N9Error, message: 'pool destroyed' },
		'findOne error',
	);
	await t.throwsAsync(
		client.existsById('test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'existsById error',
	);
	await t.throwsAsync(
		client.existsByKey('test'),
		{ instanceOf: N9Error, message: 'pool destroyed' },
		'existsByKey error',
	);
	await t.throwsAsync(
		client.exists({}),
		{ instanceOf: N9Error, message: 'pool destroyed' },
		'exists error',
	);
	await t.throwsAsync(
		client.findOneAndUpdateById('test', {}, 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneAndUpdateById error',
	);
	await t.throwsAsync(
		client.findOneAndUpdateByKey('test', {}, 'test', undefined, true),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'findOneAndUpdateByKey error',
	);
	await t.throwsAsync(
		client.findOneAndUpdate({}, {}, 'test', true),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'findOneAndUpdate error',
	);
	await t.throwsAsync(
		client.findOneAndUpsert({}, {}, 'test', true),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'findOneAndUpsert error',
	);
	await t.throwsAsync(
		client.findOneByIdAndRemoveLock('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'findOneByIdAndRemoveLock error',
	);
	await t.throwsAsync(
		client.findOneByKeyAndRemoveLock('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'findOneByKeyAndRemoveLock error',
	);
	await t.throwsAsync(
		client.findOneAndRemoveLock({}, 'test', 'test'),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'findOneAndRemoveLock error',
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
		{ instanceOf: N9Error, message: 'pool destroyed' },
		'deleteOneByKey error',
	);
	await t.throwsAsync(
		client.deleteOne({}),
		{ instanceOf: N9Error, message: 'pool destroyed' },
		'deleteOne error',
	);
	await t.throwsAsync(
		client.deleteMany({}),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
		'deleteMany error',
	);
	await t.throwsAsync(
		client.updateManyAtOnce([{}], 'test'),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
		'updateManyAtOnce error',
	);
	await t.throwsAsync(
		client2.updateManyToSameValue({}, {}, 'test'),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
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
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'addTagToOne error',
	);
	await t.throwsAsync(
		client.addTagToOneById('test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'addTagToOneBy error',
	);
	await t.throwsAsync(
		client.addTagToMany({}, 'test'),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
		'addTagToMany error',
	);
	await t.throwsAsync(
		client.removeTagFromOne({}, 'test', 'test'),
		{ instanceOf: N9Error, message: 'topology was destroyed' },
		'removeTagFromOne error',
	);
	await t.throwsAsync(
		client.removeTagFromOneById('test', 'test', 'test'),
		{ instanceOf: N9Error, message: 'invalid-mongo-id' },
		'removeTagFromOneBy error',
	);
	await t.throwsAsync(
		client.removeTagFromMany({}, 'test', 'test'),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
		'removeTagFromMany error',
	);
	await t.throwsAsync(
		client.deleteManyWithTag('test'),
		{ instanceOf: N9Error, message: 'server instance pool was destroyed' },
		'deleteManyWithTag error',
	);
});
