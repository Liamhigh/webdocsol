// D03B — narrative event-date conflicts, and the bundle-3 typing discipline.
//
// External review of evidence-bundle-3 (22 Oct 2026): the franchise
// agreement's termination "by the effluxion of time" was dated 28 February
// 2018 on ten pages and 28 February 2019 on p. 136 — the same event at two
// dates, inside the engine's own source bundle — and the engine missed it
// because D03 needs a date LABEL and affidavits state events narratively.
// The same review caught conduct indicators (CT47/48/49) and first-person
// admissions printed under the B1 "CONTRADICTION FOUND" header: an indicator
// or an admission is a recorded passage for human review, never "a fact and
// its negation".
//
// Run: node tests/event-date-conflict.test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');

const D03B = E.DETECTORS.D03B_DETECT_EVENT_DATE_CONFLICT;
t.ok(typeof D03B === 'function', 'D03B detector is registered');

// The bundle-3 miss itself: p. 117 (and others) vs p. 136 wording.
const bundle3 = [
  'Some earlier page without any dates in it at all, only ordinary prose.',
  'In casu it is common cause that the Franchise Agreement forming the basis of the Crompton Street Motors\u2019s occupation, terminated by the effluxion of time on 28 February 2018. Clause 11.1 of the Franchise Agreement provides as follows in this regard.',
  'Moreover, and for the reasons stated hereinbefore, the Business Zone judgment does not find any application in this matter as on 28 February 2019, the franchise agreement terminated by the effluxion of time.',
];
const out = D03B(bundle3);
t.ok(out.length > 0 && out.some(f => f.type === 'CT03' && f.severity === 5),
  'D03B catches the 2018-vs-2019 termination-year conflict');
const f0 = out.find(f => f.type === 'CT03');
t.ok(/Page 2/.test(f0.location) && /Page 3/.test(f0.location),
  'D03B anchors both pages (the no-anchor-no-sentence rule)');
t.ok(f0.evidence.includes('28 February 2018') && f0.evidence.includes('28 February 2019'),
  'D03B quotes both stated dates');

// A repeated statement of the SAME date is corroboration, not a conflict.
t.ok(D03B([
  'In casu it is common cause that the Franchise Agreement forming the basis of the occupation, terminated by the effluxion of time on 28 February 2018. This is repeated here at length so the sentence is long enough.',
  'Again: the Franchise Agreement forming the basis of the occupation terminated by the effluxion of time on 28 February 2018, and this sentence is also long enough to qualify.',
]).length === 0, 'D03B silent when the restated date agrees');

// Two DIFFERENT events at two different dates are not one event restated.
t.ok(D03B([
  'The lease of the Kempton Park premises commenced on 1 March 2017 for an initial period of three years, expiring by effluxion of time thereafter as stipulated.',
  'The sublease of the Durban harbour facility commenced on 1 September 2020 for an initial period of eighteen months, expiring by effluxion of time thereafter as stipulated.',
]).length === 0, 'D03B does not fuse two different instruments\u2019 dates');

// Ambiguous numeric dates never pair (the D03 rule: no fabricated allegation).
t.ok(D03B([
  'The franchise agreement terminated by the effluxion of time on 28/02/2018, recorded here in a sentence long enough to qualify for scanning.',
  'Moreover, on 28/02/2019, the franchise agreement terminated by the effluxion of time, recorded here in a sentence long enough to qualify.',
]).length === 0, 'D03B ignores ambiguous numeric date formats');

// Robustness: no throw on edge inputs.
for (const bad of [[], [''], ['   '], ['x'.repeat(100000)]]) {
  t.ok(Array.isArray(D03B(bad)), 'D03B robust on edge input');
}

// ---- Typing discipline (the other half of the bundle-3 review) ----
const rep = require('node:fs').readFileSync(path.join(__dirname, '..', 'forensic-report.js'), 'utf8');
t.ok(/put\('B4', \['CT47', 'CT48', 'CT49', 'CT50'\]\)/.test(rep),
  'conduct indicators (CT47-50) belong to the B4 behavioral brain, never the contradiction brain');
t.ok(/VO_NEUTRAL_BLOCK_CT = \{[^}]*CT47: 1, CT48: 1, CT49: 1, CT50: 1[^}]*\}/.test(rep),
  'conduct indicators print under the neutral FINDING RECORDED header');
t.ok(/if \(f && f\.conductAdmission\) return 'FINDING RECORDED';/.test(rep),
  'an admission prints as a recorded finding, never under a contradiction header');
// The inline copies in seal-document.html must carry the same discipline.
const html = require('node:fs').readFileSync(path.join(__dirname, '..', 'seal-document.html'), 'utf8');
t.ok(/put\('B4', \['CT47', 'CT48', 'CT49', 'CT50'\]\)/.test(html),
  'the inline report copy carries the same brain mapping');

// ---- Ordinal suffixes (litigation prose: "31st December 2017") ----
// The termination-date tangle in bundles 3 and 4 is stated with ordinals
// ("terminated ... on 31st December 2017" vs "on 28 February 2018").
t.ok(D03B([
  'It is common cause that the Franchise Agreement forming the basis of the occupation, terminated by the effluxion of time on 31st December 2017, as recorded here at length.',
  'Moreover, the franchise agreement terminated by the effluxion of time on 28 February 2018, a sentence long enough to qualify for scanning here.',
]).some(f => f.type === 'CT03' && f.evidence.includes('31st December 2017') && f.evidence.includes('28 February 2018')),
  'D03B reads ordinal dates and pairs the 31-Dec-2017 vs 28-Feb-2018 termination tangle');
// NOTE: month-year-only dates ("February 2003") are deliberately NOT parsed:
// on the real bundles they paired across a correspondence narrative and
// multiplied false findings. The Bester acquisition (Feb 2003 vs 1 Mar 2003)
// is a documented miss for the AI review lane.

t.done('event-date-conflict');
