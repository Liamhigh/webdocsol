/* NB-0 source register: an inventory, not a constitutional decision. */
(function (root) {
  'use strict';
  var C = (typeof module !== 'undefined' && module.exports)
    ? require('./analysis-contracts.js')
    : root && root.VOAnalysisContracts;
  if (!C) throw new Error('analysis-contracts.js must load before nine-brain-source-register.js');

  var register = {
    schema: 'vo.nine-brain-source-register.v1',
    register_version: '0.1.0-development',
    nb0_status: 'OPEN_AWAITING_GOVERNANCE_DECISION',
    concordance_status: 'POLICY_UNRESOLVED',
    production_promotion_enabled: false,
    canonical_brains: [
      { id: 'B1', name: 'Contradiction Engine', voting: true },
      { id: 'B2', name: 'Document and Image Forensics', voting: true },
      { id: 'B3', name: 'Communications Integrity', voting: true },
      { id: 'B4', name: 'Behavioral and Linguistic Patterns', voting: true },
      { id: 'B5', name: 'Timeline and Continuity', voting: true },
      { id: 'B6', name: 'Financial Exposure and Transaction Patterns', voting: true },
      { id: 'B7', name: 'Legal Subject Mapping', voting: true },
      { id: 'B8', name: 'Audio and Rich Media Forensics', voting: true },
      { id: 'B9', name: 'Research and Advisory Mesh', voting: false }
    ],
    concordance_decision: {
      authoritative_rule: null,
      agreement_unit: null,
      independence_test: null,
      b4_support_treatment: null,
      b8_unengaged_treatment: null,
      constitution_version: null,
      approved_by: null,
      decision_record_id: null,
      candidates: [
        { minimum_independent_voting_brains: 2, agreement_unit: 'theme', source_id: 'canonical-snapshot-2026-03-27' },
        { minimum_independent_voting_brains: 3, agreement_unit: 'conclusion', source_id: 'april-2026-white-paper-and-v5.2.7-family' }
      ]
    },
    sources: [
      {
        source_id: 'canonical-snapshot-2026-03-27',
        title: 'verum9brain(1).PDF',
        locator: 'PDF pp. 1–51',
        version: 'verum_omnis_canonical_spec 2026-03-27',
        sha512: 'a63c1ebee0eeee444dc600068ea9126f82b8a03597ba1b52cfc330cb32f8587b1a4e1b3b67adcaeb77e4e362681c496d4d0167edc54c9d08730a1ea280bc0019',
        role: 'AUTHORITATIVE_COMPARISON_BASELINE',
        independence: 'PRIMARY_SUPPLIED_SOURCE',
        use: 'Canonical B1–B9 identities and original operating sequence.'
      },
      {
        source_id: 'canonical-snapshot-alternative-numbering',
        title: 'verum9brain(1).PDF',
        locator: 'PDF pp. 52–144',
        version: 'verum_omnis_canonical_spec 2026-03-27',
        sha512: 'a63c1ebee0eeee444dc600068ea9126f82b8a03597ba1b52cfc330cb32f8587b1a4e1b3b67adcaeb77e4e362681c496d4d0167edc54c9d08730a1ea280bc0019',
        role: 'HISTORICAL_VARIANT_NOT_CANONICAL',
        independence: 'SAME_ARTIFACT_AS_CANONICAL_SNAPSHOT',
        use: 'Alternative numbering is registered only to prevent B-numbering leakage.'
      },
      {
        source_id: 'april-2026-white-paper-and-v5.2.7-family',
        title: 'April 2026 white paper and Constitution/Android v5.2.7 source family',
        locator: 'Supplied historical source family; exact member hashes not asserted here',
        version: '2026-04 / v5.2.7',
        sha512: null,
        role: 'GOVERNANCE_VARIANT_REQUIRING_CHANGE_CONTROL',
        independence: 'RELATED_SOURCE_FAMILY_NOT_INDEPENDENT_CORROBORATION',
        use: 'Three-brain statement and fail-closed review requirements; no silent selection.'
      },
      {
        source_id: 'constitution-v5.2.7-excerpt-64-page',
        title: 'Constitution/Android specification 64-page excerpt',
        locator: 'PDF pp. 13–76 of the supplied complete 76-page file after whitespace normalisation',
        version: 'v5.2.7',
        sha512: null,
        role: 'DUPLICATE_EXCERPT',
        independence: 'NOT_INDEPENDENT_OF_COMPLETE_V5_2_7',
        use: 'Do not count as another source or verification leg.'
      },
      {
        source_id: 'current-web-constitution-v8',
        title: 'CONSTITUTION-v8.md',
        locator: 'Repository main at 4f29b9a8076b4f68f66ec3c6bc4754f171dbd80e',
        version: 'v8.0',
        sha512: null,
        git_blob_sha1: '75a1dbe71c0a9a9fbcac678aea0b3e7b2dc6b09b',
        role: 'CURRENT_REPOSITORY_CONSTITUTION',
        independence: 'CURRENT_REPOSITORY_SOURCE',
        use: 'Current constitutional source; this slice does not edit it.'
      },
      {
        source_id: 'implementation-plan-v1.3-addenda-d-e',
        title: 'Verum Omnis documentation publication patch',
        locator: 'Supplied patch; ENHANCEMENT-IMPLEMENTATION-PLAN.md Addenda D–E',
        version: '1.3',
        sha512: null,
        patch_header_commit: '9f925daf83dce7c982ffbed84783e0bf4a015e88',
        role: 'RESTORATION_DESIGN_NOT_GOVERNANCE_DECISION',
        independence: 'SUPPLIED_DESIGN_SOURCE',
        use: 'NB-0/NB-1 requirements and fail-closed preview semantics.'
      }
    ],
    required_decision: 'A versioned human governance record must choose the concordance rule, agreement unit and independence test before production promotion. This register does not make that decision.'
  };

  function validateSourceRegister(value) {
    var errors = [];
    if (!value || value.schema !== 'vo.nine-brain-source-register.v1') errors.push('wrong source-register schema');
    if (!value || value.nb0_status !== 'OPEN_AWAITING_GOVERNANCE_DECISION' || value.concordance_status !== 'POLICY_UNRESOLVED' || value.production_promotion_enabled !== false) {
      errors.push('NB-0 must remain unresolved and production promotion disabled in this slice');
    }
    if (!value || !Array.isArray(value.canonical_brains) || value.canonical_brains.length !== 9) errors.push('exactly nine canonical brains are required');
    else {
      for (var i = 0; i < 9; i++) {
        var brain = value.canonical_brains[i];
        if (brain.id !== 'B' + (i + 1) || brain.voting !== (i < 8)) errors.push('canonical brain order/voting mismatch at ' + i);
      }
    }
    if (!value || !Array.isArray(value.sources) || !value.sources.length) errors.push('source register cannot be empty');
    return { valid: errors.length === 0, errors: errors };
  }
  var validation = validateSourceRegister(register);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  var api = { SOURCE_REGISTER: C.deepFreeze(register), validateSourceRegister: validateSourceRegister };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VONineBrainSources = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
