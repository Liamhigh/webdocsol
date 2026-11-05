// Batch 7c — corrections reproduced by the 347-page court bundle.
// The uploaded sealed artifacts remain immutable historical drafts. These
// controls correct general inference and quotation rules before a fresh scan.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const t = require('./_assert');
const D = E.DETECTORS;

// ---- CT01: an admission lead must quote complete words ----
const admissionOut = D.D01_DETECT_DIRECT_CONTRADICTION([
  'regard is baseless. AD PARAGRAPH 18 227. I admit that annexure B was sent to the Controller in response to the request.'
]);
const admissionLead = admissionOut.find(f => /explicit admission/i.test(f.evidence));
t.ok(admissionLead && !/: "egard\b/.test(admissionLead.evidence),
  'CT01 admission quotation never begins inside a word');

// ---- CT03: impossible OCR years cannot establish a date convention ----
t.ok(D.D03_DETECT_DATE_INCONSISTENCY([
  'Filed on 26/10/2026 at the registry.',
  'Corrupted metadata reads 02/28/0001 and is not a documentary date.'
]).every(f => !/mixes date formats/i.test(f.evidence)),
  'an impossible year does not establish mixed day/month and month/day conventions');
t.ok(D.D03_DETECT_DATE_INCONSISTENCY([
  'Filed on 26/10/2026 at the registry.',
  'A separate entry reads 12/30/2020 in the same document.'
]).some(f => /mixes date formats/i.test(f.evidence)),
  'two plausible but incompatible date conventions remain detectable');

// ---- CT06: legal positions are not ownable physical assets ----
t.ok(D.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT([
  'The Learned Judge assesses the merits of my claim to an unreasonable practice.',
  'Crompton Motors claim is advanced on a different legal basis.'
]).length === 0, 'a legal claim is not personal property');
t.ok(D.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT([
  'It is my submission that the franchisee contributed substantially.',
  'Crompton Motors submission adopts the opposite position.'
]).length === 0, 'a submission is not an ownable asset');
t.ok(D.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT([
  'This is my camera, valued at R7,000.',
  'The Greensky Ornamentals camera appears on the company invoice.'
]).length === 1, 'a genuine personal/entity ownership conflict remains detectable');

// ---- CT51: an occupation period is not a monetary charge ----
t.ok(D.D02D_DETECT_BILLING_AFTER_CLAIMED_END([
  'The Franchise Agreement between Complainant and Respondent terminated on 31 July 2016.',
  'In order to secure occupation until the end of the existing Franchise Agreement (31st December 2017) the Applicant was obliged to sign a Cession and Assignment Agreement.'
]).length === 0, 'secure occupation until a date is not an invoice or later charge');
t.ok(D.D02D_DETECT_BILLING_AFTER_CLAIMED_END([
  'The lease agreement for the Port Edward service station terminated on 31 July 2026.',
  'Invoice INV98185: Rental October 2026 — Port Edward service station: R88,000.00.'
]).length === 1, 'a genuine invoice for a post-termination rental period remains detectable');

// ---- CT57: nouns and unrelated numbered clauses are not factive denials ----
t.ok(D.D10B_DETECT_FACTIVE_COMMITMENT_DENIAL([
  'Certificate issued by the Commissioner of Companies and Intellectual Property Commission.',
  'This memorandum of incorporation does not limit or restrict the authority of the Board.'
]).length === 0, 'a certificate heading is not a factive verb commitment');
t.ok(D.D10B_DETECT_FACTIVE_COMMITMENT_DENIAL([
  '1.20 By its signature the FRANCHISEE confirms that it is familiar with and understands the contents of the manual and that it is bound thereby.',
  '1.38 Intellectual Property includes, but is not limited to, copyright and trade marks; 1.39 By its signature the FRANCHISOR acknowledges that it is familiar with and understands the contents thereof and that it is bound thereto.'
]).length === 0, 'an unrelated not-limited clause cannot negate a later acknowledgement');
t.ok(D.D10B_DETECT_FACTIVE_COMMITMENT_DENIAL([
  'The respondent confirms that it received the signed agreement and retained the original deposit.',
  'The respondent denies that it received the signed agreement and retained the original deposit.'
]).length === 1, 'a direct denial of the same committed proposition remains detectable');

