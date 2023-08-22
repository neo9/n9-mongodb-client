import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import * as _ from 'lodash';

import { MongoClient, MongoClientConfiguration, ObjectID } from '../src';
import { BaseMongoObject, EntityHistoric, StringMap } from '../src/models';
import { init } from './fixtures/utils';

export class AttributeEntity extends BaseMongoObject {
	public type: 'select';
	public code: string;
	public label: StringMap<string>;

	/**
	 * items of { code, label } for select or multi_select
	 */
	public parameters: StringMap<any>;
	public validations: StringMap<any>;

	public isPublic: boolean;
	public isEditable: boolean;
	public isLocalSpecific: boolean;
	public isVariable: boolean;
	public toSync?: boolean;

	public defaultLanguageCode?: string;
}

class ObjectElement {
	public code: string;
	public value: string;
}

class SampleComplexType extends BaseMongoObject {
	public text?: string;
	public excludedField?: string;
	public excludedArray?: string[];
	public property?: {
		value: string;
	};
	public objects?: ObjectElement[];
	public strings?: string[];
	public stringMap?: StringMap<ObjectElement>;
}

class ObjectWithArray extends BaseMongoObject {
	public parameters: {
		items: {
			code: string;
			label?: StringMap<string>;
		}[];
	};
}

class ObjectWithDateProperty extends BaseMongoObject {
	public code: string;
	public props: {
		date: Date;
	};
}

const locksDataSample: SampleComplexType = {
	text: 'text sample',
	excludedField: 'not locked field',
	excludedArray: ['excludeArrayValue1'],
	property: {
		value: 'v',
	},
	strings: ['a', 'b'],
	objects: [
		{
			code: 'k1',
			value: 'v1',
		},
		{
			code: 'k2',
			value: 'v2',
		},
		{
			code: 'k3',
			value: 'v3',
		},
	],
};

const getLockFieldsMongoClient = (
	keepHistoric: boolean = false,
	withArrayReferences: boolean = true,
	excludedFieldsRegex?: RegExp[],
): MongoClient<SampleComplexType, SampleComplexType> => {
	const conf: MongoClientConfiguration = {
		keepHistoric,
		lockFields: {
			excludedFields: ['excludedField', 'excludedArray'],
		},
	};
	if (withArrayReferences) {
		conf.lockFields.arrayWithReferences = {
			objects: 'code',
		};
	}
	if (excludedFieldsRegex) {
		conf.lockFields.excludedFields = conf.lockFields.excludedFields.concat(excludedFieldsRegex);
	}
	return new MongoClient(`test-${Date.now()}`, SampleComplexType, SampleComplexType, conf);
};

global.log = new N9Log('tests').module('lock-fields');

init();

ava('[LOCK-FIELDS] Insert one and check locks', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

	const lockDataEntity: SampleComplexType = {
		...locksDataSample,
		stringMap: {
			abcd0f: {
				code: 'val-1',
				value: 'value1',
			},
		},
	};

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(lockDataEntity), '');

	const entity = await mongoClient.findOneById(insertedEntity._id);

	t.true(!_.isEmpty(entity.objectInfos.lockFields), 'is there some lock fields');
	t.deepEqual(
		_.map(entity.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k2].value',
			'objects[code=k3].value',
			'stringMap.abcd0f.code',
			'stringMap.abcd0f.value',
		],
		'all lock fields are present',
	);
	t.deepEqual(
		insertedEntity.objectInfos.lockFields,
		entity.objectInfos.lockFields,
		'inserted value is same as saved one',
	);
});

ava('[LOCK-FIELDS] Insert one and check locks with regex excluded field', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient(false, true, [
		/^objects\[code=k2\]/,
		/^stringMap\.[0-9a-f]{6}\.((?!value))/,
	]);

	const lockDataEntity: SampleComplexType = {
		...locksDataSample,
		stringMap: {
			abcd0f: {
				code: 'val-1',
				value: 'value1',
			},
			bdc31e: {
				code: 'val-2',
				value: 'value2',
			},
		},
	};

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(lockDataEntity), '');

	const entity = await mongoClient.findOneById(insertedEntity._id);

	t.true(!_.isEmpty(entity.objectInfos.lockFields), 'is there some lock fields');
	t.deepEqual(
		_.map(entity.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k3].value',
			'stringMap.abcd0f.value',
			'stringMap.bdc31e.value',
		],
		'all lock fields are present',
	);
	t.deepEqual(
		insertedEntity.objectInfos.lockFields,
		entity.objectInfos.lockFields,
		'inserted value is same as saved one',
	);
});

