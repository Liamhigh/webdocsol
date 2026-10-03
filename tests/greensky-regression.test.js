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

// =====================================================================
// ---- 9. The 3 October 2026 rerun (report VO-WEB-20261003-0222) ----
// The founder sealed the 451-page Greensky bundle again on the live site.
// Fourteen of nineteen findings were "Impossible date: 15.20.9094" — a
// commodity-code token on the Frontend Transport invoice pages; an AI case
// summary bound into the bundle ("Forensic Finding:** This is an explicit
// admission of guilt…") was sealed as the record's own admission and its
// heading became the party "Forensic Finding"; and the bundle's own Verum
// seal produced "Timestamp Manipulation" / "Metadata Contradiction" findings
// (Info dictionary = the seal pass, XMP = the source document).
// ---------------------------------------------------------------------

// ---- 9.1 a date-shaped token with an impossible year is not a date ----
{
  const inv = 'FRONTEND TRANSPORT CC Tax Invoice 4088. Commodity code 15.20.9094 quantity 240. ' +
    'Commodity code 15.20.9115 quantity 60. Date: 14/03/2025';
  const out = E.DETECTORS.D03_DETECT_DATE_INCONSISTENCY([inv, 'x', inv]);
  ok(out.length === 0, 'commodity codes 15.20.9094 / 15.20.9115 raise no impossible-date finding (' + out.length + ')');

  // The gate is a year horizon, not a free pass: a plausible year with an
  // impossible day/month is exactly the signature of a mistyped or fabricated
  // date and still fires.
  const real = E.DETECTORS.D03_DETECT_DATE_INCONSISTENCY(['The deed is dated 31/02/2021.']);
  ok(real.length === 1 && /Impossible date: 31\/02\/2021/.test(real[0].evidence), 'a plausible-year impossible date still fires');
  const dotted = E.DETECTORS.D03_DETECT_DATE_INCONSISTENCY(['recorded 15.20.2025 in the ledger']);
  ok(dotted.length === 1, 'a dotted impossible date with a real year still fires');
}

// ---- 9.2 identical impossible tokens group into one finding, pages cited ----
{
  const p = 'witnessed on 31/02/2021 as recorded.';
  const out = E.DETECTORS.D03_DETECT_DATE_INCONSISTENCY([p, 'clean', p, p]);
  ok(out.length === 1, 'one finding for one impossible token across three pages (' + out.length + ')');
  ok(/appears on 3 pages \(1, 3, 4\)/.test(out[0].evidence), 'the finding names every page the token appears on');
  ok(out[0].location === 'Page 1, 3, 4', 'the location carries the page list');
  ok(Array.isArray(out[0].pages) && out[0].pages.join(',') === '1,3,4', 'the pages array is structured');
}

// ---- 9.3 a sentence that CALLS something an admission is not an admission ----
{
  const D01 = E.DETECTORS.D01_DETECT_DIRECT_CONTRADICTION;
  const aiSummary = 'Forensic Finding:** This is an explicit admission of guilt. The shareholder agreement ' +
    'regarding the 70/30 split was active on the date of the transaction (13 March 2025).';
  ok(D01([aiSummary]).filter(f => /explicit admission/.test(f.evidence)).length === 0,
    '"This is an explicit admission of guilt" (a commentator\'s label) raises no admission finding');
  ok(D01(['The email of 6 April constitutes a clear admission of guilt on his part.'])
    .filter(f => /explicit admission/.test(f.evidence)).length === 0,
    '"constitutes a clear admission" is a characterisation, not an admission');
  // The admitting party's own sentence still fires.
  ok(D01(['In reply Marius wrote: I admit that I routed the payment to my own account.'])
    .filter(f => /explicit admission/.test(f.evidence)).length === 1,
    'a first-person admission still fires');
}

// ---- 9.4 markdown-formatted analysis pages are a secondary source ----
{
  const md = E.voMarkdownAnalysisPages([
    'plain contract text, no markup at all',
    '**Key Findings** - **One:** text **Two:** more text',
    'Forensic Finding:** This is an explicit admission of guilt.',
    'an ordinary page',
  ]);
  ok(md.join(',') === '2,3', 'markdown bold pairs and a heading-colon-into-bold both mark a page (' + md.join(',') + ')');
  // Findings resting only on such pages demote to leads.
  const demo = E.voDemoteSecondarySource(
    [{ type: 'CT01', severity: 4, evidence: 'x', location: 'Page 2, 3', pages: [2, 3] }], md);
  ok(demo.kept.length === 0 && demo.leads.length === 1, 'a finding anchored only on markdown-analysis pages is a lead, not a finding');
}

