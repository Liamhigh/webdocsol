'use strict';

/*
 * RES-1–RES-9 development research slices. These are bounded deterministic
 * algorithms over structured/synthetic inputs, not new production detectors.
 */
const {
  C, R, VERSION, plain, own, text, hash, id, clone, freeze, sortedUnique, completeCoverage
} = require('./util.js');
const Allen = require('./allen-algebra.js');

const SCHEMA = 'vo.nine-brain-research.v1';

function sameValue(a, b) {
  return C.stableStringify(a) === C.stableStringify(b);
}

function alignClaims(left, right) {
  for (const claim of [left, right]) {
    const validation = R.validateClaimRecord(claim);
    if (!validation.valid) throw new TypeError(validation.errors.join('; '));
  }
  const base = {
    schema: 'vo.claim-alignment.v1', left_claim_id: left.claim_id, right_claim_id: right.claim_id,
    development_only: true, production_finding: false
  };
  if (left.claim_id === right.claim_id) return freeze({ ...base, status: 'EXCLUDED_SAME_CLAIM' });
  if (left.subject === null || right.subject === null || left.predicate === null || right.predicate === null ||
      left.actor === null || right.actor === null || left.subject !== right.subject ||
      left.predicate !== right.predicate || left.actor !== right.actor) {
    return freeze({ ...base, status: 'UNRESOLVED_NOT_SAME_PROPOSITION' });
  }
  if (!sameValue(left.qualifiers, right.qualifiers) || !sameValue(left.condition, right.condition) ||
      !sameValue(left.modality, right.modality)) {
    return freeze({ ...base, status: 'UNRESOLVED_QUALIFIER_MISMATCH' });
  }
  if (left.polarity === 'UNKNOWN' || right.polarity === 'UNKNOWN') {
    return freeze({ ...base, status: 'INSUFFICIENT_UNKNOWN_POLARITY' });
  }
  if (left.polarity !== right.polarity && sameValue(left.object, right.object)) {
    return freeze({ ...base, status: 'CANDIDATE_CONTRADICTION', candidate_class: 'POLARITY' });
  }
  if (left.polarity !== right.polarity) {
    return freeze({ ...base, status: 'UNRESOLVED_OPPOSITE_POLARITY_DIFFERENT_OBJECTS' });
  }
  if (left.polarity === right.polarity && !sameValue(left.object, right.object)) {
    const numeric = left.object && right.object && typeof left.object === 'object' && typeof right.object === 'object' &&
      Object.prototype.hasOwnProperty.call(left.object, 'amount') && Object.prototype.hasOwnProperty.call(right.object, 'amount') &&
      left.object.currency === right.object.currency;
    return freeze({
      ...base,
      status: numeric ? 'CANDIDATE_NUMERIC_DISCREPANCY' : 'VALUE_DIFFERENCE_REQUIRES_RULE_REVIEW',
      candidate_class: numeric ? 'NUMERIC' : 'UNRESOLVED_VALUE_DIFFERENCE'
    });
  }
  return freeze({ ...base, status: 'ALIGNED_NO_CONTRADICTION' });
}

function candidateFromAlignment(alignment, claimsById, atomsById) {
  if (alignment.status !== 'CANDIDATE_CONTRADICTION' && alignment.status !== 'CANDIDATE_NUMERIC_DISCREPANCY') return null;
  const left = claimsById[alignment.left_claim_id];
  const right = claimsById[alignment.right_claim_id];
  const evidenceIds = sortedUnique(left.source_evidence_ids.concat(right.source_evidence_ids));
  const anchors = evidenceIds.map((evidenceId) => ({ evidence_id: evidenceId, ...clone(atomsById[evidenceId].anchor) }));
  const payload = {
    alignment,
    left: { claim_id: left.claim_id, object: left.object, polarity: left.polarity },
    right: { claim_id: right.claim_id, object: right.object, polarity: right.polarity }
  };
  return freeze({
    schema: 'vo.nine-brain-candidate.v1',
    candidate_id: id(SCHEMA, 'RES1_CANDIDATE', payload),
    brain_id: 'B1', candidate_class: alignment.candidate_class,
    proposition: 'The two anchored structured claims require review because their bounded normalized values are incompatible under ' + alignment.candidate_class + ' comparison.',
    source_claim_ids: [left.claim_id, right.claim_id], source_evidence_ids: evidenceIds,
    source_anchors: anchors, actors: [left.actor],
    production_finding: false, semantic_review_status: 'NOT_EVALUATED'
  });
}