ava(
	'[LOCK-FIELDS] Insert&Update one with mongoID and Date and check locks',
	async (t: Assertions) => {
		const mongoClient = getLockFieldsMongoClient();
		const date = new Date('2020-01-01');
		const newDate = new Date('2020-01-01');

		const dataWithDate = {
			..._.cloneDeep(locksDataSample),
			date,
			id: new ObjectID(),
		};
		const dataWithNewDate = {
			..._.cloneDeep(dataWithDate),
			date: newDate,
		};

		const insertedEntity = await mongoClient.insertOne(dataWithDate, '');

		const entity = await mongoClient.findOneById(insertedEntity._id);

		t.true(!_.isEmpty(entity.objectInfos.lockFields), 'is there some lock fields');
		t.deepEqual(
			_.map(entity.objectInfos.lockFields, 'path'),
			[
				'text',
				'property.value',
				'strings["a"]',
				'strings["b"]',
				'objects[code=k1].value',
				'objects[code=k2].value',
				'objects[code=k3].value',
				'date',
				'id',
			],
			'all lock fields are present',
		);

		const newEntity = await mongoClient.findOneByIdAndRemoveLock(
			insertedEntity._id,
			'date',
			'userId',
		);

		t.is(newEntity.objectInfos.lockFields.length, 8, 'Number of lock fields');
		t.deepEqual(
			_.map(newEntity.objectInfos.lockFields, 'path'),
			[
				'text',
				'property.value',
				'strings["a"]',
				'strings["b"]',
				'objects[code=k1].value',
				'objects[code=k2].value',
				'objects[code=k3].value',
				'id',
			],
			'date lock fields has been removed',
		);

		const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(
			insertedEntity._id,
			_.cloneDeep(dataWithNewDate),
			'userId',
			true,
			true,
		);

		t.is(updatedData.objectInfos.lockFields.length, 8, 'Number of lock fields');
		t.deepEqual(
			_.map(updatedData.objectInfos.lockFields, 'path'),
			[
				'text',
				'property.value',
				'strings["a"]',
				'strings["b"]',
				'objects[code=k1].value',
				'objects[code=k2].value',
				'objects[code=k3].value',
				'id',
			],
			"date hasn't changed, so no new lock field has been added",
		);
	},
);

ava('[LOCK-FIELDS] Insert&Update one with simple array', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient(false, false);

	const data = {
		strings: ['a', 'b'],
	};
	const dataNew = {
		strings: ['a', 'b', 'c'],
	};

	const insertedEntity = await mongoClient.insertOne(data, '');

	const entity = await mongoClient.findOneById(insertedEntity._id);

	t.true(!_.isEmpty(entity.objectInfos.lockFields), 'is there some lock fields');
	t.deepEqual(
		_.map(entity.objectInfos.lockFields, 'path'),
		['strings["a"]', 'strings["b"]'],
		'all lock fields are present',
	);

	const newEntity = await mongoClient.findOneByIdAndRemoveLock(
		insertedEntity._id,
		'date',
		'userId',
	);

	t.is(newEntity.objectInfos.lockFields.length, 2, 'Number of lock fields');
	t.deepEqual(
		_.map(newEntity.objectInfos.lockFields, 'path'),
		['strings["a"]', 'strings["b"]'],
		'date lock fields has been removed',
	);

	const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		_.cloneDeep(dataNew),
		'userId',
		false,
		false,
	);

	t.is(updatedData.objectInfos.lockFields.length, 2, "Number of lock fields don't change");
	t.deepEqual(
		_.map(updatedData.objectInfos.lockFields, 'path'),
		['strings["a"]', 'strings["b"]'], // c is not locked
		'new c value is added',
	);
	t.deepEqual(updatedData.strings, ['a', 'b', 'c'], 'c is stored');
});

