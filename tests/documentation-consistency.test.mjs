import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { ok, done } = require('./_assert.js');
const Engine = require('../forensic-engine-page.js');
const read = (file) => readFileSync(file, 'utf8');
const engineSource = read('forensic-engine-page.js');
const reportSource = read('forensic-report.js');
const html = read('seal-document.html');

console.log('======================================================');
console.log('RUN  documentation-consistency.test.mjs');
console.log('======================================================\n');

const ctKeys = Object.keys(Engine.CONTRADICTION_TYPES);
const detectorKeys = Object.keys(Engine.DETECTORS);
const numericPrefixes = new Set(detectorKeys.map((key) => (key.match(/^D(\d+)/) || [])[1]).filter(Boolean));
const unsuffixed = detectorKeys.filter((key) => /^D\d+_/.test(key));
const suffixed = detectorKeys.filter((key) => /^D\d+[A-Z]_/.test(key));
const runStart = engineSource.indexOf('  var detectors = [');
const runEnd = engineSource.indexOf('  ];', runStart);
const runList = [...engineSource.slice(runStart, runEnd).matchAll(/DETECTORS\.(D\w+)/g)].map((match) => match[1]);
const reportCounts = reportSource.match(/var DETECTOR_COUNT = (\d+), CT_COUNT = (\d+), SP_COUNT = (\d+);/);
const builderVersion = reportSource.match(/FORENSIC REPORT BUILDER v(\d+\.\d+\.\d+)/);
const findingsVersion = html.match(/findings_json_version:\s*'([^']+)'/);
const suiteRegistry = read('tests/run-all.js');
const suiteCount = [...suiteRegistry.matchAll(/^  '[^']+\.test\.(?:mjs|js)',$/gm)].length;

ok(Engine.VO_ENGINE_VERSION === '5.7.4-web', 'engine version is the audited current source version');
ok(reportSource.includes("var ENGINE_VERSION = '5.7.4-web';"), 'report engine version agrees with engine source');
ok(builderVersion && builderVersion[1] === '1.3.1', 'report builder version comes from report source');
ok(ctKeys.length === 61 && ctKeys.some((key) => key.startsWith('CT61_')), 'taxonomy contains CT01 through CT61');
ok(detectorKeys.length === 63, 'detector registry contains 63 entries');
ok(numericPrefixes.size === 46 && unsuffixed.length === 45 && suffixed.length === 18, 'detector terminology distinguishes 46 numeric prefixes, 45 unsuffixed and 18 suffixed entries');
ok(runStart >= 0 && runEnd > runStart && runList.length === 61 && new Set(runList).size === 61, 'main run-list contains 61 unique registered entries');
ok(!runList.includes('D37_DETECT_INTERNAL_CONFLICT_CATCHALL') && detectorKeys.includes('D37_DETECT_INTERNAL_CONFLICT_CATCHALL'), 'D37 is registered and runs separately from the main run-list');
ok(!runList.includes('D10A_DETECT_S12B_LICENCE_PREDICATE_CONFLICT') && detectorKeys.includes('D10A_DETECT_S12B_LICENCE_PREDICATE_CONFLICT'), 'D10A is retained but inactive');
ok(reportCounts && +reportCounts[1] === runList.length && +reportCounts[2] === ctKeys.length && +reportCounts[3] === 17, 'report fallback counts match main run-list, taxonomy and serial registry');
ok(findingsVersion && findingsVersion[1] === '1.11.0', 'production Findings JSON version remains source-derived 1.11.0');
ok(suiteCount === 72 && suiteRegistry.includes("'ots-chain-confirmation.test.mjs'") && suiteRegistry.includes("'finding-verification.test.mjs'") && suiteRegistry.includes("'verify-first-timer.test.mjs'") && suiteRegistry.includes("'verify-gps-visibility.test.mjs'") && suiteRegistry.includes("'verify-receipt-label.test.mjs'") && suiteRegistry.includes("'detection-credibility.test.mjs'") && suiteRegistry.includes("'pr327-review.test.mjs'") && suiteRegistry.includes("'analysis-contracts.test.mjs'") && suiteRegistry.includes("'documentation-consistency.test.mjs'") && suiteRegistry.includes("'evaluation-metrics.test.mjs'") && suiteRegistry.includes("'evaluation-contractnli.test.mjs'") && suiteRegistry.includes("'evaluation-contradoc.test.mjs'") && suiteRegistry.includes("'evaluation-eyecite.test.mjs'") && suiteRegistry.includes("'legal-citations.test.mjs'") && suiteRegistry.includes("'legal-citations-za.test.mjs'") && suiteRegistry.includes("'redaction-fixtures.test.mjs'") && suiteRegistry.includes("'pdf-graph.test.mjs'"), 'all 72 Node suites are explicitly registered');
const testsGuide = read('tests/README.md');
ok(testsGuide.includes('| 58 | `evaluation-metrics` | `evaluation-metrics.test.mjs` | 116 |') &&
   testsGuide.includes('| 60 | `evaluation-contradoc` | `evaluation-contradoc.test.mjs` | 101 |') &&
 testsGuide.includes('**72 registered production/baseline suites**') &&
   testsGuide.includes('| 69 | `ots-chain-confirmation` | `ots-chain-confirmation.test.mjs` | 206 |') &&
 testsGuide.includes('| 70 | `verify-first-timer` | `verify-first-timer.test.mjs` | 8 |') &&
 testsGuide.includes('| 71 | `verify-gps-visibility` | `verify-gps-visibility.test.mjs` | 6 |') &&
 testsGuide.includes('| 72 | `verify-receipt-label` | `verify-receipt-label.test.mjs` | 8 |') &&
 testsGuide.includes('| 66 | `pr327-review` | `pr327-review.test.mjs` | 40 |'),
'test guidance records the current 72-suite registry and exact recipient-suite assertions');

const readme = read('README.md');
ok(readme.includes('VO_ENGINE_VERSION 5.7.4-web') && readme.includes('CT01–CT61') && readme.includes('Findings JSON 1.11.0'), 'README current engine/taxonomy/findings line agrees with source');
ok(readme.includes('report builder v1.3.1'), 'README names the source-derived report builder');
ok(readme.includes('website + Android `1verum`') && readme.includes('Android reference `cursorfu`') && readme.includes('Guardian firewall `firebase`'), 'README retains the four-system surface model');
ok(readme.includes('`seal-module/web/` is NOT the live site') && readme.includes('Edit the root files.'), 'README distinguishes root production sources from obsolete snapshots');

const agents = read('AGENTS.md');
const normalizedAgents = agents.replace(/\s+/g, ' ');
ok(agents.includes('46 numeric prefixes, 45 unsuffixed entries and 18 suffixed entries') && agents.includes('61 entries in the main run-list'), 'AGENTS Quick facts uses precise detector terminology');
ok(agents.includes('**72 registered suites**'), 'AGENTS Quick facts names the current registered suite count');
ok(normalizedAgents.includes('Secondary-report exclusion is classification, not authentication:') &&
   normalizedAgents.includes('platform output — report pages, seal footers, and manifest blocks — is never evidence') &&
   normalizedAgents.includes('metadata cues corroborate an independently established report but never establish it') &&
   normalizedAgents.includes('Retain an extraction-note disclosure for each affected page'),
  'AGENTS preserves the report-exclusion and disclosure invariant');

const architecture = read('ARCHITECTURE.md');
ok(architecture.includes('remains at v1.11.0') && architecture.includes('provenance appears only in the printed report'), 'ARCHITECTURE names the current findings version and report-only verifier provenance');
ok(architecture.includes('authoritative') || architecture.includes('`FINDINGS_JSON_SCHEMA.json` is kept in `1verum` and `firebase`'), 'ARCHITECTURE retains the external authoritative findings schema boundary');
ok(architecture.includes('**63 entries**') && architecture.includes('**61 entries**'), 'ARCHITECTURE distinguishes total registry and main run-list');

const reference = read('REFERENCE.md');
ok(reference.includes('**`analysis-contracts.js`**') && reference.includes('**`analysis-config.js`**'), 'REFERENCE documents both new shared scripts');
ok(reference.includes('**72 registered suites**') && reference.includes('QPDF-WASM and Playwright are development-only'), 'REFERENCE has current tests and dependency posture');

const engineDoc = read('ENGINE.md');
ok(engineDoc.includes('## 2. Contradiction types (CT01–CT61)') && engineDoc.includes('## 3. Detector inventory (63 registered entries)'), 'ENGINE current taxonomy and detector headings agree with source');
ok(engineDoc.includes('**Findings JSON:** v1.11.0') && engineDoc.includes('report builder v1.3.1'), 'ENGINE header has current findings and report-builder versions');
ok(engineDoc.includes('**72 registered suites**'), 'ENGINE test section names the current registry size');
ok(engineDoc.includes('| `verify-first-timer.test.mjs` | 8 |') &&
   engineDoc.includes('| `verify-gps-visibility.test.mjs` | 6 |') &&
   engineDoc.includes('| `verify-receipt-label.test.mjs` | 8 |'),
  'ENGINE records the measured recipient-suite assertion counts');
const testReadme = read('tests/README.md');
ok(engineDoc.includes('| `annexure-eb-regression.test.mjs` | 502 |') &&
   testReadme.includes('| 33 | `annexure-eb` | `annexure-eb-regression.test.mjs` | 502 |') &&
   engineDoc.includes('| `redaction-fixtures.test.mjs` | 54 |') &&
   testReadme.includes('| 64 | `redaction-fixtures` | `redaction-fixtures.test.mjs` | 54 |'),
  'Annexure EB and redaction fixture assertion counts match the measured suite outputs in both inventories');

ok(!html.includes("of 46 contradiction types triggered") && !html.includes("'/46 triggered"), 'stale 46-type user-facing totals are gone');
const detectorProgress = html.match(/\b\d+ contradiction detectors running\.\.\./g) || [];
ok(!html.includes('40 contradiction detectors running...') && detectorProgress.length === 2 && detectorProgress.every((message) => message === runList.length + ' contradiction detectors running...'), 'both forensic progress messages use the source-derived 61-entry main run-list count');
const dynamicTotals = html.match(/Object\.keys\(CONTRADICTION_TYPES\)\.length/g) || [];
ok(dynamicTotals.length >= 2 && html.includes("' of ' + Object.keys(CONTRADICTION_TYPES).length + ' contradiction types triggered'"), 'seal-page result totals derive from the live taxonomy');
ok(html.includes('/* VO-INLINE:analysis-contracts.js:START */') && html.includes('/* VO-INLINE:analysis-config.js:START */'), 'new shared contracts are inlined into the production seal page');
const configPosition = html.indexOf('/* VO-INLINE:analysis-config.js:START */');
const enginePosition = html.indexOf('/* VO-INLINE:forensic-engine-page.js:START */');
ok(configPosition >= 0 && configPosition < enginePosition, 'configuration loads before the engine that consumes it');
ok(/findings_json_version:\s*'1\.11\.0'/.test(html) &&
   !/verification:\s*f\.verification/.test(html) &&
   !/analysis_extensions\s*:/.test(html.slice(html.indexOf('function buildFindingsJson'), html.indexOf('function buildLocalNarrative'))),
  'production Findings JSON stays v1.11.0 and adds no verifier fields or analysis_extensions');

done('documentation-consistency');
