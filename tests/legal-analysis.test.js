/**
 * Legal Analysis layer (report template v5.1.1): party extraction and the
 * finding -> legal-subject / dishonesty-lens maps. Loaded with a minimal PDFLib
 * stub so the module gets past its load-time guard without needing pdf-lib.
 */
'use strict';
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  legal-analysis.test.js');
console.log('======================================================\n');

// Minimal stub: the module only needs PDFLib.rgb() at load time.
global.PDFLib = { rgb: (r, g, b) => ({ r, g, b }), StandardFonts: {}, PDFDocument: {} };
const R = require('../forensic-report.js');

// ---- party extraction ----
const parties = R._extractParties('Complainant: L. Highcock | Respondents: Marius Nortje, Kevin Lappeman');
ok(parties.some(p => /Highcock/.test(p)), 'extractParties finds the complainant');
ok(parties.some(p => /Marius Nortje/.test(p)), 'extractParties finds Marius Nortje');
ok(parties.some(p => /Kevin Lappeman/.test(p)), 'extractParties finds Kevin Lappeman');
ok(!parties.some(p => /Complainant|Respondent/i.test(p)), 'role labels are stripped, not treated as names');
ok(R._extractParties('').length === 0, 'no parties from empty input');
ok(R._extractParties('vs and & /').length === 0, 'no phantom names from separators only');

// ---- legal-subject mapping (one subject per CT) ----
ok(R._legalSubjectOf.CT18 === 'FINANCIAL', 'bank-detail CT18 -> Financial Irregularities');
ok(R._legalSubjectOf.CT14 === 'MISREP', 'entity-status CT14 -> Misrepresentation & Identity');
ok(R._legalSubjectOf.CT02 === 'CONTRADICTION', 'numerical CT02 -> Contradictory Statements');
ok(R._legalSubjectOf.CT27 === 'TAMPERING', 'layout CT27 -> Document Integrity & Tampering');

// ---- dishonesty-lens mapping ----
ok(R._dishonestyOf.CT02 === 'CONTRADICTIONS', 'CT02 -> Contradictions lens');
ok(R._dishonestyOf.CT18 === 'FINANCIAL', 'CT18 -> Financial Irregularities lens');
ok(R._dishonestyOf.CT27 === 'CONCEALMENT', 'CT27 -> Patterns of Concealment lens');
ok(R._dishonestyOf.CT31 === 'OMISSIONS', 'CT31 (cross-ref failure) -> Selective Omissions lens');

// ---- cleanQuote still stable (regression) ----
ok(!/verum omnis seal/i.test(R._cleanQuote('text verum omnis seal case-ab12cd34 more')), 'cleanQuote still strips seal debris');

// ---- plain-language narrative helpers ----
ok(R._listPhrase(['A']) === 'A', 'listPhrase: single');
ok(R._listPhrase(['A', 'B']) === 'A and B', 'listPhrase: pair uses "and"');
ok(R._listPhrase(['A', 'B', 'C']) === 'A, B and C', 'listPhrase: oxford-style with final "and"');
ok(R._listPhrase([]) === '', 'listPhrase: empty');
// Curated meanings for the high-value families read as lay clauses.
ok(/Lessee\/Owner trap/i.test(R._narrativeMeaning({ type: 'CT44' })), 'narrativeMeaning: CT44 clause-precondition trap');
ok(/goodwill/i.test(R._narrativeMeaning({ type: 'CT45' })), 'narrativeMeaning: CT45 goodwill denial');
ok(/two different numbers/i.test(R._narrativeMeaning({ type: 'CT02' })), 'narrativeMeaning: CT02 numeric');
// Unmapped type falls back to the category explainer, not an empty string.
ok(R._narrativeMeaning({ type: 'CT36' }).length > 0, 'narrativeMeaning: falls back to category explainer');
// Fully unknown type still yields a safe generic clause (never throws/empty).
ok(R._narrativeMeaning({ type: 'ZZ99' }).length > 0, 'narrativeMeaning: generic fallback for unknown type');