ava('[LOCK-FIELDS] Insert&Update one with Date and change to String', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();
	const date = new Date('2020-01-01');
	const dateString = date.toUTCString();

	const dataWithDate = {
		..._.cloneDeep(locksDataSample),
		date,
	};

	const dataWithString = {
		..._.cloneDeep(locksDataSample),
		id: new ObjectID(),
		date: dateString,
	};
	const insertedEntity = await mongoClient.insertOne(dataWithString, '');

	const entity = await mongoClient.findOneById(insertedEntity._id);

	t.true(!_.isEmpty(entity.objectInfos.lockFields), 'is there some lock fields');
	t.deepEqual(
		_.map(entity.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k2].value',
			'objects[code=k3].value',
			'id',
			'date',
		],
		'all lock fields are present',
	);

	const newEntity = await mongoClient.findOneByIdAndRemoveLock(
		insertedEntity._id,
		'date',
		'userId',
	);

	t.is(newEntity.objectInfos.lockFields.length, 8, 'Number of lock fields');
	t.deepEqual(
		_.map(newEntity.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k2].value',
			'objects[code=k3].value',
			'id',
		],
		'date lock fields has been removed',
	);

	const updatedDataWithDate = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		dataWithDate,
		'userId',
		true,
		true,
	);

	t.is(updatedDataWithDate.objectInfos.lockFields.length, 9, 'Number of lock fields');
	t.deepEqual(
		_.map(updatedDataWithDate.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k2].value',
			'objects[code=k3].value',
			'id',
			'date',
		],
		'updated date with same value but a different format (Date), so new date lock field has appeared',
	);
});

ava('[LOCK-FIELDS] Insert&Update one with String and change to Date', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();
	const date = new Date('2020-01-01');
	const dateString = date.toUTCString();

	const dataWithDate = {
		..._.cloneDeep(locksDataSample),
		date,
		id: new ObjectID(),
	};

	const dataWithString = {
		..._.cloneDeep(locksDataSample),
		date: dateString,
	};
	const insertedEntity = await mongoClient.insertOne(dataWithDate, '');

	const entity = await mongoClient.findOneById(insertedEntity._id);

	t.true(!_.isEmpty(entity.objectInfos.lockFields), 'is there some lock fields');
	t.deepEqual(
		_.map(entity.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k2].value',
			'objects[code=k3].value',
			'date',
			'id',
		],
		'all lock fields are present',
	);

	const newEntity = await mongoClient.findOneByIdAndRemoveLock(
		insertedEntity._id,
		'date',
		'userId',
	);

	t.is(newEntity.objectInfos.lockFields.length, 8, 'Number of lock fields');
	t.deepEqual(
		_.map(newEntity.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k2].value',
			'objects[code=k3].value',
			'id',
		],
		'date lock fields has been removed',
	);

	const updatedDataWithStringDate = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		dataWithString,
		'userId',
		true,
		true,
	);

	t.is(updatedDataWithStringDate.objectInfos.lockFields.length, 9, 'Number of lock fields');
	t.deepEqual(
		_.map(updatedDataWithStringDate.objectInfos.lockFields, 'path'),
		[
			'text',
			'property.value',
			'strings["a"]',
			'strings["b"]',
			'objects[code=k1].value',
			'objects[code=k2].value',
			'objects[code=k3].value',
			'id',
			'date',
		],
		'updated date with same value but a different format (String), so new date lock field has appeared',
	);
});

ava('[LOCK-FIELDS] Insert&Update one and check locks', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), '');
	const entity = await mongoClient.findOneById(insertedEntity._id);
	t.true(!_.isEmpty(entity.objectInfos.lockFields));

	const newValue: SampleComplexType = {
		text: 'new value',
		objects: [
			{
				code: 'k1',
				value: 'new value for k1',
			},
			{
				code: 'kNew',
				value: 'new value for new key',
			},
		],
		strings: ['a', 'c'],
		excludedField: 'new excluded fields value',
		excludedArray: ['excludeArrayValue1new'],
		property: {
			value: 'new property.value value',
		},
	};

	const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		_.cloneDeep(newValue),
		'userId',
		true,
	);

	t.is(updatedData.objectInfos.lockFields.length, 9, 'Number of lock fields');
	t.is(updatedData.text, locksDataSample.text, "text didn't change");
	t.is(updatedData.excludedField, newValue.excludedField, 'excludedField changed');
	t.is(
		_.get(updatedData, 'property.value'),
		locksDataSample.property.value,
		'property.value changed',
	);
	t.is(
		updatedData.excludedArray.length,
		newValue.excludedArray.length,
		'excludedArray length overrided',
	);
	t.is(updatedData.excludedArray[0], newValue.excludedArray[0], 'excludedArray overrided');
	t.deepEqual(
		updatedData.objects,
		locksDataSample.objects.concat([newValue.objects[1]]),
		'right object array',
	);
	t.is(updatedData.strings.length, 3, 'strings array merged length');
	t.deepEqual(
		updatedData.strings,
		_.uniq(locksDataSample.strings.concat(newValue.strings)),
		'strings array merged values',
	);
});

