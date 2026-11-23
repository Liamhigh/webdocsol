'use strict';

/* VER-1–VER-7 development workflow. No production route or live provider is enabled. */
const {
  C, R, VERSION, SHA512_RE, plain, own, text, hash, id, clone, freeze,
  sortedUnique, safeValidate
} = require('./util.js');

const SCHEMAS = freeze({
  PACKET: 'vo.independent-verification-packet.v1',
  REVIEW: 'vo.independent-review.v1',
  PANEL: 'vo.triple-verification-panel.v1',
  DISPOSITION: 'vo.contradiction-disposition.v1',
  NARRATIVE: 'vo.narrative-provenance.v1',
  ANNEX: 'vo.verification-annex.v1'
});
const PROVIDERS = freeze(['mistral', 'deepseek']);
const TESTS = freeze(['source_test', 'context_test', 'independence_test']);
const REVIEW_STATUSES = freeze(['PASS', 'FAIL', 'INSUFFICIENT', 'UNAVAILABLE', 'MALFORMED']);
const DISPOSITIONS = freeze(['CONFIRMED', 'RESOLVED_IN_CONTEXT', 'REJECTED', 'INSUFFICIENT', 'UNRESOLVED']);
const RESPONSE_INSTRUCTIONS = freeze({
  task: 'Review only the bounded proposition against the immutable evidence packet and exact Constitution text. Do not assume another reviewer response.',
  required_json: {
    proposition: 'exact packet proposition', status: 'PASS|FAIL|INSUFFICIENT',
    source_test: 'PASS|FAIL|INSUFFICIENT', context_test: 'PASS|FAIL|INSUFFICIENT', independence_test: 'PASS|FAIL|INSUFFICIENT',
    thesis: 'bounded supporting analysis', antithesis: 'strongest contrary analysis', synthesis: 'bounded reconciliation without erasing dissent',
    anchor_ids: ['evidence IDs from packet only'], reasons: ['specific reasons']
  },
  two_of_three_is_not_verification: true,
  no_legal_or_truth_certification: true
});
const CONTEXT_WINDOW = 160;
const MAX_PACKET_QUOTE = 2000;
const REVIEW_TEST_STATUSES = freeze(['PASS', 'FAIL', 'INSUFFICIENT']);
const reviewTrust = new WeakMap();
const PROCESS_DISPOSITION_RECORDS = Object.create(null);
const PROCESS_DISPOSITION_REVISIONS = Object.create(null);
const UTF8_ENCODER = new TextEncoder();

function utf8ByteLength(value) {
  return UTF8_ENCODER.encode(value).byteLength;
}

function trustReview(review, provenance) {
  reviewTrust.set(review, provenance);
  return review;
}

function trustedPanelReviews(reviews) {
  const copies = clone(reviews || []);
  copies.forEach((review, index) => {
    if (reviews && reviewTrust.has(reviews[index]) && plain(review)) trustReview(review, reviewTrust.get(reviews[index]));
  });
  return copies;
}

function endpointOrigin(endpoint) {
  try { return new URL(endpoint).origin; } catch (error) { return null; }
}

function boundedAnchor(anchor) {
  const output = clone(anchor);
  if (anchor.text_space === 'page-text-v1') {
    output.context_before = anchor.context_before.slice(-CONTEXT_WINDOW);
    output.context_after = anchor.context_after.slice(0, CONTEXT_WINDOW);
  }
  return output;
}

function evidenceIds(packet) {
  return packet && Array.isArray(packet.evidence) ? packet.evidence.map((item) => item && item.evidence_id).sort() : [];
}

function exactStringSet(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    new Set(left).size === left.length && C.stableStringify(left.slice().sort()) === C.stableStringify(right.slice().sort());
}

function packetExcerpt(item) {
  return item && item.anchor && item.anchor.text_space === 'page-text-v1' && plain(item.source_excerpt)
    ? item.source_excerpt.quote : null;
}

function buildEvidencePacket(candidate, atoms, sourceTexts, constitution) {
  if (!plain(candidate) || !text(candidate.candidate_id) || !text(candidate.proposition) || !Array.isArray(candidate.source_evidence_ids) ||
      !Array.isArray(atoms) || !plain(sourceTexts) || !plain(constitution) || !text(constitution.version) || !text(constitution.text)) {
    throw new TypeError('Verification packet requires a bounded candidate, evidence atoms, source texts and exact Constitution text/version');
  }
  const atomsById = Object.create(null);
  for (const atom of atoms) atomsById[atom.evidence_id] = atom;
  if (!exactStringSet(candidate.source_evidence_ids, Object.keys(atomsById).filter((key) => candidate.source_evidence_ids.indexOf(key) !== -1))) {
    throw new TypeError('Candidate evidence IDs must be non-empty and unique');
  }
  const evidence = candidate.source_evidence_ids.map((evidenceId) => {
    if (!own(atomsById, evidenceId)) throw new TypeError('Missing packet EvidenceAtom ' + evidenceId);
    const atom = atomsById[evidenceId];
    const sourceText = own(sourceTexts, evidenceId) ? sourceTexts[evidenceId] : undefined;
    const anchorValidation = R.validateAnyAnchor(atom.anchor, sourceText);
    if (!anchorValidation.valid) throw new TypeError(anchorValidation.errors.join('; '));
    if (atom.anchor.text_space === 'page-text-v1' && atom.anchor.quote.length > MAX_PACKET_QUOTE) {
      throw new TypeError('Packet quote exceeds the minimum-necessary limit; narrow the source anchor before provider submission');
    }
    const anchor = boundedAnchor(atom.anchor);
    return {
      evidence_id: evidenceId, artifact_sha512: atom.artifact_sha512,
      media_type: atom.media_type, locator: clone(atom.locator), anchor,
      source_excerpt: atom.anchor.text_space === 'page-text-v1' ? {
        before: anchor.context_before, quote: anchor.quote, after: anchor.context_after
      } : null,
      extraction: clone(atom.extraction), source_status: atom.source_status, ocr_status: atom.ocr_status,
      handling_provenance: clone(atom.handling_provenance)
    };
  });
  const anchorsById = Object.create(null);
  for (const item of evidence) anchorsById[item.evidence_id] = item.anchor;
  const sourceAnchors = (candidate.source_anchors || []).map((anchor) => {
    if (!plain(anchor) || !own(anchorsById, anchor.evidence_id)) throw new TypeError('Candidate source anchor is outside its evidence set');
    return { evidence_id: anchor.evidence_id, ...clone(anchorsById[anchor.evidence_id]) };
  });
  if (sourceAnchors.length !== evidence.length) throw new TypeError('Candidate must supply exactly one source anchor per packet evidence item');
  const payload = {
    schema: SCHEMAS.PACKET, version: VERSION, development_only: true,
    candidate: {
      candidate_id: candidate.candidate_id, brain_id: candidate.brain_id,
      proposition: candidate.proposition, candidate_class: candidate.candidate_class,
      source_evidence_ids: candidate.source_evidence_ids.slice(), source_anchors: sourceAnchors
    },
    evidence,
    constitution: { version: constitution.version, text: constitution.text, sha512: C.sha512Hex(constitution.text) },
    original_document_bytes_included: false, original_pdf_uploaded: false,
    minimum_necessary_excerpts_only: true,
    allowed_anchor_ids: sortedUnique(evidence.map((item) => item.evidence_id).concat([candidate.candidate_id]))
  };
  payload.packet_id = id(SCHEMAS.PACKET, 'IMMUTABLE_PACKET', payload);
  payload.packet_sha512 = hash(payload);
  const validation = validateEvidencePacket(payload);
  if (!validation.valid) throw new TypeError(validation.errors.join('; '));
  return freeze(payload);
}

