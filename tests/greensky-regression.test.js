/**
 * Regression tests from the real Greensky production run of 7 Aug 2026
 * (report VO-WEB-20260807-BCCB, engine v5.3.5-web). Each block reproduces a
 * defect observed in that sealed report and asserts the fix:
 *
 *  1. cleanQuote scrubbed identity-shaped numbers as "hex hash tokens", so the
 *     CT09 finding rendered "numbers appear: , —" with the values missing.
 *  2. The party extractor bound a country ("South Africa"), legal furniture
 *     ("Trade License", "Fiduciary Duty"), a degree ("LL B") and a free-zone
 *     fragment ("Ras Al Khaimah Economic") as parties.
 *  3. D11 reported a RAKEZ (UAE free-zone) licence number as "Registration
 *     Number Fake" (severity 4) for failing the SA CIPC format.
 *  4. D03 paired "dated" across distant pages of a 451-page bundle — two
 *     separately-dated letters reported twice as HIGH date contradictions.
 *  5. detectJurisdictions missed the UAE leg (it lived only in the engine's
 *     extraction note and the page-anchored names), so a visibly cross-border
 *     matter rendered SA-only statutory anchoring.
 *  6. With no roles kept from the case details, every finding rendered
 *     "(unattributed)" even when the cited page named a declared party.
 */
'use strict';
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  greensky-regression.test.js');
console.log('======================================================\n');

global.PDFLib = { rgb: (r, g, b) => ({ r, g, b }), StandardFonts: {}, PDFDocument: {} };
const R = require('../forensic-report.js');
const E = require('../forensic-engine-page.js');

// ---- 1. cleanQuote must keep identity-shaped numbers, still scrub hashes ----
{
  const ev = '2 different identity-shaped numbers appear: A08034452, A09556066 — confirm which are ID numbers and whose';
  const out = R._cleanQuote(ev);
  ok(out.indexOf('A08034452') !== -1, 'cleanQuote keeps ID number A08034452 (was scrubbed as a hex token)');
  ok(out.indexOf('A09556066') !== -1, 'cleanQuote keeps ID number A09556066');
  ok(R._cleanQuote('id AB1234567 cited').indexOf('AB1234567') !== -1, 'cleanQuote keeps two-letter-prefix ID shapes');
  // Real hash fragments must still be scrubbed.
  ok(R._cleanQuote('hash ae76fb3477f3ac68 there').indexOf('ae76fb34') === -1, 'cleanQuote still scrubs a real hex hash token');
  ok(R._cleanQuote('ref 2f4f8fb4c6f57bf1 x').indexOf('2f4f8fb4') === -1, 'cleanQuote still scrubs seal-hash fragments');
}

// ---- 2. countries / legal furniture / degrees are not people ----
{
  const no = ['South Africa', 'Trade License', 'Fiduciary Duty', 'LL B', 'Ras Al Khaimah Economic', 'United Arab Emirates', 'Hong Kong'];
  for (const n of no) ok(!E.voLooksLikePerson(n), 'voLooksLikePerson rejects "' + n + '"');
  const yes = ['Marius Nortjé', 'Kevin Lappeman', 'Liam Highcock', 'Moore Durban'];
  for (const n of yes) ok(E.voLooksLikePerson(n), 'voLooksLikePerson accepts "' + n + '"');
}

// ---- 3. D11: foreign-registry numbers downgrade to a verification note ----
{
  const rak = ['GREENSKY ORNAMENTALS FZ-LLC, Ras Al Khaimah Economic Zone (RAKEZ). REGISTRATION NO.: 4490279355 COMPANY REGISTRATION CERTIFICATE'];
  const f1 = E.DETECTORS.D11_DETECT_REGISTRATION_FAKE(rak);
  ok(f1.length === 1, 'D11 still reports the non-SA number (' + f1.length + ' finding)');
  ok(f1.length && f1[0].severity === 2, 'RAKEZ-context registration is severity 2, not 4 (got ' + (f1.length && f1[0].severity) + ')');
  ok(f1.length && /foreign registry/i.test(f1[0].evidence), 'evidence says to verify against the foreign registry');
  ok(f1.length && !/fake/i.test(f1[0].evidence), 'evidence no longer alleges "fake" for a foreign-format number');
  // No foreign context -> unchanged severity-4 behaviour.
  const za = ['Acme Trading CC. Registration Number: 4490279355 as recorded.'];
  const f2 = E.DETECTORS.D11_DETECT_REGISTRATION_FAKE(za);
  ok(f2.length === 1 && f2[0].severity === 4, 'SA-context malformed registration still severity 4');
  // A valid SA number still never fires.
  ok(E.DETECTORS.D11_DETECT_REGISTRATION_FAKE(['Registration Number: 2015/123456/07 acme']).length === 0, 'valid CIPC format still silent');
}