ava('[LOCK-FIELDS] Insert&update one without saving locks', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), 'userId', false);
	const entity = await mongoClient.findOneById(insertedEntity._id);
	t.true(_.isEmpty(entity.objectInfos.lockFields));

	const newValue: SampleComplexType = {
		text: 'new value',
		objects: [
			{
				code: 'k1',
				value: 'new value for k1',
			},
			{
				code: 'kNew',
				value: 'new value for new key',
			},
		],
		strings: ['a', 'c'],
		excludedField: 'new excluded fields value',
		property: {
			value: 'new property.value value',
		},
	};

	const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		newValue,
		'userId',
		true,
	);

	t.is(updatedData.text, newValue.text, 'text changed');
	t.is(updatedData.excludedField, newValue.excludedField, 'excludedField changed');
	t.is(_.get(updatedData, 'property.value'), newValue.property.value, 'property.value changed');
	t.deepEqual(updatedData.objects, newValue.objects, 'right object array');
	t.is(updatedData.strings.length, 2, 'strings array merged length');
	t.deepEqual(updatedData.strings, newValue.strings, 'strings array merged values');
	t.is(updatedData.objectInfos.lockFields.length, 5, 'Number of lock fields');
});

ava('[LOCK-FIELDS] Forbide usage of some methods', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

	await t.throwsAsync(async () => {
		await mongoClient.findOneAndUpdateById('', {}, 'userId');
	});
	await t.throwsAsync(async () => {
		await mongoClient.findOneAndUpdateByKey('', {}, 'userId');
	});
	await t.throwsAsync(async () => {
		await mongoClient.findOneAndUpdate({}, {}, 'userId');
	});
	await t.throwsAsync(async () => {
		await mongoClient.updateManyToSameValue({}, {}, 'userId');
	});
	await t.notThrowsAsync(async () => {
		await mongoClient.updateManyToSameValue({}, {}, 'userId', { ignoreLockFields: true });
	});
});

ava('[LOCK-FIELDS] Update many with locks', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient();

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

	const newValues: Partial<SampleComplexType>[] = [
		{
			text: 'id1',
			property: {
				value: 'new value 1',
			},
		},
		{
			text: 'id2',
			property: {
				value: 'new value 2',
			},
		},
	];

	await mongoClient.updateManyAtOnce(newValues, 'userId', { query: 'text' });
	const listing: Partial<SampleComplexType>[] = await mongoClient.find({}, 0, 0).toArray();

	t.is(listing.length, 2, 'found 2 elements');
	for (const i of listing) {
		_.unset(i, '_id');
		_.unset(i, 'text');
		_.unset(i, 'objectInfos.creation.date');
		_.unset(i, 'objectInfos.lastModification.date');
		for (const lockField of i.objectInfos.lockFields) {
			_.unset(lockField, 'metaDatas.date');
		}
	}
	t.deepEqual(listing[0], listing[1]);
	t.is(listing[0].property.value, locksDataSample.property.value);
	t.is(listing[0].excludedField, locksDataSample1.excludedField);
});

ava(
	'[LOCK-FIELDS] Update many with locks with excluded lock field as ObjectId',
	async (t: Assertions) => {
		const mongoClient = getLockFieldsMongoClient();

		const objectIDSample = new ObjectID();
		const locksDataSample1: SampleComplexType = {
			...locksDataSample,
			text: 'id1',
			excludedField: objectIDSample as any,
			excludedArray: [objectIDSample as any],
		};
		const locksDataSample2: SampleComplexType = {
			...locksDataSample1,
			text: 'id2',
		};
		await mongoClient.insertOne(_.cloneDeep(locksDataSample1), 'userId', true);
		await mongoClient.insertOne(_.cloneDeep(locksDataSample2), 'userId', true);

		t.deepEqual(
			((await (mongoClient as any).collection.findOne({ text: 'id1' })) as SampleComplexType)
				.excludedField as any,
			objectIDSample,
			'objectId is well saved',
		);

		t.deepEqual(
			((await (mongoClient as any).collection.findOne({ text: 'id1' })) as SampleComplexType)
				.excludedArray as any,
			[objectIDSample],
			'objectId is well saved for array',
		);

		const newValues: Partial<SampleComplexType>[] = [
			{
				text: 'id1',
				property: {
					value: 'new value 1',
				},
			},
			{
				text: 'id2',
				property: {
					value: 'new value 2',
				},
			},
		];

		await mongoClient.updateManyAtOnce(newValues, 'userId', { query: 'text' });
		const listing: Partial<SampleComplexType>[] = await mongoClient.find({}, 0, 0).toArray();

		t.is(listing.length, 2, 'found 2 elements');
		for (const i of listing) {
			_.unset(i, '_id');
			_.unset(i, 'text');
			_.unset(i, 'objectInfos.creation.date');
			_.unset(i, 'objectInfos.lastModification.date');
			for (const lockField of i.objectInfos.lockFields) {
				_.unset(lockField, 'metaDatas.date');
			}
		}
		t.deepEqual(listing[0], listing[1]);
		t.is(typeof listing[0].excludedField, 'string', 'In listing ObjectId is returned as string');

		t.deepEqual(
			((await (mongoClient as any).collection.findOne({ text: 'id1' })) as SampleComplexType)
				.excludedField as any,
			objectIDSample,
			'excludedFields are still ObjectId',
		);

		t.deepEqual(
			((await (mongoClient as any).collection.findOne({ text: 'id1' })) as SampleComplexType)
				.excludedArray as any,
			[objectIDSample],
			'excludedFields are still ObjectId for array',
		);
	},
);