// ---- CT60: refusing a new contract is not denying an existing burden ----
t.ok(D.D62_DETECT_BENEFIT_BURDEN_ASYMMETRY([
  'Crompton Motors occupies the premises against the will of the owner.',
  'The alleged unfair conduct is its refusal to extend the existing franchise and lease agreements, or to conclude new ones.'
]).length === 0, 'refusal to renew or conclude agreements is not approbation and reprobation');
t.ok(D.D62_DETECT_BENEFIT_BURDEN_ASYMMETRY([
  'The issues may be raised by agreement between the parties before the High Court.',
  'Business Zone never held that a refusal to enter into a contract constitutes an unfair contractual practice.'
]).length === 0, 'legal argument about contracting is not a benefit/burden asymmetry');
t.ok(D.D62_DETECT_BENEFIT_BURDEN_ASYMMETRY([
  'For the purposes of this Contract, the CALTEX eFuel electronic payment method means the method whereby the FRANCHISEE will accept payment for eFuel sales.',
  'I deny that the parties concluded what the Applicant refers to as a firm agreement.'
]).length === 0, 'a payment-method definition and denial that an agreement was concluded are not benefit and burden');
t.ok(D.D62_DETECT_BENEFIT_BURDEN_ASYMMETRY([
  'The respondent has occupied the premises under the lease since March 2023.',
  'The respondent denies any obligation to pay rental under the lease.'
]).length === 1, 'occupation while denying existing rental liability remains detectable');
t.ok(D.D62_DETECT_BENEFIT_BURDEN_ASYMMETRY([
  'The respondent has occupied the premises under the lease since March 2023.',
  'The respondent repudiates the lease.'
]).length === 1, 'occupation while repudiating the existing lease remains detectable');
t.ok(D.D62_DETECT_BENEFIT_BURDEN_ASYMMETRY([
  'The respondent has occupied the premises under the lease since March 2023.',
  'The respondent never repudiated the lease.'
]).length === 0, 'a negated repudiation is not a denied burden');

// ---- CT14: future consequences are not current entity status ----
t.ok(D.D09_DETECT_ENTITY_STATUS_FAKE([
  'The applicants remain on the premises and deny the registered owners rights to obtain an eviction.',
  'Failure to file the annual returns will result in the company being deregistered.'
]).length === 0, 'registered ownership and a future deregistration warning are compatible');
t.ok(D.D09_DETECT_ENTITY_STATUS_FAKE([
  'The company is registered and conducts business from the premises.',
  'The company was deregistered in 2024 and remains deregistered.'
]).length === 1, 'incompatible present entity-status assertions remain detectable');