// ---- 9.5 an analysis heading and a role are not parties ----
{
  ok(!E.voLooksLikePerson('Forensic Finding'), 'voLooksLikePerson rejects "Forensic Finding"');
  ok(!E.voLooksLikePerson('General Manager'), 'voLooksLikePerson rejects "General Manager"');
  ok(!E.voLooksLikePerson('Managing Director'), 'voLooksLikePerson rejects "Managing Director"');
  ok(E.voLooksLikePerson('Kevin Lappeman'), 'voLooksLikePerson still accepts a real name');
  const parties = E.voExtractParties('Forensic Finding:** This is an explicit admission of guilt. Marius Nortje wrote it.')
    .filter(x => x.kind === 'name').map(x => x.name);
  ok(parties.indexOf('Forensic Finding') === -1, 'the party extractor drops "Forensic Finding"');
  ok(parties.indexOf('Marius Nortje') !== -1, 'the party extractor keeps the real person');
}

// ---- 9.6 a file wearing this platform's seal suppresses the metadata compare ----
{
  // The Greensky bundle was sealed on 5 August 2026 by a pipeline that left
  // pdf-lib's default producer, so the producer test alone missed it; the
  // seal furniture on 419 pages is the proof of sealing.
  const fakeDoc = {
    getProducer: () => 'pdf-lib (https://github.com/Hopding/pdf-lib)',
    getCreationDate: () => new Date('2026-08-05T06:20:30Z'),
  };
  const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:Description xmp:CreateDate="2025-06-23T08:25:36Z" pdf:Producer="Skia/PDF m137"/></x:xmpmeta>';
  const pdfLike = '%PDF-1.7 ' + xmp + ' ' + new Array(30).join('padding padding padding ') + '%%EOF';
  const bytes = new TextEncoder().encode(pdfLike);
  const sealed = E.voDigitalForensicsScan(bytes, fakeDoc, { sealedByThisPlatform: true });
  ok(sealed.filter(f => f.type === 'CT29' || f.type === 'CT24').length === 0,
    'XMP-vs-Info findings are suppressed on a file carrying this platform\'s seal furniture');
  ok(/artefacts of sealing/.test(String(sealed.voSelfSealNote || '')), 'the suppression is disclosed, never silent');
  const unsealed = E.voDigitalForensicsScan(bytes, fakeDoc, { sealedByThisPlatform: false });
  ok(unsealed.filter(f => f.type === 'CT29').length === 1, 'the creation-date comparison still fires on an unsealed file');
  ok(unsealed.filter(f => f.type === 'CT24').length === 1, 'the producer comparison still fires on an unsealed file');
}

// ---- 9.7 report wording: an impossible date is not "two dates for one event" ----
{
  const impossible = { type: 'CT03', severity: 5, evidence: 'Impossible date: 15.20.2025 (not a real calendar date read as day/month/year or month/day/year)', location: 'Page 408' };
  ok(/cannot exist on any calendar/.test(R._establishesOf(impossible)),
    'establishesOf names the impossible-date shape');
  const twoDates = { type: 'CT03', severity: 4, evidence: '"termination date" is stated as 7 Mar 2025 and as 13 Mar 2025', location: 'Page 95' };
  ok(/two different dates/.test(R._establishesOf(twoDates)), 'the two-dates shape keeps its own wording');
  // CT39 / CT29 / CT24 no longer fall through to "The record states both positions".
  for (const [t, re] of [['CT39', /custody/i], ['CT29', /metadata stores disagree/i], ['CT24', /more than one creating tool|further tool/i]]) {
    const txt = R._establishesOf({ type: t, severity: 3, evidence: 'x', location: 'Page 1' });
    ok(re.test(txt) && !/states both positions/.test(txt), t + ' has its own establishes wording');
  }
}

// ---- 9.8 CT39 renders by name, never under a brain block ----
{
  ok(R._brainOfCt.CT39 === 'NONE', 'a custody gap is listed by name, never as "CONTRADICTION FOUND" under B1');
  ok(R._brainOfCt.CT24 === 'B2' && R._brainOfCt.CT29 === 'B5', 'the metadata and timestamp routes are unchanged');
}

// ---- 9.9 the one-page summary collapses identical serious lines ----
{
  const mk = (page, raw) => ({ type: 'CT03', severity: 5, evidence: 'Impossible date: ' + raw + ' (not a real calendar date read as day/month/year or month/day/year)', location: 'Page ' + page });
  const fr = { findings: [mk(408, '15.20.2025'), mk(408, '16.20.2025'), mk(414, '15.20.2025'), mk(414, '16.20.2025')], overallScore: 0 };
  const lines = R._plainLeadLines(fr, { docName: 'bundle.pdf', pageCount: 451 }).join('\n');
  const bullets = lines.split('\n').filter(l => /^•/.test(l) && /date does not add up/.test(l));
  ok(bullets.length === 1, 'four identical serious lines collapse into one bullet (' + bullets.length + ')');
  ok(/\(4 findings\)/.test(bullets[0]), 'the bullet carries the count');
  ok(/p\. ?408/.test(bullets[0]) && /p\. ?414/.test(bullets[0]), 'the bullet names both pages');
}

console.log('\n[greensky-regression] PASS=' + pass + ' FAIL=' + fail);
if (fail) process.exit(1);
console.log('[greensky-regression] ALL GREEN');
