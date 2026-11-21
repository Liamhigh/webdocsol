'use strict';

/* NB-2–NB-6, NB-8 and NB-10 default-off development orchestration. */
const {
  C, R, VERSION, SHA512_RE, plain, own, text, hash, id, clone, freeze,
  completeCoverage, result, safeValidate
} = require('./util.js');
const Sources = require('../../nine-brain-source-register.js');
const Preview = require('../../nine-brain-preview.js');
const Research = require('./research.js');

const SCHEMA = 'vo.nine-brain-development-run.v1';
const VIEW_SCHEMA = 'vo.nine-brain-input-view.v1';
const RELEASE_FLAGS = freeze({
  development_orchestration: false,
  production_promotion: false,
  live_independent_review: false,
  production_report_annex: false,
  production_seal_semantics_changed: false,
  authoritative_legal_conclusions: false
});
const PENDING_RULES = Object.freeze(['P2', 'P3', 'P4', 'P5', 'P7']);

function findingEvidenceIds(finding) {
  const ids = finding.development_source_evidence_ids || finding.source_evidence_ids || [];
  return Array.isArray(ids) ? ids.filter(text) : [];
}

function candidateFromFinding(finding, index, brainId, atomsById) {
  const evidenceIds = findingEvidenceIds(finding).filter((evidenceId) => own(atomsById, evidenceId));
  const anchors = evidenceIds.map((evidenceId) => ({ evidence_id: evidenceId, ...clone(atomsById[evidenceId].anchor) }));
  const sourceFindingHash = hash(finding);
  const payload = { source_index: index, source_finding_sha512: sourceFindingHash, brain_id: brainId };
  return freeze({
    schema: 'vo.nine-brain-candidate.v1',
    candidate_id: id(SCHEMA, 'EXISTING_FINDING_CANDIDATE', payload),
    brain_id: brainId,
    candidate_class: brainId === 'B8' ? 'MEDIA_OBSERVATION_REVIEW_ONLY' : 'EXISTING_DETERMINISTIC_FINDING_REVIEW_ALIAS',
    proposition: text(finding.development_bounded_proposition)
      ? finding.development_bounded_proposition
      : 'The existing deterministic finding requires explicit semantic review before any development promotion.',
    source_finding: clone(finding), source_finding_sha512: sourceFindingHash,
    source_claim_ids: [], source_evidence_ids: evidenceIds, source_anchors: anchors,
    actors: Array.isArray(finding.actors) ? finding.actors.filter(text) : [],
    production_finding: false, semantic_review_status: 'NOT_EVALUATED'
  });
}

function supportFromFinding(finding, index, atomsById) {
  const evidenceIds = findingEvidenceIds(finding).filter((evidenceId) => own(atomsById, evidenceId));
  return freeze({
    schema: 'vo.nine-brain-support.v1',
    support_id: id(SCHEMA, 'B4_SUPPORT', { source_index: index, finding_sha512: hash(finding) }),
    brain_id: 'B4', source_finding_sha512: hash(finding), source_evidence_ids: evidenceIds,
    support_only: true, independent_corroboration: false, production_finding: false
  });
}

function makeView(brain, bundle, findings, passNumber) {
  const ownFindings = brain.id === 'B9' ? [] : findings.filter((finding) => Preview.mapFindingToBrain(finding).brain_id === brain.id);
  const payload = {
    schema: VIEW_SCHEMA, brain_id: brain.id, pass_number: passNumber,
    evidence_bundle_sha512: hash(bundle),
    evidence_atoms: clone(bundle.evidence_atoms), claims: clone(bundle.claims),
    existing_findings: clone(ownFindings),
    role: brain.id === 'B4' ? 'SUPPORT_ONLY' : brain.id === 'B8' ? 'MEDIA_OBSERVATIONS_ONLY' : brain.id === 'B9' ? 'RESEARCH_ADVISORY_ONLY' : 'BOUNDED_CANDIDATE_REVIEW',
    production_finding_authority: false
  };
  return freeze({ ...payload, view_sha512: hash(payload), own_findings_count: ownFindings.length });
}