function buildEvidenceGraph(bundle, sourceTexts) {
  const validation = R.validateEvidenceBundle(bundle, sourceTexts);
  if (!validation.valid) throw new TypeError(validation.errors.join('; '));
  const atomsById = Object.create(null);
  const claimsById = Object.create(null);
  const nodes = [];
  const edges = [];
  const claimIds = new Set();
  for (const claim of bundle.claims) {
    if (claimIds.has(claim.claim_id)) throw new TypeError('Claim IDs must be unique before evidence-graph construction');
    claimIds.add(claim.claim_id);
  }
  for (const atom of bundle.evidence_atoms) {
    atomsById[atom.evidence_id] = atom;
    nodes.push({ node_id: 'evidence:' + atom.evidence_id, kind: 'EVIDENCE', artifact_sha512: atom.artifact_sha512 });
  }
  for (const claim of bundle.claims) {
    claimsById[claim.claim_id] = claim;
    nodes.push({ node_id: 'claim:' + claim.claim_id, kind: 'CLAIM' });
    for (const evidenceId of claim.source_evidence_ids) {
      edges.push({ from: 'claim:' + claim.claim_id, to: 'evidence:' + evidenceId, relation: 'SUPPORTED_BY' });
    }
  }
  const alignments = [];
  const candidates = [];
  for (let i = 0; i < bundle.claims.length; i++) {
    for (let j = i + 1; j < bundle.claims.length; j++) {
      const alignment = alignClaims(bundle.claims[i], bundle.claims[j]);
      alignments.push(alignment);
      if (alignment.status.indexOf('CANDIDATE_') === 0) {
        edges.push({ from: 'claim:' + alignment.left_claim_id, to: 'claim:' + alignment.right_claim_id, relation: alignment.status });
        candidates.push(candidateFromAlignment(alignment, claimsById, atomsById));
      }
    }
  }
  nodes.sort((a, b) => C.compareStrings(a.node_id, b.node_id));
  edges.sort((a, b) => C.compareStrings(C.stableStringify(a), C.stableStringify(b)));
  candidates.sort((a, b) => C.compareStrings(a.candidate_id, b.candidate_id));
  const units = bundle.evidence_atoms.map((atom) => atom.evidence_id).concat(bundle.claims.map((claim) => claim.claim_id));
  return freeze({
    schema: SCHEMA, slice: 'RES-1/RES-2', version: VERSION, development_only: true,
    nodes, edges, alignments, candidates, coverage: completeCoverage(units),
    limitations: ['Structured claim alignment is not natural-language inference.', 'A candidate is not a promoted or verified finding.']
  });
}

function contractAtomMap(atoms, documentIds) {
  if (!Array.isArray(atoms) || !Array.isArray(documentIds) || !documentIds.length) throw new TypeError('Contract atom mapping requires atoms and document IDs');
  const seen = new Set(documentIds);
  const groups = Object.create(null);
  const duplicates = [];
  for (const atom of atoms) {
    if (!plain(atom) || !text(atom.document_id) || !seen.has(atom.document_id) || !text(atom.normalized_text)) {
      throw new TypeError('Every contract atom needs an explicit supplied document ID and normalized text');
    }
    const key = C.sha512Hex(atom.normalized_text);
    if (!groups[key]) groups[key] = [];
    groups[key].push(atom.document_id);
  }
  for (const key of Object.keys(groups).sort(C.compareStrings)) {
    const uniqueDocuments = sortedUnique(groups[key]);
    if (uniqueDocuments.length > 1) duplicates.push({ normalized_text_sha512: key, document_ids: uniqueDocuments });
  }
  return freeze({ schema: SCHEMA, slice: 'RES-4', duplicate_groups: duplicates, false_positive_only: true, contradiction_finding: false });
}

