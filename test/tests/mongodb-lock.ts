import { N9Log } from '@neo9/n9-node-log';
import ava, { Assertions } from 'ava';
import { N9MongoLock } from '../../src';
import { init } from './fixtures/utils';

global.log = new N9Log('tests').module('lock-fields');

init();

ava('[LOCK] Test a simple lock', async (t: Assertions) => {
	const codeRegexp = new RegExp(/^[0-9a-f]{32}$/);
	const n9MongoLock = new N9MongoLock();

	await n9MongoLock.ensureIndexes();

	const code = await n9MongoLock.acquire();
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');

	const code2 = await n9MongoLock.acquire();
	t.falsy(code2, 'However, no code was returned since the lock was not acquired');

	const isReleased = await n9MongoLock.release(code);
	t.truthy(isReleased, 'Lock is released by calling function release');

	const code3 = await n9MongoLock.acquire();
	t.truthy(code3.match(codeRegexp), 'Get the lock another time');
});

ava('[LOCK] Test lock token and released later', async (t: Assertions) => {
	const codeRegexp = new RegExp(/^[0-9a-f]{32}$/);
	const n9MongoLock = new N9MongoLock(`another-collection${Date.now()}`);

	await n9MongoLock.ensureIndexes();

	const code = await n9MongoLock.acquire();
	t.truthy(code.match(codeRegexp), 'The lock code returned matches the code regexp');
	// release this lock in 3s
	setTimeout(() => n9MongoLock.release(code), 3000);

	const code2 = await n9MongoLock.acquireBlockingUntilAvailable(5000);
	t.truthy(code2.match(codeRegexp), 'Get the lock after waiting');
});
