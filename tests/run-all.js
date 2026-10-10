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
  'page-boot.test.mjs',
  'engine-perf.test.mjs',
  'voice-crypto.test.mjs',
  'pdf-encrypt.test.mjs',
  'find-seal.test.mjs',
  'seal-guard.test.mjs',
  'franchise-lease.test.mjs',
  'role-capacity.test.mjs',
  'detector-recall.test.mjs',
  'digital-forensics.test.mjs',
  'ocr-rescue.test.mjs',
  'rule-classify.test.mjs',
  'findings-json.test.mjs',
  'finding-anchors.test.mjs',
  'wrangler-config.test.mjs',
  'crop-normalize.test.mjs',
  'encrypt-detect.test.mjs',
  'constitution-lock.test.mjs',
  'ai-assess-batch.test.mjs',
  'narrate-excerpt.test.mjs',
  'human-report.test.mjs',
  'site-serving.test.mjs',
  'pages-bridge.test.mjs',
  'zip-intake.test.mjs',
  'photo-intake.test.mjs',
  'rule-package.test.mjs',
  'inline-scripts.test.mjs',
  'legal-analysis.test.js',
  'greensky-regression.test.js',
  'allfuels-regression.test.js',
  'annexure-eb-regression.test.mjs',
  'evidence-bundle-7-regression.test.mjs',
  'combine-06-april-regression.test.mjs',
  'louw-naidoo-regression.test.mjs',
  'timeline-dates.test.mjs',
  'doc-fact-index.test.mjs',
  'cross-doc-conflicts.test.mjs',
];

// A suite PASSES only if its own process exits 0. The runner prints its OWN
// authoritative result line per suite, derived from the exit code (and signal),
// NOT from any banner the suite printed — a suite's stdout can be misleading or
// truncated, but spawnSync's status/signal cannot be hidden by adjacent output.
let failed = 0;
const results = [];
for (const s of suites) {
  console.log('\n======================================================');
  console.log('RUN  ' + s);
  console.log('======================================================');
  const res = spawnSync(process.execPath, [path.join(__dirname, s)], { stdio: 'inherit' });
  const ok = res.status === 0 && !res.signal && !res.error;
  if (!ok) failed++;
  const why = res.error ? ('spawn error: ' + res.error.message)
    : res.signal ? ('killed by signal ' + res.signal)
    : ('exit ' + res.status);
  results.push({ s, ok, why });
  console.log('[run-all] ' + (ok ? 'PASS' : 'FAIL') + ' ' + s + ' (' + why + ')');
}

console.log('\n======================================================');
console.log('[run-all] per-suite results (authoritative, by exit code):');
for (const r of results) console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.s + '  (' + r.why + ')');
if (failed) {
  console.log('RESULT: ' + failed + ' of ' + suites.length + ' suite(s) FAILED');
  process.exit(1);
}
console.log('RESULT: all ' + suites.length + ' suites GREEN');
