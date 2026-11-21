/*
 * NB-0/NB-1 read-only development preview over existing deterministic findings.
 * This adapter does not execute B1–B9, infer engagement, promote, certify,
 * verify, adjudicate, narrate, seal, or mutate its input.
 */
(function (root) {
  'use strict';
  var C = (typeof module !== 'undefined' && module.exports)
    ? require('./analysis-contracts.js')
    : root && root.VOAnalysisContracts;
  var Records = (typeof module !== 'undefined' && module.exports)
    ? require('./nine-brain-contracts.js')
    : root && root.VONineBrainContracts;
  var Sources = (typeof module !== 'undefined' && module.exports)
    ? require('./nine-brain-source-register.js')
    : root && root.VONineBrainSources;
  if (!C || !Records || !Sources) throw new Error('Nine-brain preview requires analysis contracts, shared records and source register');

  var PREVIEW_SCHEMA = 'vo.nine-brain-restoration-preview.v1';
  var PREVIEW_VERSION = '0.1.0-development';
  var SHA512_RE = /^[0-9a-f]{128}$/;
  var CT_BRAIN = (function () {
    var map = {};
    function put(brain, ids) { for (var i = 0; i < ids.length; i++) map[ids[i]] = brain; }
    put('B5', ['CT03', 'CT04', 'CT29', 'CT51']);
    put('B6', ['CT02', 'CT15', 'CT16', 'CT17', 'CT18', 'CT19', 'CT20', 'CT21', 'CT22', 'CT34']);
    put('B2', ['CT23', 'CT24', 'CT25', 'CT26', 'CT27', 'CT28', 'CT30', 'CT31', 'CT32', 'CT39', 'CT41', 'CT42', 'CT53', 'CT54']);
    put('B3', ['CT37']);
    put('B7', ['CT33', 'CT35']);
    put('B1', ['CT36', 'CT38']);
    put('B4', ['CT47', 'CT48', 'CT49', 'CT50', 'CT55', 'CT56', 'CT57', 'CT58', 'CT60', 'CT61']);
    return C.deepFreeze(map);
  })();

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function compareStrings(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  function mapFindingToBrain(finding) {
    if (finding && finding.type === 'SERIAL') return { brain_id: 'B4', basis: 'EXISTING_REPORT_SERIAL_MAPPING' };
    if (finding && CT_BRAIN[finding.type]) return { brain_id: CT_BRAIN[finding.type], basis: 'EXISTING_REPORT_CT_MAPPING' };
    return { brain_id: 'B1', basis: 'EXISTING_REPORT_DEFAULT_B1_FALLBACK' };
  }
  function emptyCoverage() {
    return { units_total: 0, units_processed: 0, units_skipped: [], units_failed: [] };
  }
  function previewBrainRun(inputSha512, sourceFindingsSha512, brain) {
    var reason = brain.id === 'B8'
      ? 'Read-only preview only: no rich-media input view, engagement decision or dedicated finding register was executed.'
      : brain.id === 'B9'
        ? 'Read-only preview only: B9 remains non-voting; no research, recommendation or evaluation run was executed.'
        : 'Read-only grouping of existing findings is not brain execution; NB-2 engagement and input views remain unimplemented.';
    var outputPayload = {
      brain_id: brain.id,
      execution_mode: 'PREVIEW',
      engagement_status: 'NOT_EVALUATED',
      coverage: emptyCoverage(),
      candidate_ids: [], support_ids: [], opposition_ids: [], exclusion_ids: [],
      recommendation_ids: [], finding_ids: [], rule_hits: [], uncertainties: ['NB-2 brain-specific input view and engagement not executed']
    };
    return Records.createBrainRunRecord({
      schema: Records.SCHEMAS.BRAIN_RUN_RECORD,
      run_id: C.deterministicId(PREVIEW_SCHEMA, inputSha512, 'PREVIEW_RUN:' + brain.id,
        [{ brain_id: brain.id, source_findings_sha512: sourceFindingsSha512 }]),
      brain_id: brain.id,
      brain_version: PREVIEW_VERSION,
      voting: brain.id !== 'B9',
      execution_mode: 'PREVIEW',
      engagement_status: 'NOT_EVALUATED',
      engagement_reason: reason,
      input_view_hashes: [],
      coverage: emptyCoverage(),
      candidate_ids: [], support_ids: [], opposition_ids: [], exclusion_ids: [],
      recommendation_ids: [], finding_ids: [],
      uncertainties: outputPayload.uncertainties,
      rule_hits: [],
      output_sha512: Records.hashRecordPayload(outputPayload),
      preview_limitation: 'NO_BRAIN_EXECUTION_OR_ENGAGEMENT_CLAIM'
    });
  }

  function validatePreview(preview) {
    var errors = [];
    if (!isPlainRecord(preview) || preview.schema !== PREVIEW_SCHEMA) return { valid: false, errors: ['wrong preview schema'] };
    if (!SHA512_RE.test(preview.input_sha512)) errors.push('input_sha512 must be 128 lowercase hexadecimal characters');
    if (typeof preview.engine_version !== 'string' || !preview.engine_version) errors.push('engine_version is required');
    if (preview.preview_version !== PREVIEW_VERSION || preview.development_only !== true) errors.push('preview must retain its exact development version and boundary');
    if (preview.source_register_version !== Sources.SOURCE_REGISTER.register_version || preview.nb0_status !== 'OPEN_AWAITING_GOVERNANCE_DECISION') {
      errors.push('preview must retain the unresolved NB-0 source-register state');
    }
    if (preview.concordance_status !== 'POLICY_UNRESOLVED') errors.push('concordance must remain POLICY_UNRESOLVED');
    if (preview.production_promotion_enabled !== false || preview.pass_number !== 0 || preview.brain_execution_status !== 'NOT_EXECUTED_READ_ONLY_PREVIEW' || preview.promotion_status !== 'NOT_EVALUATED' || preview.guardian_status !== 'NOT_EVALUATED') {
      errors.push('preview cannot claim production promotion, execution, a later pass or guardian review');
    }
    if (preview.triple_verification_status !== 'NOT_IMPLEMENTED' || preview.human_adjudication_status !== 'NOT_ADJUDICATED' || preview.certification_status !== 'NOT_CERTIFIED') {
      errors.push('preview cannot claim verification, adjudication or certification');
    }
    if (!isPlainRecord(preview.concordance) || !Array.isArray(preview.concordance.engaged_voting_brains) || preview.concordance.engaged_voting_brains.length ||
      !Array.isArray(preview.concordance.concordant_themes) || preview.concordance.concordant_themes.length || !Array.isArray(preview.concordance.dissent) || preview.concordance.dissent.length) {
      errors.push('preview cannot claim engaged-brain concordance or dissent analysis');
    }
    if (!Array.isArray(preview.brain_runs) || preview.brain_runs.length !== 9) errors.push('exactly nine preview brain records are required');
    else {
      for (var i = 0; i < 9; i++) {
        var run = preview.brain_runs[i];
        var runValidation = Records.validateBrainRunRecord(run);
        for (var r = 0; r < runValidation.errors.length; r++) errors.push('preview brain B' + (i + 1) + ': ' + runValidation.errors[r]);
        if (!isPlainRecord(run)) continue;
        if (run.brain_id !== 'B' + (i + 1) || run.execution_mode !== 'PREVIEW' || run.engagement_status !== 'NOT_EVALUATED' || run.voting !== (i < 8)) {
          errors.push('preview brain invariant failed at B' + (i + 1));
        }
        var outputKeys = ['candidate_ids', 'support_ids', 'opposition_ids', 'exclusion_ids', 'recommendation_ids', 'finding_ids', 'rule_hits', 'input_view_hashes'];
        for (var k = 0; k < outputKeys.length; k++) {
          if (!Array.isArray(run[outputKeys[k]]) || run[outputKeys[k]].length) errors.push('preview brain run cannot emit analysis output or claim an input view: ' + outputKeys[k]);
        }
        if (run.preview_limitation !== 'NO_BRAIN_EXECUTION_OR_ENGAGEMENT_CLAIM') errors.push('preview brain limitation is required at B' + (i + 1));
      }
    }
    var orderedFindings = [];
    var candidateIds = [];
    if (!Array.isArray(preview.candidates)) errors.push('candidates must be an array');
    else {
      var seenIndexes = {};
      for (var c = 0; c < preview.candidates.length; c++) {
        var candidate = preview.candidates[c];
        if (!isPlainRecord(candidate) || candidate.schema !== 'vo.existing-finding-preview-candidate.v1' || !isPlainRecord(candidate.source_finding)) {
          errors.push('candidate ' + c + ' is malformed');
          continue;
        }
        if (!Number.isSafeInteger(candidate.source_index) || candidate.source_index < 0 || candidate.source_index >= preview.candidates.length || seenIndexes[candidate.source_index]) {
          errors.push('candidate source indexes must be unique and complete');
          continue;
        }
        seenIndexes[candidate.source_index] = true;
        orderedFindings[candidate.source_index] = candidate.source_finding;
        candidateIds.push(candidate.candidate_id);
        var actualFindingHash = Records.hashRecordPayload(candidate.source_finding);
        if (candidate.source_finding_sha512 !== actualFindingHash) errors.push('candidate source finding hash mismatch at ' + c);
        var expectedMapping = mapFindingToBrain(candidate.source_finding);
        if (candidate.brain_id !== expectedMapping.brain_id || candidate.mapping_basis !== expectedMapping.basis) errors.push('candidate brain mapping mismatch at ' + c);
        if (candidate.promotion_status !== 'NOT_EVALUATED' || candidate.candidate_class !== 'EXISTING_DETERMINISTIC_FINDING_READ_ONLY_ALIAS') errors.push('candidate promotion/class invariant failed at ' + c);
        if (SHA512_RE.test(preview.input_sha512)) {
          var expectedCandidateId = C.deterministicId(PREVIEW_SCHEMA, preview.input_sha512, 'EXISTING_FINDING:' + candidate.source_index,
            [{ source_index: candidate.source_index, finding_sha512: actualFindingHash }]);
          if (candidate.candidate_id !== expectedCandidateId) errors.push('candidate deterministic identity mismatch at ' + c);
        }
      }
      if (orderedFindings.length === preview.candidates.length && preview.source_findings_sha512 !== Records.hashRecordPayload(orderedFindings)) {
        errors.push('source_findings_sha512 does not match candidates in original source order');
      }
      if (!preview.coverage || preview.coverage.units_total !== preview.candidates.length || preview.coverage.units_processed !== preview.candidates.length ||
        !Array.isArray(preview.coverage.units_skipped) || preview.coverage.units_skipped.length || !Array.isArray(preview.coverage.units_failed) || preview.coverage.units_failed.length) {
        errors.push('preview coverage must account for every candidate without concealed skips or failures');
      }
    }
    if (!Array.isArray(preview.brain_views) || preview.brain_views.length !== 9) errors.push('exactly nine read-only brain views are required');
    else {
      var accountedIds = [];
      for (var v = 0; v < 9; v++) {
        var view = preview.brain_views[v];
        if (!isPlainRecord(view)) {
          errors.push('read-only brain view is malformed at B' + (v + 1));
          continue;
        }
        var expectedIds = Array.isArray(preview.candidates) ? preview.candidates.filter(function (candidate) {
          return candidate && candidate.brain_id === 'B' + (v + 1);
        }).map(function (candidate) { return candidate.candidate_id; }) : [];
        if (view.brain_id !== 'B' + (v + 1) || view.view_status !== 'READ_ONLY_GROUPING_NOT_BRAIN_EXECUTION' || view.engagement_status !== 'NOT_EVALUATED' || view.input_view_sha512 !== null ||
          C.stableStringify(view.source_candidate_ids) !== C.stableStringify(expectedIds) || view.source_finding_count !== expectedIds.length) {
          errors.push('read-only brain view reconciliation failed at B' + (v + 1));
        }
        if (Array.isArray(view.source_candidate_ids)) accountedIds = accountedIds.concat(view.source_candidate_ids);
      }
      if (C.stableStringify(accountedIds.sort(compareStrings)) !== C.stableStringify(candidateIds.sort(compareStrings))) errors.push('every candidate must occur in exactly one brain view');
    }
    if (SHA512_RE.test(preview.input_sha512)) {
      var expectedPreviewId = C.deterministicId(PREVIEW_SCHEMA, preview.input_sha512, 'RESTORATION_PREVIEW',
        [{ source_findings_sha512: preview.source_findings_sha512, engine_version: preview.engine_version }]);
      if (preview.preview_id !== expectedPreviewId) errors.push('preview deterministic identity mismatch');
    }
    try {
      var digestPayload = C.canonicalClone(preview);
      delete digestPayload.preview_sha512;
      var expectedHash = Records.hashRecordPayload(digestPayload);
      if (preview.preview_sha512 !== expectedHash) errors.push('preview_sha512 does not match the complete preview payload');
    } catch (error) {
      errors.push('preview is not canonical JSON: ' + error.message);
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function buildNineBrainPreview(spec) {
    if (!isPlainRecord(spec)) throw new TypeError('preview specification must be a plain object');
    if (typeof spec.input_sha512 !== 'string' || !SHA512_RE.test(spec.input_sha512)) {
      throw new TypeError('input_sha512 must be 128 lowercase hexadecimal characters');
    }
    if (typeof spec.engine_version !== 'string' || !spec.engine_version) throw new TypeError('engine_version is required');
    if (!Array.isArray(spec.findings)) throw new TypeError('findings must be an array');
    var findings = C.canonicalClone(spec.findings);
    var sourceFindingsSha512 = Records.hashRecordPayload(findings);
    var candidates = [];
    var warnings = [
      'Development-only read-only preview: no canonical brain was executed and no finding was promoted, certified, independently verified or human-adjudicated.',
      'NB-0 is unresolved: this output never treats report-side grouping as brain concordance.'
    ];
    for (var i = 0; i < findings.length; i++) {
      if (!isPlainRecord(findings[i])) throw new TypeError('every existing finding must be a plain object');
      var findingHash = Records.hashRecordPayload(findings[i]);
      var mapping = mapFindingToBrain(findings[i]);
      if (mapping.basis === 'EXISTING_REPORT_DEFAULT_B1_FALLBACK') {
        warnings.push('Candidate ' + i + ' used the existing report default B1 fallback; this is not independent brain attribution.');
      }
      candidates.push({
        schema: 'vo.existing-finding-preview-candidate.v1',
        candidate_id: C.deterministicId(PREVIEW_SCHEMA, spec.input_sha512, 'EXISTING_FINDING:' + i,
          [{ source_index: i, finding_sha512: findingHash }]),
        source_index: i,
        source_finding_sha512: findingHash,
        brain_id: mapping.brain_id,
        mapping_basis: mapping.basis,
        candidate_class: 'EXISTING_DETERMINISTIC_FINDING_READ_ONLY_ALIAS',
        promotion_status: 'NOT_EVALUATED',
        source_finding: findings[i]
      });
    }
    candidates.sort(function (a, b) { return compareStrings(a.candidate_id, b.candidate_id); });
    var brainViews = [];
    var brainRuns = [];
    for (var b = 0; b < Sources.SOURCE_REGISTER.canonical_brains.length; b++) {
      var brain = Sources.SOURCE_REGISTER.canonical_brains[b];
      var ids = candidates.filter(function (candidate) { return candidate.brain_id === brain.id; })
        .map(function (candidate) { return candidate.candidate_id; });
      brainViews.push({
        brain_id: brain.id,
        view_status: 'READ_ONLY_GROUPING_NOT_BRAIN_EXECUTION',
        engagement_status: 'NOT_EVALUATED',
        input_view_sha512: null,
        source_candidate_ids: ids,
        source_finding_count: ids.length
      });
      brainRuns.push(previewBrainRun(spec.input_sha512, sourceFindingsSha512, brain));
    }
    var preview = {
      schema: PREVIEW_SCHEMA,
      preview_id: C.deterministicId(PREVIEW_SCHEMA, spec.input_sha512, 'RESTORATION_PREVIEW',
        [{ source_findings_sha512: sourceFindingsSha512, engine_version: spec.engine_version }]),
      preview_version: PREVIEW_VERSION,
      development_only: true,
      input_sha512: spec.input_sha512,
      engine_version: spec.engine_version,
      source_findings_sha512: sourceFindingsSha512,
      source_register_version: Sources.SOURCE_REGISTER.register_version,
      nb0_status: Sources.SOURCE_REGISTER.nb0_status,
      concordance_status: 'POLICY_UNRESOLVED',
      production_promotion_enabled: false,
      pass_number: 0,
      brain_execution_status: 'NOT_EXECUTED_READ_ONLY_PREVIEW',
      promotion_status: 'NOT_EVALUATED',
      guardian_status: 'NOT_EVALUATED',
      certification_status: 'NOT_CERTIFIED',
      triple_verification_status: 'NOT_IMPLEMENTED',
      human_adjudication_status: 'NOT_ADJUDICATED',
      coverage: { units_total: findings.length, units_processed: findings.length, units_skipped: [], units_failed: [] },
      candidates: candidates,
      brain_views: brainViews,
      brain_runs: brainRuns,
      concordance: { engaged_voting_brains: [], concordant_themes: [], dissent: [], coverage_gaps: ['NB-2/NB-3/NB-4/NB-5/NB-6 not executed'] },
      warnings: warnings
    };
    preview.preview_sha512 = Records.hashRecordPayload(preview);
    var validation = validatePreview(preview);
    if (!validation.valid) throw new TypeError('Invalid nine-brain preview: ' + validation.errors.join('; '));
    return C.deepFreeze(preview);
  }

  var api = {
    PREVIEW_SCHEMA: PREVIEW_SCHEMA,
    PREVIEW_VERSION: PREVIEW_VERSION,
    CT_BRAIN: CT_BRAIN,
    mapFindingToBrain: mapFindingToBrain,
    validatePreview: validatePreview,
    buildNineBrainPreview: buildNineBrainPreview
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VONineBrainPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
