'use strict';

/* B7 cross-border framework: South Africa-first syntax pack, no legal conclusions. */
const { C, VERSION, plain, text, hash, id, clone, freeze, sortedUnique } = require('./util.js');
const ZA = require('../../legal-packs/za.js');

const SCHEMA = 'vo.cross-border-legal-observation.v1';
const SUPPORTED_SYNTAX_PACKS = freeze({ za: { id: ZA.id, version: ZA.version, authority: 'CITATION_SYNTAX_ONLY' } });

function buildCrossBorderObservation(spec) {
  if (!plain(spec) || !Array.isArray(spec.explicit_jurisdictions) || !spec.explicit_jurisdictions.length ||
      spec.explicit_jurisdictions.some((code) => typeof code !== 'string' || !/^[a-z]{2}$/.test(code)) ||
      !Array.isArray(spec.selected_pack_ids) || !spec.selected_pack_ids.length ||
      !Array.isArray(spec.connecting_factors) || !Array.isArray(spec.citation_occurrences)) {
    throw new TypeError('Cross-border review requires explicit jurisdictions, selected packs, connecting factors and citation occurrences');
  }
  const jurisdictions = sortedUnique(spec.explicit_jurisdictions);
  const packs = sortedUnique(spec.selected_pack_ids);
  const unsupported = packs.filter((code) => !Object.prototype.hasOwnProperty.call(SUPPORTED_SYNTAX_PACKS, code));
  if (unsupported.length) throw new TypeError('Unregistered jurisdiction syntax pack: ' + unsupported.join(', '));
  const factorRecords = spec.connecting_factors.map((factor) => {
    if (!plain(factor) || !text(factor.factor_type) || !text(factor.jurisdiction) || jurisdictions.indexOf(factor.jurisdiction) === -1 ||
        !Array.isArray(factor.source_evidence_ids) || !factor.source_evidence_ids.length || factor.source_evidence_ids.some((item) => !text(item))) {
      throw new TypeError('Every connecting factor needs an explicit declared jurisdiction and anchored source evidence IDs');
    }
    return { ...clone(factor), inference_basis: 'EXPLICITLY_SUPPLIED_NOT_INFERRED_FROM_DEVICE_OR_LANGUAGE' };
  });
  const occurrences = spec.citation_occurrences.map((occurrence) => {
    if (!plain(occurrence) || !text(occurrence.occurrence_id) || !text(occurrence.jurisdiction) ||
        jurisdictions.indexOf(occurrence.jurisdiction) === -1 || !plain(occurrence.anchor)) {
      throw new TypeError('Citation occurrences require explicit jurisdiction and an evidence anchor');
    }
    return { ...clone(occurrence), occurrence_only: true, authority_retrieved: occurrence.authority_retrieved === true, semantic_support: 'NOT_EVALUATED' };
  });
  const uncovered = jurisdictions.filter((code) => packs.indexOf(code) === -1);
  const output = {
    schema: SCHEMA, version: VERSION, development_only: true, default_off: true,
    brain_id: 'B7', research_support_brain_id: 'B9',
    explicit_jurisdictions: jurisdictions, selected_packs: packs.map((code) => clone(SUPPORTED_SYNTAX_PACKS[code])),
    connecting_factors: factorRecords, citation_occurrences: occurrences,
    jurisdiction_inference_sources: [], ip_address_used: false, device_region_used: false, language_or_locale_used: false,
    coverage_status: uncovered.length ? 'PARTIAL_EXPLICIT_GAPS' : 'SYNTAX_PACK_COVERAGE_ONLY',
    coverage_gaps: uncovered.map((code) => 'No selected syntax pack for explicitly declared jurisdiction ' + code + '.'),
    conflicts_status: jurisdictions.length > 1 || factorRecords.some((factor) => factor.foreign_element === true) ? 'CROSS_BORDER_REVIEW_REQUIRED' : 'NO_CONFLICTS_CONCLUSION',
    governing_law: null, authoritative_legal_conclusions: [], admissibility_conclusions: [],
    limitations: [
      'Citation occurrence is not authority retrieval, legal interpretation, governing-law selection or contradiction verification.',
      'The South African pack supplies citation syntax only and has not been promoted to authoritative legal reasoning.',
      'Cross-border issues require separately sourced, versioned and qualified legal review.'
    ]
  };
  output.observation_id = id(SCHEMA, 'B7_CROSS_BORDER', output);
  output.observation_sha512 = hash(output);
  const validation = validateCrossBorderObservation(output);
  if (!validation.valid) throw new TypeError(validation.errors.join('; '));
  return freeze(output);
}