// ---- 4. D03: generic "dated" must not pair across bundle pages ----
{
  const pages = [];
  pages[0] = 'Letter one, dated 6 April 2025, addressed to the shareholders.';
  for (let i = 1; i < 40; i++) pages[i] = 'body text page ' + i;
  pages[40] = 'Letter two, dated 30 April 2025, regarding the export order.';
  const cross = E.DETECTORS.D03_DETECT_DATE_INCONSISTENCY(pages);
  ok(!cross.some(f => /"dated" is stated/.test(f.evidence)), 'cross-page "dated" pair no longer reported (' + cross.length + ' findings)');

  // Same-page restatement of a generic label still fires.
  const same = E.DETECTORS.D03_DETECT_DATE_INCONSISTENCY(['Agreement dated 6 April 2025. The counterpart is dated 30 April 2025.']);
  ok(same.some(f => /"dated" is stated/.test(f.evidence)), 'same-page "dated" restatement still fires');

  // A qualified label still pairs across pages (one event, one name).
  const q = [];
  q[0] = 'The termination date 7 March 2025 applies.';
  q[10] = 'Schedule: termination date 13 March 2025.';
  for (let i = 1; i < 10; i++) q[i] = 'filler';
  const qual = E.DETECTORS.D03_DETECT_DATE_INCONSISTENCY(q);
  ok(qual.some(f => /"termination date" is stated/.test(f.evidence)), 'cross-page "termination date" conflict still fires');
}

// ---- 5. jurisdiction detection sees notes and page-anchored names ----
{
  const dataNote = { identity: {}, findings: { findings: [
    { type: 'CT03', severity: 4, evidence: '"dated" is stated as 6 April 2025 and as 30 April 2025' }
  ], extractionNotes: 'Context: multiple jurisdictions are referenced (south africa, uae) — expected in a cross-border matter.' } };
  const j1 = R._detectJurisdictions(dataNote);
  ok(j1.foreign.indexOf('AE') !== -1, 'UAE leg detected from the engine extraction note');

  const dataWho = { identity: {}, findings: { findings: [
    { type: 'CT20', severity: 2, evidence: 'A registration number does not match the SA (CIPC) format',
      anchor: { who: [{ name: 'Ras Al Khaimah Economic Zone', kind: 'name' }] } }
  ] } };
  const j2 = R._detectJurisdictions(dataWho);
  ok(j2.foreign.indexOf('AE') !== -1, 'UAE leg detected from page-anchored names');
}

// ---- 6. roles survive the case details, and anchor.who attributes ----
{
  const wr = R._extractPartiesWithRoles('Complainant: L. Highcock | Respondents: Marius Nortje, Kevin Lappeman');
  ok(wr.length === 3, 'three parties parsed (' + wr.length + ')');
  const roleOf = {}; wr.forEach(p => { roleOf[p.name] = p.role; });
  ok(roleOf['L. Highcock'] === 'Complainant', 'complainant role kept (' + roleOf['L. Highcock'] + ')');
  ok(roleOf['Marius Nortje'] === 'Respondent', 'respondent role carries across the comma list');
  ok(roleOf['Kevin Lappeman'] === 'Respondent', 'second respondent keeps the role');

  // A finding whose evidence is nameless but whose cited page names a declared
  // party now attributes (the Greensky pattern: every finding was
  // evidence-nameless and rendered "(unattributed)").
  const f = { evidence: '"dated" is stated as 6 April 2025 and as 30 April 2025',
    anchor: { who: [{ name: 'Marius Nortjé', kind: 'name' }, { name: "Kevin's Export", kind: 'name' }] } };
  const who = R._attributeParty(f, ['L. Highcock', 'Marius Nortje', 'Kevin Lappeman']);
  ok(who === 'Marius Nortje', 'anchor.who names attribute a declared party (got ' + who + ')');
  ok(R._attributeParty({ evidence: 'no names here', anchor: { who: [] } }, ['Marius Nortje']) === null, 'no match still returns null');
}

console.log('\n[greensky-regression] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[greensky-regression] ALL GREEN');
