import { N9Log } from '@neo9/n9-node-log';
import test, { Assertions } from 'ava';
import * as _ from 'lodash';
import * as mongodb from 'mongodb';
import { MongoClient, MongoUtils } from '../../src';
import { BaseMongoObject, StringMap } from '../../src/models';

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

global.log = new N9Log('tests').module('attributes');

test.before(async () => {
	await MongoUtils.connect('mongodb://localhost:27017/test-n9-mongo-client');
});

test.after(async () => {
	global.log.info(`DROP DB after tests OK`);
	await (global.db as mongodb.Db).dropDatabase();
	await MongoUtils.disconnect();
});

test('[LOCK-FIELDS] Insert&update attribute', async (t: Assertions) => {
	const attribute: AttributeEntity = {
		code : "caracteristique_dimension_jeton",
		defaultLanguageCode : "fr-FR",
		isEditable : false,
		isLocalSpecific : false,
		isPublic : true,
		isVariable : false,
		label : {
			"en-GB" : "Token Size",
			"fr-FR" : "Taille jeton"
		},
		parameters : {
			items : [
				{
					code : "taille_piece_0_50",
					label : {
						"en-GB" : "Size of a 0,50€ coin",
						"fr-FR" : "Taille d'une pièce 0,50€"
					}
				},
				{
					code : "taille_piece_1",
					label : {
						"en-GB" : "Size of a 1€ coin",
						"fr-FR" : "Taille d'une pièce 1€"
					}
				},
				{
					code : "taille_piece_2",
					label : {
						"en-GB" : "Size of a 2€ coin",
						"fr-FR" : "Taille d'une pièce 2€"
					}
				},
				{
					code : "autres_tailles",
					label : {
						"en-GB" : "Other sizes",
						"fr-FR" : "Autres tailles"
					}
				}
			]
		},
		toSync : true,
		type : "select",
		validations : {}
	};

	const mongoClient = new MongoClient('test' + Date.now(), AttributeEntity, null, {
		lockFields: {
			arrayWithReferences: {
				'parameters.items': 'code',
			},
		},
		keepHistoric: true
	});

	const attributesCreated: AttributeEntity[] = await (await mongoClient.updateManyAtOnce([attribute], 'userId1', true, false, 'code')).toArray();
	const attributeCreated = await mongoClient.findOneByKey(attribute.code);

	t.deepEqual(attributesCreated[0], attributeCreated, `update many at once return new data`);
	t.is(attributeCreated.objectInfos.lockFields, undefined, 'no lock fields at the begenning');

	const newAttributeValue = _.cloneDeep(attribute);
	newAttributeValue.label['fr-FR'] = 'Taille du jeton';

	const newAttributeValue2 = await mongoClient.findOneAndUpdateByIdWithLocks(attributeCreated._id, newAttributeValue, 'userIdUpdate', true, true);
	t.is(newAttributeValue2.objectInfos.lockFields.length, 1, 'One element edited, so one should find one lock field');
});
