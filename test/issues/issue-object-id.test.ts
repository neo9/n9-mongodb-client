import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as mongodb from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject } from '../../src/models';

global.log = new N9Log('tests').module('issues');

let mongod: MongoMemoryServer;

ava.before(async () => {
	mongod = await MongoMemoryServer.create();
	const uri = mongod.getUri();
	await MongoUtils.connect(uri);
});

ava.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
	await mongod.stop();
});

ava('[ISSUE-OBJECT-ID] Object ID should be well compared', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, BaseMongoObject, BaseMongoObject, {
		lockFields: {
			excludedFields: ['sku', 'externalReferences'],
			arrayWithReferences: {
				'attributes': 'attributeId',
				'links.bundle': 'productId',
				'links.upSell': 'productId',
				'links.crossSell': 'productId',
				'links.topping': 'productId',
			},
		},
	});

	const initialValue: any = {
		attributes: [
			{
				attributeId: '1',
				value: { 'fr-FR': 'description initiale', 'en-GB': 'english description' },
			},
			{
				attributeId: '2',
				value: 'coton',
			},
			{
				attributeId: '3',
				value: {},
			},
		],
		otherId: new mongodb.ObjectID('5cb7397c1a9299f144b71ac6'),
		label: {
			'fr-FR': 'produit à surcharger',
			'en-GB': 'english label',
			'en-IE': 'TEE-SHIRT CHILD',
			'es-ES': 'titre produit espagnol',
		},
	};

	const newValue: any = {
		attributes: [
			{
				attributeId: '1',
				value: { 'en-GB': 'english description', 'fr-FR': 'description initiale' },
			},
			{
				attributeId: '2',
				value: 'coton',
			},
			{
				attributeId: '3',
				value: {},
			},
			{
				attributeId: 'A',
				value: 'new value',
			},
		],
		otherId: new mongodb.ObjectID('5cb7397c1a9299f144b71ac6'),
		label: {
			'en-GB': 'english label',
			'fr-FR': 'produit surchargé',
		},
	};

	const savedObject = await mongoClient.insertOne(initialValue, 'userId1', false);

	const foundObject = await mongoClient.findOneById(savedObject._id);
	t.truthy(foundObject, 'found by query');

	const updatedObject = await mongoClient.findOneAndUpdateByIdWithLocks(
		savedObject._id,
		newValue,
		'userId2',
		true,
	);

	t.is<number, number>(updatedObject.objectInfos.lockFields.length, 2, '2 lock fields');
	await mongoClient.dropCollection();
});