ava('[LOCK-FIELDS] Remove lock field', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient(true);
	const insertedEntity = await mongoClient.insertOne(_.cloneDeep(locksDataSample), 'userId', true);

	t.is(insertedEntity.objectInfos.lockFields.length, 7, 'Nb lock fields after creation');
	let newEntity = await mongoClient.findOneByIdAndRemoveLock(
		insertedEntity._id,
		'strings["a"]',
		'userId',
	);

	t.is(newEntity.objectInfos.lockFields.length, 6, 'Nb lock fields after 1 removed');
	t.false(
		_.map(newEntity.objectInfos.lockFields, 'path').includes('strings["a"]'),
		'Does not contains path removed',
	);
	newEntity = await mongoClient.findOneByKeyAndRemoveLock(
		newEntity.text,
		'strings["b"]',
		'userId',
		'text',
	);

	t.is(newEntity.objectInfos.lockFields.length, 5, 'Nb lock fields after 2 removed');
	t.false(
		_.map(newEntity.objectInfos.lockFields, 'path').includes('strings["b"]'),
		'Does not contains path removed',
	);

	const allHistoric: EntityHistoric<SampleComplexType>[] = await (
		await mongoClient.findHistoricByEntityId(insertedEntity._id, 0, 0)
	).toArray();
	t.is(allHistoric.length, 2, '2 historic entries');
});

ava('[LOCK-FIELDS] Remove lock field subparts', async (t: Assertions) => {
	const mongoClient = getLockFieldsMongoClient(true);

	const dataWithNestedObject = {
		...locksDataSample,
		nested: {
			a: {
				key: 'test1',
				value: 'test 2',
			},
			b: {
				key: 'test2',
				value: {
					fr: 'TEST-FR',
					en: 'TEST-EN',
				},
			},
		},
	};

	const insertedEntity = await mongoClient.insertOne(
		_.cloneDeep(dataWithNestedObject),
		'userId',
		true,
	);

	t.is(insertedEntity.objectInfos.lockFields.length, 12, 'Nb lock fields after creation');
	t.true(
		_.map(insertedEntity.objectInfos.lockFields, 'path').some((p) => p.startsWith('nested.a')),
		'Contains nested paths',
	);
	let newEntity = await mongoClient.findOneByIdAndRemoveLockSubparts(
		insertedEntity._id,
		'nested.a',
		'userId',
	);

	t.is(newEntity.objectInfos.lockFields.length, 10, 'Nb lock fields after 2 removed');
	t.false(
		_.map(newEntity.objectInfos.lockFields, 'path').some((p) => p.startsWith('nested.a')),
		'Does not contains paths removed',
	);
	newEntity = await mongoClient.findOneByKeyAndRemoveLockSubparts(
		newEntity.text,
		'nested.b',
		'userId',
		'text',
	);

	t.is(newEntity.objectInfos.lockFields.length, 7, 'Nb lock fields after 5 removed');
	t.false(
		_.map(newEntity.objectInfos.lockFields, 'path').some((p) => p.startsWith('nested.b')),
		'Does not contains paths removed',
	);

	const allHistoric: EntityHistoric<SampleComplexType>[] = await (
		await mongoClient.findHistoricByEntityId(insertedEntity._id, 0, 0)
	).toArray();
	t.is(allHistoric.length, 2, '2 historic entries');
});

