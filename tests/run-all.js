// Runs every test file in its own Node process so per-file assertion counters
// stay isolated. Exits non-zero if any suite fails.
//
// Run:  node tests/run-all.js   (or:  npm test)

const { spawnSync } = require('node:child_process');
const path = require('path');

const suites = [
  'forensic-engine.test.js',
  'ots-proof.test.js',
  'worker.test.mjs',
];

let failed = 0;
for (const s of suites) {
  console.log('\n======================================================');
  console.log('RUN  ' + s);
  console.log('======================================================');
  const res = spawnSync(process.execPath, [path.join(__dirname, s)], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}

console.log('\n======================================================');
if (failed) {
  console.log('RESULT: ' + failed + ' suite(s) FAILED');
  process.exit(1);
}
console.log('RESULT: all suites GREEN');
