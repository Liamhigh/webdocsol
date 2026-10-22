// D03C — term arithmetic: a stated start date, a stated term and a stated
// end date form a sum the engine can check.
//
// Folder-wide review (Contradictions report, 23 Oct 2026), item 3: the All
// Fuels letter of 1 September 2017 grants "a franchise license ... for a
// period of 15 (fifteen) years" over the Franchise Agreement "dated 01 March
// 2013" and then states that the same agreement "finally terminates by the
// effluxion of time at midnight (00h00) on the 28 February 2018" — five
// years, not fifteen. A 15-year grant over a 1 March 2013 agreement cannot
// finally terminate in February 2018.
//
// Run: node tests/term-arithmetic.test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');

const D03C = E.DETECTORS.D03C_DETECT_TERM_ARITHMETIC;
t.ok(typeof D03C === 'function', 'D03C detector is registered');

// The letter itself: 15-year grant, agreement dated 1 March 2013, said to
// terminate finally on 28 February 2018.
const letter = [
  'TERMINATION OF FRANCHISE AGREEMENT. We refer to your Franchise Agreement dated 01 March 2013 and to the discussions between the parties in this regard.',
  'In terms of the Franchise Agreement, you were afforded a franchise license to operate the Franchise Business for a period of 15 (fifteen) years. The period of 15 (fifteen) years is divided into 3 (three) periods of 5 (five) years each. The Franchise Agreement finally terminates by the effluxion of time at midnight (00h00) on the 28 February 2018.',
];
const out = D03C(letter);
t.ok(out.some(f => f.type === 'CT03' && f.severity === 5),
  'D03C catches the 15-year grant said to end at five years');
t.ok(out.some(f => /15 years/.test(f.evidence) && f.evidence.includes('01 March 2013') && f.evidence.includes('28 February 2018')),
  'D03C quotes the term and both dates');
t.ok(out.some(f => /Page/.test(f.location)), 'D03C anchors a page (no anchor, no sentence)');
// The consistent 5-year sub-period must NOT flag: 5 years from 1 March 2013
// is 28 February 2018, which is what the letter says.
t.ok(!out.some(f => f.evidence.includes('stated period of 5 years')),
  'D03C stays silent on the consistent five-year sub-period');

// A letter whose arithmetic works says nothing.
t.ok(D03C([
  'We refer to your Franchise Agreement dated 01 March 2013 and the consequences of its expiry in terms of its clauses.',
  'You were afforded a franchise license for a period of 5 (five) years. The Franchise Agreement finally terminates by the effluxion of time at midnight on the 28 February 2018, which is the end of the first period.',
]).length === 0, 'D03C silent when the term arithmetic is consistent');

// A stated term with no start date (or no end date) is not a finding.
t.ok(D03C(['The franchise runs for a period of 15 (fifteen) years from commencement, as the parties recorded at the time.']).length === 0,
  'D03C needs start, term and end together');
// Ambiguous numeric dates never enter the sum (the D03 rule).
t.ok(D03C(['Your Franchise Agreement dated 01/03/2013 ran for a period of 15 (fifteen) years and finally terminates on 28/02/2018 as recorded.']).length === 0,
  'D03C ignores ambiguous numeric date formats');

// Robustness: no throw on edge inputs.
for (const bad of [[], [''], ['   '], ['x'.repeat(100000)]]) {
  t.ok(Array.isArray(D03C(bad)), 'D03C robust on edge input');
}

t.done('term-arithmetic');
