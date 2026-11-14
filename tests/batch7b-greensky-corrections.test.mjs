// Batch 7b — corrections from the sealed Greensky output review.
// The sealed artifacts stay immutable. These tests pin the ENGINE corrections
// needed before a fresh scan: no invoice/demand may disprove non-payment, no
// narrative label may become another party's conduct, and legal-lane output
// may never certify success and failure together.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const R = require(path.join(__dirname, '..', 'forensic-report.js'));
const t = require('./_assert');
const D = E.DETECTORS;

// ---- Calendar validity and ranges ----
t.ok(E.voDateSortKey('37 Mar 2025') === null && E.voDateSortKey('32 January 2026') === null,
  'impossible month-name days are rejected');
t.ok(E.voDateSortKey('31 February 2025') === null && E.voDateSortKey('29 February 2024') === 20240229,
  'month-name dates are real calendar dates, including leap day');
const rangeLedger = E.voExtractConductLedger(['Payment received for invoice INV7 on 3–7 Mar 2025: R10,000.00.']);
t.ok(rangeLedger.events.every(e => e.date !== '2025-03-37'),
  'a day range never becomes the impossible date 2025-03-37');

// ---- CT59: only completed money movement can disprove non-payment ----
const denial = 'Despite this, no payment was made to Greensky Ornamentals for its 30% share.';
const invoiceDates = ['3 Mar 2025', '4 Apr 2025', '5 May 2025', '6 Jun 2025', '7 Jul 2025', '8 Aug 2025'];
const invoiceBlocks = [denial].concat(invoiceDates.map((dt, i) =>
  'Invoice INV' + (100 + i) + ' dated ' + dt + ': export services, R100,000.00. Payment is due within thirty days.'));
t.ok(D.D61_DETECT_CONDUCT_VS_PLEADING(invoiceBlocks).length === 0,
  'six invoices and due-payment demands do not disprove non-payment to Greensky');

const noticeLedger = E.voExtractConductLedger(['Demand dated 8 Aug 2025: pay Liam Highcock R100,000.00 within seven days of receipt of this notice.']);
t.ok(noticeLedger.events.every(e => e.kind !== 'receipt' && e.proves_payment !== true),
  'receipt of a notice is not a payment receipt and a demand is not performance');
const negatedLedger = E.voExtractConductLedger(['It is recorded that no payment was made on 5 May 2025 for invoice INV9, R10,000.00.']);
t.ok(negatedLedger.events.every(e => e.proves_payment !== true),
  'a negated payment statement is not affirmative payment conduct');
const notReceivedBlocks = [denial].concat(invoiceDates.map((dt, i) =>
  'Ledger entry dated ' + dt + ': payment was not received from Greensky Ornamentals, reference PAY' + (600 + i) + ', R10,000.00.'));
t.ok(D.D61_DETECT_CONDUCT_VS_PLEADING(notReceivedBlocks).length === 0 &&
  E.voExtractConductLedger(notReceivedBlocks).events.every(e => e.proves_payment !== true),
  'payment was not received records non-payment, never completed performance');
const neverMadeLedger = E.voExtractConductLedger(['Ledger entry dated 5 May 2025: payment was never made to Greensky Ornamentals, R10,000.00.']);
t.ok(neverMadeLedger.events.every(e => e.proves_payment !== true),
  'payment was never made records non-payment, never completed performance');
const futurePaymentBlocks = [denial].concat(invoiceDates.map((dt, i) =>
  'Agreement dated ' + dt + ': payment to be made to Greensky Ornamentals under reference PAY' + (700 + i) + ', R10,000.00.'));
t.ok(D.D61_DETECT_CONDUCT_VS_PLEADING(futurePaymentBlocks).length === 0 &&
  E.voExtractConductLedger(futurePaymentBlocks).events.every(e => e.proves_payment !== true),
  'a future payment obligation is not completed payment conduct');

const paidDates = ['3 Mar 2025', '4 Apr 2025', '5 May 2025', '6 Jun 2025', '7 Jul 2025', '8 Aug 2025'];
const paidBlocks = [denial].concat(paidDates.map((dt, i) =>
  'Bank entry dated ' + dt + ': payment to Greensky Ornamentals received, reference PAY' + (200 + i) + ', R10,000.00.'));
const paidFindings = D.D61_DETECT_CONDUCT_VS_PLEADING(paidBlocks);
t.ok(paidFindings.length === 1 && paidFindings[0].type === 'CT59' && paidFindings[0].conduct_vs_pleading.event_count === 6,
  'six completed payments to the denied payee preserve the genuine CT59 detection');
const saAmountPaidBlocks = [denial].concat(paidDates.map((dt, i) =>
  'Bank entry dated ' + dt + ': payment of R10,000.00 was made to Greensky Ornamentals, reference PAY' + (800 + i) + '.'));
