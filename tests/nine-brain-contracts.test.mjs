import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const C = require('../analysis-contracts.js');
const R = require('../nine-brain-contracts.js');
const Sources = require('../nine-brain-source-register.js');
const Preview = require('../nine-brain-preview.js');
const Report = require('../forensic-report.js');
const Engine = require('../forensic-engine-page.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const fixture = (name) => JSON.parse(readFileSync(path.join(here, 'contracts', name), 'utf8'));
const safeValidation = (fn) => {
  try { return { result: fn() }; } catch (error) { return { error }; }
};

console.log('======================================================');
console.log('RUN  nine-brain-contracts.test.mjs');
console.log('======================================================\n');

const textFixture = fixture('text-anchor-v1.json');
const structuralFixture = fixture('structural-anchor-v1.json');
const sha = 'a'.repeat(128);
const otherSha = 'b'.repeat(128);
const evidenceSpec = {
  schema: R.SCHEMAS.EVIDENCE_ATOM,
  evidence_id: 'evidence-text-1', source_id: 'source-page-4', artifact_sha512: sha,
  media_type: 'text/plain', locator: { page: 4 }, anchor: textFixture.anchor,
  extraction: { route: 'pdf.js', version: '3.11.174' },
  source_status: 'PRIMARY', ocr_status: 'NOT_OCR',
  handling_provenance: [{ operation: 'synthetic-test', actor: 'test-harness' }],
  future_extension: { nested: 'preserved' }
};
const evidence = R.createEvidenceAtom(evidenceSpec, textFixture.page_text);
ok(R.validateEvidenceAtom(evidence, textFixture.page_text).valid, 'text EvidenceAtom validates against complete source text');
ok(evidence.future_extension.nested === 'preserved' && Object.isFrozen(evidence.future_extension), 'unknown extension fields survive canonical construction and are immutable');
ok(textFixture.page_text.slice(evidence.anchor.char_start, evidence.anchor.char_end) === evidence.anchor.quote, 'EvidenceAtom retains exact UTF-16 source slicing');
ok(throws(() => R.createEvidenceAtom({ ...evidenceSpec, artifact_sha512: otherSha }, textFixture.page_text)), 'atom and anchor artifact hash mismatch fails closed');
ok(throws(() => R.createEvidenceAtom(evidenceSpec)), 'text EvidenceAtom requires complete source text for verification');
const changedSource = textFixture.page_text.replace('R100.00', 'R900.00');
ok(!R.validateEvidenceAtom(evidence, changedSource).valid, 'changed source text invalidates the exact quote and context');
const structuralAtom = R.createEvidenceAtom({ ...evidenceSpec, evidence_id: 'evidence-structure-1', media_type: 'application/pdf', locator: { object: '14 0 obj' }, anchor: structuralFixture.anchor, artifact_sha512: structuralFixture.anchor.artifact_sha512 });
ok(structuralAtom.anchor.quote === null, 'structural EvidenceAtom preserves non-text evidence');

const mediaAnchor = {
  coordinate_space: 'media-time-v1', artifact_sha512: sha, document_id: 'synthetic-audio-v1', stream_index: 0,
  time_base: { numerator: 1, denominator: 1000000 }, start_ticks: 1000000, end_ticks: 2500000,
  frame_start: null, frame_end: null, decoder: { name: 'synthetic-decoder', version: '1.0.0' },
  sample_rate: 48000, channels: 1
};
const mediaAtom = R.createEvidenceAtom({ ...evidenceSpec, evidence_id: 'evidence-audio-1', media_type: 'audio/wav', locator: { stream_index: 0 }, anchor: mediaAnchor, extraction: { route: 'local-pcm', version: '1.0.0' }, ocr_status: 'NOT_APPLICABLE' });
ok(R.validateMediaAnchor(mediaAtom.anchor).valid, 'media atom uses an explicit rational time base and decoder identity');
const timeOnlyAnchor = { ...mediaAnchor };
delete timeOnlyAnchor.frame_start;
delete timeOnlyAnchor.frame_end;
ok(R.validateMediaAnchor(timeOnlyAnchor).valid, 'time-only media anchor may omit both optional frame fields');
for (const bad of [
  { ...mediaAnchor, start_ticks: 2, end_ticks: 2 },
  { ...mediaAnchor, time_base: { numerator: 1, denominator: 0 } },
  { ...mediaAnchor, decoder: { name: 'missing-version' } },
  { ...mediaAnchor, frame_start: 4, frame_end: 4 },
  { ...mediaAnchor, frame_start: 4, frame_end: null },
  { ...mediaAnchor, frame_start: null, frame_end: 4 }
]) ok(!R.validateMediaAnchor(bad).valid, 'malformed or empty media range fails closed');
ok(throws(() => R.createEvidenceAtom({ ...evidenceSpec, anchor: { ...textFixture.anchor, quote: 'fabricated' } }, textFixture.page_text)), 'fabricated text evidence cannot enter an atom');

const claimSpec = {
  schema: R.SCHEMAS.CLAIM_RECORD, claim_id: 'claim-1', subject: 'Synthetic agreement', predicate: 'has amount',
  object: { amount: '100.00', currency: 'ZAR' }, actor: 'Synthetic party',
  qualifiers: { event: 'synthetic-payment', time: null, place: null },
  polarity: 'POSITIVE', modality: null, condition: null,
  source_evidence_ids: ['evidence-text-1'], unresolved_fields: ['modality', 'condition'], claim_extension: { retain: true }
};
const claim = R.createClaimRecord(claimSpec);
ok(R.validateClaimRecord(claim).valid && claim.claim_extension.retain, 'ClaimRecord preserves structured value and unknown fields');
ok(claim.source_evidence_ids[0] === evidence.evidence_id && !Object.prototype.hasOwnProperty.call(claim, 'quote'), 'ClaimRecord references evidence atoms instead of replacing verbatim evidence');
for (const bad of [
  { ...claimSpec, source_evidence_ids: [] },
  { ...claimSpec, source_evidence_ids: ['evidence-text-1', 'evidence-text-1'] },
  { ...claimSpec, polarity: 'MAYBE' },
  { ...claimSpec, qualifiers: null }
]) ok(throws(() => R.createClaimRecord(bad)), 'malformed claim semantics fail closed');
for (const evidenceId of ['constructor', 'toString']) {
  ok(R.createClaimRecord({ ...claimSpec, source_evidence_ids: [evidenceId] }).source_evidence_ids[0] === evidenceId,
    'prototype-like evidence ID remains valid: ' + evidenceId);
}
const unresolvedClaim = {
  ...claimSpec, subject: null, predicate: null, actor: null, object: null, modality: null, condition: null,
  unresolved_fields: ['subject', 'predicate', 'actor', 'object', 'modality', 'condition']
};
ok(R.createClaimRecord(unresolvedClaim).unresolved_fields.length === 6, 'an empty normalized claim explicitly accounts for every null semantic field');
ok(throws(() => R.createClaimRecord({ ...unresolvedClaim, unresolved_fields: [] })), 'null claim semantics cannot pass with empty unresolved-field accounting');

function brainRunSpec(brainId = 'B1') {
  const spec = {
    schema: R.SCHEMAS.BRAIN_RUN_RECORD, run_id: 'run-' + brainId, brain_id: brainId, brain_version: '1.0.0-test',
    voting: brainId !== 'B9', execution_mode: 'ANALYSIS', engagement_status: 'NOT_ENGAGED',
    engagement_reason: 'Synthetic no-input fixture', input_view_hashes: [C.sha512Hex('synthetic-view')],
    coverage: { units_total: 1, units_processed: 0, units_skipped: ['no-input'], units_failed: [] },
    candidate_ids: [], support_ids: [], opposition_ids: [], exclusion_ids: [], recommendation_ids: brainId === 'B9' ? ['recommendation-1'] : [],
    finding_ids: [], uncertainties: ['Synthetic unresolved item'], rule_hits: [{ rule_id: 'TEST', status: 'NOT_EVALUATED' }],
    output_sha512: sha, future_run_field: { preserved: true }
  };
  spec.output_sha512 = R.hashBrainRunOutput(spec);
  return spec;
}
function rehashRun(spec) {
  spec.output_sha512 = R.hashBrainRunOutput(spec);
  return spec;
}
for (const id of R.BRAIN_IDS) {
  const run = R.createBrainRunRecord(brainRunSpec(id));
  ok(run.brain_id === id && run.voting === (id !== 'B9') && run.future_run_field.preserved, id + ' has canonical voting and preserved extensions');
}
ok(throws(() => R.createBrainRunRecord(rehashRun({ ...brainRunSpec('B9'), candidate_ids: ['not-allowed'] }))), 'B9 cannot emit candidates');
ok(throws(() => R.createBrainRunRecord(rehashRun({ ...brainRunSpec('B9'), finding_ids: ['not-allowed'] }))), 'B9 cannot emit findings');
ok(throws(() => R.createBrainRunRecord({ ...brainRunSpec('B1'), voting: false })), 'voting brain cannot relabel itself non-voting');
ok(throws(() => R.createBrainRunRecord(rehashRun({ ...brainRunSpec('B1'), execution_mode: 'PREVIEW', engagement_status: 'ENGAGED' }))), 'preview cannot claim engaged brain execution');
ok(throws(() => R.createBrainRunRecord(rehashRun({ ...brainRunSpec('B1'), coverage: { units_total: 2, units_processed: 1, units_skipped: [], units_failed: [] } }))), 'brain run cannot conceal unaccounted units');
const changedRunOutput = { ...brainRunSpec('B1'), uncertainties: ['Changed after hashing'] };
ok(!R.validateBrainRunRecord(changedRunOutput).valid && R.validateBrainRunRecord(rehashRun({ ...changedRunOutput })).valid,
  'BrainRunRecord output hash recomputation detects stale output identity');
const previewWithOutput = rehashRun({
  ...brainRunSpec('B1'), execution_mode: 'PREVIEW', engagement_status: 'NOT_EVALUATED', input_view_hashes: [],
  coverage: { units_total: 0, units_processed: 0, units_skipped: [], units_failed: [] }, candidate_ids: ['fabricated-candidate']
});
ok(throws(() => R.createBrainRunRecord(previewWithOutput)), 'generic PREVIEW BrainRunRecord cannot contain analysis output even with a recomputed hash');
const engagedWithoutInput = rehashRun({
  ...brainRunSpec('B1'), engagement_status: 'ENGAGED', input_view_hashes: [],
  coverage: { units_total: 1, units_processed: 1, units_skipped: [], units_failed: [] }
});
ok(throws(() => R.createBrainRunRecord(engagedWithoutInput)), 'ENGAGED analysis requires input-view provenance');
const engagedWithoutCoverage = rehashRun({ ...brainRunSpec('B1'), engagement_status: 'PARTIAL' });
ok(throws(() => R.createBrainRunRecord(engagedWithoutCoverage)), 'PARTIAL analysis requires non-zero processed coverage');
const engagedWithProvenance = rehashRun({
  ...brainRunSpec('B1'), engagement_status: 'ENGAGED',
  coverage: { units_total: 1, units_processed: 1, units_skipped: [], units_failed: [] }
});
ok(R.createBrainRunRecord(engagedWithProvenance).coverage.units_processed === 1, 'ENGAGED analysis accepts complete input and processing provenance');

function promotionSpec(decision = 'NOT_EVALUATED') {
  const rules = {};
  for (let i = 1; i <= 7; i++) rules['P' + i] = { status: decision === 'PROMOTED' ? 'PASS' : 'NOT_EVALUATED', reasons: decision === 'PROMOTED' ? ['Synthetic pass'] : [] };
  return {
    schema: R.SCHEMAS.PROMOTION_DECISION, decision_id: 'promotion-1', candidate_id: 'candidate-1', ...rules,
    failed_rules: [], supported_proposition: decision === 'PROMOTED' ? 'Synthetic bounded proposition' : null,
    independence_analysis: { status: decision === 'PROMOTED' ? 'REVIEWED' : 'NOT_EVALUATED', shared_origins: [], rationale: decision === 'PROMOTED' ? 'Synthetic independent origins reviewed' : null },
    reviewer: 'synthetic-reviewer', rule_version: '1.0.0-test', decision, reasons: []
  };
}
ok(R.createPromotionDecision(promotionSpec()).decision === 'NOT_EVALUATED', 'default promotion fixture preserves NOT_EVALUATED');
ok(R.createPromotionDecision(promotionSpec('PROMOTED')).decision === 'PROMOTED', 'schema permits promotion only with seven explicit passes');
const incompletePromotion = promotionSpec('PROMOTED');
incompletePromotion.P4 = { status: 'INSUFFICIENT', reasons: ['No independent support'] };
incompletePromotion.failed_rules = ['P4'];
ok(throws(() => R.createPromotionDecision(incompletePromotion)), 'two-of-three or partial P1–P7 cannot promote');
ok(throws(() => R.createPromotionDecision({ ...promotionSpec('PROMOTED'), supported_proposition: null })), 'promotion requires an exact bounded proposition');
const unjustifiedIndependence = promotionSpec('PROMOTED');
unjustifiedIndependence.independence_analysis.rationale = null;
ok(throws(() => R.createPromotionDecision(unjustifiedIndependence)), 'promotion requires an explicit independence rationale');
const rejectedWithFailure = promotionSpec('REJECTED');
rejectedWithFailure.P2 = { status: 'FAIL', reasons: ['Synthetic failed source test'] };
ok(throws(() => R.createPromotionDecision(rejectedWithFailure)), 'failed_rules must reconcile for non-promoted decisions');
rejectedWithFailure.failed_rules = ['P2'];
ok(R.createPromotionDecision(rejectedWithFailure).failed_rules[0] === 'P2', 'explicit failed-rule accounting validates for a rejected decision');
const malformedPromotion = safeValidation(() => R.validatePromotionDecision({ ...promotionSpec('PROMOTED'), P1: { status: 'PASS', reasons: null }, failed_rules: null, independence_analysis: null }));
ok(malformedPromotion.result && !malformedPromotion.result.valid, 'malformed nested promotion fields return invalid instead of throwing');

const auditAnchor = { ...textFixture.anchor, evidence_id: 'evidence-text-1' };
const sourceTexts = { 'evidence-text-1': textFixture.page_text };
const auditSpec = {
  schema: R.SCHEMAS.FINDING_AUDIT, audit_id: 'audit-1', original_finding_id: 'finding-1', brain_id: 'B1', type_id: 'CT01',
  actors: ['Synthetic party'], source_evidence_ids: ['evidence-text-1'], source_anchors: [auditAnchor],
  supporting_excerpts: [{ evidence_id: 'evidence-text-1' }], rule_hits: [{ rule_id: 'TEST' }],
  contradiction_checks: ['Synthetic pair compared'], corroboration_checks: ['No independence inferred'], exclusion_checks: ['Synthetic exclusions recorded'],
  uncertainties: [], promotion_reasons: [], demotion_reasons: []
};
const audit = R.createFindingAudit(auditSpec, sourceTexts);
ok(audit.source_anchors[0].quote === textFixture.anchor.quote, 'FindingAudit retains complete verified source anchors');
ok(throws(() => R.createFindingAudit(auditSpec)), 'text FindingAudit requires complete source text keyed by evidence ID');
ok(throws(() => R.createFindingAudit({ ...auditSpec, source_anchors: [] }, sourceTexts)), 'FindingAudit cannot omit every source anchor');
ok(throws(() => R.createFindingAudit({ ...auditSpec, source_anchors: [{ evidence_id: 'evidence-text-1' }] }, sourceTexts)), 'FindingAudit rejects malformed source anchors');
ok(throws(() => R.createFindingAudit({ ...auditSpec, source_anchors: [{ ...auditAnchor, quote: 'fabricated' }] }, sourceTexts)), 'FindingAudit verifies exact anchor quote and context');
ok(throws(() => R.createFindingAudit({ ...auditSpec, source_anchors: [{ ...auditAnchor, evidence_id: 'other-evidence' }] }, { ...sourceTexts, 'other-evidence': textFixture.page_text })), 'FindingAudit anchors must link to listed evidence IDs');
ok(R.createFindingAudit({ ...auditSpec, source_evidence_ids: ['toString'], source_anchors: [{ ...auditAnchor, evidence_id: 'toString' }] }, { toString: textFixture.page_text }).source_evidence_ids[0] === 'toString',
  'FindingAudit accepts prototype-like evidence IDs without inherited-property collisions');
ok(throws(() => R.createFindingAudit({ ...auditSpec, brain_id: 'B9' }, sourceTexts)), 'B9 cannot own a finding audit');
ok(throws(() => R.createFindingAudit({ ...auditSpec, development_scores: { score: 0.9 } }, sourceTexts)), 'development score without explicit non-production disclosure fails closed');
ok(R.createFindingAudit({ ...auditSpec, development_scores: { score: 0.9, disclosure: 'DEVELOPMENT_ONLY_NOT_PRODUCTION_CONFIDENCE' } }, sourceTexts).development_scores.score === 0.9, 'explicitly bounded development score is not stripped');
const malformedAudit = safeValidation(() => R.validateFindingAudit({ ...auditSpec, development_scores: null }, sourceTexts));
ok(malformedAudit.result && !malformedAudit.result.valid, 'malformed nested audit fields return invalid instead of throwing');

const guardianSpec = {
  schema: R.SCHEMAS.GUARDIAN_DECISION, guardian_id: 'guardian-1', constitution_sha512: sha, constitution_version: 'v8.0-test',
  rule_pack_version: '1.0.0-test', reviewed_count: 2, approved_count: 1, denied_count: 1,
  items: [
    { finding_id: 'finding-1', decision: 'APPROVED', reason: 'Synthetic approval' },
    { finding_id: 'finding-2', decision: 'LIMITED', reason: 'Synthetic limitation' }
  ],
  overclaim_checks: [{ status: 'PASS' }], source_checks: [{ status: 'PASS' }], unresolved_limitations: ['Synthetic limitation'],
  human_adjudication: 'NOT_ADJUDICATED'
};
ok(R.createGuardianDecision(guardianSpec).denied_count === 1, 'guardian LIMITED state is not counted as approval');
ok(throws(() => R.createGuardianDecision({ ...guardianSpec, approved_count: 2, denied_count: 0 })), 'guardian counts must reconcile with item decisions');
ok(throws(() => R.createGuardianDecision({ ...guardianSpec, human_adjudication: 'APPROVED' })), 'software guardian cannot fabricate human adjudication');
ok(throws(() => R.createGuardianDecision({ ...guardianSpec, items: [guardianSpec.items[0], { ...guardianSpec.items[1], finding_id: 'finding-1' }] })), 'guardian cannot count or decide the same finding twice');
const malformedGuardian = safeValidation(() => R.validateGuardianDecision({ ...guardianSpec, items: [null] }));
ok(malformedGuardian.result && !malformedGuardian.result.valid, 'malformed guardian items return invalid instead of throwing');

const certificationSpec = {
  schema: R.SCHEMAS.FINDING_CERTIFICATION, certification_id: 'cert-1', finding_id: 'finding-1',
  constitution_sha512: sha, rule_pack_version: '1.0.0-test', engine_version: '5.7.2-web-test', run_id: 'run-B1',
  evidence_bundle_sha512: otherSha, finding_sha512: C.sha512Hex('finding'), promotion_sha512: C.sha512Hex('promotion'),
  status: 'CERTIFIED', guardian_decision: 'APPROVED', guardian_reason: 'Synthetic approval',
  reproducibility_statement: 'Synthetic replay matched.', certification_scope: 'TECHNICAL_REPRODUCIBILITY_ONLY', human_adjudication: 'NOT_ADJUDICATED'
};
ok(R.createFindingCertification(certificationSpec).status === 'CERTIFIED', 'technical certification schema retains complete lineage');
ok(throws(() => R.createFindingCertification({ ...certificationSpec, guardian_decision: 'LIMITED' })), 'limited guardian decision cannot produce CERTIFIED');
ok(throws(() => R.createFindingCertification({ ...certificationSpec, status: 'NOT_CERTIFIED' })), 'NOT_CERTIFIED cannot silently retain guardian approval');
ok(R.createFindingCertification({ ...certificationSpec, status: 'DEMOTED', guardian_reason: 'Post-approval replay failed' }).status === 'DEMOTED', 'post-approval failure is explicitly DEMOTED');
ok(throws(() => R.createFindingCertification({ ...certificationSpec, certification_scope: 'JUDICIAL_CERTIFICATION' })), 'technical certification cannot claim judicial status');

const bundleSpec = {
  schema: R.SCHEMAS.EVIDENCE_BUNDLE, bundle_id: 'bundle-1',
  evidence_atoms: [evidence], claims: [claim], finding_audits: [audit]
};
const bundle = R.createEvidenceBundle(bundleSpec, sourceTexts);
ok(R.validateEvidenceBundle(bundle, sourceTexts).valid && Object.isFrozen(bundle), 'EvidenceBundle resolves claims and audits against unique verified EvidenceAtoms');
ok(throws(() => R.createEvidenceBundle({ ...bundleSpec, claims: [{ ...claim, source_evidence_ids: ['missing-evidence'] }] }, sourceTexts)), 'bundle rejects dangling claim evidence references');
const danglingAudit = R.createFindingAudit({ ...auditSpec, source_evidence_ids: ['evidence-text-1', 'missing-evidence'] }, sourceTexts);
ok(throws(() => R.createEvidenceBundle({ ...bundleSpec, finding_audits: [danglingAudit] }, sourceTexts)), 'bundle rejects dangling finding-audit evidence references');
ok(throws(() => R.createEvidenceBundle({ ...bundleSpec, evidence_atoms: [evidence, evidence] }, sourceTexts)), 'bundle requires unique EvidenceAtom IDs');

const sourceRegister = Sources.SOURCE_REGISTER;
ok(Sources.validateSourceRegister(sourceRegister).valid && sourceRegister.canonical_brains.length === 9, 'NB-0 source register preserves exactly B1–B9');
ok(sourceRegister.nb0_status === 'OPEN_AWAITING_GOVERNANCE_DECISION' && sourceRegister.concordance_status === 'POLICY_UNRESOLVED', 'NB-0 does not silently choose two- or three-brain concordance');
ok(sourceRegister.concordance_decision.authoritative_rule === null && sourceRegister.concordance_decision.agreement_unit === null && sourceRegister.concordance_decision.independence_test === null, 'agreement unit and independence remain explicit governance decisions');
ok(sourceRegister.production_promotion_enabled === false && Object.isFrozen(sourceRegister.sources), 'source register cannot enable production promotion and is immutable');
ok(sourceRegister.sources.find((s) => s.source_id === 'constitution-v5.2.7-excerpt-64-page').independence === 'NOT_INDEPENDENT_OF_COMPLETE_V5_2_7', 'historical excerpt is not counted as independent corroboration');
const renamedBrainRegister = C.canonicalClone(sourceRegister);
renamedBrainRegister.canonical_brains[0].name = 'Changed responsibility';
ok(!Sources.validateSourceRegister(renamedBrainRegister).valid, 'canonical brain names cannot be changed without detection');
const nullBrainRegister = C.canonicalClone(sourceRegister);
nullBrainRegister.canonical_brains[0] = null;
const malformedRegister = safeValidation(() => Sources.validateSourceRegister(nullBrainRegister));
ok(malformedRegister.result && !malformedRegister.result.valid, 'malformed canonical brain entries return invalid instead of throwing');

for (let n = 1; n <= 61; n++) {
  const type = 'CT' + String(n).padStart(2, '0');
  const finding = { type };
  const expected = Report._brainOf(finding);
  ok(Preview.mapFindingToBrain(finding).brain_id === expected, 'preview CT mapping exactly matches existing report mapping for ' + type);
}
ok(Preview.mapFindingToBrain({ type: 'SERIAL' }).brain_id === 'B4', 'SERIAL mapping matches existing report B4 mapping');
ok(Preview.mapFindingToBrain({ type: 'FUTURE_UNKNOWN' }).basis === 'EXISTING_REPORT_DEFAULT_B1_FALLBACK', 'unknown type is an explicit report fallback, not inferred brain execution');
for (const type of ['constructor', 'toString']) {
  ok(Preview.mapFindingToBrain({ type }).brain_id === 'B1', 'prototype-like unknown finding type uses safe B1 fallback: ' + type);
}

const originalFindings = [
  { type: 'CT47', detectorId: 'D41', location: 'Page 1', evidence: 'Synthetic pressure wording', custom_future_field: { keep: true } },
  { type: 'CT02', detectorId: 'D02', location: 'Page 2', evidence: 'Synthetic amounts R100 and R900' },
  { type: 'CT37', detectorId: 'D25', location: 'Page 3', evidence: 'Synthetic lookalike domain' },
  { type: 'CT02', detectorId: 'D02', location: 'Page 2', evidence: 'Synthetic amounts R100 and R900' }
];
const originalCanonical = C.stableStringify(originalFindings);
const previewSpec = { input_sha512: sha, engine_version: '5.7.2-web-test', findings: originalFindings };
const preview = Preview.buildNineBrainPreview(previewSpec);
const replay = Preview.buildNineBrainPreview(previewSpec);
ok(Preview.validatePreview(preview).valid, 'read-only preview validates its complete payload and status invariants');
ok(C.stableStringify(preview) === C.stableStringify(replay), 'identical evidence identity and findings produce byte-identical canonical preview replay');
ok(C.stableStringify(originalFindings) === originalCanonical, 'preview construction does not mutate original findings');
ok(preview.candidates.length === 4 && new Set(preview.candidates.map((c) => c.candidate_id)).size === 4, 'duplicate findings remain distinct and are never silently deleted');
ok(preview.candidates.every((c) => c.promotion_status === 'NOT_EVALUATED' && c.candidate_class === 'EXISTING_DETERMINISTIC_FINDING_READ_ONLY_ALIAS'), 'existing findings are read-only aliases, not promoted brain candidates');
ok(preview.candidates.find((c) => c.source_index === 0).source_finding.custom_future_field.keep, 'preview preserves unknown fields in original findings');
ok(preview.brain_runs.length === 9 && preview.brain_runs.every((run) => run.engagement_status === 'NOT_EVALUATED' && run.candidate_ids.length === 0 && run.finding_ids.length === 0), 'nine provenance envelopes do not fabricate brain execution or output');
ok(preview.brain_runs[8].brain_id === 'B9' && preview.brain_runs[8].voting === false && preview.brain_views[8].source_candidate_ids.length === 0, 'B9 stays non-voting and receives no finding ownership');
ok(preview.brain_views.reduce((sum, view) => sum + view.source_finding_count, 0) === originalFindings.length, 'every existing finding is accounted for exactly once in read-only views');
ok(preview.concordance.engaged_voting_brains.length === 0 && preview.concordance.concordant_themes.length === 0, 'report grouping never becomes engaged-brain or concordant-theme evidence');
ok(preview.concordance_status === 'POLICY_UNRESOLVED' && preview.triple_verification_status === 'NOT_IMPLEMENTED' && preview.human_adjudication_status === 'NOT_ADJUDICATED' && preview.certification_status === 'NOT_CERTIFIED', 'all unresolved governance and verification states remain explicit');
ok(preview.coverage.units_total === 4 && preview.coverage.units_processed === 4 && preview.coverage.units_failed.length === 0, 'preview coverage accounts for every input finding');
ok(preview.warnings.some((warning) => /no canonical brain was executed/.test(warning)), 'preview warning expressly denies brain execution');
ok(throws(() => Preview.buildNineBrainPreview({ ...previewSpec, input_sha512: 'unknown_input_sha512' })), 'unknown evidence identity fails closed');
for (const badHash of ['A'.repeat(128), 'a'.repeat(127), null, 42]) {
  ok(throws(() => Preview.buildNineBrainPreview({ ...previewSpec, input_sha512: badHash })), 'malformed preview input hash fails closed: ' + String(badHash).slice(0, 16));
}
ok(throws(() => Preview.buildNineBrainPreview({ ...previewSpec, findings: [{} , null] })), 'malformed finding fails closed rather than disappearing from coverage');
const tamperedPreview = C.canonicalClone(preview);
tamperedPreview.concordance_status = 'CONCORDANT';
ok(!Preview.validatePreview(tamperedPreview).valid, 'tampered concordance state and hash are rejected');
const tamperedHash = C.canonicalClone(preview);
tamperedHash.warnings = [];
ok(!Preview.validatePreview(tamperedHash).valid, 'preview digest covers warnings and complete payload');
const tamperedCandidate = C.canonicalClone(preview);
tamperedCandidate.candidates[0].source_finding.evidence = 'Tampered synthetic wording';
delete tamperedCandidate.preview_sha512;
tamperedCandidate.preview_sha512 = R.hashRecordPayload(tamperedCandidate);
ok(!Preview.validatePreview(tamperedCandidate).valid, 'recomputing the outer digest cannot conceal candidate/source hash and identity inconsistencies');
const unknownPreviewExtension = C.canonicalClone(preview);
unknownPreviewExtension.future_field = { retained: true };
delete unknownPreviewExtension.preview_sha512;
unknownPreviewExtension.preview_sha512 = R.hashRecordPayload(unknownPreviewExtension);
ok(Preview.validatePreview(unknownPreviewExtension).valid && unknownPreviewExtension.future_field.retained, 'canonical unknown preview fields are preserved and covered by the payload digest');
function rehashPreview(value) {
  delete value.preview_sha512;
  value.preview_sha512 = R.hashRecordPayload(value);
  return value;
}
const invalidIdentityPreview = C.canonicalClone(preview);
invalidIdentityPreview.input_sha512 = 'unknown_input_sha512';
ok(!Preview.validatePreview(rehashPreview(invalidIdentityPreview)).valid, 'recomputing the outer digest cannot legitimize unknown evidence identity');
const executedPreview = C.canonicalClone(preview);
executedPreview.brain_execution_status = 'EXECUTED';
ok(!Preview.validatePreview(rehashPreview(executedPreview)).valid, 'recomputing the outer digest cannot legitimize a brain-execution claim');
const nullRunPreview = C.canonicalClone(preview);
nullRunPreview.brain_runs[0] = null;
ok(!Preview.validatePreview(rehashPreview(nullRunPreview)).valid, 'malformed null brain-run records fail validation without throwing');
const nullViewPreview = C.canonicalClone(preview);
nullViewPreview.brain_views[0] = null;
ok(!Preview.validatePreview(rehashPreview(nullViewPreview)).valid, 'malformed null brain-view records fail validation without throwing');
const recommendationPreview = C.canonicalClone(preview);
recommendationPreview.brain_runs[8].recommendation_ids = ['fabricated-recommendation'];
rehashRun(recommendationPreview.brain_runs[8]);
ok(!Preview.validatePreview(rehashPreview(recommendationPreview)).valid, 'preview cannot introduce a B9 recommendation after construction');
const tamperedRunId = C.canonicalClone(preview);
tamperedRunId.brain_runs[0].run_id = 'tampered-run-identity';
ok(!Preview.validatePreview(rehashPreview(tamperedRunId)).valid, 'recomputing the outer digest cannot legitimize a tampered preview run ID');
const tamperedRunOutputHash = C.canonicalClone(preview);
tamperedRunOutputHash.brain_runs[0].output_sha512 = otherSha;
ok(!Preview.validatePreview(rehashPreview(tamperedRunOutputHash)).valid, 'recomputing the outer digest cannot legitimize a tampered run output hash');
const missingViewIds = C.canonicalClone(preview);
delete missingViewIds.brain_views[0].source_candidate_ids;
const malformedView = safeValidation(() => Preview.validatePreview(rehashPreview(missingViewIds)));
ok(malformedView.result && !malformedView.result.valid, 'missing brain-view source IDs return invalid instead of throwing');
const nullPreview = safeValidation(() => Preview.validatePreview(null));
ok(nullPreview.result && !nullPreview.result.valid, 'null preview returns invalid instead of throwing');
const prototypeTypePreview = Preview.buildNineBrainPreview({ ...previewSpec, findings: [{ type: 'constructor', evidence: 'Synthetic unknown type' }] });
ok(prototypeTypePreview.candidates[0].brain_id === 'B1' && prototypeTypePreview.warnings.some((warning) => /default B1 fallback/.test(warning)),
  'prototype-like unknown finding type builds a safe read-only fallback preview');

const engineBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
const engineBytesBefore = Array.from(engineBytes);
const previousExtract = globalThis.extractPdfText;
globalThis.extractPdfText = async () => ['Synthetic agreement. The total is R100.00. The parties performed on 1 January 2026.'];
let engineResult;
try {
  engineResult = await Engine.runForensicEngine(engineBytes, { getPages() { throw new Error('synthetic raw-text fallback'); } }, null, { referenceTime: '2026-11-15T00:00:00.000Z' });
} finally {
  if (typeof previousExtract === 'undefined') delete globalThis.extractPdfText;
  else globalThis.extractPdfText = previousExtract;
}
const engineFindingsBefore = C.stableStringify(engineResult.findings);
const inputSha512 = createHash('sha512').update(engineBytes).digest('hex');
const enginePreview = Preview.buildNineBrainPreview({ input_sha512: inputSha512, engine_version: '5.7.2-web', findings: engineResult.findings });
ok(C.stableStringify(engineResult.findings) === engineFindingsBefore, 'preview over an actual synthetic engine result leaves every production finding byte-identical');
ok(engineBytes.every((byte, i) => byte === engineBytesBefore[i]), 'actual synthetic engine/preview path preserves original PDF bytes');
ok(enginePreview.source_findings_sha512 === C.sha512Hex(C.stableStringify(engineResult.findings)), 'preview binds to the exact canonical existing findings');
ok(enginePreview.preview_id !== preview.preview_id, 'different evidence identity produces a different preview identity');

const replayProgram = `
const C=require(${JSON.stringify(path.join(root, 'analysis-contracts.js'))});
const P=require(${JSON.stringify(path.join(root, 'nine-brain-preview.js'))});
const result=P.buildNineBrainPreview(${JSON.stringify(previewSpec)});
process.stdout.write(C.stableStringify(result));
`;
const replayUtc = spawnSync(process.execPath, ['-e', replayProgram], { encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } });
const replayPacific = spawnSync(process.execPath, ['-e', replayProgram], { encoding: 'utf8', env: { ...process.env, TZ: 'Pacific/Honolulu' } });
ok(replayUtc.status === 0 && replayPacific.status === 0, 'fresh-process preview replay completes: ' + replayUtc.stderr + replayPacific.stderr);
ok(replayUtc.stdout === replayPacific.stdout && replayUtc.stdout === C.stableStringify(preview), 'preview replay is byte-identical across fresh processes and time zones');

for (const file of ['nine-brain-contracts.js', 'nine-brain-source-register.js', 'nine-brain-preview.js']) {
  const source = readFileSync(path.join(root, file), 'utf8');
  ok(!/Date\.now\s*\(|Math\.random\s*\(|localeCompare\s*\(|new\s+Date\s*\(\s*\)/.test(source), file + ' contains no wall clock, randomness, locale collation or empty Date constructor');
  ok(!/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(source), file + ' contains no network or telemetry path');
  ok(!/\(\?<[=!]/.test(source), file + ' contains no regex lookbehind');
}
const sealHtml = readFileSync(path.join(root, 'seal-document.html'), 'utf8');
ok(/findings_json_version:\s*'1\.11\.0'/.test(sealHtml) && !sealHtml.includes('VONineBrainPreview'), 'development preview is not wired into production Findings JSON or sealing');
const config = require('../analysis-config.js');
ok(!config.MODULE_NAMES.includes('nineBrainPreview') && !config.MODULE_NAMES.includes('behavioural'), 'no unapproved production module flag was added');

done('nine-brain-contracts');
