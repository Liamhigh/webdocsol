// Batch 4 — the deterministic shapes from the "camera case" contradiction
// analysis (23 Oct 2026), each validated against the real sealed text:
//  - ownership:  "my camera, valued at approximately R7,000" (personal) vs
//    "Greensky Ornamentals camera" / "property belonging to Greensky ..."
//    (entity) — one asset, two owners (D06B).
//  - theft/scam: "the camera was stolen" / "the theft case ... will
//    continue" vs "you tried to sell the camera ... and got conned" /
//    "lost in a courier scam, not stolen" (D01B).
//  - denial/admission: "there were no sales" / "we never invoiced at all"
//    vs "Kevin's Export proceeded with the deal" (D01C).
//  - meeting reversal: "refused to attend a meeting I had requested" vs
//    "I've asked quite a few times to have a meeting with you" (D04C).
//
// Run: node tests/batch4-detectors.test.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');

const D01B = E.DETECTORS.D01B_DETECT_THEFT_VS_SCAM_CHARACTERISATION;
const D01C = E.DETECTORS.D01C_DETECT_DENIAL_ADMISSION_PAIR;
const D04C = E.DETECTORS.D04C_DETECT_MEETING_REQUEST_REFUSAL_REVERSAL;
const D06B = E.DETECTORS.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT;
t.ok(typeof D01B === 'function' && typeof D01C === 'function' && typeof D04C === 'function' && typeof D06B === 'function',
  'batch-4 detectors are registered');

// ---- D06B: same asset, two owners ----
const cam = [
  'Statement Regarding Stolen Greensky Ornamentals Camera. The Greensky Ornamentals camera was signed out, and I confirmed to the police that the camera was taken from the premises.',
  'Filler page. '.repeat(40),
  'There is also a separate issue involving my camera, valued at approximately R7,000. The complainant says it was sold and the buyer was scammed.',
];
const outOwn = D06B(cam);
t.ok(outOwn.some(f => f.type === 'CT06' && f.severity === 4 && f.evidence.includes('camera')),
  'D06B catches my-camera vs Greensky Ornamentals camera');
t.ok(outOwn.some(f => /Page 3 vs Page 1|Page 1 vs Page 3/.test(f.location)), 'D06B anchors both pages');
// Consistent single-owner text is silent.
t.ok(D06B([
  'The company camera was signed out on Monday and returned on Friday as the register shows.',
  'My laptop was also in the bag, which is my own property and always has been.',
]).length === 0, 'D06B silent when one asset has one owner');
// Legal drafting nouns are not assets — silence required.
t.ok(D06B([
  'Attached hereto as annexure A which was also as attached in turn to my answering affidavit in the matter.',
  'Consequently, my attorneys appointed a consultant. The contentions of Former Way Properties require response.',
]).length === 0, 'D06B silent on affidavits/attorneys/contentions (drafting nouns)');

// ---- D01B: theft vs scam ----
const theft = [
  'The theft case against you and your girlfriend will continue. The camera was stolen as I told you.',
  'Filler page. '.repeat(40),
  'You tried to sell the camera through your girlfriend and got conned. The camera was lost in a courier scam.',
];
const outTS = D01B(theft);
t.ok(outTS.length === 1 && outTS[0].type === 'CT01' && outTS[0].severity === 4,
  'D01B fires once when theft and scam characterisations coexist');
t.ok(/stolen|theft/i.test(outTS[0].evidence) && /conned|scam/i.test(outTS[0].evidence),
  'D01B quotes both characterisations');
// Only one characterisation present — silent.
t.ok(D01B(['The camera was stolen from the office. A theft case was opened with SAPS.']).length === 0,
  'D01B silent when only theft appears');
t.ok(D01B(['The buyer was conned by a fake proof of payment; it was a courier scam.']).length === 0,
  'D01B silent when only scam appears');

// ---- D01C: denial then admission ----
const deny = [
  'You told me there were no sales and that the order fell through. I believed you at the time.',
  'Filler page. '.repeat(40),
  'Because you refused to communicate with us, Kevin proceeded with the deal, since the client was already his.',
];
const outDA = D01C(deny);
t.ok(outDA.length === 1 && outDA[0].type === 'CT01', 'D01C fires once on denial + admission');
t.ok(outDA[0].evidence.includes('no sales') && outDA[0].evidence.includes('proceeded with the deal'),
  'D01C quotes the denial and the admission');
t.ok(outDA[0].location === 'Page 1 vs Page 3', 'D01C prefers a cross-page pair');
// Denial alone — silent.
t.ok(D01C(['There were no sales in March. Nothing was sold and nothing was invoiced.']).length === 0,
  'D01C silent when only a denial appears');
// Admission alone — silent.
t.ok(D01C(['The deal went ahead and the sale was made in March as planned.']).length === 0,
  'D01C silent when only an admission appears');

// ---- D04C: meeting request/refusal reversal ----
const meet = [
  'I have asked quite a few times to have a meeting with you. I requested a meeting on 9 March and never got a response.',
  'Filler page. '.repeat(40),
  'Liam also blocked both Kevin and me and refused to attend a meeting I had requested to discuss his exit.',
];
const outM = D04C(meet);
t.ok(outM.length === 1 && outM[0].type === 'CT01' && outM[0].severity === 4,
  'D04C fires once on the request/refusal reversal');
t.ok(/Page 3 vs Page 1/.test(outM[0].location), 'D04C anchors the refusal page vs the request page');
// One passage saying "he refused the meeting I requested" is one event, not a reversal — silent.
t.ok(D04C(['He refused to attend the meeting I requested last week. That is the only meeting discussed here.']).length === 0,
  'D04C silent when refusal and request are the same passage');
// Requests without any refusal accusation — silent.
t.ok(D04C(['I asked for a meeting twice. He asked for a meeting too. We met on Friday and spoke at length.']).length === 0,
  'D04C silent when nobody is accused of refusing');

// Robustness: no throw on edge inputs.
for (const bad of [[], [''], ['   '], ['x'.repeat(100000)], null]) {
  t.ok(Array.isArray(D01B(bad)) && Array.isArray(D01C(bad)) && Array.isArray(D04C(bad)) && Array.isArray(D06B(bad)),
    'batch-4 detectors robust on edge input');
}

t.done('batch4-detectors');
