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

// ---- 7. Marius Nortje's conduct admission of 6 April 2025 was MISSED ----
// Founder report: the engine read the whole bundle and never surfaced the
// email of Sun 06 Apr 2025 09:53 (pp. 53-54, requoted on 82, 86, 211, 215):
//   "Because you refused to communicate with Kevin's Export and me, Kevin's
//    Export proceeded with the deal, since Sealife Hong Kong was already his
//    client."
// The explicit-admission cues ("I admit", "we concede") never fire on real
// correspondence. This is the shape that does: a causal justification + the
// transaction proceeding + the writer placing themselves in it.
{
  const D01 = E.DETECTORS.D01_DETECT_DIRECT_CONTRADICTION;
  const conduct = (pages) => (D01(pages) || []).filter(f => /own account of why/.test(f.evidence));

  const real = ['cover page',
    "Dear Liam, Because you refused to communicate with Kevin's Export and me, Kevin's Export proceeded with the deal, since Sealife Hong Kong was already his client. Regards Marius"];
  const hit = conduct(real);
  ok(hit.length === 1, 'the 6 April 2025 conduct admission is detected (was missed entirely)');
  ok(hit.length === 1 && hit[0].severity === 4, 'it is ranked among the serious findings');
  ok(hit.length === 1 && /proceeded with the deal/.test(hit[0].evidence), 'the finding quotes the admission verbatim');
  ok(hit.length === 1 && /Page 2/.test(hit[0].location), 'it is anchored to the page it appears on');
  ok(hit.length === 1 && !/admits|confesses|guilt|fraud/i.test(hit[0].evidence),
    'the finding states the account as fact and draws no conclusion about it (PD16/S15.2)');

  // The same passage requoted across the bundle aggregates to ONE finding
  // naming every page, as the AllFuels aggregation rule requires.
  const repeated = ['a',
    "Because you refused to communicate with Kevin's Export and me, Kevin's Export proceeded with the deal, since Sealife Hong Kong was already his client.",
    'b',
    "Quoted again: Because you refused to communicate with Kevin's Export and me, Kevin's Export proceeded with the deal, since Sealife was already his client."];
  const agg = conduct(repeated);
  ok(agg.length === 1 && /2, 4/.test(agg[0].location),
    'a requoted admission is ONE finding citing every page (' + (agg[0] || {}).location + ')');

  // Precision guards - these must never fire.
  ok(conduct(['The parties shall proceed with the transaction as set out in clause 5, because time is of the essence.']).length === 0,
    'contract boilerplate ("the parties shall proceed") is not an admission');
  ok(conduct(['We completed the sale of the property in 2019 and registered transfer.']).length === 0,
    'a bare first-person account with no justification does not fire (affidavits are full of these)');
  ok(conduct(['Because the weather was poor, I stayed at home that weekend and rested.']).length === 0,
    'a causal sentence with no transaction does not fire');
  ok(conduct(['Because of the delay, the shipment was cancelled by the carrier.']).length === 0,
    'a causal transaction sentence with no first-person writer does not fire');
}

// ---- 8. document boundaries inside a compiled bundle ----
// Multi-document bundles made page anchors unreadable ("p. 464" — whose
// document?). Boundaries are recovered from the documents' OWN "Page N of M"
// numbering: stated by the record, never guessed.
{
  const mk = (title, total) => {
    const out = [];
    for (let i = 1; i <= total; i++) out.push(title + '. Clause text here. page ' + i + ' of ' + total);
    return out;
  };
  const bundle = [].concat(mk('Caltex Franchise Agreement', 10), mk('Deed of Lease between the parties', 8), mk('Founding Affidavit', 6));
  const docs = E.voDetectDocuments(bundle);
  ok(docs.length === 3, 'three documents are detected in a compiled bundle (' + docs.length + ')');
  ok(docs[0].start === 1 && docs[0].end === 10, 'first document spans its own pages');
  ok(docs[1].start === 11 && docs[1].end === 18, 'second document starts where the first ends');
  ok(docs[2].start === 19 && docs[2].end === 24, 'third document is placed correctly');
  ok(/Caltex Franchise Agreement/.test(docs[0].title), 'the document is named from its own first page');
  ok(!/page \d+ of \d+/i.test(docs[0].title), 'the page marker is stripped out of the title');

  ok(E.voDetectDocuments(mk('One Document', 12)).length === 0, 'a single document reports no boundaries');
  ok(E.voDetectDocuments(['plain', 'text', 'with', 'no', 'markers', 'at all']).length === 0,
    'no page markers means no claim about boundaries');
  ok(E.voDetectDocuments([]).length === 0 && E.voDetectDocuments(null).length === 0,
    'empty input is safe');
  // A two-page stub must not be promoted to a "document".
  ok(E.voDetectDocuments([].concat(mk('Real Agreement', 10), mk('Stub', 2))).length === 0,
    'a run shorter than three pages is not called a document');

  // No lookbehind: Safari before 16.4 throws on it and the whole scan dies.
  const engineSrc2 = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-engine-page.js'), 'utf8');
  const fnSrc = engineSrc2.slice(engineSrc2.indexOf('function voDetectDocuments'), engineSrc2.indexOf('const DETECTORS') !== -1 ? engineSrc2.indexOf('const DETECTORS') : engineSrc2.indexOf('var DETECTORS'));
  ok(!/\(\?<[=!]/.test(fnSrc), 'document detection uses no regex lookbehind');
  ok(!/Date\.now|Math\.random/.test(fnSrc), 'document detection is deterministic');
}

console.log('\n[greensky-regression] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[greensky-regression] ALL GREEN');