function validateCrossBorderObservation(value) {
  const errors = [];
  if (!plain(value) || value.schema !== SCHEMA) return { valid: false, errors: ['wrong cross-border observation schema'] };
  if (value.brain_id !== 'B7' || value.research_support_brain_id !== 'B9' || value.development_only !== true || value.default_off !== true) errors.push('B7/B9 development boundaries are mandatory');
  if (value.governing_law !== null || !Array.isArray(value.authoritative_legal_conclusions) || value.authoritative_legal_conclusions.length ||
      !Array.isArray(value.admissibility_conclusions) || value.admissibility_conclusions.length) errors.push('the framework cannot emit governing-law, authoritative legal or admissibility conclusions');
  if (!Array.isArray(value.jurisdiction_inference_sources) || value.jurisdiction_inference_sources.length || value.ip_address_used !== false || value.device_region_used !== false || value.language_or_locale_used !== false) errors.push('jurisdiction inference from ambient device/network signals is prohibited');
  if (!Array.isArray(value.selected_packs) || !value.selected_packs.length) errors.push('at least one explicit syntax pack is required');
  else for (const pack of value.selected_packs) {
    if (!plain(pack) || !Object.prototype.hasOwnProperty.call(SUPPORTED_SYNTAX_PACKS, pack.id) || pack.version !== SUPPORTED_SYNTAX_PACKS[pack.id].version || pack.authority !== 'CITATION_SYNTAX_ONLY') errors.push('selected pack identity or authority boundary is invalid');
  }
  if (!Array.isArray(value.explicit_jurisdictions) || !value.explicit_jurisdictions.length || value.explicit_jurisdictions.some((code) => typeof code !== 'string' || !/^[a-z]{2}$/.test(code)) ||
      C.stableStringify(value.explicit_jurisdictions) !== C.stableStringify(sortedUnique(value.explicit_jurisdictions))) errors.push('explicit jurisdictions must be canonical unique jurisdiction codes');
  const packIds = Array.isArray(value.selected_packs) ? value.selected_packs.map((pack) => pack && pack.id).filter((code) => typeof code === 'string') : [];
  if (new Set(packIds).size !== packIds.length) errors.push('selected packs must be unique');
  const uncovered = Array.isArray(value.explicit_jurisdictions) ? value.explicit_jurisdictions.filter((code) => packIds.indexOf(code) === -1) : [];
  const expectedStatus = uncovered.length ? 'PARTIAL_EXPLICIT_GAPS' : 'SYNTAX_PACK_COVERAGE_ONLY';
  const expectedGaps = uncovered.map((code) => 'No selected syntax pack for explicitly declared jurisdiction ' + code + '.');
  if (value.coverage_status !== expectedStatus || !Array.isArray(value.coverage_gaps) || C.stableStringify(value.coverage_gaps) !== C.stableStringify(expectedGaps)) errors.push('coverage status and gaps must reconcile with declared jurisdictions and selected packs');
  const expectedConflictsStatus = Array.isArray(value.explicit_jurisdictions) && Array.isArray(value.connecting_factors) &&
    (value.explicit_jurisdictions.length > 1 || value.connecting_factors.some((factor) => plain(factor) && factor.foreign_element === true))
    ? 'CROSS_BORDER_REVIEW_REQUIRED' : 'NO_CONFLICTS_CONCLUSION';
  if (value.conflicts_status !== expectedConflictsStatus) errors.push('conflicts status must reconcile with declared jurisdictions and foreign connecting factors');
  if (Array.isArray(value.connecting_factors)) for (const factor of value.connecting_factors) {
    if (!plain(factor) || !Array.isArray(value.explicit_jurisdictions) || value.explicit_jurisdictions.indexOf(factor.jurisdiction) === -1 || !Array.isArray(factor.source_evidence_ids) || !factor.source_evidence_ids.length) errors.push('connecting factor must remain anchored to an explicit declared jurisdiction');
  } else errors.push('connecting factor register is required');
  if (!Array.isArray(value.citation_occurrences)) errors.push('citation occurrence register is required');
  else for (const occurrence of value.citation_occurrences) {
    if (!plain(occurrence) || occurrence.occurrence_only !== true || occurrence.semantic_support !== 'NOT_EVALUATED') errors.push('citation occurrence cannot claim semantic support');
    if (plain(occurrence) && (!Array.isArray(value.explicit_jurisdictions) || value.explicit_jurisdictions.indexOf(occurrence.jurisdiction) === -1)) errors.push('citation occurrence jurisdiction must be explicitly declared');
  }
  const identityCopy = clone(value);
  delete identityCopy.observation_id;
  delete identityCopy.observation_sha512;
  const expectedId = id(SCHEMA, 'B7_CROSS_BORDER', identityCopy);
  if (value.observation_id !== expectedId) errors.push('cross-border observation ID does not identify its current payload');
  if (value.observation_sha512 !== hash({ ...identityCopy, observation_id: value.observation_id })) errors.push('cross-border observation digest does not identify its current payload');
  return { valid: errors.length === 0, errors };
}

function adapterObservation(spec) {
  if (!plain(spec) || !text(spec.adapter_id) || !text(spec.adapter_version) || spec.licence_security_review !== 'APPROVED_FOR_DEVELOPMENT' ||
      !plain(spec.input_identity) || !/^[0-9a-f]{128}$/.test(spec.input_identity.artifact_sha512 || '') ||
      !Array.isArray(spec.observations) || !spec.coverage || !Number.isSafeInteger(spec.coverage.units_total)) {
    throw new TypeError('Adapter observations require identity, version, licence/security approval, input identity, observations and coverage');
  }
  const output = {
    schema: 'vo.development-adapter-observation.v1', version: VERSION,
    adapter_id: spec.adapter_id, adapter_version: spec.adapter_version,
    brain_id: spec.brain_id, development_only: true, default_off: true,
    licence_security_review: spec.licence_security_review,
    input_identity: clone(spec.input_identity), observations: clone(spec.observations), coverage: clone(spec.coverage),
    production_finding: false, triple_verification: false, legal_conclusion: false
  };
  output.observation_sha512 = hash(output);
  return freeze(output);
}

module.exports = { SCHEMA, SUPPORTED_SYNTAX_PACKS, buildCrossBorderObservation, validateCrossBorderObservation, adapterObservation };
