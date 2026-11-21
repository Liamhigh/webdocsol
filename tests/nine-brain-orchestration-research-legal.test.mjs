import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const { C, makeBase, completeReviews, passReview } = (() => ({ C: require('../analysis-contracts.js'), ...require('./nine-brain-fixtures.js') }))();
const O = require('../development/nine-brain/orchestration.js');
const Research = require('../development/nine-brain/research.js');
const Allen = require('../development/nine-brain/allen-algebra.js');
const Legal = require('../development/nine-brain/legal.js');
const here = path.dirname(fileURLToPath(import.meta.url));

console.log('======================================================');
console.log('RUN  nine-brain-orchestration-research-legal.test.mjs');
console.log('======================================================\n');

const base = makeBase();
const originalSourceText = base.sourceTexts['evidence-one'];
const originalBundle = C.stableStringify(base.bundle);
const initial = O.buildDevelopmentRun(base);
ok(initial.first_pass.length === 9 && initial.second_pass.length === 9, 'NB-2/NB-6 produce exactly nine canonical records in each pass');
ok(initial.first_pass.every((run, index) => run.brain_id === 'B' + (index + 1) && run.pass_number === 1), 'First-pass brain order and pass identity are exact');
ok(initial.second_pass.every((run) => run.pass_number === 2), 'Second-pass records retain their distinct pass identity');
ok(initial.promotion_decisions.every((decision) => decision.decision === 'NOT_EVALUATED') && initial.finding_audits.length === 0, 'Absent semantic review cannot be replaced by anchor or hash checks');
ok(initial.support_register.length === 1 && initial.support_register[0].brain_id === 'B4' && initial.support_register[0].independent_corroboration === false, 'B4 emits support only and never calls itself independent corroboration');
ok(initial.first_pass[3].candidate_ids.length === 0 && initial.first_pass[3].support_ids.length === 1, 'B4 run has support but no candidate output');
ok(initial.first_pass[8].recommendation_ids.length === 1 && initial.first_pass[8].candidate_ids.length === 0 && initial.first_pass[8].finding_ids.length === 0, 'B9 emits advisory recommendations without candidates or findings');
ok(initial.candidates.some((candidate) => candidate.brain_id === 'B8' && candidate.source_anchors[0].coordinate_space === 'media-time-v1'), 'NB-8 has a dedicated media candidate register with rational-time evidence anchors');
ok(initial.opposition_register.length === 2 && initial.exclusion_register.length === 1 && initial.exclusion_register[0].evidence_retained, 'Structured candidates retain opposition lineage and unresolved different-object polarity enters the exclusion register without deleting evidence');
ok(initial.concordance.status === 'POLICY_UNRESOLVED' && initial.concordance.verified_conclusions.length === 0, 'NB-0 remains unresolved and cannot emit concordant verified conclusions');
ok(initial.triple_verification_status === 'NOT_EXECUTED' && initial.human_adjudication_status === 'NOT_ADJUDICATED', 'Orchestration does not fabricate Triple Verification or human adjudication');
ok(Object.values(O.RELEASE_FLAGS).every((value) => value === false), 'NB-10 release controls are all default-off');
ok(initial.production_findings_json_version === '1.11.0' && initial.production_engine_version === '5.7.2-web', 'Production compatibility identities remain unchanged');
const replay = O.buildDevelopmentRun(base);
ok(C.stableStringify(initial) === C.stableStringify(replay) && initial.run_sha512 === replay.run_sha512, 'Canonical replay is byte-for-byte deterministic');
ok(C.sha512Hex(C.stableStringify(base.bundle)) === initial.evidence_bundle_sha512 && base.sourceTexts['evidence-one'] === originalSourceText && C.stableStringify(base.bundle) === originalBundle, 'Orchestration does not mutate original evidence records or source text');
ok(initial.input_views.first_pass[7].existing_findings.length === 1 && initial.input_views.first_pass[7].existing_findings[0].development_brain_id === 'B8' && initial.candidates.some((candidate) => candidate.brain_id === 'B8' && candidate.source_finding.development_brain_id === 'B8'), 'Explicit B8 media-register override is consistent in input views and candidate construction');
let malformedThrew = false;
try {
  const malformedResult = O.validateDevelopmentRun({ schema: O.SCHEMA, concordance: {} });
  ok(!malformedResult.valid, 'Malformed development-run input returns an invalid result');
} catch (error) { malformedThrew = true; }
ok(!malformedThrew, 'Malformed public development-run validation fails without throwing');
const cyclicRun = { schema: O.SCHEMA };
cyclicRun.self = cyclicRun;
let cyclicResult;
try { cyclicResult = O.validateDevelopmentRun(cyclicRun); } catch (error) { cyclicResult = { thrown: true }; }
ok(cyclicResult && cyclicResult.valid === false && !cyclicResult.thrown, 'Cyclic development-run input returns invalid instead of throwing during canonicalisation');
ok(O.validateDevelopmentRun(initial).valid, 'Development run validates its complete lineage');
const tamperedRun = C.canonicalClone(initial);
tamperedRun.candidates[0].proposition = 'Tampered proposition';
ok(!O.validateDevelopmentRun(tamperedRun).valid, 'Outer run digest detects post-run candidate tampering');
ok(throws(() => O.buildDevelopmentRun({ ...base, constitution: { ...base.constitution, version: '' } })), 'Exact Constitution version is mandatory');
ok(O.buildDevelopmentRun({ ...base, findings: [{}] }).candidates.some((candidate) => candidate.source_evidence_ids.length === 0 && candidate.production_finding === false), 'Unmapped or unanchored existing input remains only an unpromotable development candidate');

