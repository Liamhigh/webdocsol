/**
 * Cross-document conflict detection (stage B; HELD for founder wording sign-off
 * before its PR is merged). It reads the fact index (RECORD pages only) and
 * reports where two record pages state facts about the SAME subject that cannot
 * both hold. It is a contradiction detector, NOT a judge: it names no offence,
 * declares no owner, reaches no conclusion, and uses a fixed neutral form. Only
 * record pages can raise a conflict — an analysis/secondary page never can.
 *
 * Synthetic pages in the shape of the Louw v Naidoo bundle (duplicate 21/06/2024
 * ownership notices; swap-vs-sale of one vessel); no real-matter document is
 * committed.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  cross-doc-conflicts.test.mjs');
console.log('======================================================\n');

const conflicts = (pages, sec) => E.voCrossDocConflicts(E.voBuildFactIndex(pages, sec || []));

// ---- 1. the duplicate ownership notices (pp. in the Louw v Naidoo shape) ----
const dup = conflicts([
  'Notice of Change of Ownership of a Vessel. Vessel DTD 782 C. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.',
  'Notice of Change of Ownership of a Vessel. Vessel DTD782C. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.'
]);
ok(dup.length === 1, 'two ownership notices naming different new owners of one vessel raise one conflict');
ok(dup.length === 1 && /Page 1 states R\. Louw acquired DTD782C/.test(dup[0].statement) && /Page 2 states Niven Naidoo acquired the same vessel on the same date/.test(dup[0].statement) && /cannot both describe the sole new owner of DTD782C/.test(dup[0].statement),
  'the statement is the fixed neutral form, quoting both pages and both owners');
ok(dup[0].a.page === 1 && dup[0].b.page === 2 && /previous owner T\.F\. Hardouin new owner R\. Louw/.test(dup[0].a.quote || '') && /new owner Niven Naidoo/.test(dup[0].b.quote || ''),
  'both sides are anchored to a verbatim quote and page');

// ---- 2. swap-vs-sale of the same vessel ------------------------------------
const sws = conflicts([
  'By written agreement the parties swapped and the vessel DTD782C passed to Ritzema Louw on 15 July 2024.',
  'Deed of sale. The seller hereby sells DTD782C to Niven Naidoo for R300,000 on 13 September 2024.'
]);
ok(sws.length === 1 && /Ritzema Louw acquired DTD782C/.test(sws[0].statement) && /Niven Naidoo acquired the same vessel/.test(sws[0].statement),
  'a swap to one party and a later sale to another, of the same vessel, raise one conflict');

// ---- 3. no false conflict for the same party written two ways --------------
ok(E.voSameParty('R. Louw', 'Ritzema Louw') === true && E.voSameParty('N. Naidoo', 'Niven Naidoo') === true,
  'an initialled name and the full name of the same person are treated as one party');
ok(conflicts([
  'Notice of Change of Ownership. Vessel DTD900A. new owner R. Louw. Dated 1 May 2024.',
  'Deed. The vessel DTD900A was sold to Ritzema Louw on 2 June 2024.'
]).length === 0,
  'no conflict when both pages name the same party (R. Louw / Ritzema Louw)');

// ---- 4. an analysis/secondary page can NEVER raise a conflict --------------
const withAnalysis = conflicts([
  'Notice of Change of Ownership of a Vessel. Vessel DTD111A. new owner A. Person. Dated 1 May 2024.',
  'Verum Omnis — Forensic Narrative • page 3 of 14 the applicant alleges the vessel DTD111A was sold to B. Other.'
]);
ok(withAnalysis.length === 0, 'a record page and a Verum Omnis analysis page do not raise a conflict (only record pages are compared)');
const withSecondary = conflicts([
  'Notice of Change of Ownership of a Vessel. Vessel DTD222B. new owner A. Person. Dated 1 May 2024.',
  'Counsel submits that the vessel DTD222B was transferred to B. Other on 2 June 2024.'
], [2]);
ok(withSecondary.length === 0, 'a page flagged secondary cannot raise a conflict against a record page');

// ---- 5. the wording is neutral: no offence, no verdict, no conclusion ------
const all = conflicts([
  'Notice of Change of Ownership of a Vessel. Vessel DTD782C. previous owner T.F. Hardouin new owner R. Louw. Dated 21 June 2024.',
  'Notice of Change of Ownership of a Vessel. Vessel DTD782C. previous owner T.F. Hardouin new owner Niven Naidoo. Dated 21 June 2024.',
  'Deed of sale. The seller hereby sells DTD782C to Niven Naidoo for R300,000 on 13 September 2024.'
]);
const FORBIDDEN = /\b(fraud|fraudulent|forgery|forged|illegal|unlawful|the true owner|therefore|guilty|crime|criminal|liable|wrongdoing)\b/i;
ok(all.length >= 1 && all.every(c => !FORBIDDEN.test(c.statement)),
  'no conflict statement contains an offence word, a verdict, or a legal conclusion');
ok(all.every(c => /cannot both describe the sole new owner/.test(c.statement)),
  'every statement uses only the fixed "cannot both describe the sole new owner" form');

console.log('\ncross-doc-conflicts: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
