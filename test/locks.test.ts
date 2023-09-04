import { N9Log } from '@neo9/n9-node-log';
import { waitFor } from '@neo9/n9-node-utils';
import test, { Assertions } from 'ava';

import { BaseMongoObject, MongoClient } from '../src';
import { N9MongoLock } from '../src/lock';
import { init } from './fixtures/utils';

export class TestItem extends BaseMongoObject {
	public key: string;
	public i?: number;
}

const codeRegexp = /^[0-9a-f]{32}$/;
const col = 'locks';
const threeSecsInMs = 3_000;
global.log = new N9Log('tests').module('mongodb-lock');

init();

test('[LOCKS] Test ensureIndexes works fine', async (t: Assertions) => {
	// the lock name in this case doesn't matter, since we're not going to acquire this one
	const lock = new N9MongoLock(col, 'whatever');
	t.truthy(lock, 'Lock object created ok');
	await t.notThrowsAsync(async () => {
		await lock.ensureIndexes();
	}, 'Index creation was okay');
});

test("[LOCKS] Test that the lock can't be acquired twice", async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'thisLock');
	t.truthy(lock, 'Lock object created ok');

	let code1: string;
	await t.notThrowsAsync(async () => {
		code1 = await lock.acquire();
	});
	t.truthy(code1.match(codeRegexp), 'The lock code returned matches the code regexp');

	let code2: string;
	await t.notThrowsAsync(async () => {
		code2 = await lock.acquire();
	});
	t.true(!code2, 'However, no code was returned since the lock was not acquired');
});

test("[LOCKS] Test that the specified lock can't be acquired twice", async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'thisLock');
	t.truthy(lock, 'Lock object created ok');

	let code1: string;
	await t.notThrowsAsync(async () => {
		code1 = await lock.acquire('test');
	});
	t.truthy(code1.match(codeRegexp), 'The lock code returned matches the code regexp');

	let code2: string;
	await t.notThrowsAsync(async () => {
		code2 = await lock.acquire('test');
	});
	t.true(!code2, 'However, no code was returned since the lock was not acquired');
});

test('[LOCKS] Test that two locks are fine to acquire together', async (t: Assertions) => {
	const lock1 = new N9MongoLock(col, 'lock-1');
	const lock2 = new N9MongoLock(col, 'lock-2');

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock1.acquire();
	});
	t.truthy(code.match(codeRegexp), '1. The lock code returned matches the code regexp');

	await t.notThrowsAsync(async () => {
		code = await lock2.acquire();
	});
	t.truthy(code.match(codeRegexp), '2. The lock code returned matches the code regexp');
});

test('[LOCKS] Test that two specified locks are fine to acquire together', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'lock');

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test1');
	});
	t.truthy(code.match(codeRegexp), '1. The lock code returned matches the code regexp');

	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test2');
	});
	t.truthy(code.match(codeRegexp), '2. The lock code returned matches the code regexp');
});

test('[LOCKS] Test that a 3s lock is released automatically', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'three-secs', { timeout: threeSecsInMs });

	let code1: string;
	await t.notThrowsAsync(async () => {
		code1 = await lock.acquire();
	});
	t.truthy(code1.match(codeRegexp), '1. The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let code2: string;
	await t.notThrowsAsync(async () => {
		code2 = await lock.acquire();
	});
	t.truthy(code2.match(codeRegexp), '2. The lock code returned matches the code regexp');
	t.true(code1 !== code2, '2. The 2nd code generated is different from the first');
});

test('[LOCKS] Test that a 3s specified lock is released automatically', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'three-secs', { timeout: threeSecsInMs });

	let code1: string;
	await t.notThrowsAsync(async () => {
		code1 = await lock.acquire('test');
	});
	t.truthy(code1.match(codeRegexp), '1. The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let code2: string;
	await t.notThrowsAsync(async () => {
		code2 = await lock.acquire('test');
	});
	t.truthy(code2.match(codeRegexp), '2. The lock code returned matches the code regexp');
	t.true(code1 !== code2, '2. The 2nd code generated is different from the first');
});

