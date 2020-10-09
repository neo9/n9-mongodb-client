import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';

import { Exclude, Expose } from 'class-transformer';
import { MongoClient } from '../src';
import { BaseMongoObject } from '../src/models';
import { init } from './fixtures/utils';

@Exclude()
class SampleTypeListItem extends BaseMongoObject {
	@Expose()
	public fieldEntity: string;
}

@Exclude()
class SampleTypeEntity extends SampleTypeListItem {
	@Expose()
	public fieldListing: string;
}

global.log = new N9Log('tests');

init();

ava('[Listing] List elements', async (t: Assertions) => {
	const mongoClient = new MongoClient(`test-${Date.now()}`, SampleTypeEntity, SampleTypeListItem);
	const size = await mongoClient.count();

	t.true(size === 0, 'collection should be empty');

	const insertedValue = await mongoClient.insertOne(
		{
			fieldEntity: 'a',
			fieldListing: 'b',
		},
		'userId1',
	);

	t.truthy(insertedValue.fieldEntity, 'inserted entity field');
	t.truthy(insertedValue.fieldListing, 'inserted listing field');

	const listing = await (await mongoClient.find({})).toArray();

	t.truthy(listing[0].fieldEntity, 'entity field is present');
	t.falsy((listing[0] as any).fieldListing, 'listing field is missing');

	const listingWithDetails = await (await mongoClient.findWithType({}, SampleTypeEntity)).toArray();

	t.truthy(listingWithDetails[0].fieldEntity, 'entity field in details list is present');
	t.truthy(listingWithDetails[0].fieldListing, 'listing field in details list is present');

	await mongoClient.dropCollection();
});
