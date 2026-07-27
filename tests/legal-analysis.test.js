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

console.log(`\n[legal-analysis] PASS=${pass} FAIL=${fail}`);
console.log(`[legal-analysis] ${fail === 0 ? 'ALL GREEN' : 'FAILURES'}`);
process.exit(fail === 0 ? 0 : 1);