test('[LOCKS] Test that a 3s lock can be released and then re-acquired', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'release-me', { timeout: threeSecsInMs });

	let code1: string;
	await t.notThrowsAsync(async () => {
		code1 = await lock.acquire();
	});
	t.truthy(code1.match(codeRegexp), '1. The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code1);
	});
	t.true(ok, 'The lock was released correctly');

	let code2: string;
	await t.notThrowsAsync(async () => {
		code2 = await lock.acquire();
	});
	t.truthy(code2.match(codeRegexp), '2. The lock code returned matches the code regexp');
	t.true(code1 !== code2, '2. The 2nd code generated is different from the first');
});

test('[LOCKS] Test that a 3s specified lock can be released and then re-acquired', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'release-me', { timeout: threeSecsInMs });

	let code1: string;
	await t.notThrowsAsync(async () => {
		code1 = await lock.acquire('test');
	});
	t.truthy(code1.match(codeRegexp), '1. The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code1, 'test');
	});
	t.true(ok, 'The lock was released correctly');

	let code2: string;
	await t.notThrowsAsync(async () => {
		code2 = await lock.acquire('test');
	});
	t.truthy(code2.match(codeRegexp), '2. The lock code returned matches the code regexp');
	t.true(code1 !== code2, '2. The 2nd code generated is different from the first');
});

test('[LOCKS] Test that a lock will fail a 2nd .release()', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'double-release');

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire();
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code);
	});
	t.true(ok, 'The lock was released correctly');

	await t.notThrowsAsync(async () => {
		ok = await lock.release(code);
	});
	t.true(!ok, "The lock was not released (since it wasn't actually acquired)");
});

test('[LOCKS] Test that a specified lock will fail a 2nd .release()', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'double-release');

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test');
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code, 'test');
	});
	t.true(ok, 'The lock was released correctly');

	await t.notThrowsAsync(async () => {
		ok = await lock.release(code, 'test');
	});
	t.true(!ok, "The lock was not released (since it wasn't actually acquired)");
});

test('[LOCKS] Test that when a 3s is released automatically, the lock release fails properly', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'bad-release', { timeout: threeSecsInMs });

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire();
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code);
	});
	t.true(!ok, "The lock was not released (since it wasn't actually acquired)");
});

test('[LOCKS] Test that when a 3s is released automatically, the specified lock release fails properly', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'bad-release', { timeout: threeSecsInMs });

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test');
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code, 'test');
	});
	t.true(!ok, "The lock was not released (since it wasn't actually acquired)");
});

test('[LOCKS] Test that when removeExpired is false, released locks are not deleted from MongoDB', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'modify-expired-on-release', { removeExpired: false });
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire();
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code);
	});
	t.true(ok, 'The lock was released correctly');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 1, 'The record has not been removed after release');
});

test('[LOCKS] Test that when removeExpired is false, released specified locks are not deleted from MongoDB', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'modify-expired-on-release', { removeExpired: false });
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test');
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code, 'test');
	});
	t.true(ok, 'The lock was released correctly');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 1, 'The record has not been removed after release');
});

test('[LOCKS] Test that when removeExpired is false, timed out locks are not removed', async (t: Assertions) => {
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	const lock = new N9MongoLock(col, 'modify-expired-on-release', {
		timeout: threeSecsInMs,
		removeExpired: false,
	});

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire();
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let newCode: string;
	await t.notThrowsAsync(async () => {
		newCode = await lock.acquire();
	});
	t.truthy(newCode.match(codeRegexp), 'The lock code returned matches the code regexp');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 1, 'The record has not been removed after release');
});

test('[LOCKS] Test that when removeExpired is false, timed out specified locks are not removed', async (t: Assertions) => {
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	const lock = new N9MongoLock(col, 'modify-expired-on-release', {
		timeout: threeSecsInMs,
		removeExpired: false,
	});

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test');
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let newCode: string;
	await t.notThrowsAsync(async () => {
		newCode = await lock.acquire('test');
	});
	t.truthy(newCode.match(codeRegexp), 'The lock code returned matches the code regexp');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 1, 'The record has not been removed after release');
});

test('[LOCKS] Test that when removeExpired is true, released locks are deleted from MongoDB', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'remove-expired-on-release', {
		removeExpired: true,
	});
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire();
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code);
	});
	t.true(ok, 'The lock was released correctly');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 0, 'The record has not been removed after release');
});

