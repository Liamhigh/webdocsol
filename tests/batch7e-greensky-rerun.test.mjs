// Batch 7e — corrections from the Greensky re-run audit (23 November 2026, seal
// VO-239E0BCD382C, engine v5.7.3-web). The sealed artifacts stay immutable; these
// tests pin the engine and report corrections needed before any future scan:
// an institution's remit recital is not coercive conduct, a firm's letterhead
// and email router lines are not coordinated drafting, a timeline entry cannot
// borrow a neighbouring entry's kind, one demand is one ledger event, and an
// admission is never printed as a self-contradiction.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const R = require(path.join(__dirname, '..', 'forensic-report.js'));
const t = require('./_assert');
const D = E.DETECTORS;

// ---- CT47: an institution's remit lists the harms it guards against ----
// p. 374, verbatim: the EIB acknowledgement fired CT47 on its own remit recital
// and the advisory review disowned the passage.
const EIB_REMIT = "These matters fall within the EIB's published areas of concern relating to: safeguarding the integrity of EU-linked financial systems, ensuring that entities interacting with EU-based institutions operate without fraud, coercion, or professional misconduct, and responding appropriately where silence or non-action by public or quasi-public bodies may escalate harm";
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([EIB_REMIT]).length === 0,
  'CT47 is silent on an institution remit recital that lists coercion among the harms it monitors');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT(['He gave me until the end of the month failing which he would cut the supply of fish to the shop until I signed.']).length === 1,
  'a party pressure ultimatum with a concrete supply cut keeps its CT47 finding');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT(['He coerced my partner and committed fraud against us to force the transfer through.']).length === 1,
  'a party\'s own coercion report keeps its cue even with fraud named beside it');

// ---- CT55: letterhead, authenticity boilerplate and router lines ----
// pp. 120/125 reconstructed from the bundle's machine text: the Moore covering
// letter and the CIPC notification it enclosed, whose substantive content was
// images, measured 95% coordinated on furniture alone.
const MOORE_PAGE = '5th Floor, The Spinnaker, Albert Terrace,\nDurban, 4001\nP O Box 11800, Marine Parade, Durban 4056\nDISCLAIMER [this links through to the disclaimer web page]\nIf you have any doubt about the authenticity of an email you receive which claims to come from Moore South Africa and/or any of its staff members, please do not click on any links within the email and please do not respond to it. Instead, forward the email to marline@mooresa.co.za with subject line (Email authenticity check) and our Support Team will let you know whether the email is a legitimate email from Moore South Africa.\nFrom: Valerie Gounden\nSent: Thursday, 27 March 2025 14:04\nTo:\nConfidential – RAKEZ Case #1295911';
const CIPC_PAGE = '5th Floor, The Spinnaker, Albert Terrace,\nDurban, 4001\nP O Box 11800, Marine Parade, Durban 4056\nDISCLAIMER [this links through to the disclaimer web page]\nIf you have any doubt about the authenticity of an email you receive which claims to come from Moore South Africa and/or any of its staff members, please do not click on any links within the email and please do not respond to it. Instead, forward the email to marline@mooresa.co.za with subject line (Email authenticity check) and our Support Team will let you know whether the email is a legitimate email from Moore South Africa.\nFrom: noreply@cipc.co.za\nSent: 27 March 2025 10:27\nTo:\nConfidential – RAKEZ Case #1295911';
t.ok(D.D09A_DETECT_COORDINATION_NEAR_DUP([MOORE_PAGE, CIPC_PAGE]).length === 0,
  'CT55 is silent when the shared vocabulary is a letterhead, its authenticity disclaimer and email router lines');
t.ok(D.D09A_DETECT_COORDINATION_NEAR_DUP([
  'We confirm the equipment lease signed on 3 March 2025 remains in force for the Durban premises and that the monthly rental adjustment takes effect from April, with the maintenance obligations continuing unchanged for both parties in every particular as previously recorded. The secondary storage facility and the indexed service catalogue remain available for the term, and the quarterly reconciliation statements continue to be delivered against the agreed inspection schedule governing the premises during the current period of occupation without interruption. Yours faithfully, DENYS INC, per Jan Deneys.',
  'We confirm the equipment lease signed on 3 March 2025 remains in force for the Durban premises and that the monthly rental adjustment takes effect from April, with the maintenance obligations continuing unchanged for both parties in every particular as previously recorded. The secondary storage facility and the indexed service catalogue remain available for the term, and the quarterly reconciliation statements continue to be delivered against the agreed inspection schedule governing the premises during the current period of occupation without interruption. Yours sincerely, FAKROODEEN INC, per Ashraf Fakroodeen.'
]).length >= 1,
  'substantively identical letters under two different closing hands still fire CT55');

