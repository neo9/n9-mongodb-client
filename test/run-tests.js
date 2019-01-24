const execSync = require('child_process').execSync;

const baseIndex = process.argv.findIndex((arg) => arg.includes('run-tests.js'));

const param1 = process.argv[baseIndex + 1] || '';
const type = param1.toLowerCase();
const testMatch = process.argv[baseIndex + 2] || '';
let match = '';

if (testMatch) {
	match = `--match='*${testMatch}*'`
}

console.log(`RUNNING TESTS DEV: ${type} TEST matching: ${testMatch || 'all'}`);

let cmd;
if (type === 'dev') {
	cmd = `npm run build && nyc ava --verbose --serial ${match} dist/test/tests/ && nyc report --reporter=html`;
} else if (type === 'watch') {
	cmd = `npm run dev & \n  nyc ava --verbose --watch --serial ${match} dist/test/tests/ `
} else {
	cmd = `npm run lint  && npm run build && nyc ava --verbose --serial dist/test/tests/ ${testMatch} && nyc report --reporter=html`;
}

console.log(`Exec : ${cmd}`);
console.log('-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --')
execSync(cmd, { stdio: [0, 1, 2] });