function validateEvidencePacketUnsafe(packet) {
  const errors = [];
  if (!plain(packet) || packet.schema !== SCHEMAS.PACKET) return { valid: false, errors: ['wrong verification-packet schema'] };
  if (packet.development_only !== true || packet.original_document_bytes_included !== false || packet.original_pdf_uploaded !== false || packet.minimum_necessary_excerpts_only !== true) errors.push('packet privacy/development boundaries are mandatory');
  if (!plain(packet.candidate) || !text(packet.candidate.candidate_id) || !text(packet.candidate.proposition) || !Array.isArray(packet.evidence) || !packet.evidence.length) errors.push('bounded candidate and evidence are required');
  if (!plain(packet.constitution) || !text(packet.constitution.version) || typeof packet.constitution.text !== 'string' ||
      !SHA512_RE.test(packet.constitution.sha512 || '') || packet.constitution.sha512 !== C.sha512Hex(packet.constitution.text)) errors.push('exact Constitution text, version and identity must reconcile');
  const items = Array.isArray(packet.evidence) ? packet.evidence : [];
  const ids = [];
  const anchorsById = Object.create(null);
  for (const item of items) {
    if (!plain(item) || !text(item.evidence_id) || !SHA512_RE.test(item.artifact_sha512 || '') || !plain(item.anchor)) { errors.push('malformed packet evidence item'); continue; }
    ids.push(item.evidence_id);
    anchorsById[item.evidence_id] = item.anchor;
    if (item.anchor.artifact_sha512 !== item.artifact_sha512) errors.push('packet evidence and anchor artifact identities must match');
    if (item.anchor.text_space === 'page-text-v1') {
      if (!plain(item.source_excerpt) || item.source_excerpt.quote !== item.anchor.quote || item.source_excerpt.before !== item.anchor.context_before || item.source_excerpt.after !== item.anchor.context_after) errors.push('packet excerpt must exactly match its bounded anchor');
      else {
        if (item.anchor.context_before.length > CONTEXT_WINDOW || item.anchor.context_after.length > CONTEXT_WINDOW) errors.push('packet text context exceeds the minimum-necessary window');
        if (typeof item.anchor.quote !== 'string' || item.anchor.quote.length > MAX_PACKET_QUOTE) errors.push('packet quote exceeds the minimum-necessary limit');
        const reconstructed = item.source_excerpt.before + item.source_excerpt.quote + item.source_excerpt.after;
        const excerptAnchor = { ...clone(item.anchor), char_start: item.source_excerpt.before.length, char_end: item.source_excerpt.before.length + item.source_excerpt.quote.length };
        errors.push(...R.validateAnyAnchor(excerptAnchor, reconstructed).errors);
      }
    } else {
      if (item.source_excerpt !== null) errors.push('non-text packet evidence cannot carry a text excerpt');
      const validation = R.validateAnyAnchor(item.anchor);
      if (!validation.valid) errors.push(...validation.errors);
    }
  }
  if (!exactStringSet(ids, ids)) errors.push('packet evidence IDs must be unique');
  if (plain(packet.candidate)) {
    if (!exactStringSet(packet.candidate.source_evidence_ids, ids)) errors.push('candidate source evidence IDs must exactly match the included packet evidence');
    if (!Array.isArray(packet.candidate.source_anchors) || packet.candidate.source_anchors.length !== items.length) errors.push('candidate source anchors must exactly match the included packet evidence');
    else {
      const seen = new Set();
      for (const anchor of packet.candidate.source_anchors) {
        if (!plain(anchor) || !text(anchor.evidence_id) || seen.has(anchor.evidence_id) || !own(anchorsById, anchor.evidence_id)) { errors.push('candidate source anchor has a missing, extra or duplicate evidence link'); continue; }
        seen.add(anchor.evidence_id);
        const expected = { evidence_id: anchor.evidence_id, ...clone(anchorsById[anchor.evidence_id]) };
        if (C.stableStringify(anchor) !== C.stableStringify(expected)) errors.push('candidate source anchor must exactly match its packet evidence anchor');
      }
    }
  }
  if (!Array.isArray(packet.allowed_anchor_ids) || C.stableStringify(packet.allowed_anchor_ids) !== C.stableStringify(sortedUnique(ids.concat([packet.candidate && packet.candidate.candidate_id])))) errors.push('allowed anchor IDs must be exact and complete');
  const identityCopy = clone(packet);
  delete identityCopy.packet_sha512;
  delete identityCopy.packet_id;
  const expectedId = id(SCHEMAS.PACKET, 'IMMUTABLE_PACKET', identityCopy);
  delete identityCopy.packet_sha512;
  delete identityCopy.packet_id;
  if (packet.packet_id && packet.packet_id !== expectedId) errors.push('packet ID mismatch');
  if (packet.packet_sha512 && packet.packet_sha512 !== hash({ ...identityCopy, packet_id: packet.packet_id })) errors.push('packet digest mismatch');
  return { valid: errors.length === 0, errors };
}