ava(
	'[LOCK-FIELDS] Insert&update one without saving locks clear all locks and update only one field',
	async (t: Assertions) => {
		const mongoClient = getLockFieldsMongoClient();

		const insertedEntity = await mongoClient.insertOne(
			_.cloneDeep(locksDataSample),
			'userId',
			false,
		);
		const entity = await mongoClient.findOneById(insertedEntity._id);
		t.true(_.isEmpty(entity.objectInfos.lockFields));

		const newValue: SampleComplexType = {
			text: 'new value',
			objects: [
				{
					code: 'k1',
					value: 'new value for k1',
				},
				{
					code: 'kNew',
					value: 'new value for new key',
				},
			],
			strings: ['a', 'c'],
			excludedField: 'new excluded fields value',
			property: {
				value: 'new property.value value',
			},
		};

		const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(
			insertedEntity._id,
			newValue,
			'userId',
			true,
		);

		t.is(updatedData.objectInfos.lockFields.length, 5, 'Number of lock fields');

		let i = 1;
		for (const lockField of updatedData.objectInfos.lockFields) {
			const newEntityValue = await mongoClient.findOneByIdAndRemoveLock(
				updatedData._id,
				lockField.path,
				'userId',
			);
			t.is(newEntityValue.objectInfos.lockFields.length, 5 - i, 'Number of fields decreased');
			i += 1;
		}
		const lastNewEntityValue = await mongoClient.findOneById(updatedData._id);
		t.is(lastNewEntityValue.objectInfos.lockFields.length, 0, 'Number of lock fields === 0');

		const newValue2: Partial<SampleComplexType> = {
			text: newValue.text, // should not be in lock fields
			property: {
				value: 'new property.value value 2',
			},
		};

		const updatedData2 = await mongoClient.findOneAndUpdateByIdWithLocks(
			updatedData._id,
			newValue2,
			'userId',
		);

		t.is(updatedData2.objectInfos.lockFields.length, 1, `One field locked`);
		t.is(updatedData2.property.value, newValue2.property.value, `Update one field OK`);
	},
);

