/**
 * "Louw v Naidoo" (evidence-bundle-6-docs) engine-precision guard (6 Oct 2026).
 *
 * A third-party AI review graded the deterministic engine's run of this
 * 158-page bundle a C-. Most of its complaint mistook the anomaly engine for
 * the human forensic narrative (Case 341/2025), which is a separate instrument
 * and already carries the substantive analysis. But two of its points were
 * real precision defects in the engine, fixed here:
 *
 *   1. D06 / CT09 fused one man's SA ID, a DFFE fishing-right number and a
 *      second man's SA ID into "4 different identity numbers attributed to one
 *      labelled subject". In truth 4805175068087 and "480517 5068 08 7" are
 *      Louw's one ID typed solid and spaced; LF210223 is a fishing right, not
 *      an identity; 9801235120088 is Naidoo's — a different person.
 *
 *   2. D25 / CT37 emitted six separate lookalike-email findings over one
 *      cluster of near-identical domains (gmail.com, gmall.com, ymail.com,
 *      ymail.coi), which then fanned out across every name on their pages.
 *
 * No real-matter document is committed; each guard uses the bundle's own
 * identifier/domain shapes in synthetic passages, with a positive control.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');
const DET = E.DETECTORS;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };
const of = (fn, blocks, type) => (fn(blocks) || []).filter(f => f.type === type && !f.contextOnly);
const ct09 = (b) => of(DET.D06_DETECT_IDENTITY_CONFLICT, b, 'CT09');
const ct37 = (b) => of(DET.D25_DETECT_CONTACT_MISMATCH, b, 'CT37');

console.log('======================================================');
console.log('RUN  louw-naidoo-regression.test.mjs');
console.log('======================================================\n');

// ---- 1. Identity over-grouping (CT09) --------------------------------------

// The real cluster: Louw's ID (solid + spaced), a DFFE right, Naidoo's ID,
// each labelled, with no single owning name resolvable between them.
ok(ct09([
  'Identity number 4805175068087 and fishing right LF210223 on this page.',
  'ID 480517 5068 08 7 recorded again here.',
  'Identity number 9801235120088 appears on the rental schedule.'
]).length === 0,
  'CT09 silent: one ID typed solid and spaced, a fishing right, and a second person\'s ID are not "4 different identity numbers for one subject"');

// The spaced and solid forms of ONE id, same labelled subject, never make two.
ok(ct09(['ID 4805175068087 of the holder; the identity number 480517 5068 08 7 is repeated below.']).length === 0,
  'CT09 silent: 4805175068087 and 480517 5068 08 7 are the same identity, solid vs spaced');

// A fishing right / permit number labelled as a right is not an identity.
ok(ct09([
  'Ritzema Louw, identity number 4805175068087, holder of Commercial Traditional Linefish Right LF210223.'
]).length === 0,
  'CT09 silent: LF210223 is a fishing-right number, not a second identity for the holder');

// Positive control: the SAME resolved person really does carry two different
// 13-digit identity numbers -> still a finding (annexure-EB contract kept).
ok(ct09([
  'Applicant Sipho Dlamini, ID 8001015009087, on the form.',
  'Sipho Dlamini gives identity number 7502204567089 on the affidavit.'
]).length === 1,
  'CT09 still fires: the same person carries two different 13-digit identity numbers');

// Positive control: two labelled lettered identity codes for one person.
ok(ct09([
  'Holder Jan Botha, ID AB1234567, noted.', 'Jan Botha passport CD7654321 recorded.'
]).length === 1,
  'CT09 still fires: the same person with two labelled lettered identity codes');

// A DFFE right and an SA ID are different identifier TYPES: never grouped even
// when attributed to the same named person.
ok(ct09([
  'Ritzema Louw, identity number 4805175068087; Ritzema Louw also holds right LF210223 and vessel DTD782C.'
]).length === 0,
  'CT09 silent: a right number and a vessel registration are not identity numbers');

// ---- 2. Lookalike-email over-reporting (CT37) ------------------------------

// The real cluster: four near-identical webmail domains across the bundle.
// One cluster -> ONE finding, not six pairwise findings.
const cluster = ct37([
  'write to a@gmail.com and b@gmall.com for the account',
  'copy c@ymail.com and d@ymail.coi on the reply'
]);
ok(cluster.length === 1,
  'CT37: a cluster of four near-identical domains is one finding, not six (' + cluster.length + ')');
ok(cluster.length === 1 && /gmail\.com/.test(cluster[0].evidence) && /gmall\.com/.test(cluster[0].evidence) && /ymail\.com/.test(cluster[0].evidence) && /ymail\.coi/.test(cluster[0].evidence),
  'CT37: the one cluster finding names every member domain');
ok(cluster.length === 1 && /in one record/.test(cluster[0].evidence),
  'CT37: a 3+ domain cluster uses the cluster wording');

// Positive control: a single lookalike PAIR keeps the original "A beside B"
// wording so the record and the other regressions are unchanged.
const pair = ct37(['x@pprotect.org here', 'y@protect.org there']);
ok(pair.length === 1 && /"pprotect\.org"[^]*beside[^]*"protect\.org"/.test(pair[0].evidence) && /1 character apart/.test(pair[0].evidence),
  'CT37: a two-domain cluster keeps the "A beside B — 1 character apart" wording');

// Identical domains are never a finding.
ok(ct37(['a@dffe.gov.za here', 'b@dffe.gov.za there']).length === 0,
  'CT37 silent: identical domains are not a lookalike');

console.log('\nlouw-naidoo: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
