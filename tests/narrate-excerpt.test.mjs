/**
 * voBuildNarrateExcerpt (seal-document.html) builds the AI narrator's document
 * excerpt from the pages the findings anchor to, not the first N chars of the
 * bundle. On a long bundle the contradictions sit deep in the record, so the old
 * first-12k excerpt showed the narrator none of the evidence. This extracts the
 * real function and proves it centres the excerpt on the finding pages, includes
 * page 1 for identity, tags pages, respects the cap, and falls back sensibly.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  narrate-excerpt.test.mjs');
console.log('======================================================\n');

const html = readFileSync('seal-document.html', 'utf8');
const m = html.match(/function voBuildNarrateExcerpt\(textBlocks, findings, maxChars\) \{[\s\S]*?\n\}/);
if (!m) throw new Error('could not extract voBuildNarrateExcerpt from seal-document.html');
const sandbox = { String, Array, Object, Number, Math, parseInt };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(m[0] + '\n; this.voBuildNarrateExcerpt = voBuildNarrateExcerpt;', sandbox);
const build = sandbox.voBuildNarrateExcerpt;

// A 148-"page" bundle: page N's text says "PAGE_N_BODY <n> ...". Deep pages carry
// the evidence; the opening pages are boilerplate.
const pages = [];
for (let i = 1; i <= 148; i++) pages.push('PAGE' + i + 'BODY page ' + i + ' ' + 'filler '.repeat(40));
pages[0] = 'COVER LETTER parties Louw and Moolla case CCT ' + 'x'.repeat(200);   // page 1 identity
pages[112] = 'RECEIVED CONTRADICTION only received on 10 march 2015 vs not received ' + 'y'.repeat(200); // page 113
pages[127] = 'CAPACITY as director of Feike Pty Ltd pay into my personal trust account ' + 'z'.repeat(200); // page 128

// Findings anchored to deep pages (the shape the engine emits).
const findings = [
  { type: 'CT01', location: 'Page 113' },
  { type: 'CT02', location: 'p. 2 vs 138' },
  { type: 'CT46', location: 'Page 128' },
  { type: 'CT44', location: 'Page 1 vs Page 3' },
  { type: 'CT18', location: '—' },        // no page -> contributes nothing
];

const ex = build(pages, findings, 12000);
ok(typeof ex === 'string' && ex.length > 0, 'produces a non-empty excerpt');
ok(ex.length <= 12000, 'excerpt stays within the 12k cap (' + ex.length + ')');

// Centres on the finding pages -- including the DEEP ones the old head-excerpt
// could never reach.
ok(/\[Page 113\]/.test(ex) && /RECEIVED CONTRADICTION/.test(ex), 'includes the deep page 113 evidence (received contradiction)');
ok(/\[Page 128\]/.test(ex) && /CAPACITY as director of Feike/.test(ex), 'includes the deep page 128 evidence (role/capacity)');
ok(/\[Page 2\]/.test(ex), 'parses "p. 2 vs 138" and includes page 2');
ok(/\[Page 138\]/.test(ex), 'parses the "vs 138" side and includes page 138');
ok(/\[Page 1\]/.test(ex) && /COVER LETTER parties/.test(ex), 'always includes page 1 for document identity');
// Neighbours of an anchored page are included for context.
ok(/\[Page 112\]/.test(ex) || /\[Page 114\]/.test(ex), 'includes a neighbour of an anchored page for context');
// A boilerplate deep page NOT referenced by any finding is excluded.
ok(!/\[Page 74\]/.test(ex), 'excludes an unreferenced middle page (page 74)');

// Role/capacity reach (the Moolla scenario): the payment page is anchored by a
// finding, but the affidavit's "in my capacity as director" page is NOT anchored
// by any finding. The excerpt must still pull the affidavit page in via its
// capacity marker, so the narrator sees BOTH halves of the contradiction.
const cap = [];
for (let i = 1; i <= 148; i++) cap.push('PAGE' + i + ' routine bundle text ' + 'filler '.repeat(30));
cap[0] = 'COVER parties Louw and Moolla';
cap[1] = 'Payment to SSM TRUST ACCOUNT 4082883975; Feike account 9027934431 also on file. ' + 'z'.repeat(120); // page 2 (anchored)
cap[125] = 'I was contacted in my capacity as a director of Feike (Pty) Ltd. ' + 'q'.repeat(120);            // page 126 (NOT anchored)
const capEx = build(cap, [{ type: 'CT02', location: 'p. 2 vs 138' }], 12000);
ok(/\[Page 2\]/.test(capEx) && /SSM TRUST ACCOUNT/.test(capEx), 'includes the anchored payment page (both accounts visible)');
ok(/\[Page 126\]/.test(capEx) && /in my capacity as a director of Feike/.test(capEx),
  'pulls in the UNANCHORED affidavit page via its capacity marker, so the narrator sees both halves');

// A bundle that mentions "trust account" on many pages must not flood the excerpt.
const flood = [];
for (let i = 1; i <= 40; i++) flood.push('Page ' + i + ' references a trust account in passing. ' + 'x'.repeat(60));
const floodEx = build(flood, [{ type: 'CT01', location: 'Page 3' }], 12000);
const markerPageCount = (floodEx.match(/\[Page \d+\]/g) || []).length;
ok(markerPageCount <= 3 + 5 + 2, 'capacity-marker pages are capped, not unbounded (' + markerPageCount + ' page blocks)');

// Fallback: no finding names a page AND no capacity/account marker anywhere ->
// document head, page-tagged. (Use a clean bundle so nothing is pulled in.)
const plainPages = [];
for (let i = 1; i <= 12; i++) plainPages.push('Page ' + i + ' ordinary letter text with nothing notable. ' + 'w'.repeat(40));
plainPages[0] = 'COVER LETTER opening page';
const headEx = build(plainPages, [{ type: 'CT18', location: '—' }], 12000);
ok(/\[Page 1\]/.test(headEx) && /COVER LETTER/.test(headEx), 'fallback: head excerpt when no finding names a page and no marker matches');

// Degenerate inputs never throw.
ok(build(null, findings, 12000) === '', 'no page text -> empty string');
ok(build([], findings, 12000) === '', 'empty page text -> empty string');
ok(typeof build(pages, [], 12000) === 'string', 'no findings -> still returns a string (head fallback)');

console.log(`\n[narrate-excerpt] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[narrate-excerpt] FAILURES'); process.exit(1); }
console.log('[narrate-excerpt] ALL GREEN');
