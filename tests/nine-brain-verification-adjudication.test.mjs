import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const C = require('../analysis-contracts.js');
const O = require('../development/nine-brain/orchestration.js');
const V = require('../development/nine-brain/verification.js');
const { makeBase, completeReviews, providerConfig, passingModelResponse } = require('./nine-brain-fixtures.js');

console.log('======================================================');
console.log('RUN  nine-brain-verification-adjudication.test.mjs');
console.log('======================================================\n');

const base = makeBase();
const preview = O.buildDevelopmentRun(base);
const run = O.buildDevelopmentRun({ ...base, promotionReviews: completeReviews(preview) });
const candidate = run.candidates.find((item) => item.brain_id === 'B1');
const audit = run.finding_audits.find((item) => item.original_finding_id === candidate.candidate_id);
const packet = V.buildEvidencePacket(candidate, base.bundle.evidence_atoms, base.sourceTexts, base.constitution);
ok(V.validateEvidencePacket(packet).valid, 'VER-1 immutable minimum-necessary packet validates');
ok(packet.original_document_bytes_included === false && packet.original_pdf_uploaded === false && packet.minimum_necessary_excerpts_only, 'Packet contains excerpts and anchors, never original PDF bytes');
ok(packet.constitution.sha512 === C.sha512Hex(base.constitution.text) && packet.constitution.text === base.constitution.text, 'Exact Constitution text and identity enter the packet');
ok(packet.evidence.every((item) => item.source_excerpt.quote === item.anchor.quote), 'Packet excerpts preserve exact anchor quotes and context');
ok(Object.isFrozen(packet) && Object.isFrozen(packet.evidence[0]) && Object.isFrozen(packet.constitution), 'Packet and nested evidence are immutable');
const packetTamper = C.canonicalClone(packet);
packetTamper.constitution.text += ' Changed';
ok(!V.validateEvidencePacket(packetTamper).valid, 'Constitution text tampering invalidates packet identity');
const privacyTamper = C.canonicalClone(packet);
privacyTamper.original_pdf_uploaded = true;
ok(!V.validateEvidencePacket(privacyTamper).valid, 'Packet privacy boundary cannot be relabelled');

const responsible = V.responsibleBrainReview(packet, audit);
ok(responsible.status === 'PASS' && responsible.provider === 'deterministic' && responsible.reviewer_origin === 'brain:B1', 'Responsible eligible brain supplies the first deterministic source/rule review');
const wrongAudit = { ...audit, original_finding_id: 'other-candidate' };
ok(V.responsibleBrainReview(packet, wrongAudit).status === 'FAIL', 'Mismatched responsible-brain audit fails closed');
const mistral = providerConfig('mistral');
const deepseek = providerConfig('deepseek');
const mistralRequest = V.buildProviderRequest(packet, mistral);
const deepseekRequest = V.buildProviderRequest(packet, deepseek);
ok(C.stableStringify(mistralRequest.packet) === C.stableStringify(deepseekRequest.packet), 'Mistral and DeepSeek receive byte-identical evidence packets');
ok(mistralRequest.packet_sha512 === deepseekRequest.packet_sha512 && mistralRequest.packet.constitution.sha512 === deepseekRequest.packet.constitution.sha512, 'Both external seats receive the same packet and Constitution identities');
ok(mistralRequest.instructions.two_of_three_is_not_verification && mistralRequest.deterministic_evidence_claim === false, 'Provider contract rejects majority voting and deterministic-evidence claims');
ok(!JSON.stringify(mistralRequest).includes('secret-value'), 'Provider request carries a credential reference, not a secret value');