const saAmountPaidFindings = D.D61_DETECT_CONDUCT_VS_PLEADING(saAmountPaidBlocks);
t.ok(saAmountPaidFindings.length === 1 && saAmountPaidFindings[0].conduct_vs_pleading.event_count === 6,
  'a decimal amount between the payment noun and completed-performance verb remains detectable');
const otherPayeeBlocks = [denial].concat(paidDates.map((dt, i) =>
  'Bank entry dated ' + dt + ': payment to Liam Highcock received, reference PAY' + (300 + i) + ', R10,000.00.'));
t.ok(D.D61_DETECT_CONDUCT_VS_PLEADING(otherPayeeBlocks).length === 0,
  'payments to Liam cannot contradict non-payment to Greensky');
const mixedPayeeBlocks = [denial];
for (let i = 0; i < paidDates.length; i++) {
  mixedPayeeBlocks.push('Bank entry dated ' + paidDates[i] + ': payment to Liam Highcock received, reference PAY' + (400 + i) + ', R10,000.00.');
  mixedPayeeBlocks.push('Bank entry dated ' + paidDates[i] + ': payment to Greensky Ornamentals received, reference PAY' + (500 + i) + ', R10,000.00.');
}
const mixedPayeeFindings = D.D61_DETECT_CONDUCT_VS_PLEADING(mixedPayeeBlocks);
t.ok(mixedPayeeFindings.length === 1 && mixedPayeeFindings[0].conduct_vs_pleading.event_count === 6,
  'same-day same-value payments to different payees remain separate ledger events');
t.ok(D.D61_DETECT_CONDUCT_VS_PLEADING(['No agreement ever existed between the parties.'].concat(paidBlocks.slice(1))).length === 0,
  'payment conduct does not prove that an agreement existed');
t.ok(D.D61_DETECT_CONDUCT_VS_PLEADING(['No amount is due or payable.'].concat(paidBlocks.slice(1))).length === 0,
  'historic payments do not contradict a denial that a present balance is due');

// ---- CT01: admissions and reported positions are not direct contradictions ----
const admissionText = "Because you refused to communicate with Kevin's Export and me, Kevin's Export proceeded with the deal, since Sealife Hong Kong was already his client.";
const admission = D.D01_DETECT_DIRECT_CONTRADICTION([admissionText, admissionText]).find(f => f.conductAdmission);
t.ok(admission && E.voClassifyFinding(admission) === 'TENSION',
  'a party admission is preserved as an evidence lead, not classified as a contradiction');
t.ok(admission && admission.pages.length === 1,
  'the same admission repeated in an email thread is counted once');
t.ok(D.D01_DETECT_DIRECT_CONTRADICTION(["Perhaps later you'll think to yourself: I was wrong. You have admitted to fraud, and your attorney will advise you to settle."])
  .every(f => !/explicit admission/.test(f.evidence)),
  'a prediction that another person may think “I was wrong” is not that person’s admission');

const theftScamSame = ['The camera was lost in a courier scam, not stolen. Belinda personally assisted with the attempted sale.'];
t.ok(D.D01B_DETECT_THEFT_VS_SCAM_CHARACTERISATION(theftScamSame).length === 0,
  '“not stolen” is not a theft allegation and one passage is not two opposing positions');
const theftOut = D.D01B_DETECT_THEFT_VS_SCAM_CHARACTERISATION([
  'The camera was stolen from the locked office on Monday. The theft was reported to police.',
  'The buyer was conned during a later attempted sale of the camera. The seller disclosed that sale.'
]);
t.ok(theftOut.length === 1 && !/ulent on the buyer|\btran\b/.test(theftOut[0].evidence),
  'a genuine two-position theft/scam lead survives with complete words');

t.ok(D.D01C_DETECT_DENIAL_ADMISSION_PAIR([
  'Liam records that you said the deal fell through and that we never invoiced.',
  admissionText
]).length === 0,
  'a reported denial and a third-party transaction admission are not paired as one actor’s contradiction');
t.ok(D.D01C_DETECT_DENIAL_ADMISSION_PAIR([
  'There were no sales and nothing was invoiced for the Sealife transaction.',
  'Liam records that Kevin said the deal went ahead.'
]).length === 0,
  'a direct denial is not paired with a narrator’s report of another person’s admission');
t.ok(D.D01C_DETECT_DENIAL_ADMISSION_PAIR([
  'There were no sales and nothing was invoiced for the Sealife transaction.',
  'Kevin proceeded with the deal and completed the Sealife sale.'
]).length === 1,
  'a direct transaction denial still pairs with an admission that the same transaction proceeded');

