import test, { ExecutionContext } from 'ava';
import * as _ from 'lodash';

import { BaseMongoObject, N9MongoDBClient } from '../src';
import { getBaseMongoClientSettings, getOneCollectionName, init, TestContext } from './fixtures';

export class AttributeValueListItemEntity extends BaseMongoObject {
	public code: string;
	public label: {
		[key: string]: string;
	};
	public position?: number;
}

const getLockFieldsMongoClient = (
	t: ExecutionContext<TestContext>,
): N9MongoDBClient<AttributeValueListItemEntity, AttributeValueListItemEntity> =>
	new N9MongoDBClient<AttributeValueListItemEntity, AttributeValueListItemEntity>(
		getOneCollectionName(),
		AttributeValueListItemEntity,
		AttributeValueListItemEntity,
		{
			...getBaseMongoClientSettings(t),
			keepHistoric: false,
			lockFields: {
				excludedFields: ['attributeId', 'code'],
			},
		},
	);

init();

test('[LOCK-FIELDS-REG] Insert&update multiple times without changing locks', async (t: ExecutionContext<TestContext>) => {
	const mongoClient = getLockFieldsMongoClient(t);

	const insertedEntity = await mongoClient.insertOne(
		{
			code: 'lemon-yellow',
			label: {
				'fr-FR': 'Jaune citron',
				'en-GB': 'Lemon yellow',
			},
			position: Number.POSITIVE_INFINITY,
		},
		'userId',
		false,
	);
	const entity = await mongoClient.findOneById(insertedEntity._id);
	t.true(_.isEmpty(entity.objectInfos.lockFields));

	const updatedData = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		{
			label: {
				'fr-FR': 'Jaune citron edited',
				'en-GB': 'Lemon yellow edited',
			},
			position: 1,
		},
		'userId',
		true,
		true,
	);

	t.is(updatedData.objectInfos.lockFields.length, 3, 'Number of lock fields');
	t.is(updatedData.objectInfos.lockFields[0].path, 'label.fr-FR', 'First lock on label fr-FR');
	t.is(updatedData.objectInfos.lockFields[1].path, 'label.en-GB', '2nd lock on label en-GB');
	t.is(updatedData.objectInfos.lockFields[2].path, 'position', '3rd lock on position');

	const updatedDataTwice = await mongoClient.findOneAndUpdateByIdWithLocks(
		insertedEntity._id,
		{
			label: {
				'fr-FR': 'Jaune citron edited',
				'en-GB': 'Lemon yellow edited',
			},
			position: 1,
		},
		'userId',
		true,
		true,
	);

	t.is(updatedDataTwice.objectInfos.lockFields.length, 3, '[2] Number of lock fields');
	t.is(
		updatedDataTwice.objectInfos.lockFields[0].path,
		'label.fr-FR',
		'[2] First lock on label fr-FR',
	);
	t.is(
		updatedDataTwice.objectInfos.lockFields[1].path,
		'label.en-GB',
		'[2] 2nd lock on label en-GB',
	);
	t.is(updatedDataTwice.objectInfos.lockFields[2].path, 'position', '[2] 3rd lock on position');

	const valueListItemEntityCursor = await mongoClient.updateManyAtOnce([updatedDataTwice], 'TEST', {
		upsert: true,
		lockNewFields: true,
		forceEditLockFields: true,
		unsetUndefined: false,
		mapFunction: (entityEdited) => ({ position: entityEdited.position }),
		query: (entityEdited) => ({
			code: entityEdited.code,
		}),
	});
	const updatedValues = await valueListItemEntityCursor.toArray();

	t.is(updatedValues.length, 1, '1 updated value');
	t.is(updatedValues[0].objectInfos.lockFields.length, 3, '[3] Number of lock fields');
	t.is(
		updatedValues[0].objectInfos.lockFields[0].path,
		'label.fr-FR',
		'[3] First lock on label fr-FR',
	);
	t.is(
		updatedValues[0].objectInfos.lockFields[1].path,
		'label.en-GB',
		'[3] 2nd lock on label en-GB',
	);
	t.is(updatedValues[0].objectInfos.lockFields[2].path, 'position', '[3] 3rd lock on position');
});
