/**
 * Anchored-statement layer (v5.4). A forensic finding must bind WHO / WHERE /
 * WHAT (quote) / WHEN / WHICH-provision, and the dated findings must assemble
 * into a human-readable timeline narrative. The statute layer is
 * cite-or-stay-silent: law is named ONLY where the document itself carries the
 * citation — the engine never invents an applicable law.
 *
 * These are the AllFuels shapes the layer was built from: goodwill of R3.8M
 * recognised then denied, a deposit variance, a clause 4.5.2 the document cites,
 * and dated events that must order chronologically into a story.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  finding-anchors.test.mjs');
console.log('======================================================\n');

// ---- voExtractCitations: cite-or-stay-silent -------------------------------
ok(E.voExtractCitations('the goodwill is forfeited under clause 4.5.2 of the lease').join('|') === 'clause 4.5.2',
  'clause 4.5.2 extracted verbatim');
ok(E.voExtractCitations('a breach of the Companies Act 71 of 2008 arises').join('|') === 'Companies Act 71 of 2008',
  'named Act with number/year extracted');
ok(E.voExtractCitations('see section 12(1)(a) and regulation 4').length === 2,
  'section 12(1)(a) and regulation 4 both extracted');
ok(E.voExtractCitations('the parties met and shook hands over coffee').length === 0,
  'no citation invented where the document names no law (cite-or-stay-silent)');
ok(E.voExtractCitations('he was section head and paid s 50').length === 0,
  'bare "s 50" / "section head" do not fabricate a statute reference');

// The exact citation shapes the Greensky Institutional Review Template uses:
// "Art. 110(2)", "SA ECT Act Sec. 86(1)", "Federal Law 32/2021", "Article 84".
ok(E.voExtractCitations('breach of UAE Art. 110(2) on oppression').some(c => /Art\. 110\(2\)/.test(c)),
  'abbreviated "Art. 110(2)" extracted (template form)');
ok(E.voExtractCitations('under SA ECT Act Sec. 86(1) unauthorised access').some(c => /Sec\. 86\(1\)/.test(c)),
  'abbreviated "Sec. 86(1)" extracted (template form)');
ok(E.voExtractCitations('violating Federal Law 32/2021 of the UAE').some(c => /Law 32\/2021/.test(c)),
  'slash-form "Federal Law 32/2021" extracted (template form)');
ok(E.voExtractCitations('Article 84 (fiduciary duty) and Article 257 (forgery)').length === 2,
  'full "Article 84 / Article 257" both extracted');
ok(E.voExtractCitations('Art Vandelay signed for the seller').length === 0,
  'a name "Art Vandelay" (no number) is not mistaken for Article citation');

// ---- voExtractParties: roles + proper names --------------------------------
const parties = E.voExtractParties('Gary Highcock paid R3,800,000 to the Lessee, and Wayne Nel signed for Norton Rose Fulbright');
const pnames = parties.map(p => p.name);
ok(pnames.includes('Gary Highcock') && pnames.includes('Wayne Nel'), 'personal names bound as parties');
ok(pnames.includes('Lessee'), 'legal role bound as a party');
ok(parties.find(p => p.name === 'Lessee').kind === 'role', 'role is tagged kind=role');
ok(!E.voExtractParties('The document states that Payment was made').some(p => p.name === 'The document'),
  'sentence-initial capitalised words are not mistaken for parties');

// ---- voExtractDates + voDateSortKey: chronology ----------------------------
ok(E.voExtractDates('signed 12 March 2018 and again on 2026-01-04').length === 2, 'two dates extracted');
ok(E.voDateSortKey('12 March 2018') < E.voDateSortKey('2026-01-04'), '2018 sorts before 2026 across formats');
ok(E.voDateSortKey('not a date') === null, 'unparseable token yields null key');
ok(E.voDateSortKey('04/06/2026') === 20260604, 'numeric date read day-first (SA convention)');

// ---- voAnchorEnrich: full binding on a finding -----------------------------
const findings = [
  { type: 'CT01', severity: 5,
    evidence: 'The document both affirms and negates "goodwill": "…goodwill of R3,800,000 recognised, paid by Gary Highcock on 12 March 2018…" vs "…no goodwill shall be payable, per clause 4.5.2…"',
    location: 'Page 78 vs Page 176' },
  { type: 'CT02', severity: 4,
    evidence: '"deposit" is stated as R95,833.33 and as R1,500,000 (variance: 94%)',
    location: 'Page 140' },
];
const blocks = new Array(200).fill('');
blocks[77] = 'goodwill of R3,800,000 recognised, paid by Gary Highcock on 12 March 2018 to the Lessee';
blocks[175] = 'no goodwill shall be payable to the Lessee, per clause 4.5.2, dated 4 June 2026';
E.voAnchorEnrich(findings, blocks);

const a1 = findings[0].anchor;
ok(a1.where && a1.where.join(',') === '78,176', 'CT01 bound to both pages 78 and 176');
ok(a1.who.some(w => w.name === 'Gary Highcock'), 'CT01 WHO includes Gary Highcock');
ok(a1.quote.length >= 2, 'CT01 carries both verbatim quotes (recognised vs denied)');
ok(a1.law.includes('clause 4.5.2'), 'CT01 WHICH-provision = clause 4.5.2, quoted from the document');
ok(a1.when.includes('12 March 2018'), 'CT01 WHEN carries the recognition date');
ok(typeof findings[0].statement === 'string' && /clause 4\.5\.2/.test(findings[0].statement),
  'CT01 flat statement names the cited provision');
ok(!/\b(possibly|may be|appears to|hypothesis|we think)\b/i.test(findings[0].statement),
  'flat statement carries no hedge words');

const a2 = findings[1].anchor;
ok(a2.law.length === 0, 'CT02 states NO law — the deposit-variance passage cites none (cite-or-stay-silent)');

// ---- voBuildTimeline: the story --------------------------------------------
const tl = E.voBuildTimeline(findings);
ok(tl.events.length >= 1, 'timeline has dated events');
const idx2018 = tl.narrative.indexOf('2018');
const idx2026 = tl.narrative.indexOf('2026');
ok(idx2018 !== -1 && (idx2026 === -1 || idx2018 < idx2026), 'timeline narrative is chronological (2018 before 2026)');
ok(/^On /m.test(tl.narrative), 'each timeline line reads "On <date>: …"');

// ---- voBuildPersonIndex: descriptive who->pages/findings aggregation --------
const pidxFindings = [
  { type: 'CT01', severity: 5, location: 'Page 78',
    anchor: { who: [{ name: 'Gary Highcock', kind: 'name' }, { name: 'Lessee', kind: 'role' }], where: [78], quote: [], when: [], law: [] } },
  { type: 'CT02', severity: 4, location: 'Page 140',
    anchor: { who: [{ name: 'Gary Highcock', kind: 'name' }], where: [140], quote: [], when: [], law: [] } },
  { type: 'CT45', severity: 5, location: 'Page 176',
    anchor: { who: [{ name: 'Wayne Nel', kind: 'name' }], where: [176], quote: [], when: [], law: [] } },
  { type: 'CT03', severity: 3, location: 'Page 12',
    anchor: { who: [], where: [12], quote: [], when: [], law: [] } }, // no party
];
const pidx = E.voBuildPersonIndex(pidxFindings);
const gary = pidx.find(p => p.name === 'Gary Highcock');
ok(gary && gary.mentionCount === 2, 'Gary Highcock aggregated across both his findings');
ok(gary && gary.pages.join(',') === '78,140', 'person carries the sorted set of pages they appear on');
ok(pidx[0].name === 'Gary Highcock', 'most-mentioned party sorts first');
ok(pidx.some(p => p.name === 'Lessee' && p.kind === 'role'), 'a legal role is indexed and tagged kind=role');
ok(!pidx.some(p => p.name === ''), 'anchorless finding contributes no empty party');
ok(E.voBuildPersonIndex([]).length === 0, 'empty findings yield an empty index (no crash)');

// ---- Parties from the CITED PAGE (the empty-person-index regression) --------
// The AllFuels rerun recovered pages 316-318 by OCR — full of names — yet the
// person index was EMPTY, because voAnchorEnrich only ever searched the short
// evidence snippet (`ev.length > 20 ? ev : ctx` is always the ev branch).
const emailPage =
  'FW: RENTAL ESCALATION - JANUARY 2026\n' +
  'From: Gary Highcock\nTo: Rabia Seedat\n' +
  'Cc: Amrit Singh, Mohamed Ally\n' +
  'The MOU has expired. How can the rent be increased?\nRegards Gary Highcock';
const ctxPeople = E.voExtractPersonsFromContext(emailPage, 8).map(p => p.name);
ok(ctxPeople.includes('Gary Highcock'), 'From: header yields Gary Highcock');
ok(ctxPeople.includes('Rabia Seedat'), 'To: header yields Rabia Seedat');
ok(ctxPeople.includes('Amrit Singh') && ctxPeople.includes('Mohamed Ally'),
  'a comma-separated Cc: list yields every named person');
ok(!ctxPeople.includes('Rental Escalation'),
  'document furniture ("RENTAL ESCALATION") is not indexed as a person');
ok(E.voExtractPersonsFromContext('Adv E de Waal appeared', 8).some(p => /de Waal/.test(p.name)),
  'a courtesy title (Adv) yields the person');

// End-to-end: a finding whose evidence names nobody must still bind the people
// the cited page names — this is the exact empty-index bug.
const pageFindings = [{ type: 'CT02', severity: 4,
  evidence: '"total" is stated as 26,009.43 and as R87,121.86 (variance: 108%)',
  location: 'Page 3' }];
const pageBlocks = ['', '', emailPage];
E.voAnchorEnrich(pageFindings, pageBlocks);
const boundNames = (pageFindings[0].anchor.who || []).map(p => p.name);
ok(boundNames.includes('Gary Highcock'),
  'REGRESSION: a finding whose evidence names nobody still binds parties from the cited page');
ok(E.voBuildPersonIndex(pageFindings).length > 0,
  'REGRESSION: the person index is no longer empty for a page that names people');

// ---- Person-index QUALITY (the Greensky rerun garbage) ---------------------
// The Greensky rerun bound: "Greensky Ornamentals FZ-LLC, Kevin. Late Mares The,
// Gooale Drive. PRIVATE SEAL" — one real party and three artefacts, including
// Verum's OWN seal footer. A person index that names the seal is worse than an
// empty one, because a reviewer may act on it.
ok(E.voLooksLikePerson('Gary Highcock'), 'a real two-token name is a person');
ok(E.voLooksLikePerson('E de Waal'), 'initial + particle + surname is a person');
ok(!E.voLooksLikePerson('PRIVATE SEAL'), 'REGRESSION: "PRIVATE SEAL" (seal footer) is not a person');
ok(!E.voLooksLikePerson('Gooale Drive'), 'REGRESSION: "Gooale Drive" (OCR of Google Drive) is not a person');
ok(!E.voLooksLikePerson('Kevin. Late Mares The'), 'REGRESSION: a run through a sentence end / stop word is not a person');
ok(!E.voLooksLikePerson('Tax Invoice'), 'document furniture ("Tax Invoice") is not a person');
ok(!E.voLooksLikePerson('Kevin'), 'a single token is not a person');
// Scanned-contract furniture (AllFuels/Des Caltex agreement): the "Yes/No"
// schedule cells and capitalised DEFINED TERMS recurred enough to be bound as
// parties in the person index. Blocked as whole phrases + Yes/No tokens.
ok(!E.voLooksLikePerson('Yes No'), 'REGRESSION: a scanned schedule "Yes No" cell is not a person');
ok(!E.voLooksLikePerson('Business System'), 'REGRESSION: the defined term "Business System" is not a person');
ok(!E.voLooksLikePerson('Intellectual Property'), 'REGRESSION: "Intellectual Property" is not a person');
ok(!E.voLooksLikePerson('Value of the Business'), 'REGRESSION: "Value of the Business" is not a person');
// ...but a real surname that happens to be a common word survives (phrase-level
// block, not per-token), so "John Marks" / "Ann Property" are not lost.
ok(E.voLooksLikePerson('John Marks'), 'the surname "Marks" survives (blocked only as the phrase "Trade Marks")');
ok(E.voLooksLikePerson('Desmond Smith'), 'a real franchisee name still passes');

// Seal boilerplate on the cited page must never reach the index.
const sealedPage = 'VERUM OMNIS SEALED ORIGINAL — PRIVATE SEAL — FREE TIER\n' +
  'verumglobal.foundation | OpenTimestamps | Patent Pending\n' +
  'From: Marius Nortje\nTo: Kevin Lappeman\n';
const sealedFindings = [{ type: 'CT03', severity: 4, evidence: '"dated" is stated as 6 April 2025 and as 30 April 2025', location: 'Page 1' }];
E.voAnchorEnrich(sealedFindings, [sealedPage]);
const sealedWho = (sealedFindings[0].anchor.who || []).map(p => p.name.toLowerCase());
ok(!sealedWho.some(n => /seal|verum|omnis|timestamps/.test(n)),
  'REGRESSION: Verum seal-footer text is stripped before party extraction');
ok(sealedWho.some(n => /marius nortje|kevin lappeman/.test(n)),
  'real people on a sealed page are still bound');

// ---- DOCUMENT PARTY ROSTER (names in ordinary prose) ----------------------
// The Greensky/Louw runs reported "not attributed to a named party" on a finding
// whose cited page names the person twice in plain prose ("Kevin Lappeman
// operates the registered entity …"). Marker-anchored extraction only saw email
// headers. Recurrence across the bundle is the signal that a name is a party.
{
  const bundle = [
    'Kevin Lappeman operates the registered entity South Coast Aquaculture',
    'correspondence from Kevin Lappeman about the export order',
    'the entity of Kevin Lappeman is recorded as deregistered as of March',
    'a Passing Mention appears exactly once here',
  ];
  const roster = E.voBuildNameRoster(bundle).map(r => r.name);
  ok(roster.includes('Kevin Lappeman'), 'a recurring prose name enters the party roster');
  ok(!roster.includes('Passing Mention'), 'a one-off capitalised pair does NOT enter the roster');

  const f = [{ type: 'CT14', severity: 4,
    evidence: 'Conflicting status claims: registered, deregistered', location: 'Full document' }];
  E.voBackfillPageAnchors(f, bundle);
  E.voAnchorEnrich(f, bundle);
  const who = (f[0].anchor.who || []).map(x => x.name);
  ok(who.includes('Kevin Lappeman'),
    'REGRESSION: a finding is attributed to the party its cited page names in prose');
}
{
  // The roster must not enrol the seal footer, and must not attach a roster name
  // to a finding whose cited page does not mention them.
  const bundle = [
    'VERUM OMNIS SEALED ORIGINAL PRIVATE SEAL verumglobal.foundation OpenTimestamps',
    'VERUM OMNIS SEALED ORIGINAL PRIVATE SEAL verumglobal.foundation OpenTimestamps',
    'VERUM OMNIS SEALED ORIGINAL PRIVATE SEAL Marius Nortje wrote to the board',
    'Marius Nortje replied again; Marius Nortje confirmed receipt',
  ];
  const roster = E.voBuildNameRoster(bundle).map(r => r.name.toLowerCase());
  ok(!roster.some(n => /seal|verum|omnis|timestamps/.test(n)), 'seal boilerplate never enters the roster');
  ok(roster.includes('marius nortje'), 'a real recurring party still enters the roster');

  const f = [{ type: 'CT03', severity: 3, evidence: '"dated" differs', location: 'Page 1' }];
  E.voAnchorEnrich(f, bundle);
  const who = (f[0].anchor.who || []).map(x => x.name);
  ok(!who.includes('Marius Nortje'),
    'a roster party is NOT attached to a page that does not name them');
}

// ---- MULTI-PAGE ANCHORING (the "anchor rule override" request) ------------
// A document-wide pattern ("Multiple email domains: …", location "Multiple
// pages") failed the anchor rule and dropped out of the report, even though
// every instance sits on a known page. It is anchored to a page SET. This
// UPHOLDS the rule — a pattern that cannot be enumerated to a bounded set of
// real pages still stays unanchored.
{
  const blocks = [
    'correspondence from admin@lpc.org.za regarding the complaint',
    'nothing relevant on this page at all',
    'reply sent to admin@lpc.org.za and copied to clerk@capebar.co.za',
    'further mail from clerk@capebar.co.za about the same matter',
  ];
  // Same normalisation voBackfillPageAnchors applies (voNormMatch): strips @ and
  // dots, so a probe and a page compare on equal terms.
  const vnorm = (b) => b.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const norm = blocks.map(vnorm);
  const pages = E.voPagesForEvidence('Multiple email domains: lpc.org.za, capebar.co.za', norm);
  ok(pages.join(',') === '1,3,4', 'a document-wide pattern resolves to its full page set (1,3,4)');

  const f = [{ type: 'CT37', severity: 2,
    evidence: 'Multiple email domains: lpc.org.za, capebar.co.za',
    location: 'Multiple pages' }];
  E.voBackfillPageAnchors(f, blocks);
  ok(/^Pages 1, 3, 4$/.test(f[0].location), 'backfill rewrites "Multiple pages" to the real page set');
  ok(E.voEnforceAnchorRule(f).kept.length === 1,
    'the multi-page finding now SURVIVES the anchor rule instead of being dropped');
}
// Precision held: a probe too short or too widespread anchors nothing.
{
  const many = Array.from({ length: 40 }, () => 'amount R 500 stated here');
  const norm = many.map(b => b.toLowerCase());
  ok(E.voPagesForEvidence('Multiple currencies without conversion: R, $', norm).length === 0,
    'single-character currency probes never anchor (would match every page)');
  ok(E.voPagesForEvidence('Multiple values: amount', norm).length === 0,
    'a probe hitting more pages than the cap is noise, not an anchor');
}
{
  // An explicit cap must be honoured, including 0 ("anchor nothing"). A
  // truthiness test would silently turn 0 into the default cap of 25.
  const small = ['alpha beta lpc org za', 'gamma lpc org za'];
  ok(E.voPagesForEvidence('Domains: lpc.org.za', small).join(',') === '1,2',
    'default cap resolves the page set');
  ok(E.voPagesForEvidence('Domains: lpc.org.za', small, 0).length === 0,
    'an explicit cap of 0 anchors nothing (not silently replaced by the default)');
  ok(E.voPagesForEvidence('Domains: lpc.org.za', small, 1).length === 0,
    'an explicit cap of 1 rejects a 2-page spread');
}

// ---- Greensky real-run regressions (from the shipped findings JSON) ---------
// The 2026-08-02 Greensky JSON carried: labels of "undefined", parties
// "Marius Nortj" / "Confidential RAKEZ Case" / "Legal Relevance", where:[88,88],
// and set-anchored findings whose anchor.where came back null.
ok(E.voParsePages('Pages 1, 3, 4').join(',') === '1,3,4',
  'REGRESSION: plural "Pages 1, 3, 4" (the form this engine writes) parses');
ok(E.voParsePages('Pages 12-14').join(',') === '12,14', 'page spans yield their endpoints');
ok(E.voParsePages('Page 88 vs Page 88').join(',') === '88',
  'REGRESSION: duplicate page references dedupe (no more p.88/88)');
ok(E.voExtractParties('agreement between Marius Nortjé and Kevin Lappeman').some(p => p.name === 'Marius Nortjé'),
  'REGRESSION: accented surname survives whole ("Nortjé", not "Nortj")');
ok(E.voBuildNameRoster(['Marius Nortjé wrote', 'Marius Nortjé again', 'Marius Nortjé signed'])
    .some(r => r.name === 'Marius Nortjé'),
  'roster keeps the accent too');
ok(!E.voLooksLikePerson('Confidential RAKEZ Case'), 'REGRESSION: "Confidential RAKEZ Case" is not a person');
ok(!E.voLooksLikePerson('Legal Relevance'), 'REGRESSION: "Legal Relevance" is not a person');
ok(!E.voLooksLikePerson('Hong Kong Legal Relevance'), 'REGRESSION: "Hong Kong Legal Relevance" is not a person');
{
  // voStatement must label with the CT name, never "undefined".
  const f = { type: 'CT03', severity: 4, evidence: 'x', location: 'Page 15',
    anchor: { who: [], where: [15, 85], quote: [], when: [], law: [] } };
  const st = E.voStatement(f);
  ok(/^Date Inconsistency/.test(st), 'statement labels with the CT name');
  ok(!/undefined/.test(st), 'REGRESSION: no "undefined" in the anchored statement');
}

// ---- 3 Aug Greensky rerun residuals ----------------------------------------
// That run bound "BCFF SHA-" / "EC SHA-" (hash fragments), "Evidence Analyzed",
// "SAPS CAS" as parties, and listed "Kevin Lappeman\u2019s" beside "Kevin Lappeman".
ok(!E.voLooksLikePerson('BCFF SHA-'), 'REGRESSION: hash fragment "BCFF SHA-" is not a person');
ok(!E.voLooksLikePerson('EC SHA-'), 'REGRESSION: hash fragment "EC SHA-" is not a person');
ok(!E.voLooksLikePerson('Evidence Analyzed'), 'REGRESSION: "Evidence Analyzed" is not a person');
ok(!E.voLooksLikePerson('SAPS CAS'), 'REGRESSION: "SAPS CAS" (case-number label) is not a person');
ok(E.voCleanPersonName('Kevin Lappeman\u2019s') === 'Kevin Lappeman', 'trailing possessive stripped');
{
  const who = E.voExtractParties("link to Kevin Lappeman\u2019s registered entity and Kevin Lappeman signed").map(p => p.name);
  ok(who.filter(n => /Kevin Lappeman/.test(n)).length === 1,
    'REGRESSION: possessive and plain forms collapse to ONE party');
}

console.log(`\n[finding-anchors] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[finding-anchors] FAILURES'); process.exit(1); }
console.log('[finding-anchors] ALL GREEN');