// ---- Ledger: a timeline entry cannot borrow a neighbouring entry's kind ----
// p. 95, bundle duplicate 224: the 13 March fish shipment and the 6 April
// entry were typed "invoice" by the previous entry's word inside the window.
const TIMELINE = 'Investigation timeline prepared from the record. Date: 8 Mar 2025 Event: Invoice sent and accepted Legal Relevance: Validates the order was executed pre-termination Date: 13 Mar 2025 Event: Fish shipped to Hong Kong Date: 6 Apr 2025 Event: Marius admits Kevin did the deal';
{
  const led = E.voExtractConductLedger([TIMELINE]);
  t.ok(led.events.some(e => e.date_key === 20250308 && e.kind === 'invoice'),
    'the 8 March invoice keeps its own kind on the timeline page');
  t.ok(!led.events.some(e => (e.date_key === 20250313 || e.date_key === 20250406) && e.kind === 'invoice'),
    'the fish shipment and the admission entry no longer borrow the neighbouring invoice');
}
{
  // The instrument named beside its date stays an invoice even when its terms
  // mention a future payment.
  const led = E.voExtractConductLedger(['Invoice INV101 dated 3 Mar 2025: export services, R100,000.00. Payment is due within thirty days.']);
  t.ok(led.events.length === 1 && led.events[0].kind === 'invoice' && led.events[0].proves_payment === false,
    'an invoice with due-payment terms is an invoice, and due terms are not performance');
}

// ---- Ledger: one demand is one event ----
// pp. 55/90 (bundle duplicate 219): the R100,000 demand of 14 April 2025 read
// as "entry" from the covering account and "demand" from the letter, doubling
// the ledger total to R200,000.
{
  const led = E.voExtractConductLedger([
    'I am pursuing the civil compensation claim of R100,000.00, with a deadline for payment set at midnight on Monday, 14 April 2025. As previously communicated, no negotiations on the amount will be entertained.',
    '',
    'Demand for compensation of R100,000.00 as before: should payment not be received by 14 April 2025, civil legal proceedings will follow to recover the loss.'
  ]);
  const evs = led.events.filter(e => e.date_key === 20250414 && e.amount === 100000);
  t.ok(evs.length === 1 && evs[0].also_on_pages.indexOf(3) !== -1 && led.summary.total_value === 100000,
    'the same demand seen from its covering account and from its letter is one event, one amount in the total');
}
{
  // Same date + same amount with two DIFFERENT stated payees are separate conduct.
  const led = E.voExtractConductLedger([
    'Payment of R40,000.00 was made to Greensky Ornamentals on 14 April 2025.',
    '',
    'Payment of R40,000.00 was made to Blue Reef Aquatics on 14 April 2025.'
  ]);
  t.ok(led.events.length === 2 && led.events.every(e => e.amount === 40000),
    'two same-day payments of the same value to different stated payees never collapse');
}

// ---- establishesOf: an admission is not a self-contradiction ----
{
  const adm = R._establishesOf({ type: 'CT01', severity: 4, conductAdmission: true, evidence: 'A party gives their own account of why the disputed transaction went ahead: "I let the order proceed"' });
  t.ok(/own account/.test(adm) && !/fact and its negation/i.test(adm),
    'a conduct admission prints the admission it is, never "asserts a fact and its negation"');
  const plain = R._establishesOf({ type: 'CT01', severity: 4, evidence: 'The letter states the licence is valid. The schedule states it lapsed.' });
  t.ok(/asserts a fact and its negation/i.test(plain),
    'a plain CT01 contradiction keeps its contradiction line');
}

t.done('batch7e-greensky-rerun');
