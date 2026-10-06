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
    { type: 'CT03', severity: 4, evidence: '"termination date" is stated as 7 Mar 2025 and as 13 Mar 2025', location: 'Page 95',
      anchor: { who: [{ name: 'Gary Highcock', kind: 'name' }, { name: 'Lessee', kind: 'role' }], where: [95], quote: ['termination date'], when: ['7 Mar 2025', '13 Mar 2025'], law: ['clause 4.5.2'] },
      statement: 'Date Inconsistency (p.95): "termination date" is stated as 7 Mar 2025 and as 13 Mar 2025 Parties: Gary Highcock, Lessee.' },
    { type: 'SERIAL', serialPattern: 'SP01_ADVANCE_FEE_FRAUD', serialName: 'Advance Fee Fraud (419 Scam)', severity: 5, evidence: 'stages matched', location: 'Pages 3-9' },
    { type: 'CT28', severity: 3, evidence: 'cropped next to an image', location: 'Page 12', source: 'ai' },
  ],
  extractionNotes: 'note',
};
const json = buildFindingsJson(result, 'bundle.pdf', 'a'.repeat(128), 100, { caseName: 'Greensky' });

ok(buildFindingsJson(Object.assign({}, result, { referenceTime: '2026-10-02T20:11:36.233Z' }), 'bundle.pdf', 'a'.repeat(128), 100, {}).analysis_reference_utc === '2026-10-02T20:11:36.233Z' && json.analysis_reference_utc === null,
  'analysis_reference_utc records the instant the engine was given (null when none), so the dated-after note is reproducible');
ok(json.findings_json_version === '1.8.0', 'contract version bumped to 1.8.0 (candidate_law; 1.7.0 added brain, display_name, triple_verification, ai_review_note; candidates carry INSUFFICIENT, not a band; 1.6.0 added analysis_reference_utc; 1.5.0 ocr_held; 1.4.0 secondary_capped / ocr_anchored; 1.3.0 review_status / ocr_provenance / ocr_confidence / severity_capped_for_ocr)');

// v1.7.0 (evidence-bundle-7-docs review, 5 October 2026), with the report
// builder loaded as the page has it: the brain (§2), the measured label, the
// Thesis / Antithesis / Synthesis legs (§3), the AI's advisory note (founder
// ruling: a note, never a removal), and no confidence band on a candidate (PD1).
{
  if (!globalThis.PDFLib) globalThis.PDFLib = { rgb: (r, g, b) => ({ r, g, b }), StandardFonts: {}, PDFDocument: {} };
  const R = require('../forensic-report.js');
  const withWin = new Function(
    'CONTRADICTION_TYPES', 'VO_ENGINE_VERSION', 'window',
    '"use strict";' + src + '\nreturn { buildFindingsJson };'
  )(ENGINE.CONTRADICTION_TYPES, ENGINE.VO_ENGINE_VERSION, { VerumReport: R }).buildFindingsJson;
  const j7 = withWin({ findings: [
    { type: 'CT20', severity: 3, evidence: 'A number labelled as a registration is not a valid SA registration format: "Reg 12AB"', location: 'Page 54', aiReviewNote: 'reference to a portal number' },
    { type: 'CT39', severity: 3, evidence: 'Chain-of-custody documentation is claimed but only 2 of 5 steps appear', location: 'Page 17' },
    { type: 'CT28', severity: 3, evidence: 'cropped', location: 'Page 12', source: 'ai' }
  ] }, 'b.pdf', 'a'.repeat(128), 65, {});
  const [a, c, d] = j7.contradictions;
  ok(a.brain === 'B6' && c.brain === 'B2' && d.brain === null, 'every engine record names its brain (B6 for a registration number, B2 for a custody record); a candidate names none');
  ok(a.display_name === 'Registration Number Format Invalid' && a.ct_name === 'Registration Number Fake' && c.display_name === 'Chain-of-Custody Steps Not Documented', 'the measured label travels beside the sealed taxonomy name');
  ok(a.triple_verification && a.triple_verification.thesis.result === 'PASS' && a.triple_verification.status === 'ACCEPTED' && a.triple_verification.independent_verifiers === 1 && d.triple_verification === null, 'each engine record carries its Thesis / Antithesis / Synthesis legs and says one independent verifier made them');
  ok(a.ai_review_note === 'reference to a portal number' && c.ai_review_note === null && a.verification_status === 'ENGINE-VERIFIED', 'the AI\'s note rides beside the unchanged finding (the schema\'s enum value is unchanged)');
  ok(d.severity === 'INSUFFICIENT' && d.confidence === 'INSUFFICIENT' && d.detected_fact.confidence === 'INSUFFICIENT' && !/MODERATE|HIGH/.test(JSON.stringify(d)), 'an AI candidate carries no severity and no confidence band (PD1): the schema\'s INSUFFICIENT');
  ok(j7.engine_verified_count === 2 && j7.g3_candidate_count === 1, 'the candidate is never counted with the engine findings');
  // v1.8.0 (Combine 06 April 2026): the candidate law the report prints travels with each engine record.
  ok(Array.isArray(a.candidate_law) && a.candidate_law.length >= 1 && a.candidate_law[0].jurisdiction === 'ZA' && a.candidate_law[0].provisions.length >= 1 && a.legal_hypothesis === null && Array.isArray(d.candidate_law) && d.candidate_law.length === 0,
    'each engine record carries the report\'s candidate law by jurisdiction (legal_hypothesis stays null: no legal conclusion); a candidate carries none (' + JSON.stringify(a.candidate_law) + ')');
  ok(!/perj/i.test(JSON.stringify(c.candidate_law)), 'the custody-steps record carries no perjury candidate law, as in the report');
}

// The page block must not redeclare the engine's voCtById(id): two same-named
// declarations share one global, the later (no-arg) one won, voStatement got a
// map instead of a type, and every finding label rendered "undefined".
ok((html.match(/function voCtById\b/g) || []).length === 1,
  'exactly one voCtById declaration in seal-document.html (the inlined engine copy)');
ok(/function voCtMapById\(\)/.test(html), 'page-native map helper renamed to voCtMapById');

// Anchors bound into the record: who -> actors, when -> temporal_analysis,
// document-cited law -> document_cited_provisions (cite-or-stay-silent).
const r0 = json.contradictions[0];
ok(r0.proposition_a_actor === 'Gary Highcock', 'first party bound to proposition_a_actor');
ok(r0.proposition_b_actor === 'Lessee', 'second party bound to proposition_b_actor');
ok(r0.temporal_analysis === '7 Mar 2025, 13 Mar 2025', 'anchor dates flow into temporal_analysis');
ok(Array.isArray(r0.document_cited_provisions) && r0.document_cited_provisions[0] === 'clause 4.5.2',
  'document-cited provision carried (cite-or-stay-silent)');
ok(r0.anchors && r0.anchors.where[0] === 95 && r0.anchors.law[0] === 'clause 4.5.2',
  'full anchor block (where/law) carried on the record');
ok(typeof r0.anchored_statement === 'string' && r0.anchored_statement.length > 0,
  'flat anchored_statement carried on the record');
// A finding with no anchor (serial/AI) must not crash and must state no law.
ok(Array.isArray(json.contradictions[1].document_cited_provisions) && json.contradictions[1].document_cited_provisions.length === 0,
  'anchorless finding yields empty provisions, not a crash');

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