const meeting = D.D04C_DETECT_MEETING_REQUEST_REFUSAL_REVERSAL([
  'Liam requested a private shareholder meeting four times without an answer.',
  'You repeatedly refused to meet and blocked both Kevin and me on WhatsApp.'
]);
t.ok(meeting.length === 1 && E.voClassifyFinding(meeting[0]) === 'TENSION',
  'private/group meeting accounts remain a review tension, not a logical impossibility');

// ---- CT06/CT55: nouns and boilerplate are not asset/coordination evidence ----
t.ok(D.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT([
  'I do not know whether you received my message during the signal interruption.',
  'CIPC Disclaimer: This message and its attachments are intended only for the named recipient.'
]).length === 0, 'a message is communication, not a possessable asset');
t.ok(D.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT([
  'Moore Durban requested only my resignation from ReefTribe.',
  'Liam Highcocks resignation was recorded by Moore Durban as company secretary.'
]).length === 0, 'a resignation is a legal act, not a possessable asset');

const mooreA = 'MOORE SOUTH AFRICA. Moore Durban. This email and any attachments are confidential and intended solely for the named recipient. If you received this email in error, please notify the sender and delete it. Any unauthorised review, use, disclosure, copying or distribution is prohibited. Moore South Africa accepts no liability for transmission errors, interception, corruption or viruses. Directors: A Smith, B Jones. Registration 2000/000001/07. Page 113.';
const mooreB = mooreA.replace('Page 113', 'Page 118').replace('A Smith, B Jones', 'C Brown, D Ntuli');
t.ok(D.D09A_DETECT_COORDINATION_NEAR_DUP([mooreA, mooreB]).length === 0,
  'shared professional email disclaimers and letterhead do not establish coordinated drafting');
const body = 'We refer to the above matter and to your recent correspondence. Our client instructs that the application was duly processed by the office and that any suggestion to the contrary is denied. We are instructed to demand that you withdraw the allegations within twenty one days failing which our client will approach the court for relief including an order declaring you a vexatious litigant and seeking punitive costs on the attorney and client scale together with interest and such further relief as the court deems meet and appropriate in the circumstances of this disputed matter.';
t.ok(D.D09A_DETECT_COORDINATION_NEAR_DUP([
  'DENYS ATTORNEYS. 7 July 2026. ' + body + ' Yours faithfully, DENYS INC, per Jan Deneys.',
  'FAKROODEEN & ASSOCIATES. 9 July 2026. ' + body + ' Yours sincerely, FAKROODEEN INC, per Ashraf Fakroodeen.'
]).length === 1, 'substantively identical letters under different hands remain detectable');

// ---- Behavioural indicators: source quality and thread deduplication ----
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  "As a result, I'm left with no choice but to seek legal advice.",
  "As a result, I'm left with no choice but to seek legal advice.",
  "As a result, I'm left with no choice but to seek legal advice."
]).length === 0, 'ordinary recourse to legal advice is not coercive conduct');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'If you fail to deliver the stock tomorrow we will suspend your supply and seek legal advice.'
]).length === 1, 'mentioning legal advice does not suppress an independent coercive cue');
const threat = 'If you fail to deliver the stock tomorrow we will be forced to suspend your supply and recover the loss.';
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([threat, threat, threat]).length === 1 &&
  D.D41_DETECT_COERCIVE_CONDUCT([threat, threat, threat])[0].pages.length === 1,
  'an identical threat repeated in quoted email threads counts once');
t.ok(D.D42_DETECT_REALITY_DENIAL([
  'Additional Evidence: Fabricated Allegations. This WhatsApp screenshot confirms Liam experienced signal failure.',
  'It further reinforces that the accusations were fabricated and Liam was set up deliberately.'
]).length === 0, 'the complainant’s fabricated-allegation argument is not independent reality-denial conduct');
t.ok(D.D42_DETECT_REALITY_DENIAL([
  'Liam’s narrative states that Marius said your recollection of events is wrong.'
]).length === 0, 'a second-hand narrative attribution is not independent opposing-party conduct');
t.ok(D.D42_DETECT_REALITY_DENIAL(['Your recollection of events is wrong and no such meeting happened.']).length === 1,
  'direct reality-denial language remains detectable');
t.ok(D.D42_DETECT_REALITY_DENIAL(['That is not what was said during the meeting and no such agreement existed.']).length === 1,
  'direct “that is not what was said” wording is not mistaken for second-hand attribution');
t.ok(D.D43_DETECT_BLAME_REVERSAL([
  'This indicates false instruction or omission by Marius, constituting abuse of process.'
]).length === 0, 'the complainant’s legal characterisation is not opposing-party blame reversal');
t.ok(D.D43_DETECT_BLAME_REVERSAL(['We are the real victims and your harassment of our staff must stop.']).length === 1,
  'direct reverse-victim language remains detectable');