function validateEvidencePacket(packet) {
  try { return validateEvidencePacketUnsafe(packet); }
  catch (error) { return { valid: false, errors: ['Verification-packet canonicalisation/validation failed closed: ' + error.message] }; }
}

function buildProviderRequest(packet, config) {
  const packetValidation = validateEvidencePacket(packet);
  if (!packetValidation.valid) throw new TypeError(packetValidation.errors.join('; '));
  validateProviderConfig(config);
  return freeze({
    schema: 'vo.independent-provider-request.v1', provider: config.provider, model: config.model,
    endpoint: config.endpoint, reviewer_slot: config.reviewer_slot,
    packet_sha512: packet.packet_sha512, packet: clone(packet), instructions: RESPONSE_INSTRUCTIONS,
    response_format: 'JSON_ONLY', temperature: 0,
    deterministic_evidence_claim: false
  });
}

function validateProviderConfig(config) {
  if (!plain(config) || PROVIDERS.indexOf(config.provider) === -1 || config.reviewer_slot !== config.provider ||
      !text(config.model) || !text(config.endpoint) || !/^https:\/\//.test(config.endpoint) ||
      !Number.isSafeInteger(config.timeout_ms) || config.timeout_ms < 1 || config.timeout_ms > 120000 ||
      !Number.isSafeInteger(config.max_response_bytes) || config.max_response_bytes < 1 || config.max_response_bytes > 1048576) {
    throw new TypeError('Provider requires Mistral/DeepSeek identity, HTTPS endpoint, model, bounded timeout and response limit');
  }
}

function failureReview(packet, config, status, reasons, rawResponse) {
  const raw = typeof rawResponse === 'string' ? rawResponse : '';
  return freeze({
    schema: SCHEMAS.REVIEW, version: VERSION, reviewer_slot: config.reviewer_slot,
    reviewer_origin: config.provider + ':' + config.model + ':' + config.endpoint,
    provider: config.provider, model: config.model, endpoint: config.endpoint,
    packet_id: packet.packet_id, packet_sha512: packet.packet_sha512,
    constitution_sha512: packet.constitution.sha512, proposition: packet.candidate.proposition,
    status, source_test: 'INSUFFICIENT', context_test: 'INSUFFICIENT', independence_test: 'INSUFFICIENT',
    thesis: '', antithesis: '', synthesis: '', anchor_ids: [], reasons,
    raw_response: raw, response_sha512: C.sha512Hex(raw),
    cross_reviewer_context_received: false, independent_submission: true,
    deterministic_evidence: false, development_only: true
  });
}

function lacksPassGrounding(review) {
  return review.status === 'PASS' && (
    !Array.isArray(review.anchor_ids) || !review.anchor_ids.length ||
    !['thesis', 'antithesis', 'synthesis'].every((key) => text(review[key])) ||
    !Array.isArray(review.reasons) || !review.reasons.length
  );
}

function parseReview(packet, config, raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch (error) { return failureReview(packet, config, 'MALFORMED', ['Provider response was not valid JSON.'], raw); }
  if (!plain(parsed) || !text(parsed.proposition) || REVIEW_STATUSES.indexOf(parsed.status) === -1 ||
      TESTS.some((key) => ['PASS', 'FAIL', 'INSUFFICIENT'].indexOf(parsed[key]) === -1) ||
      !['thesis', 'antithesis', 'synthesis'].every((key) => typeof parsed[key] === 'string') ||
      !Array.isArray(parsed.anchor_ids) || parsed.anchor_ids.some((item) => !text(item)) ||
      !Array.isArray(parsed.reasons) || parsed.reasons.some((item) => !text(item))) {
    return failureReview(packet, config, 'MALFORMED', ['Provider JSON did not satisfy the bounded response contract.'], raw);
  }
  const allowedEvidenceIds = evidenceIds(packet);
  const unknownAnchors = parsed.anchor_ids.filter((anchorId) => allowedEvidenceIds.indexOf(anchorId) === -1);
  const propositionMatches = parsed.proposition === packet.candidate.proposition;
  const ungroundedPass = lacksPassGrounding(parsed);
  const status = unknownAnchors.length || !propositionMatches || ungroundedPass ? 'FAIL' : parsed.status;
  const reasons = parsed.reasons.slice();
  if (unknownAnchors.length) reasons.push('Response cited anchors outside the immutable packet: ' + unknownAnchors.join(', '));
  if (!propositionMatches) reasons.push('Response changed the bounded proposition.');
  if (ungroundedPass) reasons.push('A passing review requires packet evidence anchors and substantive thesis, antithesis, synthesis and reasons.');
  return freeze({
    schema: SCHEMAS.REVIEW, version: VERSION, reviewer_slot: config.reviewer_slot,
    reviewer_origin: config.provider + ':' + config.model + ':' + config.endpoint,
    provider: config.provider, model: config.model, endpoint: config.endpoint,
    packet_id: packet.packet_id, packet_sha512: packet.packet_sha512,
    constitution_sha512: packet.constitution.sha512, proposition: packet.candidate.proposition,
    status, source_test: parsed.source_test, context_test: parsed.context_test, independence_test: parsed.independence_test,
    thesis: parsed.thesis, antithesis: parsed.antithesis, synthesis: parsed.synthesis,
    anchor_ids: parsed.anchor_ids.slice(), reasons,
    raw_response: raw, response_sha512: C.sha512Hex(raw),
    cross_reviewer_context_received: false, independent_submission: true,
    deterministic_evidence: false, development_only: true
  });
}