function oracleMetrics(expected, actual, candidateUniverse) {
  if (!Array.isArray(expected) || !Array.isArray(actual)) throw new TypeError('Oracle metrics require arrays');
  const expectedById = Object.create(null);
  const actualById = Object.create(null);
  const register = (items, target, label) => {
    for (const item of items) {
      if (!plain(item) || !text(item.candidate_id)) throw new TypeError(label + ' entries require candidate IDs');
      if (own(target, item.candidate_id)) throw new TypeError(label + ' candidate IDs must be unique: ' + item.candidate_id);
      target[item.candidate_id] = item;
    }
  };
  register(expected, expectedById, 'Expected');
  register(actual, actualById, 'Actual');
  if (candidateUniverse !== undefined && (!Array.isArray(candidateUniverse) || candidateUniverse.some((item) => !text(item)) || new Set(candidateUniverse).size !== candidateUniverse.length)) throw new TypeError('Candidate universe must be an explicit array of unique candidate IDs');
  const ids = sortedUnique(Object.keys(expectedById).concat(Object.keys(actualById)));
  let tp = 0, fp = 0, fn = 0, localized = 0;
  for (const candidateId of ids) {
    const wanted = own(expectedById, candidateId);
    const found = own(actualById, candidateId);
    if (wanted && found) {
      tp++;
      if (sameValue(expectedById[candidateId].anchors, actualById[candidateId].anchors)) localized++;
    } else if (found) fp++;
    else fn++;
  }
  const detection = { true_positive: tp, false_positive: fp, false_negative: fn };
  if (candidateUniverse !== undefined) detection.true_negative = candidateUniverse.filter((candidateId) => !own(expectedById, candidateId) && !own(actualById, candidateId)).length;
  return freeze({
    schema: SCHEMA, slice: 'RES-5', detection,
    localization: { detected: tp, exact_anchor_matches: localized },
    detection_and_localization_are_separate: true
  });
}

function reviewerRobustness(results) {
  if (!Array.isArray(results) || !results.length) throw new TypeError('Reviewer robustness requires supplied review results');
  const byCandidate = Object.create(null);
  for (const result of results) {
    if (!plain(result) || !text(result.candidate_id) || !text(result.reviewer_id) || !text(result.status)) throw new TypeError('Malformed robustness result');
    if (!byCandidate[result.candidate_id]) byCandidate[result.candidate_id] = [];
    byCandidate[result.candidate_id].push({ reviewer_id: result.reviewer_id, status: result.status });
  }
  const disagreements = [];
  for (const candidateId of Object.keys(byCandidate).sort(C.compareStrings)) {
    const statuses = sortedUnique(byCandidate[candidateId].map((item) => item.status));
    if (statuses.length > 1) disagreements.push({ candidate_id: candidateId, statuses, reviews: byCandidate[candidateId] });
  }
  return freeze({ schema: SCHEMA, slice: 'RES-6', disagreements, agreement_is_not_truth: true, live_calls_executed: false });
}

function rejectionRegister(entries) {
  if (!Array.isArray(entries)) throw new TypeError('Rejection register requires an array');
  const required = ['candidate_id', 'reason', 'reviewer', 'source_evidence_ids'];
  const records = entries.map((entry) => {
    if (!plain(entry) || required.some((key) => !entry[key] || (Array.isArray(entry[key]) && !entry[key].length))) throw new TypeError('Incomplete rejection register entry');
    return { ...clone(entry), evidence_retained: true, audit_history_retained: true };
  });
  records.sort((a, b) => C.compareStrings(a.candidate_id, b.candidate_id));
  return freeze({ schema: SCHEMA, slice: 'RES-8', entries: records, evidence_deleted: false });
}

function formalFactKey(fact) {
  return C.stableStringify({ predicate: fact.predicate, subject: fact.subject, object: fact.object, group: fact.group || null });
}