const reviews = completeReviews(initial);
const promoted = O.buildDevelopmentRun({ ...base, promotionReviews: reviews });
ok(promoted.promotion_decisions.every((decision) => decision.decision === 'PROMOTED' && decision.failed_rules.length === 0), 'Complete P1–P7 synthetic reviews permit development-only promotion');
ok(promoted.finding_audits.length === promoted.candidates.length && promoted.finding_certifications.length === promoted.candidates.length, 'Every promoted candidate has audit and certification lineage');
ok(promoted.guardian_decision.reviewed_count === promoted.candidates.length && promoted.guardian_decision.approved_count === promoted.candidates.length, 'Guardian reviews every promoted candidate with exact counts');
ok(promoted.finding_certifications.every((certification) => certification.certification_scope === 'TECHNICAL_REPRODUCIBILITY_ONLY' && certification.human_adjudication === 'NOT_ADJUDICATED' && certification.production_finding === false), 'Technical certification cannot become truth certification or human adjudication');
ok(promoted.finding_certifications.every((certification) => {
  const certifiedCandidate = promoted.candidates.find((item) => item.candidate_id === certification.finding_id);
  const actualRun = promoted.second_pass.find((brainRun) => brainRun.brain_id === certifiedCandidate.brain_id);
  return certification.run_id === actualRun.run_id && certification.finding_sha512 === C.sha512Hex(C.stableStringify(certifiedCandidate));
}), 'Certification binds to the exact candidate and actual second-pass brain run');
ok(promoted.second_pass.some((run) => run.finding_ids.length > 0) && promoted.first_pass.every((run) => run.finding_ids.length === 0), 'Only the post-review pass lists development-certified candidate IDs');
const rejectedReviews = completeReviews(initial);
rejectedReviews[initial.candidates[0].candidate_id] = { ...passReview(), P5: { status: 'FAIL', reasons: ['Invalidating antithesis remains unresolved.'] } };
const rejected = O.buildDevelopmentRun({ ...base, promotionReviews: rejectedReviews });
ok(rejected.promotion_decisions[0].decision === 'REJECTED' && rejected.promotion_decisions[0].failed_rules.join(',') === 'P5', 'P5 antithesis failure reconciles exactly with failed_rules');
ok(!rejected.finding_audits.some((audit) => audit.original_finding_id === initial.candidates[0].candidate_id), 'Rejected candidate cannot acquire a promoted-finding audit');
const noAnchorFindings = [{ type: 'CT23', development_bounded_proposition: 'Bounded but unanchored synthetic observation.' }];
const noAnchorRun = O.buildDevelopmentRun({ ...base, findings: noAnchorFindings });
const noAnchorReviews = completeReviews(noAnchorRun);
const noAnchorResult = O.buildDevelopmentRun({ ...base, findings: noAnchorFindings, promotionReviews: noAnchorReviews });
ok(noAnchorResult.promotion_decisions.some((decision) => decision.decision === 'REJECTED' && decision.failed_rules.indexOf('P1') !== -1), 'Explicit semantic reviews cannot override missing direct evidence anchors');
const overclaimReviews = completeReviews(initial);
const overclaimBase = { ...base, findings: [{ type: 'CT23', development_source_evidence_ids: ['evidence-one'], development_bounded_proposition: 'This proves conclusive truth and is admissible.' }] };
const overclaimPreview = O.buildDevelopmentRun(overclaimBase);
const overclaim = O.buildDevelopmentRun({ ...overclaimBase, promotionReviews: completeReviews(overclaimPreview) });
const overclaimCandidate = overclaim.candidates.find((candidate) => candidate.proposition.includes('conclusive truth'));
ok(overclaim.guardian_decision.denied_count === 1 && overclaim.finding_certifications.find((certification) => certification.finding_id === overclaimCandidate.candidate_id).status === 'NOT_CERTIFIED', 'Guardian denies overclaiming language even after P1–P7 review');
ok(!overclaim.second_pass.find((brainRun) => brainRun.brain_id === overclaimCandidate.brain_id).finding_ids.includes(overclaimCandidate.candidate_id), 'Guardian-denied candidates are excluded from second-pass finding_ids');