// ---- CT20: registry spacing and spaced identity numbers must be read whole ----
t.ok(D.D11_DETECT_REGISTRATION_FAKE([
  'Registration Number: Enterprise Name: SANARTH FUELS 2016 / 392549 / 07'
]).length === 0, 'spaces around CIPC registration slashes do not make a valid number malformed');
t.ok(D.D11_DETECT_REGISTRATION_FAKE([
  'Registration Number: SANARTH FUELS 2016/392549/07 / 2024/05'
]).length === 0, 'a valid CIPC number is not merged with an adjacent slash-separated reference');
const identityReg = D.D11_DETECT_REGISTRATION_FAKE([
  'Registration No. 510209 5091 08 4'
]);
t.ok(identityReg.every(f => !/not a valid SA registration format/i.test(f.evidence)) &&
  identityReg.every(f => !/Registration No\. 510209"/.test(f.evidence)),
  'a spaced identity number is not truncated to its first six digits');
t.ok(identityReg.length === 1 && identityReg[0].severity === 0 && identityReg[0].contextOnly === true,
  'a person’s identity number under a registration label is a verification note, not a fake-registration contradiction');

// ---- CT44: alternative ownership/lease wording records no acquisition ----
t.ok(D.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED([
  'The FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement; the agreement is deemed to have terminated.',
  'Notwithstanding any agreement to the contrary, where the FRANCHISOR owns the Premises or itself holds the Premises by lease, any lease or sublease granted to the FRANCHISEE applies accordingly.'
]).every(f => f.contextOnly === true), 'owns-or-holds-by-lease alternatives are not proof that the party became owner');
t.ok(D.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED([
  'The FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement; the agreement is deemed to have terminated.',
  'The FRANCHISEE shall similarly notify the address of the owner of such premises.'
]).every(f => f.contextOnly === true), 'an address-of-owner notice clause is not an ownership-acquisition record');
t.ok(D.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED([
  'The FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement; the agreement is deemed to have terminated.',
  'For contact purposes, the respondent purchased the property in 2024.'
]).some(f => f.contextOnly !== true), 'a contact reference cannot suppress a genuine property acquisition');
t.ok(D.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED([
  'The FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement; the agreement is deemed to have terminated.',
  'At the property, where the respondent is the owner of the site, transfer was recorded in 2024.'
]).some(f => f.contextOnly !== true), 'a factual where-relative ownership clause remains detectable');
t.ok(D.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED([
  'The FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement; the agreement is deemed to have terminated.',
  'At the property, where the respondent is the owner of the site or occupier, transfer was recorded in 2024.'
]).some(f => f.contextOnly !== true), 'an incidental owner-or-occupier phrase does not hide factual ownership');

// ---- Prior analyses: a Verum Omnis analysis is not primary evidence ----
const priorAnalysisBlocks = [
  'V E R U M O M N I S — FORENSIC ANALYSIS — What the Court Was Not Shown',
  '1. Documents Analysed. D1 is the submission, D2 is the affidavit and D3 is the agreement.',
  'Primary evidence that remains in the record.'
];
const priorAnalysisExclusion = E.voExcludeSecondaryReportPages(priorAnalysisBlocks);
t.ok(priorAnalysisExclusion && priorAnalysisExclusion.pages.length === 2 &&
  priorAnalysisExclusion.pages[0] === 1 && priorAnalysisExclusion.pages[1] === 2 && /Primary evidence/.test(priorAnalysisBlocks[2]),
  'a FORENSIC ANALYSIS masthead and its analytical continuation are excluded, not primary evidence');
const repeatedExhibitBlocks = [
  'V E R U M O M N I S — FORENSIC ANALYSIS — What the Court Was Not Shown',
  'Primary evidence: Exhibit D1, Exhibit D1 and again Exhibit D1 are reproduced below.'
];
t.ok(E.voExcludeSecondaryReportPages(repeatedExhibitBlocks).pages.length === 1 && /Primary evidence/.test(repeatedExhibitBlocks[1]),
  'repeated exhibit D1 labels do not turn a primary-evidence page into analysis');
const distinctExhibitBlocks = [
  'V E R U M O M N I S — FORENSIC ANALYSIS — What the Court Was Not Shown',
  'Primary evidence: Exhibits D1, D2 and D3 are reproduced below without analytical attribution.'
];
t.ok(E.voExcludeSecondaryReportPages(distinctExhibitBlocks).pages.length === 1 && /Primary evidence/.test(distinctExhibitBlocks[1]),
  'distinct exhibit labels without analytical attribution do not hide primary evidence');

// ---- CT47: legal redress, statutes and consent clauses are not coercion ----
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  "The Complainant has no option but to seek redress through the NCC."
]).length === 0, 'seeking statutory redress is not coercive conduct');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'Regard must also be had to Section 40 of the CPA, which deals with unconscionable conduct:- 59.1 A supplier or an agent of the supplier must not use, inter alia, coercion, undue influence, pressure, unfair tactics or similar conduct.'
]).length === 0, 'quoting a statutory prohibition is not opposing-party coercion');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'Should the consent or signature of the FRANCHISEE be required by any competent authority, the FRANCHISEE will be obliged to furnish such consent or signature.'
]).length === 0, 'a contractual consent obligation is not a coercive threat');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'The FRANCHISEE will be obliged to maintain the equipment in good working order.'
]).length === 0, 'an ordinary contractual obligation is not an ultimatum');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'Liam’s narrative states that Marius said take it or leave it.'
]).length === 0, 'second-hand attribution is not independent opposing-party coercion');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'Considering that the Complainant had no option but to step aside after 28 years of building up a successful business, it is submitted that the maneuvering and conduct both Respondents have resorted to is unconscionable.'
]).length === 0, 'a complainant’s submitted case theory is not independent coercive conduct');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'This is my final offer: take it or leave it.'
]).length === 1, 'a direct take-it-or-leave-it ultimatum remains detectable');

t.done('batch7c-court-corrections');