// ---- cross-border jurisdiction detection ----
{
  const cb = R._detectJurisdictions({ identity: { jurisdiction: 'South Africa / UAE' }, findings: { findings: [] } });
  ok(cb.isCrossBorder === true, 'detectJurisdictions: SA + UAE is cross-border');
  ok(cb.foreign.indexOf('AE') !== -1, 'detectJurisdictions: UAE detected as foreign leg');
  const home = R._detectJurisdictions({ identity: { jurisdiction: 'South Africa' }, findings: { findings: [] } });
  ok(home.isCrossBorder === false, 'detectJurisdictions: SA only is not cross-border');
  // Currency corroboration: AED in evidence pulls in the UAE leg even if the field is blank.
  const byCurrency = R._detectJurisdictions({ identity: {}, findings: { findings: [{ evidence: 'paid AED 1,200,000 to the account' }] } });
  ok(byCurrency.isCrossBorder === true && byCurrency.foreign.indexOf('AE') !== -1, 'detectJurisdictions: AED currency signals UAE');
  // Jurisdiction read from the DOCUMENT TEXT even when the field is blank
  // (Des/AllFuels: KwaZulu-Natal + Companies Act 71 of 2008 place it in ZA).
  const byText = R._detectJurisdictions({ identity: {}, findings: { findings: [
    { evidence: 'Premises at Umtentweni, KwaZulu-Natal; the FRANCHISOR is a company under the Companies Act 71 of 2008.' }
  ] } });
  ok(byText.home === 'ZA' && byText.isCrossBorder === false, 'detectJurisdictions: SA cues in the document text place the matter in ZA with the field blank');
  // A UAE nexus named only in the document makes it cross-border on its own.
  const dubaiText = R._detectJurisdictions({ identity: {}, findings: { findings: [
    { evidence: 'the RAKEZ free-zone entity in Dubai, DIFC courts nexus' }
  ] } });
  ok(dubaiText.foreign.indexOf('AE') !== -1, 'detectJurisdictions: a Dubai/DIFC/RAKEZ nexus in the text is detected as a foreign leg');
}

// ---- subject mapping incl. franchise/lease ----
ok(R._subjectOf({ type: 'CT44' }) === 'CONTRACT', 'subjectOf: CT44 -> CONTRACT');
ok(R._subjectOf({ type: 'CT45' }) === 'CONTRACT', 'subjectOf: CT45 -> CONTRACT');
ok(R._subjectOf({ type: 'CT18' }) === 'FINANCIAL', 'subjectOf: CT18 -> FINANCIAL');

// ---- statute mapping across jurisdictions ----
{
  const jur = { home: 'ZA', foreign: ['AE'], isCrossBorder: true };
  const fin = R._statutesForSubject('FINANCIAL', jur);
  ok(fin.length === 2, 'statutesForSubject: FINANCIAL returns ZA + AE');
  ok(fin[0].jur === 'ZA' && /Organised Crime Act 121 of 1998/.test(fin[0].provisions.join(' ')), 'statutesForSubject: ZA cites POCA');
  ok(fin[1].jur === 'AE' && /Anti-Money Laundering Law \(Federal Decree-Law 20 of 2018\)/.test(fin[1].provisions.join(' ')), 'statutesForSubject: AE cites AML Law 20/2018');
  const homeOnly = R._statutesForSubject('TAMPERING', { home: 'ZA', foreign: [], isCrossBorder: false });
  ok(homeOnly.length === 1 && homeOnly[0].jur === 'ZA', 'statutesForSubject: home-only when not cross-border');
}

// ---- party attribution ----
{
  const parties = ['Marius Nortje', 'Kevin Lappeman'];
  ok(R._attributeParty({ evidence: 'Nortje signed the amended clause' }, parties) === 'Marius Nortje', 'attributeParty: matches by surname/first token');
  ok(R._attributeParty({ evidence: 'no party named here' }, parties) === null, 'attributeParty: null when unattributed');
}

