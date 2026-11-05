/**
 * Batch 6 (evidence-bundle-6 review, 5 November 2026). The engine measured
 * well but labelled poorly: every measurement was called a "contradiction".
 * Eight approved changes, pinned here:
 *
 *  1. CT54 reconciles with OCR rescue — a thin page the OCR pass rendered is
 *     an OCR-attempted limit ("recovered by OCR rescue"), never "went
 *     unchecked" (WF2 counts the same pages as examined).
 *  2. Every finding carries an epistemic class: CONTRADICTION / TENSION /
 *     COMPLETENESS / EXAMINATION_LIMIT / BEHAVIORAL.
 *  3. Actor-mismatch gate: same-actor types (CT05/CT06/CT10/CT11/CT46) whose
 *     two quotes name different parties demote to TENSION ("Learned Judge"
 *     vs "Crompton Motors" is a dispute, not a logical impossibility).
 *  4. Empty counter-proposition gate: a pair-scoped finding anchored to one
 *     side only demotes to TENSION, never CONTRADICTION.
 *  5. CT32 ignores internal self-references ("the terms of this Contract").
 *  6. Unanchored AI candidates are dropped, counted and disclosed — pinned in
 *     ai-assess-batch.test.mjs.
 *  7. Headline counts speak by class, not one flat "contradictions" number.
 *  8. Clause/paragraph numbering binds to the finding anchors ("clause
 *     1.1.50", "AD PARAGRAPH 227").
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');
const R = require('../forensic-report.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  batch6-finding-classes.test.mjs');
console.log('======================================================\n');

const filler = () => ('the quick brown fox jumps over the lazy dog near the river bank again today. ').repeat(12);

// ---- 1. D08A: OCR-attempted thin pages are honest about what happened ------
{
  const blocks = [filler(), filler(), '[OCR] 9k4',
    '', // genuinely unreadable, no OCR provenance
    filler(), filler()];
  const fs = E.DETECTORS.D08A_DETECT_SCAN_ONLY_PAGE(blocks, { ocrRan: true, ocrPages: [3] });
  ok(fs.length === 2, 'two thin runs produce two findings (' + fs.length + ')');
  const ocrF = fs.find(f => /Page 3/.test(f.location || ''));
  const plainF = fs.find(f => /Page 4/.test(f.location || ''));
  ok(ocrF && /recovered by OCR rescue/.test(ocrF.evidence) && ocrF.ocrAttempted === true,
    'OCR-rendered thin page reads "recovered by OCR rescue", marked ocrAttempted');
  ok(ocrF && !/went unchecked/.test(ocrF.evidence),
    'OCR-rendered thin page is never said to have "gone unchecked"');
  ok(plainF && /went unchecked/.test(plainF.evidence) && plainF.ocrAttempted === false,
    'a thin page with no OCR provenance keeps the "went unchecked" wording');
}
{
  // Whole document unreadable and OCR was run: say so, do not tell the user
  // to "OCR the pages and re-run" as if that had not happened.
  const fs = E.DETECTORS.D08A_DETECT_SCAN_ONLY_PAGE(['', '', ''], { ocrRan: true, ocrPages: [] });
  ok(fs.length === 1 && /OCR rescue was run/.test(fs[0].evidence) && fs[0].ocrAttempted === true,
    'whole-document case with OCR run discloses the failed OCR pass');
}

// ---- 2. Class table: spot checks across all five classes -------------------
ok(E.voClassifyFinding({ type: 'CT03' }) === 'CONTRADICTION', 'CT03 is a contradiction');
ok(E.voClassifyFinding({ type: 'CT45' }) === 'CONTRADICTION', 'CT45 is a contradiction');
ok(E.voClassifyFinding({ type: 'CT26' }) === 'TENSION', 'CT26 format anomaly is a tension');
ok(E.voClassifyFinding({ type: 'CT57' }) === 'TENSION', 'CT57 factive/denial is a tension (its own descriptor: indicator)');
ok(E.voClassifyFinding({ type: 'CT31' }) === 'COMPLETENESS', 'CT31 missing cross-reference is a completeness issue');
ok(E.voClassifyFinding({ type: 'CT53' }) === 'COMPLETENESS', 'CT53 blank execution block is a completeness issue');
ok(E.voClassifyFinding({ type: 'CT54' }) === 'EXAMINATION_LIMIT', 'CT54 is an examination limit');
ok(E.voClassifyFinding({ type: 'CT48' }) === 'BEHAVIORAL', 'CT48 reality-denial is a behavioural indicator');
ok(E.voClassifyFinding({ type: 'CT99' }) === 'TENSION', 'an unknown type defaults to tension, never contradiction');
ok(E.voClassifyFinding({ type: 'SERIAL' }) === null, 'serial patterns are not classed (own section)');

// ---- 4. Empty counter-proposition gate -------------------------------------
{
  // CT01 is pair-capable; one anchored side only -> TENSION with a reason.
  const one = [{ type: 'CT01', severity: 5, evidence: 'the letter states "paid in full"',
    anchor: { who: [], where: [4], quote: ['paid in full'], when: [], law: [], clauses: [] } }];
  E.voApplyFindingClasses(one);
  ok(one[0].findingClass === 'TENSION' && /Only one side/.test(one[0].classNote || ''),
    'pair-scoped finding with one anchored side demotes to tension');
  // The same finding with both sides anchored stays a contradiction.
  const two = [{ type: 'CT01', severity: 5, evidence: '"paid in full" vs "no payment received"',
    anchor: { who: [], where: [4, 9], quote: ['paid in full', 'no payment received'], when: [], law: [], clauses: [] } }];
  E.voApplyFindingClasses(two);
  ok(two[0].findingClass === 'CONTRADICTION', 'two anchored sides stay a contradiction');
  // A fragment under twelve characters is not a counter-proposition (the
  // evidence-bundle-6 "Conduct Admission": "i admit" beside a full passage).
  const frag = [{ type: 'CT01', severity: 5, evidence: '"i admit" beside the passage',
    anchor: { who: [], where: [4], quote: ['i admit', 'I admit that annexure B was sent to the Controller'], when: [], law: [], clauses: [] } }];
  E.voApplyFindingClasses(frag);
  ok(frag[0].findingClass === 'TENSION',
    'a quoted fragment under twelve characters does not count as a second side');
  // A rule-verified single-sided type (registration fails the registry check)
  // is self-scoped and stays a contradiction on one quote.
  const self = [{ type: 'CT20', severity: 5, evidence: 'registration "ABC123" fails validation',
    anchor: { who: [], where: [2], quote: ['ABC123'], when: [], law: [], clauses: [] } }];
  E.voApplyFindingClasses(self);
  ok(self[0].findingClass === 'CONTRADICTION', 'self-scoped validity check keeps its class on one anchor');
}

// ---- 3. Actor-mismatch gate (same-actor types only) -------------------------
{
  const mismatched = [{ type: 'CT06', severity: 5, evidence: '"the order was granted" vs "no order exists"',
    anchor: { who: [], where: [4, 9], quote: ['Rayhaan Khan told the court the order was granted', 'Crompton Motors holds no order'], when: [], law: [], clauses: [] } }];
  E.voApplyFindingClasses(mismatched);
  ok(mismatched[0].findingClass === 'TENSION' && mismatched[0].actorMismatch === true && /different parties/.test(mismatched[0].classNote || ''),
    'CT06 with differently-named parties demotes to tension with actorMismatch');
  const sameActor = [{ type: 'CT06', severity: 5, evidence: '"I never signed" vs "I signed"',
    anchor: { who: [], where: [4, 9], quote: ['Gary Highcock never signed the addendum', 'Gary Highcock signed the addendum on that day'], when: [], law: [], clauses: [] } }];
  E.voApplyFindingClasses(sameActor);
  ok(sameActor[0].findingClass === 'CONTRADICTION', 'CT06 on one party stays a contradiction');
  // Witness-statement conflict is DESIGNED for two actors: never gated.
  const witnesses = [{ type: 'CT40', severity: 4, evidence: '"the car was red" vs "the car was blue"',
    anchor: { who: [], where: [4, 9], quote: ['James Nkosi saw a red car', 'Pieter Botha saw a blue car'], when: [], law: [], clauses: [] } }];
  E.voApplyFindingClasses(witnesses);
  ok(witnesses[0].findingClass === 'CONTRADICTION', 'CT40 between two witnesses is a contradiction, not gated');
}

// ---- 5. CT32 internal self-reference stoplist -------------------------------
{
  const boiler = [filler(), filler(), filler(),
    'The parties agree in accordance with the terms of this Contract that delivery follows. ' + filler()];
  ok(E.DETECTORS.D36_DETECT_SOURCE_FAILURE(boiler).length === 0,
    '"the terms of this Contract" is boilerplate, not a missing source');
  const boiler2 = [filler(), filler(), filler(),
    'Payment follows as per the provisions of this Agreement. ' + filler()];
  ok(E.DETECTORS.D36_DETECT_SOURCE_FAILURE(boiler2).length === 0,
    '"the provisions of this Agreement" is boilerplate, not a missing source');
  const real = [filler(), filler(), filler(),
    'The price was set according to the Harris Valuation Report. ' + filler()];
  const f32 = E.DETECTORS.D36_DETECT_SOURCE_FAILURE(real);
  ok(f32.length === 1 && /Harris Valuation/.test(f32[0].evidence),
    'a genuine single-citation external source is still found');
}

// ---- 8. Clause / paragraph-number anchors -----------------------------------
{
  const cr = E.voExtractClauseRefs('see clause 1.1.50 and AD PARAGRAPH 227');
  ok(cr.length === 2 && cr.indexOf('clause 1.1.50') !== -1 && cr.indexOf('AD PARAGRAPH 227') !== -1,
    'clause 1.1.50 and AD PARAGRAPH 227 both extracted, once each (' + JSON.stringify(cr) + ')');
}
ok(E.voExtractClauseRefs('under section 12(1) of the Act').length === 0,
  'statute sections stay with the law extractor, not the clause one');
{
  const page = 'Some opening text. AD PARAGRAPH 227 The respondent states that the vessel was never used for charter, which is denied. Further text follows here.';
  const found = E.voClauseContextOf(page, 'The respondent states that the vessel was never used for charter');
  ok(found === 'AD PARAGRAPH 227', 'the numbered paragraph above the quote is found (' + found + ')');
  ok(E.voClauseContextOf(page, 'text that is not on the page at all') === null,
    'a quote not on the page binds no clause');
}
{
  // End-to-end through voAnchorEnrich: a finding whose page carries a numbered
  // paragraph above its quote gets the clause bound into its anchor.
  const blocks = ['AD PARAGRAPH 227 The respondent denies chartering the vessel. ' + filler()];
  const f = [{ type: 'CT01', severity: 5, evidence: 'the affidavit states "The respondent denies chartering the vessel"', location: 'Page 1' }];
  E.voAnchorEnrich(f, blocks, []);
  ok(f[0].anchor && (f[0].anchor.clauses || []).some(c => /AD PARAGRAPH 227/.test(c)),
    'anchor.clauses carries the paragraph the passage sits under (' + JSON.stringify(f[0].anchor && f[0].anchor.clauses) + ')');
}

// ---- 2/7. Report side: fallback map identical, headline speaks by class -----
{
  const em = E.VO_FINDING_CLASS, rm = R._VO_FINDING_CLASS_FALLBACK;
  const keys = Object.keys(em).sort();
  ok(JSON.stringify(keys) === JSON.stringify(Object.keys(rm).sort()) &&
     keys.every(k => em[k] === rm[k]),
    'report fallback class map is identical to the engine VO_FINDING_CLASS');
  ok(R._voFindingClassOf({ type: 'CT03' }) === 'CONTRADICTION' &&
     R._voFindingClassOf({ type: 'CT03', findingClass: 'TENSION', classNote: 'x' }) === 'TENSION',
    'a stamped class wins; the fallback only fills older data');
  const line = R._voClassBreakdownSentence([
    { type: 'CT03' }, { type: 'CT45' }, { type: 'CT31' }, { type: 'CT54' }, { type: 'CT48' }, { type: 'CT26' }]);
  ok(/2 contradictions/.test(line) && /1 tension/.test(line) && /1 completeness issue/.test(line) &&
     /1 examination limit/.test(line) && /1 behavioural indicator/.test(line),
    'headline breakdown names every class in a fixed order (' + line + ')');
  ok(R._voClassBreakdownSentence([{ type: 'SERIAL' }]) === '',
    'serial patterns never enter the class breakdown');
}

console.log('\n[batch6] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[batch6] ALL GREEN');
