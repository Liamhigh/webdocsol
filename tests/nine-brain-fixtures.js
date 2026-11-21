'use strict';

const C = require('../analysis-contracts.js');
const R = require('../nine-brain-contracts.js');

function textAtom(evidenceId, pageText, quote, page) {
  const start = pageText.indexOf(quote);
  if (start < 0) throw new Error('Fixture quote missing');
  const artifactSha512 = C.sha512Hex(pageText);
  const anchor = {
    artifact_sha512: artifactSha512, document_id: 'synthetic-' + evidenceId, page,
    text_space: 'page-text-v1', char_start: start, char_end: start + quote.length,
    quote, context_before: pageText.slice(0, start), context_after: pageText.slice(start + quote.length),
    extraction: { kind: 'pdf_text', extractor: 'synthetic', extractor_version: '1.0.0', ocr_page: false },
    geometry: null, structure: null
  };
  return R.createEvidenceAtom({
    schema: R.SCHEMAS.EVIDENCE_ATOM, evidence_id: evidenceId, source_id: 'source-' + evidenceId,
    artifact_sha512: artifactSha512, media_type: 'text/plain', locator: { page }, anchor,
    extraction: { route: 'synthetic-text', version: '1.0.0' }, source_status: 'PRIMARY', ocr_status: 'NOT_OCR',
    handling_provenance: [{ operation: 'created', actor: 'synthetic-fixture' }]
  }, pageText);
}

function mediaAtom() {
  const artifactSha512 = 'd'.repeat(128);
  return R.createEvidenceAtom({
    schema: R.SCHEMAS.EVIDENCE_ATOM, evidence_id: 'evidence-media', source_id: 'synthetic-media',
    artifact_sha512: artifactSha512, media_type: 'audio/wav', locator: { stream_index: 0 },
    anchor: {
      coordinate_space: 'media-time-v1', artifact_sha512: artifactSha512, document_id: 'synthetic-media', stream_index: 0,
      time_base: { numerator: 1, denominator: 1000 }, start_ticks: 100, end_ticks: 900,
      frame_start: null, frame_end: null, decoder: { name: 'synthetic-pcm', version: '1.0.0' }, sample_rate: 48000, channels: 1
    },
    extraction: { route: 'local-synthetic-pcm', version: '1.0.0' }, source_status: 'PRIMARY', ocr_status: 'NOT_APPLICABLE',
    handling_provenance: [{ operation: 'created', actor: 'synthetic-fixture' }]
  });
}

function makeBase() {
  const text1 = 'Synthetic statement one: the amount is R100.00.';
  const text2 = 'Synthetic statement two: no R100.00 amount is agreed.';
  const text3 = 'Synthetic statement three: the amount is R900.00.';
  const atoms = [
    textAtom('evidence-one', text1, 'the amount is R100.00', 1),
    textAtom('evidence-two', text2, 'no R100.00 amount is agreed', 2),
    textAtom('evidence-three', text3, 'the amount is R900.00', 3),
    mediaAtom()
  ];
  const claimBase = {
    schema: R.SCHEMAS.CLAIM_RECORD, subject: 'Synthetic agreement', predicate: 'has amount', actor: 'Synthetic party',
    qualifiers: { event: 'synthetic-agreement', time: null, place: null }, modality: null, condition: null,
    unresolved_fields: ['modality', 'condition']
  };
  const claims = [
    R.createClaimRecord({ ...claimBase, claim_id: 'claim-positive', object: { amount: '100.00', currency: 'ZAR' }, polarity: 'POSITIVE', source_evidence_ids: ['evidence-one'] }),
    R.createClaimRecord({ ...claimBase, claim_id: 'claim-negative', object: { amount: '100.00', currency: 'ZAR' }, polarity: 'NEGATIVE', source_evidence_ids: ['evidence-two'] }),
    R.createClaimRecord({ ...claimBase, claim_id: 'claim-numeric', object: { amount: '900.00', currency: 'ZAR' }, polarity: 'POSITIVE', source_evidence_ids: ['evidence-three'] })
  ];
  const bundle = R.createEvidenceBundle({
    schema: R.SCHEMAS.EVIDENCE_BUNDLE, bundle_id: 'synthetic-development-bundle',
    evidence_atoms: atoms, claims, finding_audits: []
  }, { 'evidence-one': text1, 'evidence-two': text2, 'evidence-three': text3 });
  const finding = (type, evidenceId, brain) => ({
    type, severity: 'DEVELOPMENT', development_source_evidence_ids: [evidenceId], actors: ['Synthetic party'],
    development_bounded_proposition: 'Synthetic ' + brain + ' observation bounded to its supplied evidence anchor.',
    synthetic: true
  });
  const findings = [
    finding('CT23', 'evidence-one', 'B2'), finding('CT37', 'evidence-two', 'B3'),
    finding('CT47', 'evidence-one', 'B4'), finding('CT03', 'evidence-two', 'B5'),
    finding('CT15', 'evidence-three', 'B6'), finding('CT33', 'evidence-one', 'B7'),
    { ...finding('CT99-SYNTHETIC-MEDIA', 'evidence-media', 'B8'), development_brain_id: 'B8' }
  ];
  return {
    bundle, sourceTexts: { 'evidence-one': text1, 'evidence-two': text2, 'evidence-three': text3 },
    findings, constitution: { version: 'synthetic-constitution-v1', text: 'Synthetic Constitution fixture. Exact bytes are supplied identically to both reviewers.' },
    rulePackVersion: 'synthetic-rules-v1', engineVersion: '5.7.2-web'
  };
}

function passReview() {
  const pass = (reason) => ({ status: 'PASS', reasons: [reason] });
  return {
    P2: pass('Actor is explicit in the synthetic claim or finding.'), P3: pass('The proposition is bounded to the fixture.'),
    P4: pass('Synthetic review records distinct evidence origins; this is not a claim of real corroboration.'),
    P5: pass('The structured antithesis and exclusion registers were reviewed.'), P7: pass('Explanation avoids overclaim.'),
    independence_analysis: { status: 'REVIEWED', shared_origins: [], rationale: 'Synthetic distinct evidence IDs; no independence claim beyond the fixture.' },
    reviewer: 'synthetic-semantic-reviewer', rule_version: 'synthetic-p1-p7-v1'
  };
}

function completeReviews(run) {
  const reviews = Object.create(null);
  for (const candidate of run.candidates) reviews[candidate.candidate_id] = passReview();
  return reviews;
}

function providerConfig(provider) {
  return {
    provider, reviewer_slot: provider, model: provider + '-synthetic-model',
    endpoint: 'https://' + provider + '.example.invalid/review', timeout_ms: 1000, max_response_bytes: 65536,
    credential_reference: provider + '-secret-reference'
  };
}

function passingModelResponse(packet, overrides) {
  return JSON.stringify({
    proposition: packet.candidate.proposition, status: 'PASS',
    source_test: 'PASS', context_test: 'PASS', independence_test: 'PASS',
    thesis: 'Synthetic thesis grounded in packet anchors.', antithesis: 'Synthetic antithesis retained.',
    synthesis: 'Synthetic bounded synthesis; no truth certification.',
    anchor_ids: packet.evidence.map((item) => item.evidence_id), reasons: ['Synthetic mock review passed.'],
    ...(overrides || {})
  });
}

module.exports = { makeBase, passReview, completeReviews, providerConfig, passingModelResponse };