// ---- Quotation integrity ----
const longPage = 'Prefix ' + 'substantial investment '.repeat(40) + 'concluded.';
const q = E.voSentenceAround(longPage, 'tial investment substantial investment');
t.ok(q && !/^\s*[a-z]{1,4}\s/.test(q) && !/\b[a-z]{1,3}$/.test(q),
  'quotation windows do not begin or end inside a word');

// ---- Legal-lane state and defensive rendering ----
const worker = (await import(path.join(__dirname, '..', 'worker', 'verum-rules.js'))).default;
const req = body => new Request('https://verumglobal.foundation/api/v1/ai/verify-law', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
});
const baseEnv = { RULES_KV: { get: async () => null, list: async () => ({ keys: [] }) }, ENVIRONMENT: 'test' };
async function lawRun(aiVerdicts, externalVerdicts, thirdVerdicts) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const verdicts = /law-lane-three/.test(String(url)) ? thirdVerdicts : externalVerdicts;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ verdicts }) } }] }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const env = Object.assign({}, baseEnv, {
      AI: { run: async () => ({ response: JSON.stringify({ verdicts: aiVerdicts }) }) },
      LLM2_API_BASE: 'https://law-lane-two.invalid/v1', LLM2_MODEL: 'independent-lane', LLM2_API_KEY: 'test-only'
    });
    if (thirdVerdicts) Object.assign(env, {
      LLM3_API_BASE: 'https://law-lane-three.invalid/v1', LLM3_MODEL: 'third-independent-lane', LLM3_API_KEY: 'test-only'
    });
    const response = await worker.fetch(req({ jurisdiction: 'ZA', candidates: [
      { statute: 'Companies Act 71 of 2008', section: 's76', claim: 'directors duties' },
      { statute: 'Prescription Act 68 of 1969', section: 's11', claim: 'extinctive prescription' }
    ] }), env, {});
    return await response.json();
  } finally { globalThis.fetch = realFetch; }
}
const confirmsA = { statute: 'Companies Act 71 of 2008', verdict: 'CONFIRMS', note: 'Statute and director duties confirmed' };
const confirmsB = { statute: 'Prescription Act 68 of 1969', verdict: 'CONFIRMS', note: 'Statute and prescription confirmed' };
const mixed = await lawRun([confirmsA, confirmsB], [confirmsA]);
t.ok(mixed.results[0].status === 'VERIFIED' && mixed.results[1].status === 'UNVERIFIED' &&
  !/Law citations verified by/.test(mixed.declaration) && !/quorum 2\/2[\s\S]*Fewer than two|Fewer than two[\s\S]*quorum 2\/2/.test(mixed.declaration + ' ' + mixed.direction),
  'one verified citation cannot produce a blanket two-lane success declaration for another unverified citation');
const disputed = await lawRun([confirmsA, confirmsB], [
  { statute: 'Companies Act 71 of 2008', verdict: 'REJECTS', note: 'Coverage disputed' },
  { statute: 'Prescription Act 68 of 1969', verdict: 'REJECTS', note: 'Coverage disputed' }
]);
t.ok(disputed.results.every(r => r.status === 'DISPUTED') && !/Law citations verified by/.test(disputed.declaration) && /did not agree/.test(disputed.direction),
  'two answering lanes that disagree produce only the disputed direction');
const rejectsA = { statute: 'Companies Act 71 of 2008', verdict: 'REJECTS', note: 'Third lane rejects coverage' };
const rejectsB = { statute: 'Prescription Act 68 of 1969', verdict: 'REJECTS', note: 'Third lane rejects coverage' };
const threeLaneDissent = await lawRun([confirmsA, confirmsB], [confirmsA, confirmsB], [rejectsA, rejectsB]);
t.ok(threeLaneDissent.results.every(r => r.status === 'DISPUTED' && r.quorum === false && r.lanesRun === 3 &&
  r.lanes.some(l => l.lane === 'L3' && l.verdict === 'REJECTS')) &&
  !/Law citations verified by/.test(threeLaneDissent.declaration) && /did not agree/.test(threeLaneDissent.direction),
  'three-lane dissent excludes the disputed citations and preserves the rejecting lane');
const rendered = R._lawExclusionsOf({
  declaration: 'Law citations verified by 2 independent lanes (quorum 2/2).',
  direction: 'Fewer than two independent legal lanes ran. Do not rely on any legal reference in this report — contact a qualified lawyer.',
  results: [
    { statute: 'Companies Act 71 of 2008', status: 'VERIFIED', lanes: [] },
    { statute: 'Prescription Act 68 of 1969', status: 'UNVERIFIED', lanes: [] }
  ]
});
t.ok(!/Law citations verified by/.test(rendered.declaration) && rendered.excluded.length === 1,
  'the report renderer independently suppresses a stale positive declaration when any citation is excluded');

t.done('batch7b-greensky-corrections');
