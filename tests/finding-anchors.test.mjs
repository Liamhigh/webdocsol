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

console.log(`\n[finding-anchors] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[finding-anchors] FAILURES'); process.exit(1); }
console.log('[finding-anchors] ALL GREEN');