async function requestIndependentReview(packet, config, transport) {
  validateProviderConfig(config);
  const finish = (review) => trustReview(review, {
    kind: 'external', provider: config.provider, model: config.model, endpoint: config.endpoint, transport
  });
  if (typeof transport !== 'function') return finish(failureReview(packet, config, 'UNAVAILABLE', ['No isolated provider transport was supplied; live fallback is prohibited.']));
  const request = buildProviderRequest(packet, config);
  const controller = new AbortController();
  let timeout;
  try {
    const response = await Promise.race([
      Promise.resolve().then(() => transport(request, { signal: controller.signal })),
      new Promise((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve({ transport_timeout: true });
        }, config.timeout_ms);
      })
    ]);
    if (response && response.transport_timeout) return finish(failureReview(packet, config, 'UNAVAILABLE', ['Provider transport exceeded the configured timeout; transport cancellation was signalled.']));
    const raw = typeof response === 'string' ? response : response && response.body;
    const statusCode = response && typeof response === 'object' ? response.status : 200;
    if (typeof raw !== 'string') return finish(failureReview(packet, config, 'UNAVAILABLE', ['Provider returned no bounded text response.']));
    if (utf8ByteLength(raw) > config.max_response_bytes) return finish(failureReview(packet, config, 'MALFORMED', ['Provider response exceeded the configured byte limit.'], raw.slice(0, 256)));
    if (statusCode !== 200) return finish(failureReview(packet, config, 'UNAVAILABLE', ['Provider returned HTTP ' + statusCode + '; no cross-provider fallback occurred.'], raw));
    return finish(parseReview(packet, config, raw));
  } catch (error) {
    return finish(failureReview(packet, config, 'UNAVAILABLE', ['Provider transport failed: ' + error.message]));
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function responsibleFailure(packet, brainId, reasons) {
  return trustReview(freeze({
    schema: SCHEMAS.REVIEW, version: VERSION, reviewer_slot: 'responsible_brain', reviewer_origin: 'brain:' + (brainId || 'INVALID'), provider: 'deterministic', model: 'source-rule-review', endpoint: null,
    packet_id: packet.packet_id, packet_sha512: packet.packet_sha512, constitution_sha512: packet.constitution.sha512,
    proposition: packet.candidate.proposition, status: 'FAIL', source_test: 'FAIL', context_test: 'INSUFFICIENT', independence_test: 'INSUFFICIENT',
    thesis: '', antithesis: '', synthesis: '', anchor_ids: [], reasons,
    raw_response: '', response_sha512: C.sha512Hex(''), cross_reviewer_context_received: false, independent_submission: true,
    deterministic_evidence: true, development_only: true
  }), { kind: 'responsible', brain_id: brainId || null });
}

function responsibleBrainReview(packet, audit, sourceTexts, sourceContextReview) {
  const packetValidation = validateEvidencePacket(packet);
  if (!packetValidation.valid) return responsibleFailure(packet, audit && audit.brain_id, ['Invalid immutable packet.', ...packetValidation.errors]);
  if (!plain(audit) || audit.original_finding_id !== packet.candidate.candidate_id || audit.brain_id !== packet.candidate.brain_id || audit.brain_id === 'B9') {
    return responsibleFailure(packet, audit && audit.brain_id, ['Responsible-brain audit does not match the packet candidate and eligible brain.']);
  }
  const auditValidation = R.validateFindingAudit(audit, sourceTexts);
  if (!auditValidation.valid) return responsibleFailure(packet, audit.brain_id, ['Complete FindingAudit validation failed.', ...auditValidation.errors]);
  if (!exactStringSet(audit.source_evidence_ids, evidenceIds(packet))) return responsibleFailure(packet, audit.brain_id, ['Audit and packet evidence IDs do not reconcile exactly.']);
  if (!Array.isArray(audit.source_anchors) || audit.source_anchors.length !== packet.evidence.length) return responsibleFailure(packet, audit.brain_id, ['Audit must contain exactly one source anchor per packet evidence item.']);
  const packetAnchors = Object.create(null);
  for (const item of packet.evidence) packetAnchors[item.evidence_id] = item.anchor;
  const seen = new Set();
  for (const anchor of audit.source_anchors) {
    if (!plain(anchor) || seen.has(anchor.evidence_id) || !own(packetAnchors, anchor.evidence_id)) return responsibleFailure(packet, audit.brain_id, ['Audit contains a missing, extra or duplicate packet evidence anchor.']);
    seen.add(anchor.evidence_id);
    const original = clone(anchor);
    delete original.evidence_id;
    const expected = boundedAnchor(original);
    if (C.stableStringify(expected) !== C.stableStringify(packetAnchors[anchor.evidence_id])) return responsibleFailure(packet, audit.brain_id, ['Audit and bounded packet anchors do not reconcile exactly.']);
  }
  if (!plain(sourceContextReview) || REVIEW_TEST_STATUSES.indexOf(sourceContextReview.source_test) === -1 ||
      REVIEW_TEST_STATUSES.indexOf(sourceContextReview.context_test) === -1 || !text(sourceContextReview.source_reason) ||
      !text(sourceContextReview.context_reason) || !exactStringSet(sourceContextReview.reviewed_evidence_ids, evidenceIds(packet))) {
    return responsibleFailure(packet, audit.brain_id, ['Explicit source/context review evidence with reasons and complete evidence coverage is required; anchor equality alone cannot pass.']);
  }
  const passed = sourceContextReview.source_test === 'PASS' && sourceContextReview.context_test === 'PASS';
  return trustReview(freeze({
    schema: SCHEMAS.REVIEW, version: VERSION, reviewer_slot: 'responsible_brain', reviewer_origin: 'brain:' + audit.brain_id,
    provider: 'deterministic', model: 'source-rule-review', endpoint: null,
    packet_id: packet.packet_id, packet_sha512: packet.packet_sha512, constitution_sha512: packet.constitution.sha512,
    proposition: packet.candidate.proposition, status: passed ? 'PASS' : 'FAIL',
    source_test: sourceContextReview.source_test, context_test: sourceContextReview.context_test, independence_test: 'PASS',
    thesis: passed ? sourceContextReview.source_reason : '',
    antithesis: sourceContextReview.context_reason + ' A hash match establishes identity, not truth or legal authority.',
    synthesis: passed ? 'Explicit source/context review passes; two independent model reviews and human adjudication remain separate.' : 'Source/context review fails closed.',
    anchor_ids: audit.source_evidence_ids.slice(), reasons: ['Trusted FindingAudit and exact packet lineage reconciled.', sourceContextReview.source_reason, sourceContextReview.context_reason],
    raw_response: '', response_sha512: C.sha512Hex(''), cross_reviewer_context_received: false, independent_submission: true,
    deterministic_evidence: true, development_only: true
  }), { kind: 'responsible', brain_id: audit.brain_id, audit_id: audit.audit_id });
}

function validateReviewRecord(review, packet) {
  const errors = [];
  if (!plain(review) || review.schema !== SCHEMAS.REVIEW) return { valid: false, errors: ['wrong independent-review schema'] };
  if (['responsible_brain', 'mistral', 'deepseek'].indexOf(review.reviewer_slot) === -1) errors.push('reviewer slot is not contracted');
  if (!text(review.reviewer_origin) || !text(review.provider) || !text(review.model)) errors.push('reviewer origin/provider/model are required');
  if (!SHA512_RE.test(review.packet_sha512 || '') || !SHA512_RE.test(review.constitution_sha512 || '') || !text(review.proposition)) errors.push('review packet, Constitution and proposition identities are required');
  if (REVIEW_STATUSES.indexOf(review.status) === -1 || TESTS.some((key) => ['PASS', 'FAIL', 'INSUFFICIENT'].indexOf(review[key]) === -1)) errors.push('review status or verification test is malformed');
  if (!['thesis', 'antithesis', 'synthesis'].every((key) => typeof review[key] === 'string') || !Array.isArray(review.anchor_ids) || !Array.isArray(review.reasons)) errors.push('review thesis/antithesis/synthesis, anchors and reasons are required');
  if (Array.isArray(review.anchor_ids) && (new Set(review.anchor_ids).size !== review.anchor_ids.length || review.anchor_ids.some((anchorId) => !text(anchorId)))) errors.push('review anchor IDs must be unique strings');
  if (lacksPassGrounding(review)) errors.push('passing review requires packet evidence anchors and substantive thesis, antithesis, synthesis and reasons');
  if (packet && Array.isArray(review.anchor_ids)) {
    const allowed = evidenceIds(packet);
    if (review.anchor_ids.some((anchorId) => allowed.indexOf(anchorId) === -1)) errors.push('review anchors must identify packet evidence, not candidate or external IDs');
  }
  if (typeof review.raw_response !== 'string' || review.response_sha512 !== C.sha512Hex(review.raw_response)) errors.push('raw response identity does not reconcile');
  if (review.cross_reviewer_context_received !== false || review.independent_submission !== true || review.development_only !== true) errors.push('review independence/development boundaries are mandatory');
  if (review.reviewer_slot === 'responsible_brain') {
    if (review.provider !== 'deterministic' || !/^brain:B[1-8]$/.test(review.reviewer_origin) || review.deterministic_evidence !== true || review.raw_response !== '') errors.push('responsible-brain review must be one eligible deterministic brain seat');
  } else {
    if (review.provider !== review.reviewer_slot || PROVIDERS.indexOf(review.provider) === -1 || !text(review.endpoint) || review.deterministic_evidence !== false) errors.push('external review provider/origin boundary is invalid');
    if (review.status === 'PASS' && !review.raw_response) errors.push('passing external review requires preserved raw output');
  }
  return { valid: errors.length === 0, errors };
}

function validatePanel(panel, packet) {
  const errors = [];
  if (!plain(panel) || panel.schema !== SCHEMAS.PANEL) return { valid: false, errors: ['wrong panel schema'] };
  if (!Array.isArray(panel.reviews) || panel.reviews.length !== 3) errors.push('panel requires exactly three reviews');
  else panel.reviews.forEach((review) => errors.push(...validateReviewRecord(review).errors));
  if (['FAIL', 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION'].indexOf(panel.status) === -1) errors.push('panel status is not contracted');
  if (panel.independent_verification_label_granted !== false || panel.two_of_three_accepted !== false || panel.human_adjudication_required !== true || panel.development_only !== true) errors.push('panel verification boundaries are mandatory');
  const copy = clone(panel);
  delete copy.panel_sha512;
  if (!SHA512_RE.test(panel.panel_sha512 || '') || hash(copy) !== panel.panel_sha512) errors.push('panel digest mismatch');
  if (packet && Array.isArray(panel.reviews) && panel.reviews.length === 3) {
    const expected = evaluatePanel(panel.reviews, packet);
    if (C.stableStringify(expected) !== C.stableStringify(panel)) errors.push('panel does not reconcile with an independent recomputation from its packet and reviews');
  }
  return { valid: errors.length === 0, errors };
}

function validateDisposition(disposition) {
  const errors = [];
  if (!plain(disposition) || disposition.schema !== SCHEMAS.DISPOSITION) return { valid: false, errors: ['wrong disposition schema'] };
  if (!Number.isSafeInteger(disposition.revision) || disposition.revision < 1 || DISPOSITIONS.indexOf(disposition.disposition) === -1) errors.push('disposition revision/status is invalid');
  if (disposition.human !== true || !text(disposition.adjudicator) || !text(disposition.reason) || disposition.evidence_retained !== true || disposition.audit_history_retained !== true) errors.push('human adjudication and evidence-retention boundaries are required');
  if (!SHA512_RE.test(disposition.packet_sha512 || '') || !SHA512_RE.test(disposition.panel_sha512 || '') || !Array.isArray(disposition.resolution_evidence_ids)) errors.push('disposition lineage is incomplete');
  const copy = clone(disposition);
  delete copy.disposition_sha512;
  if (!SHA512_RE.test(disposition.disposition_sha512 || '') || hash(copy) !== disposition.disposition_sha512) errors.push('disposition digest mismatch');
  return { valid: errors.length === 0, errors };
}

function validateNarrative(narrative, packet, disposition) {
  const errors = [];
  if (!plain(narrative) || narrative.schema !== SCHEMAS.NARRATIVE) return { valid: false, errors: ['wrong narrative schema'] };
  if (narrative.status !== 'HUMAN_APPROVED_GROUNDED_NARRATIVE' || narrative.narrative_can_resolve_contradiction !== false || !plain(narrative.human_approval) || narrative.human_approval.approved !== true) errors.push('narrative human-approval and resolution boundaries are mandatory');
  if (!Array.isArray(narrative.statements) || narrative.statements.some((statement) => !plain(statement) || !text(statement.text) || statement.verbatim_authorized_text !== true || !Array.isArray(statement.source_ids) || !statement.source_ids.length)) errors.push('narrative statements require verbatim authorized source mappings');
  if (packet) {
    if (narrative.packet_sha512 !== packet.packet_sha512 || narrative.packet_id !== packet.packet_id) errors.push('narrative packet lineage does not reconcile');
    for (const statement of narrative.statements || []) {
      if (!plain(statement) || !Array.isArray(statement.source_ids)) continue;
      if (new Set(statement.source_ids).size !== statement.source_ids.length || !statement.source_ids.every((sourceId) => packet.evidence.some((item) => item.evidence_id === sourceId && packetExcerpt(item) === statement.text))) errors.push('narrative statement is not grounded verbatim in its mapped packet evidence');
    }
  }
  if (disposition && (narrative.disposition_sha512 !== disposition.disposition_sha512 || narrative.disposition_revision !== disposition.revision || narrative.candidate_id !== disposition.candidate_id || narrative.packet_sha512 !== disposition.packet_sha512 ||
      narrative.human_approval.disposition_sha512 !== disposition.disposition_sha512 || narrative.human_approval.disposition_revision !== disposition.revision)) errors.push('narrative disposition lineage and embedded human approval must bind to the same current revision and digest');
  const copy = clone(narrative);
  delete copy.narrative_sha512;
  if (!SHA512_RE.test(narrative.narrative_sha512 || '') || hash(copy) !== narrative.narrative_sha512) errors.push('narrative digest mismatch');
  return { valid: errors.length === 0, errors };
}

function evaluatePanel(reviews, packet) {
  const errors = [];
  const packetValidation = validateEvidencePacket(packet);
  if (!packetValidation.valid) errors.push(...packetValidation.errors);
  if (!Array.isArray(reviews) || reviews.length !== 3) errors.push('Exactly three review seats are required.');
  const expectedSlots = ['responsible_brain', 'mistral', 'deepseek'];
  const origins = new Set();
  const mistralReview = (reviews || []).find((item) => item && item.reviewer_slot === 'mistral');
  const deepseekReview = (reviews || []).find((item) => item && item.reviewer_slot === 'deepseek');
  if (mistralReview && deepseekReview && endpointOrigin(mistralReview.endpoint) &&
      endpointOrigin(mistralReview.endpoint) === endpointOrigin(deepseekReview.endpoint)) errors.push('Mistral and DeepSeek review records share a provider origin.');
  const mistralTrust = mistralReview && reviewTrust.get(mistralReview);
  const deepseekTrust = deepseekReview && reviewTrust.get(deepseekReview);
  if (mistralTrust && deepseekTrust && mistralTrust.transport === deepseekTrust.transport) errors.push('Mistral and DeepSeek review records share a transport subroutine.');
  for (const slot of expectedSlots) {
    const review = (reviews || []).find((item) => item.reviewer_slot === slot);
    if (!review) { errors.push('Missing review seat ' + slot + '.'); continue; }
    errors.push(...validateReviewRecord(review, packet).errors.map((error) => slot + ': ' + error));
    const trust = reviewTrust.get(review);
    if (!trust) errors.push(slot + ': review was not produced by the trusted development review workflow.');
    else if (slot === 'responsible_brain' && (trust.kind !== 'responsible' || trust.brain_id !== packet.candidate.brain_id)) errors.push(slot + ': trusted responsible-brain lineage does not match the packet brain.');
    else if (slot !== 'responsible_brain' && (trust.kind !== 'external' || trust.provider !== slot || trust.model !== review.model || trust.endpoint !== review.endpoint)) errors.push(slot + ': trusted transport/configuration provenance does not match the review record.');
    if (review.packet_sha512 !== packet.packet_sha512 || review.constitution_sha512 !== packet.constitution.sha512 || review.proposition !== packet.candidate.proposition) errors.push(slot + ' reviewed a different packet, Constitution or proposition.');
    if (origins.has(review.reviewer_origin)) errors.push('Duplicate/common-origin reviewer detected: ' + review.reviewer_origin);
    origins.add(review.reviewer_origin);
    if (review.cross_reviewer_context_received !== false) errors.push(slot + ' received cross-reviewer context.');
    if (review.status !== 'PASS') errors.push(slot + ' did not pass: ' + review.status + '.');
    for (const key of TESTS) if (review[key] !== 'PASS') errors.push(slot + ' failed ' + key + '.');
    if (slot !== 'responsible_brain' && review.provider !== slot) errors.push(slot + ' provider identity mismatch.');
    if (slot !== 'responsible_brain' && typeof review.raw_response === 'string') {
      const reparsed = parseReview(packet, {
        provider: review.provider, reviewer_slot: slot, model: review.model, endpoint: review.endpoint
      }, review.raw_response);
      if (C.stableStringify(reparsed) !== C.stableStringify(review)) errors.push(slot + ' review fields do not reconcile with its preserved raw response.');
    }
  }
  const output = {
    schema: SCHEMAS.PANEL, version: VERSION, packet_id: packet.packet_id, packet_sha512: packet.packet_sha512,
    proposition: packet.candidate.proposition, reviews: trustedPanelReviews(reviews),
    status: errors.length ? 'FAIL' : 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION',
    errors, independent_verification_label_granted: false,
    two_of_three_accepted: false, human_adjudication_required: true,
    development_only: true, deterministic_evidence: false
  };
  output.panel_id = id(SCHEMAS.PANEL, 'PANEL', output);
  output.panel_sha512 = hash(output);
  return freeze(output);
}

async function runIndependentPanel(packet, responsibleReview, mistralConfig, deepseekConfig, mistralTransport, deepseekTransport) {
  validateProviderConfig(mistralConfig);
  validateProviderConfig(deepseekConfig);
  if (mistralConfig.provider !== 'mistral' || deepseekConfig.provider !== 'deepseek') throw new TypeError('The two external seats must be Mistral and DeepSeek respectively');
  if (endpointOrigin(mistralConfig.endpoint) === endpointOrigin(deepseekConfig.endpoint)) {
    throw new TypeError('Mistral and DeepSeek seats must not share an endpoint, provider origin, or transport subroutine');
  }
  if (mistralTransport === deepseekTransport) throw new TypeError('Mistral and DeepSeek seats must not share a transport subroutine');
  const external = await Promise.all([
    requestIndependentReview(packet, mistralConfig, mistralTransport),
    requestIndependentReview(packet, deepseekConfig, deepseekTransport)
  ]);
  return evaluatePanel([responsibleReview, external[0], external[1]], packet);
}

class DispositionStore {
  constructor() {
    // One explicitly non-durable process-lifetime store, shared by every instance.
    // Production persistence requires a separately reviewed durable atomic-CAS adapter.
    this.records = PROCESS_DISPOSITION_RECORDS;
    this.revisions = PROCESS_DISPOSITION_REVISIONS;
    this.storage_scope = 'PROCESS_MEMORY_ONLY_NOT_RESTART_DURABLE';
  }
  current(candidateId) { return own(this.records, candidateId) ? this.records[candidateId] : null; }
  history(candidateId) { return freeze(own(this.revisions, candidateId) ? this.revisions[candidateId].slice() : []); }
  commit(candidateId, spec, expectedRevision) {
    const current = this.current(candidateId);
    const revision = current ? current.revision : 0;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== revision) throw new Error('Compare-and-swap failed: expected revision ' + expectedRevision + ', current revision ' + revision);
    const packetValidation = validateEvidencePacket(spec && spec.packet);
    const panelValidation = validatePanel(spec && spec.panel, spec && spec.packet);
    if (!packetValidation.valid || !panelValidation.valid) throw new TypeError('Human adjudication requires a valid immutable packet and non-forgeable panel lineage: ' + packetValidation.errors.concat(panelValidation.errors).join('; '));
    if (!plain(spec) || spec.candidate_id !== candidateId || !plain(spec.panel) || spec.panel.schema !== SCHEMAS.PANEL ||
        !plain(spec.packet) || spec.panel.packet_id !== spec.packet.packet_id || spec.packet.candidate.candidate_id !== candidateId ||
        DISPOSITIONS.indexOf(spec.disposition) === -1 || !text(spec.adjudicator) || spec.human !== true || !text(spec.reason) ||
        !Array.isArray(spec.resolution_evidence_ids)) throw new TypeError('Human adjudication requires linked packet/panel, contracted disposition, identity, reason and resolution-evidence accounting');
    if (spec.disposition === 'CONFIRMED' && spec.panel.status !== 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION') throw new TypeError('CONFIRMED requires all three technical seats to pass');
    if (spec.disposition === 'RESOLVED_IN_CONTEXT' && !spec.resolution_evidence_ids.length) throw new TypeError('Context resolution requires anchored qualifying evidence');
    const packetEvidenceIds = evidenceIds(spec.packet);
    if (new Set(spec.resolution_evidence_ids).size !== spec.resolution_evidence_ids.length || spec.resolution_evidence_ids.some((evidenceId) => packetEvidenceIds.indexOf(evidenceId) === -1)) throw new TypeError('Resolution evidence must be unique packet evidence IDs; candidate IDs do not qualify');
    const record = {
      schema: SCHEMAS.DISPOSITION, version: VERSION, candidate_id: candidateId,
      revision: revision + 1, previous_disposition_sha512: current ? current.disposition_sha512 : null,
      packet_id: spec.packet.packet_id, packet_sha512: spec.packet.packet_sha512,
      panel_id: spec.panel.panel_id, panel_sha512: spec.panel.panel_sha512,
      disposition: spec.disposition, adjudicator: spec.adjudicator, human: true, reason: spec.reason,
      resolution_evidence_ids: spec.resolution_evidence_ids.slice(),
      evidence_retained: true, audit_history_retained: true, development_only: true
    };
    record.disposition_id = id(SCHEMAS.DISPOSITION, 'DISPOSITION', record);
    record.disposition_sha512 = hash(record);
    const committed = freeze(record);
    if (!own(this.revisions, candidateId)) this.revisions[candidateId] = [];
    this.revisions[candidateId].push(committed);
    this.records[candidateId] = committed;
    return committed;
  }
}

function buildNarrativeProvenance(spec) {
  const dispositionValidation = validateDisposition(spec && spec.disposition);
  const packetValidation = validateEvidencePacket(spec && spec.packet);
  if (!dispositionValidation.valid || !packetValidation.valid) throw new TypeError('Narrative requires a valid committed disposition and immutable packet: ' + dispositionValidation.errors.concat(packetValidation.errors).join('; '));
  if (!plain(spec) || !plain(spec.disposition) || spec.disposition.schema !== SCHEMAS.DISPOSITION ||
      spec.disposition.packet_sha512 !== spec.packet.packet_sha512 || !Array.isArray(spec.statements) || !plain(spec.human_approval) ||
      spec.human_approval.approved !== true || !text(spec.human_approval.adjudicator) ||
      spec.human_approval.disposition_sha512 !== spec.disposition.disposition_sha512 ||
      spec.human_approval.disposition_revision !== spec.disposition.revision) {
    throw new TypeError('Narrative requires a packet-linked committed disposition, statements and separate matching human approval');
  }
  const statements = spec.statements.map((statement) => {
    if (!plain(statement) || !text(statement.text) || !Array.isArray(statement.source_ids) || !statement.source_ids.length || new Set(statement.source_ids).size !== statement.source_ids.length) throw new TypeError('Malformed narrative statement');
    const authorized = statement.source_ids.every((sourceId) => spec.packet.evidence.some((item) => item.evidence_id === sourceId && packetExcerpt(item) === statement.text));
    if (!authorized) throw new TypeError('Narrative invention blocked: every material statement must be a verbatim packet-evidence quote mapped to its evidence ID');
    return { text: statement.text, source_ids: statement.source_ids.slice(), verbatim_authorized_text: true };
  });
  const output = {
    schema: SCHEMAS.NARRATIVE, version: VERSION, candidate_id: spec.disposition.candidate_id,
    packet_id: spec.packet.packet_id, packet_sha512: spec.packet.packet_sha512,
    disposition_id: spec.disposition.disposition_id, disposition_revision: spec.disposition.revision,
    disposition_sha512: spec.disposition.disposition_sha512, statements,
    status: 'HUMAN_APPROVED_GROUNDED_NARRATIVE', human_approval: clone(spec.human_approval),
    narrative_can_resolve_contradiction: false, development_only: true
  };
  output.narrative_id = id(SCHEMAS.NARRATIVE, 'NARRATIVE', output);
  output.narrative_sha512 = hash(output);
  return freeze(output);
}

function buildVerificationAnnex(spec) {
  const packetValidation = validateEvidencePacket(spec && spec.packet);
  const panelValidation = validatePanel(spec && spec.panel, spec && spec.packet);
  const dispositionValidation = validateDisposition(spec && spec.disposition);
  if (!packetValidation.valid || !panelValidation.valid || !dispositionValidation.valid) throw new TypeError('Annex refused malformed or digest-inconsistent packet/panel/disposition input');
  if (!plain(spec) || !spec.disposition_store || typeof spec.disposition_store.current !== 'function') throw new TypeError('Annex requires the authoritative disposition store; caller-supplied current state is not trusted');
  const current = spec.disposition_store.current(spec.disposition.candidate_id);
  const currentValidation = validateDisposition(current);
  if (!currentValidation.valid) throw new TypeError('Annex could not validate the authoritative current disposition');
  if (spec.narrative) {
    const narrativeValidation = validateNarrative(spec.narrative, spec.packet, spec.disposition);
    if (!narrativeValidation.valid) throw new TypeError('Annex refused malformed or ungrounded narrative: ' + narrativeValidation.errors.join('; '));
  }
  if (current.disposition_sha512 !== spec.disposition.disposition_sha512 || current.revision !== spec.disposition.revision ||
      spec.panel.packet_sha512 !== spec.packet.packet_sha512 || spec.disposition.packet_sha512 !== spec.packet.packet_sha512 ||
      spec.disposition.panel_sha512 !== spec.panel.panel_sha512) {
    throw new TypeError('Annex refused: packet/panel/disposition linkage is invalid or the authoritative disposition revision is stale');
  }
  if (spec.narrative && (spec.narrative.disposition_sha512 !== spec.disposition.disposition_sha512 || spec.narrative.disposition_revision !== spec.disposition.revision)) throw new TypeError('Narrative is bound to a stale disposition');
  const output = {
    schema: SCHEMAS.ANNEX, version: VERSION, development_only: true, default_off: true,
    candidate_id: spec.disposition.candidate_id, packet: clone(spec.packet), panel: clone(spec.panel),
    disposition: clone(spec.disposition), narrative: spec.narrative ? clone(spec.narrative) : null,
    committed_disposition_revision: spec.disposition.revision,
    committed_disposition_sha512: spec.disposition.disposition_sha512,
    production_report_modified: false, production_seal_modified: false,
    sealing_status: 'READY_FOR_EXISTING_EXTERNAL_SEALER', sealed: false, blockchain_anchor: null,
    label: spec.panel.status === 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION' && spec.disposition.disposition === 'CONFIRMED'
      ? 'HUMAN_ADJUDICATED_WITH_THREE_TECHNICAL_REVIEWS' : 'ADJUDICATION_AND_DISSENT_RECORD'
  };
  output.annex_id = id(SCHEMAS.ANNEX, 'ANNEX', output);
  output.annex_sha512 = hash(output);
  return freeze(output);
}

async function handleIndependentReview(body, dependencies) {
  try {
    if (!plain(dependencies) || typeof dependencies.authorize !== 'function' || typeof dependencies.transportFor !== 'function' ||
        typeof dependencies.providerConfigs !== 'function' || typeof dependencies.lineageFor !== 'function') return { status: 500, body: { error: 'Handler dependencies unavailable' } };
    if (!await dependencies.authorize(body)) return { status: 401, body: { error: 'Unauthorized' } };
    if (!plain(body) || !plain(body.packet)) return { status: 400, body: { error: 'Bounded immutable packet required' } };
    const rawSize = utf8ByteLength(C.stableStringify(body));
    if (rawSize > 2097152) return { status: 413, body: { error: 'Request exceeds 2 MiB development limit' } };
    const packetValidation = validateEvidencePacket(body.packet);
    if (!packetValidation.valid) return { status: 400, body: { error: 'Invalid immutable packet', details: packetValidation.errors } };
    const lineage = await dependencies.lineageFor(body.packet);
    if (!plain(lineage) || !plain(lineage.finding_audit) || !plain(lineage.source_texts) || !plain(lineage.source_context_review)) return { status: 500, body: { error: 'Trusted responsible-brain run/candidate lineage unavailable' } };
    const configs = await dependencies.providerConfigs();
    if (!Array.isArray(configs) || configs.length !== 2) return { status: 500, body: { error: 'Trusted provider configuration unavailable' } };
    const mistral = configs.find((config) => config.provider === 'mistral');
    const deepseek = configs.find((config) => config.provider === 'deepseek');
    if (!mistral || !deepseek) return { status: 500, body: { error: 'Distinct Mistral and DeepSeek seats required; no fallback' } };
    const responsibleReview = responsibleBrainReview(body.packet, lineage.finding_audit, lineage.source_texts, lineage.source_context_review);
    const panel = await runIndependentPanel(body.packet, responsibleReview, mistral, deepseek,
      dependencies.transportFor('mistral'), dependencies.transportFor('deepseek'));
    return { status: 200, body: panel };
  } catch (error) {
    return { status: 400, body: { error: error.message } };
  }
}

module.exports = {
  SCHEMAS, PROVIDERS, RESPONSE_INSTRUCTIONS,
  buildEvidencePacket, validateEvidencePacket, buildProviderRequest,
  requestIndependentReview, responsibleBrainReview, validateReviewRecord, evaluatePanel, validatePanel, runIndependentPanel,
  DispositionStore, validateDisposition, buildNarrativeProvenance, validateNarrative, buildVerificationAnnex, handleIndependentReview
};