function saturateFormalFacts(facts, rules, budget) {
  if (!Array.isArray(facts) || !Array.isArray(rules)) throw new TypeError('Formal saturation requires fact and rule arrays');
  const limit = budget === undefined ? 1000 : budget;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('Formal saturation budget must be positive');
  const known = Object.create(null);
  const proofs = Object.create(null);
  const queued = new Set();
  const pending = [];
  for (const fact of facts) {
    const enriched = { ...clone(fact), origin: 'ASSERTED' };
    const key = formalFactKey(enriched);
    if (queued.has(key)) continue;
    queued.add(key);
    pending.push(enriched);
  }
  let steps = 0;
  while (pending.length) {
    if (++steps > limit) return freeze({ schema: SCHEMA, slice: 'RES-3', status: 'BUDGET_EXCEEDED', facts: Object.values(known), proofs });
    const fact = pending.shift();
    const key = formalFactKey(fact);
    queued.delete(key);
    if (known[key]) continue;
    known[key] = fact;
    proofs[key] = fact.origin === 'ASSERTED' ? [{ fact_id: fact.fact_id, origin: 'ASSERTED' }] : fact.proof;
    for (const rule of rules) {
      if (!plain(rule) || !text(rule.rule_id) || !plain(rule.when) || !plain(rule.then)) throw new TypeError('Malformed formal rule');
      let matched = false;
      let proof = null;
      for (const candidate of Object.values(known)) {
        if (candidate.predicate === rule.when.predicate &&
            (rule.when.subject === undefined || candidate.subject === rule.when.subject) &&
            (rule.when.object === undefined || sameValue(candidate.object, rule.when.object))) {
          matched = true;
          proof = [{ rule_id: rule.rule_id, premise: candidate.fact_id }];
          break;
        }
      }
      if (matched) {
        const derived = { ...clone(rule.then), fact_id: rule.rule_id + ':' + Object.keys(known).length + ':' + pending.length, origin: 'DERIVED', proof };
        const derivedKey = formalFactKey(derived);
        if (!known[derivedKey] && !queued.has(derivedKey)) {
          queued.add(derivedKey);
          pending.push(derived);
        }
      }
    }
  }
  const values = Object.values(known);
  const conflicts = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i].group && values[i].group === values[j].group && !sameValue(values[i].object, values[j].object)) {
        conflicts.push({ group: values[i].group, fact_ids: [values[i].fact_id, values[j].fact_id] });
      }
    }
  }
  return freeze({ schema: SCHEMA, slice: 'RES-3', status: conflicts.length ? 'FORMAL_CONFLICT_CANDIDATES' : 'SATURATED_NO_DERIVED_CONFLICT', facts: values, proofs, conflicts, steps });
}

function syntheticLegalReasoner(facts, rules, query, budget) {
  if (!Array.isArray(facts) || !Array.isArray(rules) || !plain(query) || query.synthetic !== true ||
      facts.some((fact) => fact.synthetic !== true) || rules.some((rule) => rule.synthetic !== true || rule.qualified_review_status !== 'SYNTHETIC_FIXTURE_REVIEWED')) {
    throw new TypeError('The formal legal reasoner accepts only explicitly synthetic facts and reviewed synthetic rules');
  }
  const formalFacts = facts.map((fact) => ({ ...fact, fact_id: fact.fact_id || id(SCHEMA, 'SYNTHETIC_FACT', fact) }));
  const formalRules = rules.map((rule) => ({ ...rule, when: rule.when, then: { ...rule.then, synthetic: true } }));
  const saturated = saturateFormalFacts(formalFacts, formalRules, budget);
  if (saturated.status === 'BUDGET_EXCEEDED') return freeze({
    schema: SCHEMA, slice: 'RES-9', synthetic_only: true, legal_conclusion: false, governing_law_determination: false,
    status: 'BUDGET_EXCEEDED', proof: null, qualified_legal_review_still_required: true
  });
  const match = saturated.facts.find((fact) => fact.predicate === query.predicate && fact.subject === query.subject && sameValue(fact.object, query.object));
  return freeze({
    schema: SCHEMA, slice: 'RES-9', synthetic_only: true, legal_conclusion: false, governing_law_determination: false,
    status: match ? 'SYNTHETIC_PROOF_FOUND' : 'UNKNOWN_NOT_DISPROVED',
    proof: match ? saturated.proofs[C.stableStringify({ predicate: match.predicate, subject: match.subject, object: match.object, group: match.group || null })] : null,
    qualified_legal_review_still_required: true
  });
}

module.exports = {
  SCHEMA, alignClaims, buildEvidenceGraph, contractAtomMap, oracleMetrics,
  reviewerRobustness, rejectionRegister, saturateFormalFacts, syntheticLegalReasoner,
  checkTemporalNetwork: Allen.checkPathConsistency, validateTemporalWitness: Allen.validateWitness
};