function makeRun(brain, view, passNumber, registers, reviewsComplete) {
  const units = view.evidence_atoms.map((atom) => atom.evidence_id)
    .concat(view.claims.map((claim) => claim.claim_id))
    .concat(view.existing_findings.map((finding, index) => 'finding:' + index + ':' + hash(finding)));
  const hasMedia = view.evidence_atoms.some((atom) => atom.anchor && atom.anchor.coordinate_space === 'media-time-v1');
  const engaged = brain.id === 'B8' ? hasMedia || view.existing_findings.length > 0 : units.length > 0;
  const candidateIds = brain.id === 'B4' || brain.id === 'B9' ? [] : registers.candidates.filter((item) => item.brain_id === brain.id).map((item) => item.candidate_id);
  const supportIds = brain.id === 'B4' ? registers.supports.map((item) => item.support_id) : [];
  const recommendationIds = brain.id === 'B9' ? registers.recommendations.map((item) => item.recommendation_id) : [];
  const oppositionIds = brain.id === 'B1' ? registers.oppositions.map((item) => item.opposition_id) : [];
  const exclusionIds = brain.id === 'B1' ? registers.exclusions.map((item) => item.exclusion_id) : [];
  const findingIds = passNumber === 2 ? registers.promotions.filter((item) => item.decision === 'PROMOTED' && item.brain_id === brain.id).map((item) => item.candidate_id) : [];
  const uncertainties = [];
  if (brain.id === 'B4') uncertainties.push('B4 support is never independent corroboration.');
  if (brain.id === 'B8' && !engaged) uncertainties.push('No contracted rich-media input or existing B8 observation was supplied.');
  if (brain.id === 'B9') uncertainties.push('B9 is research/advisory only and cannot vote or issue findings.');
  if (passNumber === 2 && !reviewsComplete) uncertainties.push('Semantic promotion review is incomplete; no automatic promotion occurred.');
  const output = {
    brain_id: brain.id, execution_mode: 'ANALYSIS',
    engagement_status: engaged ? 'ENGAGED' : 'NOT_ENGAGED',
    coverage: engaged ? completeCoverage(units) : { units_total: units.length, units_processed: 0, units_skipped: units, units_failed: [] },
    candidate_ids: candidateIds, support_ids: supportIds, opposition_ids: oppositionIds,
    exclusion_ids: exclusionIds, recommendation_ids: recommendationIds, finding_ids: findingIds,
    rule_hits: passNumber === 2 ? registers.promotions.filter((item) => item.brain_id === brain.id).map((item) => ({ candidate_id: item.candidate_id, decision: item.decision, failed_rules: item.failed_rules })) : [],
    uncertainties
  };
  return R.createBrainRunRecord({
    schema: R.SCHEMAS.BRAIN_RUN_RECORD,
    run_id: id(SCHEMA, 'PASS_' + passNumber + ':' + brain.id, { view_sha512: view.view_sha512, output }),
    brain_id: brain.id, brain_version: VERSION, voting: brain.id !== 'B9', execution_mode: 'ANALYSIS',
    engagement_status: output.engagement_status,
    engagement_reason: engaged ? 'Canonical input view processed with complete unit accounting.' : 'No contracted input for this brain; non-engagement is not agreement.',
    input_view_hashes: [view.view_sha512], ...output,
    output_sha512: R.hashBrainRunOutput(output), pass_number: passNumber,
    production_finding: false
  });
}