for (const left of Allen.RELATIONS) for (const right of Allen.RELATIONS) {
  const composed = Allen.composePair(left, right);
  ok(composed.length > 0 && composed.every((item) => Allen.RELATIONS.includes(item)), `Allen composition ${left}${right} is non-empty and canonical`);
}
ok(Allen.relation({ start: 0, end: 2 }, { start: 2, end: 4 }) === 'm', 'Allen meets relation is exact');
ok(Allen.relation({ start: 0, end: 5 }, { start: 1, end: 4 }) === 'di', 'Allen contains relation is exact');
ok(Allen.composeSets(['<', 'm'], ['<', 'm']).every((item) => Allen.RELATIONS.includes(item)) && Allen.composeSets(Allen.RELATIONS, Allen.RELATIONS).length === 13, 'Set composition uses canonical precomputed relation results');
ok(Allen.CONVERSE[Allen.relation({ start: 0, end: 1 }, { start: 3, end: 4 })] === '>', 'Allen converse is correct');
const temporal = Research.checkTemporalNetwork([
  { from: 0, to: 1, allowed: ['<'] }, { from: 1, to: 2, allowed: ['<'] }, { from: 0, to: 2, allowed: ['<'] }
], 3);
ok(temporal.status === 'PATH_CONSISTENT_NOT_SCHEDULE_PROOF', 'Temporal path consistency does not masquerade as a schedule proof');
const temporalConflict = Research.checkTemporalNetwork([
  { from: 0, to: 1, allowed: ['<'] }, { from: 1, to: 2, allowed: ['<'] }, { from: 0, to: 2, allowed: ['>'] }
], 3);
ok(temporalConflict.status === 'INCONSISTENT', 'Temporal network detects an empty derived relation');
ok(Research.checkTemporalNetwork([{ from: 0, to: 1, allowed: ['<'] }], 3, 1).status === 'BUDGET_EXCEEDED', 'Temporal budget exhaustion fails closed without a consistency claim');
ok(Research.validateTemporalWitness([{ from: 0, to: 1, allowed: ['<'] }], [{ start: 0, end: 1 }, { start: 2, end: 3 }]).valid, 'Concrete temporal witness independently validates');
ok(!Research.validateTemporalWitness([{ from: 0, to: 1, allowed: ['<'] }], [{ start: 3, end: 4 }, { start: 0, end: 1 }]).valid, 'Invalid temporal witness is rejected');

