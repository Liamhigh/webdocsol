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

console.log(`\n[legal-analysis] PASS=${pass} FAIL=${fail}`);
console.log(`[legal-analysis] ${fail === 0 ? 'ALL GREEN' : 'FAILURES'}`);
process.exit(fail === 0 ? 0 : 1);