function promotionFor(candidate, review, bundle, sourceTexts, constitution) {
  const complete = plain(review) && PENDING_RULES.every((key) => plain(review[key]) && review[key].status !== 'NOT_EVALUATED') &&
    plain(review.independence_analysis) && review.independence_analysis.status === 'REVIEWED' && text(review.reviewer);
  if (!complete) {
    const rules = {};
    for (let p = 1; p <= 7; p++) rules['P' + p] = result('NOT_EVALUATED', []);
    return R.createPromotionDecision({
      schema: R.SCHEMAS.PROMOTION_DECISION,
      decision_id: id(SCHEMA, 'PROMOTION_NOT_EVALUATED', { candidate_id: candidate.candidate_id }),
      candidate_id: candidate.candidate_id, ...rules, failed_rules: [], supported_proposition: null,
      independence_analysis: { status: 'NOT_EVALUATED', shared_origins: [] },
      reviewer: 'development-coordinator', rule_version: VERSION,
      decision: 'NOT_EVALUATED', reasons: ['Explicit P2/P3/P4/P5/P7 and independence review was not complete.'],
      brain_id: candidate.brain_id, production_promotion: false
    });
  }
  const rules = {};
  let p1Pass = candidate.source_evidence_ids.length > 0 && candidate.source_anchors.length > 0;
  const p1Reasons = [];
  for (const anchor of candidate.source_anchors) {
    const validation = R.validateAnyAnchor(anchor, own(sourceTexts, anchor.evidence_id) ? sourceTexts[anchor.evidence_id] : undefined);
    if (!validation.valid) { p1Pass = false; p1Reasons.push(validation.errors.join('; ')); }
  }
  if (!candidate.source_evidence_ids.length) p1Reasons.push('No evidence-linked anchor was supplied.');
  rules.P1 = result(p1Pass ? 'PASS' : 'FAIL', p1Pass ? ['Every candidate anchor resolves against contracted source evidence.'] : p1Reasons);
  for (const key of PENDING_RULES) rules[key] = result(review[key].status, review[key].reasons);
  const provenancePass = bundle.evidence_atoms.filter((atom) => candidate.source_evidence_ids.indexOf(atom.evidence_id) !== -1)
    .every((atom) => atom.artifact_sha512 === atom.anchor.artifact_sha512 && atom.extraction && atom.handling_provenance);
  rules.P6 = result(provenancePass ? 'PASS' : 'FAIL', [provenancePass ? 'Evidence identity, extraction and handling lineage reconcile.' : 'Evidence provenance or integrity lineage is incomplete.']);
  const failedRules = [];
  for (let p = 1; p <= 7; p++) if (['FAIL', 'INSUFFICIENT'].indexOf(rules['P' + p].status) !== -1) failedRules.push('P' + p);
  const promoted = failedRules.length === 0 && Object.values(rules).every((rule) => rule.status === 'PASS');
  return R.createPromotionDecision({
    schema: R.SCHEMAS.PROMOTION_DECISION,
    decision_id: id(SCHEMA, 'PROMOTION', { candidate_id: candidate.candidate_id, review, constitution_sha512: C.sha512Hex(constitution.text) }),
    candidate_id: candidate.candidate_id, ...rules, failed_rules: failedRules,
    supported_proposition: promoted ? candidate.proposition : null,
    independence_analysis: clone(review.independence_analysis), reviewer: review.reviewer,
    rule_version: text(review.rule_version) ? review.rule_version : VERSION,
    decision: promoted ? 'PROMOTED' : 'REJECTED',
    reasons: promoted ? ['All seven bounded promotion gates passed; production promotion remains disabled.'] : ['One or more promotion gates failed or were insufficient.'],
    brain_id: candidate.brain_id, production_promotion: false
  });
}

function auditFor(candidate, sourceTexts) {
  return R.createFindingAudit({
    schema: R.SCHEMAS.FINDING_AUDIT,
    audit_id: id(SCHEMA, 'AUDIT', { candidate_id: candidate.candidate_id, candidate_sha512: hash(candidate) }),
    original_finding_id: candidate.candidate_id, brain_id: candidate.brain_id,
    type_id: candidate.candidate_class, actors: candidate.actors,
    source_evidence_ids: candidate.source_evidence_ids, source_anchors: candidate.source_anchors,
    supporting_excerpts: candidate.source_anchors.map((anchor) => ({ evidence_id: anchor.evidence_id, quote: anchor.quote === undefined ? null : anchor.quote })),
    rule_hits: [{ rule_id: candidate.candidate_class, status: 'DEVELOPMENT_REVIEW' }],
    contradiction_checks: ['Candidate opposition and exclusion registers retained in the development run.'],
    corroboration_checks: ['Independence remains as recorded in the promotion decision; B4 support is not independent.'],
    exclusion_checks: ['No evidence was removed by promotion or rejection.'], uncertainties: [],
    promotion_reasons: ['P1–P7 passed in the supplied bounded development review.'], demotion_reasons: []
  }, sourceTexts);
}