test('[LOCKS] Test that when removeExpired is true, released specified locks are deleted from MongoDB', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'remove-expired-on-release', {
		removeExpired: true,
	});
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test');
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	let ok: boolean;
	await t.notThrowsAsync(async () => {
		ok = await lock.release(code, 'test');
	});
	t.true(ok, 'The lock was released correctly');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 0, 'The record has not been removed after release');
});

test('[LOCKS] Test that when removeExpired is true, timed out locks are deleted from MongoDB', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'remove-expired-on-timeout', {
		removeExpired: true,
		timeout: threeSecsInMs,
	});
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire();
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let newCode: string;
	await t.notThrowsAsync(async () => {
		newCode = await lock.acquire();
	});
	t.truthy(newCode.match(codeRegexp), 'The lock code returned matches the code regexp');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 0, 'The record has not been removed after release');
});

test('[LOCKS] Test that when removeExpired is true, timed out specified locks are deleted from MongoDB', async (t: Assertions) => {
	const lock = new N9MongoLock(col, 'remove-expired-on-timeout', {
		removeExpired: true,
		timeout: threeSecsInMs,
	});
	const mongoClient = new MongoClient(`locks`, TestItem, TestItem);

	let code: string;
	await t.notThrowsAsync(async () => {
		code = await lock.acquire('test');
	});
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	await waitFor(threeSecsInMs + 100);

	let newCode: string;
	await t.notThrowsAsync(async () => {
		newCode = await lock.acquire('test');
	});
	t.truthy(newCode.match(codeRegexp), 'The lock code returned matches the code regexp');

	let count: number;
	await t.notThrowsAsync(async () => {
		count = await mongoClient.count({ code });
	});
	t.true(count === 0, 'The record has not been removed after release');
});

test('[LOCKS] Try ensuring index with wrong collection name', async (t: Assertions) => {
	const db = global.db;
	delete global.db;
	t.throws(() => new N9MongoLock('$collection-name'), {
		message: 'missing-db',
	});
	global.db = db;

	const lock = new N9MongoLock('$collection-name');

	let result: any;
	await t.throwsAsync(
		async () => {
			result = await lock.ensureIndexes();
		},
		{
			message: "Collection names must not contain '$'",
		},
	);
	t.truthy(!result, "The lock can't be ensured due to invalid collection name (contains $)");
});

test('[LOCKS] Try acquiring lock with wrong collection name', async (t: Assertions) => {
	const db = global.db;
	delete global.db;
	t.throws(() => new N9MongoLock('$collection-name'), {
		message: 'missing-db',
	});
	global.db = db;

	const lock = new N9MongoLock('$collection-name');

	let code: string;
	await t.throwsAsync(
		async () => {
			code = await lock.acquire();
		},
		{
			message: "Collection names must not contain '$'",
		},
	);
	t.truthy(!code, "The lock can't be acquired due to invalid collection name (contains $)");
});

test('[LOCKS] Try acquiring lock with valid key', async (t: Assertions) => {
	const db = global.db;
	delete global.db;
	t.throws(() => new N9MongoLock('$collection-name'), {
		message: 'missing-db',
	});
	global.db = db;

	const lockWithCollectionNameOk = new N9MongoLock('collection-name', { $ab: 123 } as any);

	let code: string;
	await t.throwsAsync(
		async () => {
			code = await lockWithCollectionNameOk.acquire();
		},
		{
			message: 'unknown operator: $ab',
		},
	);
	t.truthy(
		!code,
		"The lock can't be acquired due to invalid key $ab (it is confused to a mongodb operator)",
	);
});

test('[LOCKS] Try releasing lock with wrong collection name', async (t: Assertions) => {
	const db = global.db;
	delete global.db;
	t.throws(() => new N9MongoLock('$collection-name'), {
		message: 'missing-db',
	});
	global.db = db;

	const lock = new N9MongoLock('$collection-name');

	let ok: boolean;
	await t.throwsAsync(
		async () => {
			ok = await lock.release('a-fake-lock-id');
		},
		{
			message: "Collection names must not contain '$'",
		},
	);
	t.truthy(!ok, "The lock can't be released due to invalid collection name (contains $)");
});
