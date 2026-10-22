import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const t = require('./_assert.js');
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(new URL('../forensic-engine-page.js', import.meta.url), 'utf8');
const sandbox = { window: {}, document: { addEventListener() {}, getElementById() { return null; } }, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const DETECTORS = sandbox.window.DETECTORS || sandbox.DETECTORS;

function run(name, blocks) {
  const fn = DETECTORS[name];
  t.ok(typeof fn === 'function', name + ' exists');
  return fn.call(DETECTORS, blocks) || [];
}

// ---------- D04B: document predates its own contents (schedule item 9, Annexure L) ----------
const annL = [
  'ANNEXURE L\nGREENSKY PROJECT REPORT\nMarius Nortje (50% Shareholder / GM)\nDate: 13 April 2025\nPrepared for internal record.',
  'Works summary: the structural repair date: 21 April 2025 was recorded on site after inspection. All values final.',
  'Sign-off page. No further dates.'
];
const f1 = run('D04B_DETECT_DOCUMENT_PREDATES_CONTENT', annL);
t.ok(f1.length === 1, 'D04B fires once on cover 13 Apr vs structural repair date 21 Apr');
t.ok(f1[0].type === 'CT04' && f1[0].severity === 5, 'D04B finding is CT04 sev 5');
t.ok(/13 April 2025/.test(f1[0].evidence) && /21 April 2025/.test(f1[0].evidence), 'D04B evidence cites both dates');

// A future HEARING date is legitimate reference, not an accomplished fact — silence required
const future = [
  'REPORT\nDate: 13 April 2025\nMatter overview.',
  'The hearing is set down for 21 April 2025 and the deadline for filing is 30 April 2025.'
];
t.ok(run('D04B_DETECT_DOCUMENT_PREDATES_CONTENT', future).length === 0, 'D04B silent on future hearing/deadline references');

// Completion date EARLIER than cover date is fine — silence required
const earlier = [
  'REPORT\nDate: 13 April 2025\nMatter overview.',
  'Completion date: 2 April 2025. All works closed out before this report.'
];
t.ok(run('D04B_DETECT_DOCUMENT_PREDATES_CONTENT', earlier).length === 0, 'D04B silent when inner completion predates cover');

// No labelled cover date — the detector must not guess
t.ok(run('D04B_DETECT_DOCUMENT_PREDATES_CONTENT', ['A document with no date line.', 'repair date: 21 April 2025']).length === 0, 'D04B silent without a cover date');

// ---------- D02B: same charge, two invoice numbers (schedule item 16, FA8 vs FA11) ----------
const fa = [
  'FA8: The amount outstanding for Damages October 2026 is per invoice INV98185 for R199,405.63, payable on demand.',
  'Some unrelated page with no invoice content at all.',
  'FA11: The damages claim for October 2026 is carried under invoice INV69816 in the sum of R199,405.63.'
];
const f2 = run('D02B_DETECT_INVOICE_IDENTITY_CONFLICT', fa);
t.ok(f2.length === 1, 'D02B fires once on INV98185 vs INV69816 sharing R199,405.63');
t.ok(f2[0].type === 'CT02' && f2[0].severity === 4, 'D02B finding is CT02 sev 4');
t.ok(/INV98185/.test(f2[0].evidence) && /INV69816/.test(f2[0].evidence) && /199,405\.63/.test(f2[0].evidence), 'D02B evidence cites both numbers and the amount');

// Same invoice number repeated is consistency, not conflict — silence required
const sameInv = [
  'Invoice INV98185 for R199,405.63 is outstanding for damages.',
  'We again refer to invoice INV98185 for R199,405.63 in respect of damages.'
];
t.ok(run('D02B_DETECT_INVOICE_IDENTITY_CONFLICT', sameInv).length === 0, 'D02B silent when the same invoice number repeats');

// Two invoice numbers for DIFFERENT amounts is ordinary business — silence required
const diffAmt = [
  'Invoice INV98185 for R199,405.63 covers damages.',
  'Invoice INV69816 for R50,000.00 covers rental.'
];
t.ok(run('D02B_DETECT_INVOICE_IDENTITY_CONFLICT', diffAmt).length === 0, 'D02B silent when amounts differ');

// ---------- D02C: paid claim vs "not a proof of payment" disclaimer (schedule items 14-15) ----------
const pop = [
  'Email: Attached is POP for refund for fuel in the amount of R 2 000 000 paid into the account.',
  'Attachment statement: A single capture of R1,000,000.00 was made on 3 March 2026 and remains unreleased. THIS DOCUMENT IS NOT A PROOF OF PAYMENT and must not be relied on as such.'
];
const f3 = run('D02C_DETECT_PAYMENT_PROOF_MISMATCH', pop);
t.ok(f3.length === 1, 'D02C fires once on claimed R2m POP vs disclaimed R1m capture');
t.ok(f3[0].type === 'CT02' && f3[0].severity === 4, 'D02C finding is CT02 sev 4');
t.ok(/not a proof of payment/i.test(f3[0].evidence), 'D02C evidence quotes the disclaimer');

// Claimed amount MATCHING the disclaimed document is not a money contradiction here — silence required
const popMatch = [
  'Email: Attached is POP for the refund of R1,000,000.00 paid into the account.',
  'Attachment statement: A single capture of R1,000,000.00 was made on 3 March 2026. THIS DOCUMENT IS NOT A PROOF OF PAYMENT.'
];
t.ok(run('D02C_DETECT_PAYMENT_PROOF_MISMATCH', popMatch).length === 0, 'D02C silent when claimed amount matches the document');

// ---------- edge robustness ----------
t.noThrow(() => run('D04B_DETECT_DOCUMENT_PREDATES_CONTENT', []), 'D04B survives empty input');
t.noThrow(() => run('D02B_DETECT_INVOICE_IDENTITY_CONFLICT', null), 'D02B survives null input');
t.noThrow(() => run('D02C_DETECT_PAYMENT_PROOF_MISMATCH', [null, undefined, '']), 'D02C survives messy blocks');

t.done('batch3-detectors');