function buildDevelopmentRun(spec) {
  if (!plain(spec) || !plain(spec.bundle) || !plain(spec.sourceTexts) || !Array.isArray(spec.findings) ||
      !plain(spec.constitution) || !text(spec.constitution.text) || !text(spec.constitution.version) ||
      !text(spec.rulePackVersion) || !text(spec.engineVersion)) {
    throw new TypeError('Development run requires bundle, sourceTexts, findings, exact Constitution text/version, rule-pack version and engine version');
  }
  const bundleValidation = R.validateEvidenceBundle(spec.bundle, spec.sourceTexts);
  if (!bundleValidation.valid) throw new TypeError(bundleValidation.errors.join('; '));
  const graph = Research.buildEvidenceGraph(spec.bundle, spec.sourceTexts);
  const atomsById = Object.create(null);
  for (const atom of spec.bundle.evidence_atoms) atomsById[atom.evidence_id] = atom;
  const candidates = graph.candidates.slice();
  const supports = [];
  spec.findings.forEach((finding, index) => {
    if (!plain(finding)) throw new TypeError('Existing finding must be a plain record');
    const mapping = finding.development_brain_id === 'B8' ? { brain_id: 'B8', basis: 'EXPLICIT_DEVELOPMENT_MEDIA_REGISTER' } : Preview.mapFindingToBrain(finding);
    if (mapping.brain_id === 'B4') supports.push(supportFromFinding(finding, index, atomsById));
    else candidates.push(candidateFromFinding(finding, index, mapping.brain_id, atomsById));
  });
  candidates.sort((a, b) => C.compareStrings(a.candidate_id, b.candidate_id));
  const candidateIds = new Set(candidates.map((candidate) => candidate.candidate_id));
  if (candidateIds.size !== candidates.length) throw new Error('Candidate identity collision');
  const oppositions = graph.candidates.map((candidate) => ({
    opposition_id: id(SCHEMA, 'OPPOSITION', candidate), candidate_id: candidate.candidate_id,
    source_claim_ids: candidate.source_claim_ids, search_status: 'STRUCTURED_ALIGNMENT_ONLY', production_finding: false
  }));
  const exclusions = graph.alignments.filter((alignment) => alignment.status.indexOf('UNRESOLVED') === 0 || alignment.status.indexOf('EXCLUDED') === 0)
    .map((alignment) => ({ exclusion_id: id(SCHEMA, 'EXCLUSION', alignment), alignment, evidence_retained: true }));
  const recommendations = [{
    recommendation_id: id(SCHEMA, 'B9_RESEARCH_RECOMMENDATION', { bundle_sha512: hash(spec.bundle) }),
    brain_id: 'B9', recommendation: 'Review structured candidates, unresolved qualifiers, coverage gaps and supplied research slices.',
    voting: false, finding: false, authoritative: false
  }];
  const reviews = plain(spec.promotionReviews) ? spec.promotionReviews : Object.create(null);
  const promotions = candidates.map((candidate) => promotionFor(candidate, reviews[candidate.candidate_id], spec.bundle, spec.sourceTexts, spec.constitution));
  const reviewsComplete = promotions.every((promotion) => promotion.decision !== 'NOT_EVALUATED');
  const promoted = promotions.filter((promotion) => promotion.decision === 'PROMOTED');
  const audits = promoted.map((promotion) => {
    const candidate = candidates.find((item) => item.candidate_id === promotion.candidate_id);
    return auditFor(candidate, spec.sourceTexts);
  });
  const constitutionSha512 = C.sha512Hex(spec.constitution.text);
  const guardianItems = promoted.map((promotion) => {
    const candidate = candidates.find((item) => item.candidate_id === promotion.candidate_id);
    const unsafe = /\b(?:proves?|guarantees?|admissible|court[- ]approved|judicially (?:validated|endorsed)|conclusive truth)\b/i.test(candidate.proposition);
    return {
      finding_id: candidate.candidate_id, decision: unsafe ? 'DENIED' : 'APPROVED',
      reason: unsafe ? 'Guardian rejected overclaiming language.' : 'Bounded candidate, source checks and P1–P7 lineage reconcile for technical development certification only.'
    };
  });
  const guardian = R.createGuardianDecision({
    schema: R.SCHEMAS.GUARDIAN_DECISION,
    guardian_id: id(SCHEMA, 'GUARDIAN', { constitution_sha512: constitutionSha512, items: guardianItems }),
    constitution_sha512: constitutionSha512, constitution_version: spec.constitution.version,
    rule_pack_version: spec.rulePackVersion, reviewed_count: guardianItems.length,
    approved_count: guardianItems.filter((item) => item.decision === 'APPROVED').length,
    denied_count: guardianItems.filter((item) => item.decision !== 'APPROVED').length,
    items: guardianItems,
    overclaim_checks: guardianItems.map((item) => ({ finding_id: item.finding_id, result: item.decision })),
    source_checks: audits.map((audit) => ({ finding_id: audit.original_finding_id, result: 'ANCHORS_VALIDATED' })),
    unresolved_limitations: ['NB-0 concordance remains unresolved.', 'Technical certification is not truth, legal validity or human adjudication.'],
    human_adjudication: 'NOT_ADJUDICATED'
  });
  const registers = { candidates, supports, oppositions, exclusions, recommendations, promotions };
  const firstViews = Sources.SOURCE_REGISTER.canonical_brains.map((brain) => makeView(brain, spec.bundle, spec.findings, 1));
  const firstPass = Sources.SOURCE_REGISTER.canonical_brains.map((brain, index) => makeRun(brain, firstViews[index], 1, registers, false));
  const secondViews = Sources.SOURCE_REGISTER.canonical_brains.map((brain) => makeView(brain, spec.bundle, spec.findings, 2));
  const secondPass = Sources.SOURCE_REGISTER.canonical_brains.map((brain, index) => makeRun(brain, secondViews[index], 2, registers, reviewsComplete));
  const certifications = promoted.map((promotion) => {
    const candidate = candidates.find((item) => item.candidate_id === promotion.candidate_id);
    const guardianItem = guardianItems.find((item) => item.finding_id === candidate.candidate_id);
    return R.createFindingCertification({
      schema: R.SCHEMAS.FINDING_CERTIFICATION,
      certification_id: id(SCHEMA, 'CERTIFICATION', { candidate_id: candidate.candidate_id, guardian_id: guardian.guardian_id }),
      finding_id: candidate.candidate_id, constitution_sha512: constitutionSha512,
      run_id: secondPass[Number(candidate.brain_id.slice(1)) - 1].run_id, evidence_bundle_sha512: hash(spec.bundle),
      finding_sha512: hash(candidate), promotion_sha512: hash(promotion),
      rule_pack_version: spec.rulePackVersion, engine_version: spec.engineVersion,
      status: guardianItem.decision === 'APPROVED' ? 'CERTIFIED' : 'NOT_CERTIFIED',
      guardian_decision: guardianItem.decision, guardian_reason: guardianItem.reason,
      reproducibility_statement: 'The development record can be replayed from its canonical input; this certifies technical reproducibility only.',
      certification_scope: 'TECHNICAL_REPRODUCIBILITY_ONLY', human_adjudication: 'NOT_ADJUDICATED',
      production_finding: false
    });
  });
  const output = {
    schema: SCHEMA, version: VERSION, development_only: true, default_off: true,
    release_flags: RELEASE_FLAGS, nb0_status: 'OPEN_AWAITING_GOVERNANCE_DECISION', concordance_status: 'POLICY_UNRESOLVED',
    production_findings_json_version: '1.11.0', production_engine_version: '5.7.2-web',
    engine_version: spec.engineVersion, constitution_version: spec.constitution.version, constitution_sha512: constitutionSha512,
    evidence_bundle: clone(spec.bundle), evidence_bundle_sha512: hash(spec.bundle),
    source_texts_sha512: hash(spec.sourceTexts), source_findings_sha512: hash(spec.findings),
    input_views: { first_pass: firstViews, second_pass: secondViews },
    first_pass: firstPass, second_pass: secondPass,
    candidates, support_register: supports, opposition_register: oppositions, exclusion_register: exclusions,
    recommendation_register: recommendations, promotion_decisions: promotions,
    finding_audits: audits, guardian_decision: guardian, finding_certifications: certifications,
    research: graph,
    concordance: {
      status: 'POLICY_UNRESOLVED', concordant_themes: [], verified_conclusions: [],
      dissent: promotions.filter((item) => item.decision !== 'PROMOTED').map((item) => ({ candidate_id: item.candidate_id, decision: item.decision, failed_rules: item.failed_rules })),
      coverage_gaps: ['No constitutional concordance rule has been selected.', 'Absence of engagement is not agreement.', 'No Triple Verification or human adjudication is asserted.']
    },
    triple_verification_status: 'NOT_EXECUTED', human_adjudication_status: 'NOT_ADJUDICATED',
    coverage: completeCoverage(spec.bundle.evidence_atoms.map((atom) => atom.evidence_id).concat(spec.bundle.claims.map((claim) => claim.claim_id)).concat(spec.findings.map((finding, index) => 'finding:' + index))),
    limitations: [
      'Existing finding mapping is orchestration input, not proof that a canonical brain executed a new detector.',
      'B4 emits support only; B8 emits media observations only; B9 cannot vote or issue findings.',
      'Promotion and certification are development-only and cannot enter production Findings JSON or sealing semantics.',
      'Two-of-three agreement is never verification.'
    ]
  };
  output.run_sha512 = hash(output);
  const validation = validateDevelopmentRun(output);
  if (!validation.valid) throw new TypeError('Invalid development run: ' + validation.errors.join('; '));
  return freeze(output);
}

