// Runs separately gated development contracts without changing the audited
// production/baseline registry in run-all.js. Included in npm test.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const suites = ['nine-brain-contracts.test.mjs'];
let failed = 0;
for (const suite of suites) {
  const result = spawnSync(process.execPath, [path.join(__dirname, suite)], { stdio: 'inherit' });
  if (result.status !== 0 || result.signal || result.error) failed++;
}
if (failed) {
  console.log('RESULT: ' + failed + ' of ' + suites.length + ' development suite(s) FAILED');
  process.exit(1);
}
console.log('RESULT: all ' + suites.length + ' separately gated development suite(s) GREEN');