const seenRequests = [];
const transportFor = (provider) => async (request) => {
  seenRequests.push(request);
  ok(!request.raw_response && !request.other_reviewer_response, provider + ' receives no other reviewer response');
  return { status: 200, body: passingModelResponse(packet) };
};
const panel = await V.runIndependentPanel(packet, responsible, mistral, deepseek, transportFor('mistral'), transportFor('deepseek'));
ok(panel.status === 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION' && panel.errors.length === 0, 'Three distinct passing technical reviews support the same bounded proposition');
ok(panel.reviews.length === 3 && panel.reviews.every((review) => review.source_test === 'PASS' && review.context_test === 'PASS' && review.independence_test === 'PASS'), 'Source, context and independence tests pass separately in every seat');
ok(panel.independent_verification_label_granted === false && panel.human_adjudication_required, 'Technical panel cannot grant an independent-verification label before human adjudication');
ok(panel.two_of_three_accepted === false && panel.deterministic_evidence === false, 'Panel preserves non-majority and non-deterministic-evidence boundaries');
ok(seenRequests.length === 2 && seenRequests[0].provider !== seenRequests[1].provider, 'Exactly two isolated external calls occur for the two named providers');
ok(panel.reviews[1].antithesis.includes('antithesis') && panel.reviews[1].raw_response.includes('antithesis'), 'Thesis, antithesis, synthesis and raw response are preserved');

const dissentTransport = async () => ({ status: 200, body: passingModelResponse(packet, { status: 'FAIL', context_test: 'FAIL', reasons: ['Synthetic dissent preserved.'] }) });
const dissentPanel = await V.runIndependentPanel(packet, responsible, mistral, deepseek, transportFor('mistral'), dissentTransport);
ok(dissentPanel.status === 'FAIL' && dissentPanel.errors.some((error) => error.includes('deepseek did not pass')), 'Two-of-three agreement is not verification');
ok(dissentPanel.reviews[2].status === 'FAIL' && dissentPanel.reviews[2].reasons.includes('Synthetic dissent preserved.'), 'Provider dissent remains visible in the failed panel');
const malformed = await V.requestIndependentReview(packet, mistral, async () => ({ status: 200, body: '{not json' }));
ok(malformed.status === 'MALFORMED' && malformed.raw_response === '{not json', 'Malformed provider JSON fails closed with bounded raw-response evidence');
const unknownAnchor = await V.requestIndependentReview(packet, mistral, async () => ({ status: 200, body: passingModelResponse(packet, { anchor_ids: ['fabricated-anchor'] }) }));
ok(unknownAnchor.status === 'FAIL' && unknownAnchor.reasons.some((reason) => reason.includes('outside the immutable packet')), 'Model cannot introduce an anchor outside the packet');
const changedProposition = await V.requestIndependentReview(packet, mistral, async () => ({ status: 200, body: passingModelResponse(packet, { proposition: 'A broader invented proposition' }) }));
ok(changedProposition.status === 'FAIL' && changedProposition.reasons.some((reason) => reason.includes('changed the bounded proposition')), 'Model cannot silently broaden the surviving proposition');
const unavailable = await V.requestIndependentReview(packet, mistral, undefined);
ok(unavailable.status === 'UNAVAILABLE' && unavailable.reasons[0].includes('fallback is prohibited'), 'Missing transport fails closed without silent fallback');
const httpFailure = await V.requestIndependentReview(packet, mistral, async () => ({ status: 503, body: 'unavailable' }));
ok(httpFailure.status === 'UNAVAILABLE', 'Provider HTTP failure remains an explicit unavailable status');
const oversized = await V.requestIndependentReview(packet, { ...mistral, max_response_bytes: 8 }, async () => ({ status: 200, body: '123456789' }));
ok(oversized.status === 'MALFORMED' && oversized.reasons[0].includes('byte limit'), 'Provider response byte limit is enforced');
const timedOut = await V.requestIndependentReview(packet, { ...mistral, timeout_ms: 5 }, () => new Promise((resolve) => setTimeout(() => resolve({ status: 200, body: passingModelResponse(packet) }), 30)));
ok(timedOut.status === 'UNAVAILABLE' && timedOut.reasons[0].includes('timeout'), 'Provider timeout fails closed');
const duplicateReviews = C.canonicalClone(panel.reviews);
duplicateReviews[2].reviewer_origin = duplicateReviews[1].reviewer_origin;
ok(V.evaluatePanel(duplicateReviews, packet).errors.some((error) => error.includes('Duplicate/common-origin')), 'Duplicate/common-origin reviewers cannot occupy two seats');
const crossTalkReviews = C.canonicalClone(panel.reviews);
crossTalkReviews[2].cross_reviewer_context_received = true;
ok(V.evaluatePanel(crossTalkReviews, packet).errors.some((error) => error.includes('cross-reviewer context')), 'Cross-talk invalidates independence');
const fabricatedExternalReviews = C.canonicalClone(panel.reviews);
fabricatedExternalReviews[1].raw_response = '';
fabricatedExternalReviews[1].response_sha512 = C.sha512Hex('');
ok(V.evaluatePanel(fabricatedExternalReviews, packet).status === 'FAIL', 'A passing external review cannot omit its preserved raw model response');
const forgedPanel = C.canonicalClone(dissentPanel);
forgedPanel.status = 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION';
forgedPanel.errors = [];
delete forgedPanel.panel_sha512;
forgedPanel.panel_sha512 = C.sha512Hex(C.stableStringify(forgedPanel));
ok(throws(() => new V.DispositionStore().commit(candidate.candidate_id, {
  candidate_id: candidate.candidate_id, packet, panel: forgedPanel, disposition: 'CONFIRMED', adjudicator: 'Synthetic human', human: true, reason: 'Forged status attempt', resolution_evidence_ids: []
}, 0)), 'Adjudication recomputes panel outcome and rejects a rehashed forged status');

const store = new V.DispositionStore();
ok(store.current(candidate.candidate_id) === null, 'Disposition store starts without a fabricated decision');
ok(throws(() => store.commit(candidate.candidate_id, {
  candidate_id: candidate.candidate_id, packet, panel: dissentPanel, disposition: 'CONFIRMED', adjudicator: 'Synthetic human', human: true, reason: 'Attempted majority override', resolution_evidence_ids: []
}, 0)), 'Human adjudication cannot confirm a failed technical panel');
const confirmed = store.commit(candidate.candidate_id, {
  candidate_id: candidate.candidate_id, packet, panel, disposition: 'CONFIRMED', adjudicator: 'Synthetic human adjudicator', human: true,
  reason: 'Separate synthetic human review accepted the bounded proposition.', resolution_evidence_ids: []
}, 0);
ok(confirmed.revision === 1 && confirmed.disposition === 'CONFIRMED' && confirmed.human && confirmed.evidence_retained, 'Separate human adjudication creates monotonic revision one while retaining evidence');
ok(throws(() => store.commit(candidate.candidate_id, {
  candidate_id: candidate.candidate_id, packet, panel, disposition: 'REJECTED', adjudicator: 'Synthetic human adjudicator', human: true, reason: 'Stale update', resolution_evidence_ids: []
}, 0)), 'Compare-and-swap rejects a stale disposition revision');
ok(throws(() => store.commit(candidate.candidate_id, {
  candidate_id: candidate.candidate_id, packet, panel, disposition: 'RESOLVED_IN_CONTEXT', adjudicator: 'Synthetic human adjudicator', human: true, reason: 'No anchor supplied', resolution_evidence_ids: []
}, 1)), 'Narrative or assertion alone cannot resolve a contradiction without qualifying evidence anchors');
const resolved = store.commit(candidate.candidate_id, {
  candidate_id: candidate.candidate_id, packet, panel, disposition: 'RESOLVED_IN_CONTEXT', adjudicator: 'Synthetic human adjudicator', human: true,
  reason: 'Synthetic qualifying packet context resolved the bounded proposition.', resolution_evidence_ids: [packet.evidence[0].evidence_id]
}, 1);
ok(resolved.revision === 2 && resolved.previous_disposition_sha512 === confirmed.disposition_sha512, 'Committed revision two links to the prior disposition digest');
ok(store.current(candidate.candidate_id).disposition_sha512 === resolved.disposition_sha512, 'Store exposes only the latest committed revision as current');
const quote = packet.evidence[0].anchor.quote;
const narrative = V.buildNarrativeProvenance({
  disposition: resolved, statements: [{ text: quote, source_ids: [packet.evidence[0].evidence_id] }],
  authorized_excerpts: { [packet.evidence[0].evidence_id]: quote },
  human_approval: { approved: true, adjudicator: 'Synthetic narrative approver', disposition_sha512: resolved.disposition_sha512 }
});
ok(narrative.status === 'HUMAN_APPROVED_GROUNDED_NARRATIVE' && narrative.statements[0].verbatim_authorized_text, 'Grounded narrative uses verbatim authorized source text and separate human approval');
ok(narrative.narrative_can_resolve_contradiction === false && narrative.disposition_revision === 2, 'Narrative is bound to the committed revision and cannot itself resolve a contradiction');
ok(throws(() => V.buildNarrativeProvenance({
  disposition: resolved, statements: [{ text: 'Invented new fact or law.', source_ids: [packet.evidence[0].evidence_id] }],
  authorized_excerpts: { [packet.evidence[0].evidence_id]: quote },
  human_approval: { approved: true, adjudicator: 'Synthetic narrative approver', disposition_sha512: resolved.disposition_sha512 }
})), 'Narrative invention is blocked even with human approval metadata');
ok(throws(() => V.buildNarrativeProvenance({
  disposition: resolved, statements: [{ text: quote, source_ids: [packet.evidence[0].evidence_id] }],
  authorized_excerpts: { [packet.evidence[0].evidence_id]: quote },
  human_approval: { approved: true, adjudicator: 'Synthetic narrative approver', disposition_sha512: confirmed.disposition_sha512 }
})), 'Narrative approval cannot bind to a stale disposition');
const annex = V.buildVerificationAnnex({ packet, panel, disposition: resolved, current_disposition: store.current(candidate.candidate_id), narrative });
ok(annex.committed_disposition_revision === 2 && annex.committed_disposition_sha512 === resolved.disposition_sha512, 'VER-7 annex binds to the exact committed disposition revision and digest');
ok(annex.sealed === false && annex.sealing_status === 'READY_FOR_EXISTING_EXTERNAL_SEALER' && annex.blockchain_anchor === null, 'Development annex does not claim sealing or blockchain anchoring');
ok(annex.production_report_modified === false && annex.production_seal_modified === false, 'Annex leaves production report and seal semantics untouched');
ok(throws(() => V.buildVerificationAnnex({ packet, panel, disposition: confirmed, current_disposition: resolved })), 'Annex generation refuses stale or superseded revisions');

const handlerBody = { packet, finding_audit: audit };
const handlerDependencies = {
  authorize: () => true, transportFor, providerConfigs: () => [mistral, deepseek]
};
const handler = await V.handleIndependentReview(handlerBody, handlerDependencies);
ok(handler.status === 200 && handler.body.status === 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION', 'VER-4 bounded handler derives the brain review and uses trusted provider configuration with authorized mocks');
const unauthorized = await V.handleIndependentReview(handlerBody, {
  ...handlerDependencies, authorize: () => false
});
ok(unauthorized.status === 401, 'Independent-review handler requires authorization');
const missingProvider = await V.handleIndependentReview(handlerBody, {
  ...handlerDependencies, providerConfigs: () => [mistral, mistral]
});
ok(missingProvider.status === 500 && missingProvider.body.error.includes('no fallback'), 'Handler rejects duplicate trusted provider configuration without fallback');
const clientEndpointAttempt = await V.handleIndependentReview({ ...handlerBody, configs: [{ ...mistral, endpoint: 'https://attacker.example.invalid' }] }, handlerDependencies);
ok(clientEndpointAttempt.status === 200 && seenRequests.every((request) => request.endpoint.indexOf('attacker.example.invalid') === -1), 'Client-supplied provider endpoints are ignored rather than becoming an SSRF target');

ok(V.SCHEMAS.DISPOSITION === 'vo.contradiction-disposition.v1' && V.SCHEMAS.NARRATIVE === 'vo.narrative-provenance.v1' && V.SCHEMAS.ANNEX === 'vo.verification-annex.v1', 'Required disposition, NarrativeProvenance and VerificationAnnex contracts are present');
done();
