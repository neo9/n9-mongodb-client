import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';

import { BaseMongoObject, MongoUtils, N9MongoDBClient } from '../src';
import { ObjectId } from '../src/mongodb';
import {
	ArrayElement,
	getBaseMongoClientSettings,
	getOneCollectionName,
	init,
	TestContext,
} from './fixtures';

class SampleComplexType extends BaseMongoObject {
	public text: string;
	public property: {
		value: number;
	};
	public objectId: string;
	public objects: ArrayElement[];
	public objectIds: string[];
	public strings: string[];
	public date: Date;
	public dates: Date[];
}
const date = new Date();
const objectId = new ObjectId() as any as string;

const locksDataSample: SampleComplexType = {
	text: 'text sample',
	property: {
		value: 123456,
	},
	strings: ['a', undefined],
	objectId,
	objectIds: [objectId, objectId],
	objects: [
		{
			code: 'k1',
			value: undefined,
		},
		{
			code: 'k2',
			value: null,
		},
		{
			code: 'k3',
			value: 'v3',
		},
	],
	date,
	dates: [date, date],
};

init();

test("[LOCK-FIELDS-DISABLED] Insert one, update it and check undefined values don't change value or types", async (t: ExecutionContext<TestContext>) => {
	const collection = t.context.db.collection(getOneCollectionName());
	const mongoClient = new N9MongoDBClient(collection, SampleComplexType, SampleComplexType, {
		...getBaseMongoClientSettings(t),
		lockFields: {
			excludedFields: [
				// exclude all fields
				'text',
				'property.value',
				'objectId',
				'objects',
				'objectIds',
				'strings',
				'date',
				'dates',
			],
		},
	});

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '');
	const entity = await mongoClient.findOneById(insertedEntity._id);

	t.true(
		_.isEmpty(entity.objectInfos.lockFields),
		'no lock fields present because every one are excluded',
	);

	const expectedValueFromMongo = {
		text: 'text sample',
		property: {
			value: 123456,
		},
		date,
		dates: [date, date],
		objectId: objectId.toString(),
		objectIds: [objectId.toString(), objectId.toString()],
		strings: ['a'],
		objects: [
			{
				code: 'k1',
			},
			{
				code: 'k2',
				value: null,
			},
			{
				code: 'k3',
				value: 'v3',
			},
		],
	};
	const expectedValueFromMongoRaw = {
		text: 'text sample',
		property: {
			value: 123456,
		},
		date,
		dates: [date, date],
		objectId,
		objectIds: [objectId, objectId],
		strings: ['a'],
		objects: [
			{
				code: 'k1',
			},
			{
				code: 'k2',
				value: null,
			},
			{
				code: 'k3',
				value: 'v3',
			},
		],
	};
	t.deepEqual(
		_.omit(entity, ['_id', 'objectInfos']) as any,
		expectedValueFromMongo,
		'undefined fields are not kept and not replaced by null',
	);
	const document = await collection.findOne({ _id: MongoUtils.TO_OBJECT_ID(entity._id) });
	t.deepEqual(
		_.omit(document, ['_id', 'objectInfos']),
		expectedValueFromMongoRaw as any,
		'undefined fields are not kept and not replaced by null and types are ok',
	);

	const newValue: SampleComplexType = {
		text: undefined,
		property: {
			value: undefined,
		},
		strings: undefined,
		objectId: undefined,
		objectIds: undefined,
		objects: undefined,
		date: undefined,
		dates: undefined,
	};
	await mongoClient.findOneAndUpdateByIdWithLocks(entity._id, _.cloneDeep(newValue), '', false);

	const entityUpdated = await mongoClient.findOneById(entity._id);

	t.deepEqual(
		_.omit(entityUpdated, ['_id', 'objectInfos']),
		expectedValueFromMongo as any,
		'check after update nothing has changed',
	);

	// check values in mongodb
	const documentUpdated = await collection.findOne({ _id: MongoUtils.TO_OBJECT_ID(entity._id) });
	t.deepEqual(
		_.omit(documentUpdated, ['_id', 'objectInfos']),
		expectedValueFromMongoRaw as any,
		'check after update in mongodb nothing has changed',
	);

	const newValue2: any = {};
	await mongoClient.findOneAndUpdateByIdWithLocks(entity._id, _.cloneDeep(newValue2), '', false);

	const entityUpdated2 = await mongoClient.findOneById(entity._id);

	t.deepEqual(
		_.omit(entityUpdated2, ['_id', 'objectInfos']),
		expectedValueFromMongo as any,
		'check after update nothing has changed',
	);

	// check values in mongodb
	const documentUpdated2 = await collection.findOne({ _id: MongoUtils.TO_OBJECT_ID(entity._id) });
	t.deepEqual(
		_.omit(documentUpdated2, ['_id', 'objectInfos']),
		expectedValueFromMongoRaw as any,
		'check after update in mongodb nothing has changed',
	);
});