// ---- monetary figure extraction (extraction only, de-duplicated) ----
{
  const m = R._extractMoney('paid AED 1,200,000 then only AED 1,020,000; also R 250 000 demanded');
  ok(m.some((x) => /AED 1,200,000/.test(x)), 'extractMoney: finds AED amount');
  ok(m.some((x) => /R 250 000/.test(x)), 'extractMoney: finds ZAR "R" amount with spaces');
  ok(R._extractMoney('$11,000 deal').some((x) => /\$11,000/.test(x)), 'extractMoney: finds USD $ amount');
  const dup = R._extractMoney('USD 500 and USD 500 again');
  ok(dup.filter((x) => /USD 500/.test(x)).length === 1, 'extractMoney: de-duplicates identical figures');
  ok(R._extractMoney('no money here, just words').length === 0, 'extractMoney: empty when no figures');
  // The R token must not match inside a word: "7 Mar 2025" produced "r 2025"
  // in a real Greensky report's Monetary Figures table.
  ok(R._extractMoney('stated as 7 Mar 2025 and as 13 Mar 2025').length === 0, 'extractMoney: does not read "Mar 2025" as an R amount');
  ok(R._extractMoney('a fee of R 2025 was charged').some((x) => /R 2025/.test(x)), 'extractMoney: still finds a genuine standalone R amount');
  ok(R._extractMoney('at the Bár 2025 gathering').length === 0, 'extractMoney: accented word ending in r does not leak an R amount');
  ok(R._extractMoney('var VAR_R 2025 in the code sample').length === 0, 'extractMoney: underscore identifier does not leak an R amount');
}

// ---- plain-language: EVERY finding type must carry everyday wording ----
// The website report's "In plain terms, ..." line is what an ordinary reader
// relies on. If a CT type has no lay clause it silently drops to a generic
// category sentence — understandable, but not specific. This guard makes plain
// wording a shipping requirement: add a CT type, add its plain sentence.
{
  const names = R._ctNames;
  const meaning = R._narrativeMeaningMap;
  const missing = Object.keys(names).filter((ct) => !meaning[ct] || !String(meaning[ct]).trim());
  ok(missing.length === 0, 'every CT type in CT_NAMES has a plain-language NARRATIVE_MEANING (missing: ' + (missing.join(', ') || 'none') + ')');
  // The plain wording must actually be plain: no CT codes, no "shall", no latin.
  const jargon = Object.keys(meaning).filter((ct) => /\bCT\d|\bshall\b|\bprima facie\b|\binter alia\b/i.test(meaning[ct]));
  ok(jargon.length === 0, 'plain-language clauses contain no codes or legalese (offenders: ' + (jargon.join(', ') || 'none') + ')');
  // narrativeMeaning() returns the specific clause, not the generic fallback.
  ok(R._narrativeMeaning({ type: 'CT20' }) === meaning.CT20 && !/inconsistent on this point/.test(R._narrativeMeaning({ type: 'CT20' })),
    'narrativeMeaning() returns the finding-specific plain clause (CT20), not the generic fallback');
}