const positive = base.bundle.claims[0];
const negative = base.bundle.claims[1];
const qualifierChanged = { ...negative, qualifiers: { ...negative.qualifiers, event: 'different-event' } };
ok(Research.alignClaims(positive, negative).status === 'CANDIDATE_CONTRADICTION', 'RES-1 detects a bounded polarity candidate');
ok(Research.alignClaims(positive, qualifierChanged).status === 'UNRESOLVED_QUALIFIER_MISMATCH', 'Different event qualifiers cannot be collapsed into a contradiction');
ok(Research.alignClaims(positive, { ...negative, actor: 'Another actor' }).status === 'UNRESOLVED_NOT_SAME_PROPOSITION', 'Different actors do not silently form the same proposition');
ok(Research.alignClaims(positive, { ...negative, object: { amount: '500.00', currency: 'ZAR' } }).status === 'UNRESOLVED_OPPOSITE_POLARITY_DIFFERENT_OBJECTS', 'Opposite polarity with different objects remains unresolved rather than aligned');
const duplicateClaimBundle = C.canonicalClone(base.bundle);
duplicateClaimBundle.claims.push(C.canonicalClone(duplicateClaimBundle.claims[0]));
ok(throws(() => Research.buildEvidenceGraph(duplicateClaimBundle, base.sourceTexts)), 'Duplicate claim IDs are rejected before evidence-graph construction');
const graph = Research.buildEvidenceGraph(base.bundle, base.sourceTexts);
ok(graph.candidates.length === 2 && graph.coverage.units_total === 7 && graph.coverage.units_processed === 7, 'Evidence graph accounts for every atom and claim');
ok(graph.candidates.every((candidate) => candidate.production_finding === false && candidate.semantic_review_status === 'NOT_EVALUATED'), 'Research candidates are not production findings');
const duplicates = Research.contractAtomMap([
  { document_id: 'doc-a', normalized_text: 'Same synthetic clause' }, { document_id: 'doc-b', normalized_text: 'Same synthetic clause' }
], ['doc-a', 'doc-b']);
ok(duplicates.duplicate_groups.length === 1 && duplicates.false_positive_only && !duplicates.contradiction_finding, 'RES-4 retains cross-document duplicate candidates without calling them contradictions');
const metrics = Research.oracleMetrics([
  { candidate_id: 'a', anchors: [{ page: 1 }] }, { candidate_id: 'b', anchors: [{ page: 2 }] }
], [{ candidate_id: 'a', anchors: [{ page: 9 }] }, { candidate_id: 'c', anchors: [{ page: 3 }] }]);
ok(metrics.detection.true_positive === 1 && metrics.detection.false_positive === 1 && metrics.detection.false_negative === 1, 'Detection metrics count expected and actual IDs separately');
ok(metrics.localization.detected === 1 && metrics.localization.exact_anchor_matches === 0, 'Localization failure does not erase detection success');
ok(!Object.prototype.hasOwnProperty.call(metrics.detection, 'true_negative'), 'True negatives are omitted without a defined candidate universe');
const universeMetrics = Research.oracleMetrics([{ candidate_id: 'a', anchors: [] }], [{ candidate_id: 'a', anchors: [] }], ['a', 'b']);
ok(universeMetrics.detection.true_negative === 1, 'True negatives are calculated only from an explicit candidate universe');
ok(throws(() => Research.oracleMetrics([{ candidate_id: 'a', anchors: [] }, { candidate_id: 'a', anchors: [] }], [])), 'Duplicate expected candidate IDs invalidate oracle metrics');
ok(throws(() => Research.oracleMetrics([], [{ candidate_id: 'a', anchors: [] }, { candidate_id: 'a', anchors: [] }])), 'Duplicate actual candidate IDs invalidate oracle metrics');
const disagreement = Research.reviewerRobustness([
  { candidate_id: 'a', reviewer_id: 'one', status: 'PASS' }, { candidate_id: 'a', reviewer_id: 'two', status: 'FAIL' }
]);
ok(disagreement.disagreements.length === 1 && disagreement.agreement_is_not_truth && !disagreement.live_calls_executed, 'RES-6 preserves reviewer disagreement and performs no live calls');
const rejectedRegister = Research.rejectionRegister([{ candidate_id: 'a', reason: 'Context resolves', reviewer: 'human', source_evidence_ids: ['e1'] }]);
ok(rejectedRegister.evidence_deleted === false && rejectedRegister.entries[0].audit_history_retained, 'Rejection never deletes evidence or audit history');
const formal = Research.saturateFormalFacts([
  { fact_id: 'f1', predicate: 'status', subject: 's', object: 'open', group: 'state' },
  { fact_id: 'f2', predicate: 'status', subject: 's', object: 'closed', group: 'state' }
], [], 100);
ok(formal.status === 'FORMAL_CONFLICT_CANDIDATES' && formal.conflicts.length === 1, 'Formal saturation reports explicit value conflicts');
const derived = Research.saturateFormalFacts([{ fact_id: 'f1', predicate: 'premise', subject: 's', object: true }], [
  { rule_id: 'r1', when: { predicate: 'premise', subject: 's', object: true }, then: { predicate: 'result', subject: 's', object: true } }
]);
ok(derived.facts.some((fact) => fact.predicate === 'result') && derived.proofs[C.stableStringify({ predicate: 'result', subject: 's', object: true, group: null })][0].rule_id === 'r1', 'Formal derivation retains a proof trace');
ok(derived.status === 'SATURATED_NO_DERIVED_CONFLICT' && derived.facts.length === 2 && derived.steps === 2, 'Known and pending formal conclusions are deduplicated before enqueueing');
const duplicateFacts = Research.saturateFormalFacts([
  { fact_id: 'f1', predicate: 'premise', subject: 's', object: true },
  { fact_id: 'f1-duplicate', predicate: 'premise', subject: 's', object: true }
], [], 10);
ok(duplicateFacts.facts.length === 1, 'Semantically duplicate asserted formal facts are enqueued only once');
const syntheticLaw = Research.syntheticLegalReasoner([
  { fact_id: 'f1', synthetic: true, predicate: 'premise', subject: 's', object: true }
], [{ rule_id: 'r1', synthetic: true, qualified_review_status: 'SYNTHETIC_FIXTURE_REVIEWED', when: { predicate: 'premise', subject: 's', object: true }, then: { predicate: 'result', subject: 's', object: true } }], { synthetic: true, predicate: 'result', subject: 's', object: true });
ok(syntheticLaw.status === 'SYNTHETIC_PROOF_FOUND' && syntheticLaw.legal_conclusion === false && syntheticLaw.qualified_legal_review_still_required, 'RES-9 remains a synthetic proof exercise, never a legal conclusion');
const syntheticBudget = Research.syntheticLegalReasoner([
  { fact_id: 'f1', synthetic: true, predicate: 'premise', subject: 's', object: true }
], [{ rule_id: 'r1', synthetic: true, qualified_review_status: 'SYNTHETIC_FIXTURE_REVIEWED', when: { predicate: 'premise', subject: 's', object: true }, then: { predicate: 'result', subject: 's', object: true } }], { synthetic: true, predicate: 'result', subject: 's', object: true }, 1);
ok(syntheticBudget.status === 'BUDGET_EXCEEDED' && syntheticBudget.proof === null, 'RES-9 propagates formal budget exhaustion without claiming a proof');
ok(throws(() => Research.syntheticLegalReasoner([{ predicate: 'real', subject: 's', object: true }], [], { synthetic: true })), 'Real or unreviewed facts cannot enter the synthetic legal reasoner');

