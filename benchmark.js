const { N9Log } = require('@neo9/n9-node-log');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient, MongoUtils } = require('./dist/src');
const { add, complete, cycle, save, suite } = require('benny');

class TestEntity {
	test;
	n;
	i;
}

async function runInsertBench(defaultCaseRunOptions, version) {
	const nbElement = 100;
	const suiteName = `Insert Case ${nbElement}`;
	const dataToInsert = Array(nbElement).fill({
		test: 'a string',
		n: 123456,
	});
	await suite(
		suiteName,
		add(
			'Insert mongodb native',
			async () => {
				const db = global.dbClient.db();
				return async () => {
					await db.collection('test-1').insertMany(dataToInsert, { forceServerObjectId: true });
				};
			},
			defaultCaseRunOptions,
		),
		add(
			'Insert N9MongoClient',
			async () => {
				const mongoClient = new MongoClient('test-2', TestEntity, TestEntity);
				return async () => {
					await mongoClient.insertMany(dataToInsert, 'userId', undefined, false);
				};
			},
			defaultCaseRunOptions,
		),
		cycle(),
		complete(),
		save({
			version,
			format: 'json',
			details: false,
			file: `${suiteName} ${version}`,
		}),
	);
}

async function runUpdateManyAtOnceBench(defaultCaseRunOptions, version) {
	const nbElement = 100;
	const suiteName = `Update many at once Case ${nbElement}`;
	let i = 0;
	const dataToInsert = Array(nbElement)
		.fill({
			test: 'a string',
			n: 123456,
		})
		.map((elmt) => {
			i += 1;
			return { ...elmt, i };
		});
	await suite(
		suiteName,
		add(
			'Update many at once mongodb native',
			async () => {
				const db = global.dbClient.db();
				return async () => {
					await db.collection('test-1').bulkWrite(
						dataToInsert.map((dataToInsert) => ({
							updateOne: {
								filter: {
									i: dataToInsert.i,
								},
								update: {
									$set: dataToInsert,
								},
								upsert: true,
							},
						})),
					);
				};
			},
			defaultCaseRunOptions,
		),
		add(
			'Update many at once N9MongoClient with query a string',
			async () => {
				const mongoClient = new MongoClient('test-2', TestEntity, TestEntity);
				return async () => {
					await mongoClient.updateManyAtOnce(dataToInsert, 'userId', {
						unsetUndefined: true,
						forceEditLockFields: true,
						upsert: true,
						query: 'i',
						lockNewFields: false,
						onlyInsertFieldsKey: ['i'],
						returnNewEntities: true, // default
					});
				};
			},
			defaultCaseRunOptions,
		),
		add(
			'Update many at once N9MongoClient with query a string without returning new values',
			async () => {
				const mongoClient = new MongoClient('test-2', TestEntity, TestEntity);
				return async () => {
					await mongoClient.updateManyAtOnce(dataToInsert, 'userId', {
						unsetUndefined: true,
						forceEditLockFields: true,
						upsert: true,
						query: 'i',
						lockNewFields: false,
						onlyInsertFieldsKey: ['i'],
						returnNewEntities: false,
					});
				};
			},
			defaultCaseRunOptions,
		),
		add(
			'Update many at once N9MongoClient with query as function',
			async () => {
				const mongoClient = new MongoClient('test-2', TestEntity, TestEntity);
				return async () => {
					await mongoClient.updateManyAtOnce(dataToInsert, 'userId', {
						unsetUndefined: true,
						forceEditLockFields: true,
						upsert: true,
						query: (e) => ({ i: e.i }),
						lockNewFields: false,
						onlyInsertFieldsKey: ['i'],
					});
				};
			},
			defaultCaseRunOptions,
		),
		add('Update many at once N9MongoClient with lock fields', async () => {
			const mongoClient = new MongoClient('test-2', TestEntity, TestEntity);
			return async () => {
				await mongoClient.updateManyAtOnce(dataToInsert, 'userId', {
					unsetUndefined: true,
					forceEditLockFields: true,
					upsert: true,
					query: 'i',
					lockNewFields: true,
					onlyInsertFieldsKey: ['i'],
				});
			};
		}),
		add(
			'Update many at once N9MongoClient with no query',
			async () => {
				const mongoClient = new MongoClient('test-2', TestEntity, TestEntity);
				return async () => {
					await mongoClient.updateManyAtOnce(dataToInsert, 'userId', {
						unsetUndefined: false,
						upsert: true,
					});
				};
			},
			defaultCaseRunOptions,
		),
		cycle(),
		complete(),
		save({
			version,
			format: 'json',
			details: false,
			file: `${suiteName} ${version}`,
		}),
	);
}

async function runFindBench(defaultCaseRunOptions, version) {
	const nbElement = 100;
	const suiteName = `Read Case ${nbElement}`;
	const collectionName = 'test-1';
	const dataToInsert = Array(nbElement).fill({
		test: 'a string',
		n: 123456,
	});
	const mongoClient = new MongoClient(collectionName, TestEntity, TestEntity);
	const db = global.dbClient.db();
	await mongoClient.insertMany(dataToInsert, 'userId', { forceServerObjectId: true });
	// Force to read all once
	const cursor = await db.collection(collectionName).find({});
	await cursor.toArray();

	await suite(
		suiteName,
		add(
			'Read mongodb native',
			async () => {
				const cursor = await db.collection(collectionName).find({});
				// read all cursor one by one
				while (await cursor.hasNext()) {
					await cursor.next();
				}
			},
			defaultCaseRunOptions,
		),
		add(
			'Read N9MongoClient',
			async () => {
				const cursor = await mongoClient.find({}, 0, 0);
				// read all cursor one by one
				while (await cursor.hasNext()) {
					await cursor.next();
				}
			},
			defaultCaseRunOptions,
		),
		cycle(),
		complete(),
		save({
			version,
			format: 'json',
			details: false,
			file: `${suiteName} ${version}`,
		}),
	);
}

async function start() {
	global.log = new N9Log('bench');
	let mongod;

	try {
		mongod = new MongoMemoryServer();
		const uri = await mongod.getConnectionString();
		await MongoUtils.connect(uri);
		const defaultCaseRunOptions = {
			minSamples: 100,
		};
		const version = require('./package.json').version;

		await runInsertBench(defaultCaseRunOptions, version);
		await global.db.dropDatabase();
		await runFindBench(defaultCaseRunOptions, version);
		await global.db.dropDatabase();
		await runUpdateManyAtOnceBench(defaultCaseRunOptions, version);
		await global.db.dropDatabase();
	} catch (e) {
		throw e;
	} finally {
		if (global.db) {
			await global.db.dropDatabase();
			await MongoUtils.disconnect();
		}
		await mongod.stop();
	}
}

start()
	.then(() => {
		(global.log || console).info('END SUCCESS !');
		process.exit(0);
	})
	.catch((e) => {
		(global.log || console).error(`Error on run : `, e);
		throw e;
	});
