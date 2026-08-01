/**
 * Findings JSON contract v1.1.0 — canonical taxonomy carried in-band.
 * An external "contradiction database" was built with its own conflicting
 * CT01-CT43 numbering because this file shipped bare codes ("type": "CT03")
 * with no names or definitions. Every record now carries ct_name /
 * ct_category / ct_definition resolved from the engine's sealed
 * CONTRADICTION_TYPES map, and the file carries the full ct_taxonomy
 * glossary, so downstream databases inherit the one sealed taxonomy.
 *
 * buildFindingsJson is page-native in seal-document.html; the block is
 * extracted by marker and evaluated with the real engine map injected.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ENGINE = require('../forensic-engine-page.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  findings-json.test.mjs');
console.log('======================================================\n');

const html = readFileSync('seal-document.html', 'utf8');
const start = html.indexOf("// contract v1.0.0 — reports and exports speak in ordinals");
const end = html.indexOf('function buildLocalNarrative');
ok(start !== -1 && end > start, 'findings JSON emitter block located');
const src = html.slice(start, end);
const { buildFindingsJson } = new Function(
  'CONTRADICTION_TYPES', 'VO_ENGINE_VERSION',
  '"use strict";' + src + '\nreturn { buildFindingsJson };'
)(ENGINE.CONTRADICTION_TYPES, ENGINE.VO_ENGINE_VERSION);

const result = {
  findings: [
    { type: 'CT03', severity: 4, evidence: '"termination date" is stated as 7 Mar 2025 and as 13 Mar 2025', location: 'Page 95' },
    { type: 'SERIAL', serialPattern: 'SP01_ADVANCE_FEE_FRAUD', serialName: 'Advance Fee Fraud (419 Scam)', severity: 5, evidence: 'stages matched', location: 'Pages 3-9' },
    { type: 'CT28', severity: 3, evidence: 'cropped next to an image', location: 'Page 12', source: 'ai' },
  ],
  extractionNotes: 'note',
};
const json = buildFindingsJson(result, 'bundle.pdf', 'a'.repeat(128), 100, { caseName: 'Greensky' });

ok(json.findings_json_version === '1.1.0', 'contract version bumped to 1.1.0 (additive taxonomy fields)');

// Per-record canonical fields.
const [f1, f2, f3] = json.contradictions;
ok(f1.ct_name === 'Date Inconsistency' && f1.ct_category === 'STATEMENTAL' && typeof f1.ct_definition === 'string' && f1.ct_definition.length > 0,
  'CT03 record carries canonical name/category/definition');
ok(f2.ct_name === 'Advance Fee Fraud (419 Scam)' && f2.ct_category === 'SERIAL_PATTERN',
  'serial record carries its pattern name and SERIAL_PATTERN category');
ok(f3.ct_name === 'Image Integrity Failure',
  'AI-raised record still resolves its canonical CT name');

// The in-band glossary must be the engine map, exactly — no drift, no subset.
const tax = json.ct_taxonomy;
const engineIds = Object.values(ENGINE.CONTRADICTION_TYPES).map(t => t.id);
ok(Object.keys(tax).length === engineIds.length,
  `ct_taxonomy carries every sealed type (${Object.keys(tax).length}/${engineIds.length})`);
let mismatches = 0;
for (const t of Object.values(ENGINE.CONTRADICTION_TYPES)) {
  const g = tax[t.id];
  if (!g || g.name !== t.name || g.category !== t.category || g.definition !== t.desc) mismatches++;
}
ok(mismatches === 0, 'every glossary entry byte-matches the engine map (' + mismatches + ' mismatches)');

console.log(`\n[findings-json] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[findings-json] FAILURES'); process.exit(1); }
console.log('[findings-json] ALL GREEN');