const legal = Legal.buildCrossBorderObservation({
  explicit_jurisdictions: ['za', 'gb'], selected_pack_ids: ['za'],
  connecting_factors: [{ factor_type: 'performance_location', jurisdiction: 'gb', foreign_element: true, source_evidence_ids: ['evidence-one'] }],
  citation_occurrences: [{ occurrence_id: 'citation-1', jurisdiction: 'za', anchor: base.bundle.evidence_atoms[0].anchor }]
});
ok(legal.coverage_status === 'PARTIAL_EXPLICIT_GAPS' && legal.coverage_gaps.length === 1, 'B7 exposes the unsupported declared jurisdiction as an explicit gap');
ok(legal.conflicts_status === 'CROSS_BORDER_REVIEW_REQUIRED' && legal.governing_law === null, 'Cross-border elements trigger review, not an automatic governing-law conclusion');
ok(legal.ip_address_used === false && legal.device_region_used === false && legal.language_or_locale_used === false && legal.jurisdiction_inference_sources.length === 0, 'Jurisdiction is never inferred from IP, region, language or locale');
ok(legal.citation_occurrences[0].semantic_support === 'NOT_EVALUATED' && legal.authoritative_legal_conclusions.length === 0, 'Citation occurrence cannot become semantic legal support');
ok(legal.selected_packs[0].id === 'za' && legal.selected_packs[0].version === '1.0.0' && legal.selected_packs[0].authority === 'CITATION_SYNTAX_ONLY', 'South Africa is the first explicit versioned syntax-only pack');
ok(Legal.validateCrossBorderObservation(legal).valid, 'Cross-border observation validates its boundaries');
const legalCoverageTamper = C.canonicalClone(legal);
legalCoverageTamper.explicit_jurisdictions = ['za'];
ok(!Legal.validateCrossBorderObservation(legalCoverageTamper).valid, 'B7 validation reconciles declared jurisdictions, selected packs and explicit coverage gaps');
const legalIdentityTamper = C.canonicalClone(legal);
legalIdentityTamper.citation_occurrences[0].occurrence_id = 'changed-occurrence';
ok(!Legal.validateCrossBorderObservation(legalIdentityTamper).valid, 'B7 validation recomputes observation identity and digest instead of accepting stale lineage');
ok(throws(() => Legal.buildCrossBorderObservation({ explicit_jurisdictions: ['za'], selected_pack_ids: ['xx'], connecting_factors: [], citation_occurrences: [] })), 'Unknown jurisdiction pack fails closed');
const adapter = Legal.adapterObservation({
  adapter_id: 'synthetic-archive-adapter', adapter_version: '1.0.0', brain_id: 'B7', licence_security_review: 'APPROVED_FOR_DEVELOPMENT',
  input_identity: { artifact_sha512: 'a'.repeat(128) }, observations: [], coverage: { units_total: 0, units_processed: 0, units_skipped: [], units_failed: [] }
});
ok(adapter.development_only && adapter.default_off && !adapter.production_finding && !adapter.triple_verification, 'Archive adapters remain separately gated observation sources');
ok(throws(() => Legal.adapterObservation({ ...adapter, licence_security_review: 'NOT_REVIEWED' })), 'Unreviewed archive adapter cannot be admitted');

for (const file of ['forensic-engine-page.js', 'forensic-report.js', 'seal-document.html', 'worker/verum-rules.js', 'analysis-config.js']) {
  const source = readFileSync(path.join(here, '..', file), 'utf8');
  ok(!source.includes('development/nine-brain') && !source.includes('verify-independent'), file + ' has no production wiring to development orchestration or independent review');
}

done();
