/**
 * CT46 — Role / Capacity Contradiction (D40). Generic, derived, NO hardcoded
 * parties or account numbers: it fires when an actor claims a corporate capacity
 * yet routes money to an explicitly PERSONAL account (Path A), or states a
 * restriction on its capacity and then records conduct that breaches it (Path B).
 *
 * The design is deliberately precision-first. These tests lock BOTH the true
 * positives AND the silences that matter most: a lawful attorney/firm trust
 * account for a company, an ordinary corporate payment, and a plain personal
 * account with no corporate claim must all stay quiet -- otherwise the detector
 * would fabricate an allegation on routine, lawful documents.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  role-capacity.test.mjs');
console.log('======================================================\n');

const DET = require('../forensic-engine-page.js').DETECTORS;
const D40 = DET && DET.D40_DETECT_ROLE_CAPACITY_CONFLICT;
ok(Boolean(D40), 'D40 detector is exported');

// --- Path A: corporate capacity claimed, money to a personal account ---
const pathA = [
  'I confirm that I was instructed in my capacity as a director of Feike (Pty) Ltd.',
  'Kindly pay the deposit of R275,000 into my personal trust account.'
];
let a = D40(pathA);
ok(a.length > 0 && a[0].type === 'CT46', 'Path A: fires CT46 when a corporate capacity is claimed but payment goes to a personal account');
ok(a.length > 0 && a[0].severity === 4, 'CT46 is severity 4 (HIGH indicator, not a determination)');
ok(a.length > 0 && /Page 1 vs Page 2/.test(a[0].location), 'CT46 anchors to the real pages of each half');
ok(a.length > 0 && /personal trust account/i.test(a[0].evidence) && /Feike \(Pty\) Ltd/i.test(a[0].evidence),
  'CT46 evidence quotes both the corporate claim and the personal-account instruction');
ok(a.length > 0 && /legal characterisation is for the court/.test(a[0].evidence), 'CT46 states the finding as fact and reserves the legal characterisation to the court (PD16)');

// --- Path B: stated restriction vs stated breach ---
const pathB = [
  'As an advocate I may not accept briefs directly from a member of the public.',
  'Nonetheless, in this matter I accepted a brief from a member of the public.'
];
let b = D40(pathB);
ok(b.length > 0 && b.some(f => f.type === 'CT46'), 'Path B: fires CT46 when a stated capacity restriction is contradicted by stated conduct');
ok(b.some(f => /restriction on the actor's capacity/.test(f.evidence)), 'Path B evidence quotes both the restriction and the breach');

// --- Silences that protect precision (must NOT fire) ---

// A lawful attorney/firm trust account held FOR a company is normal practice.
ok(D40([
  'We act herein on behalf of ABC Holdings (Pty) Ltd.',
  'Please pay the settlement funds into our trust account as usual.'
]).length === 0, 'silent: a lawful firm/attorney trust account for a company is not flagged');

// Corporate capacity paid to a corporate/company account -- no contradiction.
ok(D40([
  'Acting for XYZ Trading (Pty) Ltd in this transaction.',
  'Deposit the amount into the company account.'
]).length === 0, 'silent: corporate capacity paid to a corporate account');

// A personal account instruction with NO corporate-capacity claim is just a payment.
ok(D40([
  'Thanks for the invoice.',
  'Please pay into my personal account when convenient.'
]).length === 0, 'silent: a plain personal-account payment with no corporate claim');

// A restriction stated with no breach recorded is not a contradiction.
ok(D40([
  'Per the rules of the Bar, I may not accept briefs from a member of the public.'
]).length === 0, 'silent: a capacity restriction alone (no breach recorded)');

// Ordinary clean prose.
ok(D40(['This is a normal letter confirming a meeting next Tuesday.']).length === 0,
  'silent: clean prose produces no CT46 finding');

console.log(`\n[role-capacity] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[role-capacity] FAILURES'); process.exit(1); }
console.log('[role-capacity] ALL GREEN');