function validateDevelopmentRun(run) {
  const errors = [];
  if (!plain(run) || run.schema !== SCHEMA) return { valid: false, errors: ['wrong development-run schema'] };
  if (run.development_only !== true || run.default_off !== true || run.nb0_status !== 'OPEN_AWAITING_GOVERNANCE_DECISION' || run.concordance_status !== 'POLICY_UNRESOLVED') errors.push('development and unresolved-NB-0 boundaries must be explicit');
  if (!plain(run.release_flags) || Object.keys(RELEASE_FLAGS).some((key) => run.release_flags[key] !== false)) errors.push('every release flag must remain false');
  if (run.production_findings_json_version !== '1.11.0' || run.production_engine_version !== '5.7.2-web') errors.push('production compatibility identities changed');
  if (!SHA512_RE.test(run.run_sha512 || '') || !SHA512_RE.test(run.constitution_sha512 || '') || !SHA512_RE.test(run.evidence_bundle_sha512 || '')) errors.push('run, Constitution and bundle hashes are required');
  if (run.triple_verification_status !== 'NOT_EXECUTED' || run.human_adjudication_status !== 'NOT_ADJUDICATED') errors.push('development orchestration cannot claim verification or adjudication');
  for (const key of ['first_pass', 'second_pass']) {
    if (!Array.isArray(run[key]) || run[key].length !== 9) errors.push(key + ' requires exactly nine brain runs');
    else run[key].forEach((brainRun, index) => {
      const validation = safeValidate(R.validateBrainRunRecord, brainRun);
      validation.errors.forEach((error) => errors.push(key + ':' + index + ': ' + error));
      if (brainRun.brain_id !== 'B' + (index + 1) || brainRun.pass_number !== (key === 'first_pass' ? 1 : 2) || brainRun.production_finding !== false) errors.push(key + ' canonical identity/boundary mismatch');
    });
  }
  if (!Array.isArray(run.candidates) || !Array.isArray(run.promotion_decisions) || run.candidates.length !== run.promotion_decisions.length) errors.push('candidate and promotion counts must reconcile');
  else run.promotion_decisions.forEach((promotion) => safeValidate(R.validatePromotionDecision, promotion).errors.forEach((error) => errors.push(error)));
  if (!Array.isArray(run.finding_audits) || !Array.isArray(run.finding_certifications)) errors.push('audit and certification registers are required');
  const promoted = (run.promotion_decisions || []).filter((item) => item.decision === 'PROMOTED').length;
  if (run.finding_audits && run.finding_audits.length !== promoted) errors.push('every promoted candidate requires exactly one audit');
  const guardianValidation = safeValidate(R.validateGuardianDecision, run.guardian_decision);
  guardianValidation.errors.forEach((error) => errors.push(error));
  if (run.guardian_decision && run.guardian_decision.reviewed_count !== promoted) errors.push('guardian must review every promoted candidate');
  if (run.finding_certifications && run.finding_certifications.length !== promoted) errors.push('every promoted candidate requires a certification outcome');
  for (const certification of run.finding_certifications || []) {
    safeValidate(R.validateFindingCertification, certification).errors.forEach((error) => errors.push(error));
    const candidate = (run.candidates || []).find((item) => item.candidate_id === certification.finding_id);
    const secondPassRun = candidate && (run.second_pass || []).find((brainRun) => brainRun.brain_id === candidate.brain_id);
    if (!candidate || !secondPassRun || certification.run_id !== secondPassRun.run_id || certification.finding_sha512 !== hash(candidate)) errors.push('certification must bind to the exact candidate and actual second-pass brain run');
  }
  if (!plain(run.concordance) || run.concordance.status !== 'POLICY_UNRESOLVED' ||
      !Array.isArray(run.concordance.concordant_themes) || run.concordance.concordant_themes.length ||
      !Array.isArray(run.concordance.verified_conclusions) || run.concordance.verified_conclusions.length) errors.push('unresolved concordance cannot emit agreement or verified conclusions');
  const digestCopy = clone(run);
  delete digestCopy.run_sha512;
  if (SHA512_RE.test(run.run_sha512 || '') && hash(digestCopy) !== run.run_sha512) errors.push('run digest does not identify the development record');
  return { valid: errors.length === 0, errors };
}

module.exports = { SCHEMA, VIEW_SCHEMA, RELEASE_FLAGS, buildDevelopmentRun, validateDevelopmentRun };