// ---- plain-language "bottom line" opens the report and NAMES the serious ones ----
{
  const data = { docName: 'Wallers Agreement', pageCount: 20 };
  const fr = {
    overallScore: 62,
    findings: [
      { type: 'CT45', severity: 5, location: 'Page 11', evidence: 'goodwill recognised then denied' },
      { type: 'CT03', severity: 4, location: 'Page 3', evidence: 'Impossible date: 31/02/2021' },
      { type: 'CT26', severity: 1, location: 'Page 2', evidence: 'near-empty pages' },
      { type: 'CT31', severity: 2, evidence: 'annexure not found [bundle context: repeated page]' }
    ]
  };
  const lines = R._plainLeadLines(fr, data);
  const joined = lines.join('\n');
  ok(lines.length > 0, 'plain lead is produced when there are findings');
  ok(/sealed record of "Wallers Agreement" \(20 pages\) contains 4 verified findings\. The following are established\./.test(joined),
    'plain lead opens with the sealed record, document name, page count and verified finding count stated as fact');
  // An AI-raised item is candidate tier — it must never inflate the verified
  // count, never appear among the established serious findings, and must be
  // disclosed as advisory (PD16).
  const frAi = { overallScore: 62, findings: fr.findings.concat([
    { source: 'ai', type: 'INCONSISTENT_ENTITLEMENT', severity: 4, rationale: 'franchisor vs franchisee' }
  ]) };
  const joinedAi = R._plainLeadLines(frAi, data).join('\n');
  ok(/contains 4 verified findings\./.test(joinedAi), 'AI candidate does NOT inflate the verified findings count');
  ok(/raised 1 further candidate item/.test(joinedAi) && /advisory only/.test(joinedAi),
    'AI candidate is disclosed as advisory, outside the established findings');
  ok(/The serious ones, in plain words:/.test(joined), 'plain lead announces the serious findings');
  ok(/On p\. 11, .*goodwill/i.test(joined), 'plain lead NAMES the CT45 serious finding in plain words, anchored to its page');
  ok(/date does not add up/.test(joined), 'plain lead NAMES the CT03 serious finding in plain words');
  ok(!/CT45|CT03/.test(joined), 'plain lead contains no CT codes (everyday language only)');
  ok(/sealed under SHA-512/.test(joined) && /cannot be changed, altered, or deleted/.test(joined) && /verdict on any named person is for the court/.test(joined),
    'plain lead states the seal certainty and reserves the verdict for the court (PD16) - no score language');
  ok(!/\/100/.test(joined) && !/[Cc]onfidence band/.test(joined),
    'plain lead carries NO 0-100 score and NO confidence band (Ordinal Confidence: never percentages)');
  // Unreadable / failed scans must NOT produce a plain "all clear".
  ok(R._plainLeadLines({ unreadable: true, findings: [{ type: 'CT01', severity: 5 }] }, data).length === 0,
    'plain lead is empty on an unreadable document (no false all-clear)');
  ok(R._plainLeadLines({ scanFailed: true, findings: [{ type: 'CT01', severity: 5 }] }, data).length === 0,
    'plain lead is empty when the scan failed');
}

// ---- narrative reads as a story, not a data dump (source lock) ----
// Every external review of the narrative made the same complaint: one numbered
// entry per finding restates the same pattern until the story is unreadable.
// The narrative walk groups instances of a pattern into one telling: meaning
// once, strongest quote once, every page listed once, check-hint and law once.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  ok(/groups\.slice\(0,\s*CAP\)/.test(src), 'narrative walks pattern GROUPS, not raw findings');
  ok(src.indexOf("head += ' The record shows this ' + g.length + ' times.'") !== -1,
    'a repeated pattern is told once with its instance count');
  ok(src.indexOf("'Where it happens: '") !== -1, 'a repeated pattern lists every page it touches, once');
  ok(src.indexOf("'The strongest instance: '") !== -1, 'a repeated pattern quotes its strongest instance');
  ok(src.indexOf("'At its core: '") !== -1, 'the narrative opens with a factual thesis of the top patterns');
  ok(!/A moderate issue|A lesser issue/.test(src),
    'per-finding severity adjectives are gone - pattern order carries the weight');

  // Founder ruling 5 (AGENTS.md): the story leads, and provenance is on the
  // first pages. The narrative must be wired BEFORE §15.4 section 1 in
  // build(), and the software-not-AI statement must appear on the cover, in
  // the narrative intro, and on the sealed plain-language twin's first page.
  const buildBody = src.slice(src.indexOf('async function build('), src.indexOf('async function buildNarrative('));
  const narrAt = buildBody.indexOf("secNarrative(ctx, data, { label: 'THE STORY IN PLAIN LANGUAGE' })");
  const sec1At = buildBody.indexOf('secCriticalSubjects(ctx, data)');
  ok(narrAt !== -1 && sec1At !== -1 && narrAt < sec1At,
    'plain-language narrative renders on the first pages, before §15.4 section 1');
  ok((src.match(/not the opinion of a generative AI|not by a generative AI/g) || []).length >= 3,
    'cover, narrative intro and narrative twin all state findings are software output, not generative AI');
  ok(/produced by forensic software/.test(src) && /deterministic detection rules/.test(src),
    'the provenance statement names the mechanism: deterministic software rules');
}

console.log(`\n[legal-analysis] PASS=${pass} FAIL=${fail}`);
console.log(`[legal-analysis] ${fail === 0 ? 'ALL GREEN' : 'FAILURES'}`);
process.exit(fail === 0 ? 0 : 1);