ava('[LOCK-FIELDS] Insert&update boolean', async (t: Assertions) => {
	const attribute: AttributeEntity = {
		code: 'caracteristique_dimension_jeton',
		defaultLanguageCode: 'fr-FR',
		isEditable: false,
		isLocalSpecific: false,
		isPublic: false,
		isVariable: false,
		toSync: false,
		label: {
			'en-GB': 'Token Size',
			'fr-FR': 'Taille jeton',
		},
		parameters: {},
		type: 'select',
		validations: {},
	};

	const mongoClient = new MongoClient(`test-${Date.now()}`, AttributeEntity, null, {
		lockFields: {
			arrayWithReferences: {
				'parameters.items': 'code',
			},
		},
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();

	const attributesCreated: AttributeEntity[] = await (
		await mongoClient.updateManyAtOnce([attribute], 'userId1', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();

	const newAttributeValue = _.cloneDeep(attribute);
	newAttributeValue.isEditable = !newAttributeValue.isEditable;

	const attributesUpdated = await mongoClient.findOneAndUpdateByIdWithLocks(
		attributesCreated[0]._id,
		newAttributeValue,
		'userIdUpdate',
		true,
		true,
	);
	t.truthy(attributesUpdated.objectInfos.lockFields, 'Should have some lock fields');
	t.is(
		attributesUpdated.objectInfos.lockFields.length,
		1,
		'One element edited, so one should find one lock field',
	);
});

ava('[LOCK-FIELDS] Insert&update array sub object element', async (t: Assertions) => {
	const attribute: AttributeEntity = {
		code: 'caracteristique_dimension_jeton',
		defaultLanguageCode: 'fr-FR',
		isEditable: false,
		isLocalSpecific: false,
		isPublic: false,
		isVariable: false,
		toSync: false,
		label: {
			'en-GB': 'Token Size',
			'fr-FR': 'Taille jeton',
		},
		parameters: {
			items: [
				{
					code: 'taille_piece_1',
					label: {
						'en-GB': 'Size of a 1€ coin',
						'fr-FR': "Taille d'une piece 1€",
					},
				},
				{
					code: 'autres_tailles',
					label: {
						'en-GB': 'Other sizes',
						'fr-FR': 'Autres',
					},
				},
			],
		},
		type: 'select',
		validations: {},
	};

	const mongoClient = new MongoClient(`test-${Date.now()}`, AttributeEntity, null, {
		lockFields: {
			arrayWithReferences: {
				'parameters.items': 'code',
			},
		},
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();

	const attributesCreated: AttributeEntity[] = await (
		await mongoClient.updateManyAtOnce([attribute], 'userId1', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();

	const newAttributeValue = _.cloneDeep(attribute);
	newAttributeValue.parameters.items[1].label['fr-FR'] = 'Autres tailles';

	const attributesUpdated = await mongoClient.findOneAndUpdateByIdWithLocks(
		attributesCreated[0]._id,
		newAttributeValue,
		'userIdUpdate',
		true,
		true,
	);
	t.truthy(attributesUpdated.objectInfos.lockFields, 'Should have some lock fields');
	t.is(
		attributesUpdated.objectInfos.lockFields.length,
		1,
		'One element edited, so one should find one lock field',
	);
});

ava('[LOCK-FIELDS] Insert object with array and code with no value', async (t: Assertions) => {
	const objectWithArray: ObjectWithArray = {
		parameters: {
			items: [
				{
					code: 'code1',
					label: {
						'en-GB': 'Size of a 1€ coin',
						'fr-FR': "Taille d'une piece 1€",
					},
				},
				{
					code: 'code2',
				},
			],
		},
	};

	const mongoClient = new MongoClient(`test-${Date.now()}`, ObjectWithArray, null, {
		lockFields: {
			arrayWithReferences: {
				'parameters.items': 'code',
			},
		},
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();

	const objectCreated: ObjectWithArray = await mongoClient.insertOne(
		objectWithArray,
		'userId',
		true,
	);

	t.truthy(objectCreated.objectInfos.lockFields, 'Should have some lock fields');

	const paths = _.map(objectCreated.objectInfos.lockFields, 'path');
	t.deepEqual(
		paths,
		[
			'parameters.items[code=code1].label.en-GB',
			'parameters.items[code=code1].label.fr-FR',
			'parameters.items[code=code2]',
		],
		'One element edited, so one should find one lock field',
	);

	const newObjectWithArray = _.cloneDeep(objectWithArray);
	newObjectWithArray.parameters.items.pop();

	const objectUpdated: ObjectWithArray = await mongoClient.findOneAndUpdateByIdWithLocks(
		objectCreated._id,
		newObjectWithArray,
		'userId',
		true,
		false,
	);

	t.is(objectUpdated.parameters.items.length, 2, 'Should kee element locked');
});

ava('[LOCK-FIELDS] Insert&update attribute', async (t: Assertions) => {
	const attribute: AttributeEntity = {
		code: 'caracteristique_dimension_jeton',
		defaultLanguageCode: 'fr-FR',
		isEditable: false,
		isLocalSpecific: false,
		isPublic: true,
		isVariable: false,
		label: {
			'en-GB': 'Token Size',
			'fr-FR': 'Taille jeton',
		},
		parameters: {
			items: [
				{
					code: 'taille_piece_0_50',
					label: {
						'en-GB': 'Size of a 0,50€ coin',
						'fr-FR': "Taille d'une pièce 0,50€",
					},
				},
				{
					code: 'taille_piece_1',
					label: {
						'en-GB': 'Size of a 1€ coin',
						'fr-FR': "Taille d'une pièce 1€",
					},
				},
				{
					code: 'taille_piece_2',
					label: {
						'en-GB': 'Size of a 2€ coin',
						'fr-FR': "Taille d'une pièce 2€",
					},
				},
				{
					code: 'autres_tailles',
					label: {
						'en-GB': 'Other sizes',
						'fr-FR': 'Autres tailles',
					},
				},
			],
		},
		toSync: true,
		type: 'select',
		validations: {},
	};

	const mongoClient = new MongoClient(`test-${Date.now()}`, AttributeEntity, null, {
		lockFields: {
			arrayWithReferences: {
				'parameters.items': 'code',
			},
		},
		keepHistoric: true,
	});
	await mongoClient.initHistoricIndexes();

	const attributesCreated: AttributeEntity[] = await (
		await mongoClient.updateManyAtOnce([attribute], 'userId1', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	const attributeCreated = await mongoClient.findOneByKey(attribute.code);

	t.deepEqual(attributesCreated[0], attributeCreated, `update many at once return new data`);
	t.is(attributeCreated.objectInfos.lockFields, undefined, 'no lock fields at the begenning');

	const newAttributeValue = _.cloneDeep(attribute);
	newAttributeValue.label['fr-FR'] = 'Taille du jeton';

	const newAttributeValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
		attributeCreated._id,
		newAttributeValue,
		'userIdUpdate',
		true,
		true,
	);
	t.is(
		newAttributeValue2.objectInfos.lockFields.length,
		1,
		'One element edited, so one should find one lock field',
	);
});

ava('[LOCK-FIELDS] Insert&update entity with date property', async (t: Assertions) => {
	const entity: ObjectWithDateProperty = {
		code: 'test_case',
		props: {
			date: new Date('2020-01-01'),
		},
	};

	const mongoClient = new MongoClient(`test-${Date.now()}`, ObjectWithDateProperty, null, {
		lockFields: {},
		keepHistoric: false,
	});

	const createdEntities: ObjectWithDateProperty[] = await (
		await mongoClient.updateManyAtOnce([entity], 'userId1', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();
	const createdEntity = await mongoClient.findOneByKey(entity.code);

	t.deepEqual(createdEntities[0], createdEntity, `update many at once return new data`);

	// unitary update of a date property
	const updateData2 = _.cloneDeep(entity);
	updateData2.props.date = new Date('2020-02-02');

	const newEntityValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(
		createdEntity._id,
		updateData2,
		'userIdUpdate',
		false,
		true,
	);

	t.deepEqual(
		new Date(newEntityValue2.props.date),
		new Date('2020-02-02'),
		'The date should be updated with unitary update',
	);
	t.falsy(
		newEntityValue2.objectInfos.lockFields?.find((lockField) => lockField.path === 'props.date'),
		'The date 3 should not be locked',
	);

	// bulk update of a date property
	const updateData3 = _.cloneDeep(entity);
	updateData3.props.date = new Date('2020-03-03');

	const newEntityValues3 = await (
		await mongoClient.updateManyAtOnce([updateData3], 'userIdBulkUpsert', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
		})
	).toArray();

	t.deepEqual(
		new Date(newEntityValues3[0].props.date),
		new Date('2020-03-03'),
		'The date should be updated with bulk update when the field is not locked',
	);
	t.falsy(
		newEntityValues3[0].objectInfos.lockFields?.find(
			(lockField) => lockField.path === 'props.date',
		),
		'The date 3 should not be locked',
	);

	// unitary update of a date property with lock
	const updateData4 = _.cloneDeep(entity);
	updateData4.props.date = new Date('2020-04-04');

	const newEntityValue4 = await mongoClient.findOneAndUpdateByIdWithLocks(
		createdEntity._id,
		updateData4,
		'userIdUpdate',
		true,
		true,
	);

	t.is(
		new Date(newEntityValue4.props.date).toISOString(),
		new Date('2020-04-04').toISOString(),
		'The date 4 should be updated',
	);
	t.truthy(
		newEntityValue4.objectInfos.lockFields.find((lockField) => lockField.path === 'props.date'),
		'The date should be locked',
	);
	const dateLockCreated = newEntityValue4.objectInfos.lockFields.find(
		(lockField) => lockField.path === 'props.date',
	).metaDatas.date;

	// bulk update of a date property with lock field
	const updateData5 = _.cloneDeep(entity);
	updateData5.props.date = new Date('2020-05-05');

	const newEntityValues5 = await (
		await mongoClient.updateManyAtOnce([updateData5], 'userIdBulkUpsert', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
			forceEditLockFields: false,
		})
	).toArray();

	t.is(
		new Date(newEntityValues5[0].props.date).toISOString(),
		new Date('2020-04-04').toISOString(),
		'The date should be not be updated with bulk update when the field is locked and no force edit',
	);
	t.truthy(
		newEntityValues5[0].objectInfos.lockFields?.find(
			(lockField) => lockField.path === 'props.date',
		),
		'The date 5 should still be locked',
	);
	t.deepEqual(
		newEntityValues5[0].objectInfos.lockFields?.find((lockField) => lockField.path === 'props.date')
			.metaDatas.date,
		dateLockCreated,
		'The date 5 should still be locked at the same date',
	);

	const updateData6 = _.cloneDeep(entity);
	updateData6.props.date = new Date('2020-05-05');
	const newEntityValues6 = await (
		await mongoClient.updateManyAtOnce([updateData6], 'userIdBulkUpsert', {
			upsert: true,
			lockNewFields: false,
			query: 'code',
			forceEditLockFields: true,
		})
	).toArray();

	t.is(
		new Date(newEntityValues6[0].props.date).toISOString(),
		new Date('2020-05-05').toISOString(),
		'The date should be not be updated with bulk update when the field is locked and no force edit',
	);
});

ava('[LOCK-FIELDS] Forbidden actions', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, AttributeEntity, null, {
		lockFields: {},
	});

	await t.throwsAsync(async () => await mongoClient.findOneAndUpdate({}, {}, 'userId', false));

	const notFoundElement = await mongoClient.findOneAndUpdateByIdWithLocks(
		'01234567890123456789abcd',
		{},
		'userId',
	);
	t.is(notFoundElement, undefined, 'element is null is not found');
});

ava('[LOCK-FIELDS] Forbidden actions without locks', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, AttributeEntity, null);

	await t.throwsAsync(
		async () => await mongoClient.findOneAndRemoveLock({}, 'lock.path', 'userId'),
	);
});
