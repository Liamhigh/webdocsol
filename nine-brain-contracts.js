/*
 * Verum Omnis NB-1 deterministic shared records.
 *
 * Development/preview contracts only. These constructors do not execute a
 * brain, promote a finding, certify truth, adjudicate a matter, or verify law.
 * Canonical records preserve unknown fields and contain caller-supplied times
 * and stable identities only. No clock, randomness, network, locale collation,
 * telemetry, or browser-only dependency is used.
 */
(function (root) {
  'use strict';

  var C = (typeof module !== 'undefined' && module.exports)
    ? require('./analysis-contracts.js')
    : root && root.VOAnalysisContracts;
  if (!C) throw new Error('analysis-contracts.js must load before nine-brain-contracts.js');

  var SCHEMAS = Object.freeze({
    EVIDENCE_ATOM: 'vo.evidence-atom.v1',
    CLAIM_RECORD: 'vo.claim-record.v1',
    BRAIN_RUN_RECORD: 'vo.brain-run-record.v1',
    PROMOTION_DECISION: 'vo.promotion-decision.v1',
    FINDING_AUDIT: 'vo.finding-audit.v1',
    GUARDIAN_DECISION: 'vo.guardian-decision.v1',
    FINDING_CERTIFICATION: 'vo.finding-certification.v1',
    EVIDENCE_BUNDLE: 'vo.evidence-bundle.v1'
  });
  var BRAIN_IDS = Object.freeze(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']);
  var ENGAGEMENT_STATUSES = Object.freeze(['ENGAGED', 'PARTIAL', 'NOT_ENGAGED', 'NOT_EVALUATED', 'FAILED', 'UNSUPPORTED']);
  var REVIEW_STATUSES = Object.freeze(['PASS', 'FAIL', 'INSUFFICIENT', 'NOT_EVALUATED']);
  var RUN_OUTPUT_FIELDS = Object.freeze([
    'brain_id', 'execution_mode', 'engagement_status', 'coverage',
    'candidate_ids', 'support_ids', 'opposition_ids', 'exclusion_ids',
    'recommendation_ids', 'finding_ids', 'rule_hits', 'uncertainties'
  ]);
  var SHA512_RE = /^[0-9a-f]{128}$/;

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function isPlainRecord(value) {
    if (!isRecord(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function nonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
  }
  function safeInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  }
  function validHash(value) {
    return typeof value === 'string' && SHA512_RE.test(value);
  }
  function addError(errors, condition, message) {
    if (!condition) errors.push(message);
  }
  function cloneWithSchema(spec, schema) {
    if (!isPlainRecord(spec)) throw new TypeError(schema + ' requires a plain object');
    var record = C.canonicalClone(spec);
    if (record.schema !== schema) throw new TypeError('schema must be ' + schema);
    return record;
  }
  function finish(record, errors) {
    if (errors.length) throw new TypeError('Invalid ' + record.schema + ': ' + errors.join('; '));
    return C.deepFreeze(record);
  }
  function uniqueStrings(value) {
    if (!Array.isArray(value) || !value.length) return false;
    var seen = Object.create(null);
    for (var i = 0; i < value.length; i++) {
      if (!nonEmptyString(value[i]) || Object.prototype.hasOwnProperty.call(seen, value[i])) return false;
      seen[value[i]] = true;
    }
    return true;
  }
  function hasOwn(record, key) {
    return isRecord(record) && Object.prototype.hasOwnProperty.call(record, key);
  }
  function sourceTextFor(sourceTexts, evidenceId) {
    return hasOwn(sourceTexts, evidenceId) && typeof sourceTexts[evidenceId] === 'string'
      ? sourceTexts[evidenceId]
      : undefined;
  }
  function stringArray(value) {
    if (!Array.isArray(value)) return false;
    for (var i = 0; i < value.length; i++) if (!nonEmptyString(value[i])) return false;
    return true;
  }
  function plainRecordArray(value) {
    if (!Array.isArray(value)) return false;
    for (var i = 0; i < value.length; i++) if (!isPlainRecord(value[i])) return false;
    return true;
  }
  function validateCoverage(coverage) {
    try {
      var envelope = {
        module_id: 'coverage-check', module_version: '1', implementation_digest: 'coverage-check',
        status: 'completed', input_sha512: 'a'.repeat(128), reference_time: null,
        configuration: {}, dependencies: [], coverage: coverage,
        observations: [], findings: [], warnings: [], failure: null
      };
      var result = C.validateModuleEnvelope(envelope);
      return result.errors.filter(function (message) {
        return message.indexOf('coverage') !== -1 || message.indexOf('completed work') !== -1 ||
          message.indexOf('every unit') !== -1 || message.indexOf('duplicate') !== -1 ||
          message.indexOf('one unit') !== -1;
      });
    } catch (error) {
      return ['coverage is malformed: ' + error.message];
    }
  }
  function validateMediaAnchor(anchor) {
    var errors = [];
    if (!isPlainRecord(anchor)) return { valid: false, errors: ['media anchor must be a plain object'] };
    addError(errors, anchor.coordinate_space === 'media-time-v1', 'coordinate_space must be media-time-v1');
    addError(errors, validHash(anchor.artifact_sha512), 'artifact_sha512 must be 128 lowercase hexadecimal characters');
    addError(errors, nonEmptyString(anchor.document_id), 'document_id is required');
    addError(errors, safeInteger(anchor.stream_index), 'stream_index must be a non-negative safe integer');
    addError(errors, isPlainRecord(anchor.time_base) && safeInteger(anchor.time_base.numerator) && anchor.time_base.numerator > 0 &&
      safeInteger(anchor.time_base.denominator) && anchor.time_base.denominator > 0,
      'time_base requires positive safe-integer numerator and denominator');
    addError(errors, safeInteger(anchor.start_ticks) && safeInteger(anchor.end_ticks) && anchor.end_ticks > anchor.start_ticks,
      'media time range requires end_ticks after start_ticks');
    var hasFrameStart = anchor.frame_start !== null && typeof anchor.frame_start !== 'undefined';
    var hasFrameEnd = anchor.frame_end !== null && typeof anchor.frame_end !== 'undefined';
    if (hasFrameStart || hasFrameEnd) {
      addError(errors, hasFrameStart && hasFrameEnd && safeInteger(anchor.frame_start) && safeInteger(anchor.frame_end) && anchor.frame_end > anchor.frame_start,
        'frame range must be absent/null or a complete non-empty increasing safe-integer range');
    }
    addError(errors, isPlainRecord(anchor.decoder) && nonEmptyString(anchor.decoder.name) && nonEmptyString(anchor.decoder.version),
      'decoder name and version are required');
    addError(errors, anchor.sample_rate === null || (safeInteger(anchor.sample_rate) && anchor.sample_rate > 0),
      'sample_rate must be null or a positive safe integer');
    addError(errors, anchor.channels === null || (safeInteger(anchor.channels) && anchor.channels > 0),
      'channels must be null or a positive safe integer');
    return { valid: errors.length === 0, errors: errors };
  }
  function validateAnyAnchor(anchor, sourceText) {
    if (isPlainRecord(anchor) && anchor.coordinate_space === 'media-time-v1') return validateMediaAnchor(anchor);
    return C.validateEvidenceAnchor(anchor, sourceText);
  }

  function validateEvidenceAtom(atom, sourceText) {
    var errors = [];
    if (!isPlainRecord(atom)) return { valid: false, errors: ['EvidenceAtom must be a plain object'] };
    addError(errors, atom.schema === SCHEMAS.EVIDENCE_ATOM, 'wrong EvidenceAtom schema');
    addError(errors, nonEmptyString(atom.evidence_id) && nonEmptyString(atom.source_id), 'evidence_id and source_id are required');
    addError(errors, validHash(atom.artifact_sha512), 'artifact_sha512 must be a SHA-512 identity');
    addError(errors, nonEmptyString(atom.media_type), 'media_type is required');
    addError(errors, isPlainRecord(atom.locator), 'page/message/frame locator is required');
    var anchorResult = validateAnyAnchor(atom.anchor, sourceText);
    for (var i = 0; i < anchorResult.errors.length; i++) errors.push('anchor: ' + anchorResult.errors[i]);
    if (isPlainRecord(atom.anchor) && validHash(atom.artifact_sha512) && atom.anchor.artifact_sha512 !== atom.artifact_sha512) {
      errors.push('atom and anchor artifact identities must match');
    }
    addError(errors, isPlainRecord(atom.extraction) && nonEmptyString(atom.extraction.route), 'extraction.route is required');
    addError(errors, ['PRIMARY', 'SECONDARY', 'UNKNOWN'].indexOf(atom.source_status) !== -1, 'source_status is not contracted');
    addError(errors, ['NOT_APPLICABLE', 'NOT_OCR', 'OCR', 'UNKNOWN'].indexOf(atom.ocr_status) !== -1, 'ocr_status is not contracted');
    addError(errors, plainRecordArray(atom.handling_provenance), 'handling_provenance must contain plain records');
    return { valid: errors.length === 0, errors: errors };
  }
  function createEvidenceAtom(spec, sourceText) {
    var record = cloneWithSchema(spec, SCHEMAS.EVIDENCE_ATOM);
    return finish(record, validateEvidenceAtom(record, sourceText).errors);
  }

  function validateClaimRecord(claim) {
    var errors = [];
    if (!isPlainRecord(claim)) return { valid: false, errors: ['ClaimRecord must be a plain object'] };
    addError(errors, claim.schema === SCHEMAS.CLAIM_RECORD, 'wrong ClaimRecord schema');
    addError(errors, nonEmptyString(claim.claim_id), 'claim_id is required');
    ['subject', 'predicate', 'actor'].forEach(function (key) {
      addError(errors, claim[key] === null || nonEmptyString(claim[key]), key + ' must be a non-empty string or null');
    });
    addError(errors, Object.prototype.hasOwnProperty.call(claim, 'object'), 'object/value field is required even when null');
    addError(errors, isPlainRecord(claim.qualifiers), 'event/time/place qualifiers object is required');
    addError(errors, ['POSITIVE', 'NEGATIVE', 'UNKNOWN'].indexOf(claim.polarity) !== -1, 'polarity is not contracted');
    addError(errors, claim.modality === null || nonEmptyString(claim.modality), 'modality must be a string or null');
    addError(errors, claim.condition === null || nonEmptyString(claim.condition), 'condition must be a string or null');
    addError(errors, uniqueStrings(claim.source_evidence_ids), 'source_evidence_ids must be a non-empty unique string array');
    addError(errors, stringArray(claim.unresolved_fields), 'unresolved_fields must be a string array');
    if (Array.isArray(claim.unresolved_fields)) {
      ['subject', 'predicate', 'actor', 'object', 'modality', 'condition'].forEach(function (key) {
        addError(errors, claim[key] !== null || claim.unresolved_fields.indexOf(key) !== -1,
          'null semantic field ' + key + ' must be listed in unresolved_fields');
      });
    }
    return { valid: errors.length === 0, errors: errors };
  }
  function createClaimRecord(spec) {
    var record = cloneWithSchema(spec, SCHEMAS.CLAIM_RECORD);
    return finish(record, validateClaimRecord(record).errors);
  }

  function brainRunOutputPayload(run) {
    if (!isPlainRecord(run)) throw new TypeError('BrainRunRecord output requires a plain object');
    var payload = {};
    for (var i = 0; i < RUN_OUTPUT_FIELDS.length; i++) {
      var key = RUN_OUTPUT_FIELDS[i];
      if (!hasOwn(run, key)) throw new TypeError('BrainRunRecord output is missing ' + key);
      payload[key] = run[key];
    }
    return payload;
  }
  function hashBrainRunOutput(run) {
    return hashRecordPayload(brainRunOutputPayload(run));
  }

  function validateBrainRunRecord(run) {
    var errors = [];
    if (!isPlainRecord(run)) return { valid: false, errors: ['BrainRunRecord must be a plain object'] };
    addError(errors, run.schema === SCHEMAS.BRAIN_RUN_RECORD, 'wrong BrainRunRecord schema');
    addError(errors, nonEmptyString(run.run_id), 'run_id is required');
    addError(errors, BRAIN_IDS.indexOf(run.brain_id) !== -1, 'brain_id is not canonical');
    addError(errors, nonEmptyString(run.brain_version), 'brain_version is required');
    addError(errors, run.voting === (run.brain_id !== 'B9'), 'voting must be true for B1–B8 and false for B9');
    addError(errors, ['ANALYSIS', 'PREVIEW'].indexOf(run.execution_mode) !== -1, 'execution_mode is not contracted');
    addError(errors, ENGAGEMENT_STATUSES.indexOf(run.engagement_status) !== -1, 'engagement_status is not contracted');
    if (run.execution_mode === 'PREVIEW') addError(errors, run.engagement_status === 'NOT_EVALUATED', 'preview cannot claim brain engagement');
    addError(errors, nonEmptyString(run.engagement_reason), 'engagement_reason is required');
    addError(errors, Array.isArray(run.input_view_hashes) && run.input_view_hashes.every(validHash), 'input_view_hashes must contain SHA-512 identities');
    var coverageErrors = validateCoverage(run.coverage);
    for (var i = 0; i < coverageErrors.length; i++) errors.push(coverageErrors[i]);
    ['candidate_ids', 'support_ids', 'opposition_ids', 'exclusion_ids', 'recommendation_ids', 'finding_ids', 'uncertainties'].forEach(function (key) {
      addError(errors, stringArray(run[key]), key + ' must be a string array');
    });
    addError(errors, plainRecordArray(run.rule_hits), 'rule_hits must contain plain records');
    addError(errors, validHash(run.output_sha512), 'output_sha512 must be a SHA-512 identity');
    if (validHash(run.output_sha512)) {
      try {
        addError(errors, run.output_sha512 === hashBrainRunOutput(run), 'output_sha512 must identify the exact contracted run output');
      } catch (error) {
        errors.push('run output cannot be canonically hashed: ' + error.message);
      }
    }
    if (run.execution_mode === 'ANALYSIS' && (run.engagement_status === 'ENGAGED' || run.engagement_status === 'PARTIAL')) {
      addError(errors, Array.isArray(run.input_view_hashes) && run.input_view_hashes.length > 0,
        'ENGAGED/PARTIAL analysis requires at least one input-view hash');
      addError(errors, isRecord(run.coverage) && safeInteger(run.coverage.units_processed) && run.coverage.units_processed > 0,
        'ENGAGED/PARTIAL analysis requires processed coverage');
    }
    if (run.execution_mode === 'PREVIEW') {
      ['candidate_ids', 'support_ids', 'opposition_ids', 'exclusion_ids', 'recommendation_ids', 'finding_ids', 'rule_hits', 'input_view_hashes'].forEach(function (key) {
        addError(errors, Array.isArray(run[key]) && run[key].length === 0, 'PREVIEW cannot emit or claim ' + key);
      });
      addError(errors, isRecord(run.coverage) && run.coverage.units_total === 0 && run.coverage.units_processed === 0 &&
        Array.isArray(run.coverage.units_skipped) && run.coverage.units_skipped.length === 0 &&
        Array.isArray(run.coverage.units_failed) && run.coverage.units_failed.length === 0,
        'PREVIEW coverage must be empty with zero processed units');
    }
    if (run.brain_id === 'B9') {
      ['candidate_ids', 'support_ids', 'opposition_ids', 'exclusion_ids', 'finding_ids'].forEach(function (key) {
        addError(errors, Array.isArray(run[key]) && run[key].length === 0, 'B9 cannot emit ' + key);
      });
    }
    return { valid: errors.length === 0, errors: errors };
  }
  function createBrainRunRecord(spec) {
    var record = cloneWithSchema(spec, SCHEMAS.BRAIN_RUN_RECORD);
    ['candidate_ids', 'support_ids', 'opposition_ids', 'exclusion_ids', 'recommendation_ids', 'finding_ids', 'uncertainties', 'rule_hits'].forEach(function (key) {
      if (typeof record[key] === 'undefined') record[key] = [];
    });
    return finish(record, validateBrainRunRecord(record).errors);
  }

  function validateRuleResult(result, label, errors) {
    addError(errors, isPlainRecord(result), label + ' must be a plain record');
    if (!isPlainRecord(result)) return;
    addError(errors, REVIEW_STATUSES.indexOf(result.status) !== -1, label + '.status is not contracted');
    addError(errors, stringArray(result.reasons), label + '.reasons must be a string array');
    addError(errors, result.status === 'NOT_EVALUATED' || (Array.isArray(result.reasons) && result.reasons.length > 0), label + ' evaluated status requires a reason');
  }
  function validatePromotionDecision(decision) {
    var errors = [];
    if (!isPlainRecord(decision)) return { valid: false, errors: ['PromotionDecision must be a plain object'] };
    addError(errors, decision.schema === SCHEMAS.PROMOTION_DECISION, 'wrong PromotionDecision schema');
    addError(errors, nonEmptyString(decision.decision_id) && nonEmptyString(decision.candidate_id), 'decision_id and candidate_id are required');
    for (var i = 1; i <= 7; i++) validateRuleResult(decision['P' + i], 'P' + i, errors);
    addError(errors, stringArray(decision.failed_rules), 'failed_rules must be a string array');
    var expectedFailedRules = [];
    for (var f = 1; f <= 7; f++) {
      var rule = decision['P' + f];
      if (isPlainRecord(rule) && (rule.status === 'FAIL' || rule.status === 'INSUFFICIENT')) expectedFailedRules.push('P' + f);
    }
    addError(errors, stringArray(decision.failed_rules) && C.stableStringify(decision.failed_rules) === C.stableStringify(expectedFailedRules),
      'failed_rules must exactly list every FAIL/INSUFFICIENT P-rule in P1–P7 order');
    addError(errors, decision.supported_proposition === null || nonEmptyString(decision.supported_proposition), 'supported_proposition must be text or null');
    addError(errors, isPlainRecord(decision.independence_analysis), 'independence_analysis must be a record');
    if (isPlainRecord(decision.independence_analysis)) {
      addError(errors, ['REVIEWED', 'NOT_EVALUATED'].indexOf(decision.independence_analysis.status) !== -1, 'independence_analysis.status is not contracted');
      addError(errors, Array.isArray(decision.independence_analysis.shared_origins), 'independence_analysis.shared_origins must be an array');
      addError(errors, decision.independence_analysis.status !== 'REVIEWED' || nonEmptyString(decision.independence_analysis.rationale), 'reviewed independence analysis requires a rationale');
    }
    addError(errors, nonEmptyString(decision.reviewer) && nonEmptyString(decision.rule_version), 'reviewer and rule_version are required');
    addError(errors, ['NOT_EVALUATED', 'PROMOTED', 'REJECTED', 'DEMOTED'].indexOf(decision.decision) !== -1, 'decision is not contracted');
    addError(errors, stringArray(decision.reasons), 'reasons must be a string array');
    if (decision.decision === 'PROMOTED') {
      for (var p = 1; p <= 7; p++) addError(errors, decision['P' + p] && decision['P' + p].status === 'PASS', 'PROMOTED requires P' + p + ' PASS');
      addError(errors, Array.isArray(decision.failed_rules) && decision.failed_rules.length === 0 && nonEmptyString(decision.supported_proposition), 'PROMOTED requires no failed rules and a bounded proposition');
      addError(errors, isPlainRecord(decision.independence_analysis) && decision.independence_analysis.status === 'REVIEWED', 'PROMOTED requires reviewed independence analysis');
    }
    if (decision.decision === 'NOT_EVALUATED') {
      for (var n = 1; n <= 7; n++) addError(errors, decision['P' + n] && decision['P' + n].status === 'NOT_EVALUATED', 'NOT_EVALUATED requires every P-rule NOT_EVALUATED');
      addError(errors, decision.supported_proposition === null, 'NOT_EVALUATED cannot assert a supported proposition');
      addError(errors, isPlainRecord(decision.independence_analysis) && decision.independence_analysis.status === 'NOT_EVALUATED', 'NOT_EVALUATED promotion requires independence analysis NOT_EVALUATED');
    }
    return { valid: errors.length === 0, errors: errors };
  }
  function createPromotionDecision(spec) {
    var record = cloneWithSchema(spec, SCHEMAS.PROMOTION_DECISION);
    return finish(record, validatePromotionDecision(record).errors);
  }

  function validateFindingAudit(audit, sourceTexts) {
    var errors = [];
    if (!isPlainRecord(audit)) return { valid: false, errors: ['FindingAudit must be a plain object'] };
    addError(errors, audit.schema === SCHEMAS.FINDING_AUDIT, 'wrong FindingAudit schema');
    addError(errors, nonEmptyString(audit.audit_id) && nonEmptyString(audit.original_finding_id), 'audit_id and original_finding_id are required');
    addError(errors, BRAIN_IDS.indexOf(audit.brain_id) !== -1 && audit.brain_id !== 'B9', 'finding audit brain must be eligible B1–B8');
    addError(errors, nonEmptyString(audit.type_id), 'type_id is required');
    addError(errors, stringArray(audit.actors), 'actors must be a string array');
    addError(errors, uniqueStrings(audit.source_evidence_ids), 'source_evidence_ids must be non-empty and unique');
    addError(errors, plainRecordArray(audit.source_anchors) && audit.source_anchors.length > 0,
      'source_anchors must contain at least one valid evidence-linked anchor');
    if (Array.isArray(audit.source_anchors)) {
      for (var i = 0; i < audit.source_anchors.length; i++) {
        var anchor = audit.source_anchors[i];
        if (!isPlainRecord(anchor)) continue;
        addError(errors, nonEmptyString(anchor.evidence_id) && Array.isArray(audit.source_evidence_ids) && audit.source_evidence_ids.indexOf(anchor.evidence_id) !== -1,
          'each source anchor must link to a listed source_evidence_id');
        try {
          var anchorResult = validateAnyAnchor(anchor, sourceTextFor(sourceTexts, anchor.evidence_id));
          for (var a = 0; a < anchorResult.errors.length; a++) errors.push('source_anchors[' + i + ']: ' + anchorResult.errors[a]);
        } catch (error) {
          errors.push('source_anchors[' + i + '] is malformed: ' + error.message);
        }
      }
    }
    addError(errors, plainRecordArray(audit.supporting_excerpts) && plainRecordArray(audit.rule_hits), 'supporting_excerpts and rule_hits must contain records');
    ['contradiction_checks', 'corroboration_checks', 'exclusion_checks', 'uncertainties', 'promotion_reasons', 'demotion_reasons'].forEach(function (key) {
      addError(errors, stringArray(audit[key]), key + ' must be a string array');
    });
    if (hasOwn(audit, 'development_scores')) {
      addError(errors, isPlainRecord(audit.development_scores), 'development_scores must be a record when present');
      addError(errors, isPlainRecord(audit.development_scores) && audit.development_scores.disclosure === 'DEVELOPMENT_ONLY_NOT_PRODUCTION_CONFIDENCE',
        'development scores require explicit non-production disclosure');
    }
    return { valid: errors.length === 0, errors: errors };
  }
  function createFindingAudit(spec, sourceTexts) {
    var record = cloneWithSchema(spec, SCHEMAS.FINDING_AUDIT);
    return finish(record, validateFindingAudit(record, sourceTexts).errors);
  }

  function validateGuardianDecision(guardian) {
    var errors = [];
    if (!isPlainRecord(guardian)) return { valid: false, errors: ['GuardianDecision must be a plain object'] };
    addError(errors, guardian.schema === SCHEMAS.GUARDIAN_DECISION, 'wrong GuardianDecision schema');
    addError(errors, nonEmptyString(guardian.guardian_id), 'guardian_id is required');
    addError(errors, validHash(guardian.constitution_sha512) && nonEmptyString(guardian.constitution_version), 'exact Constitution identity is required');
    addError(errors, nonEmptyString(guardian.rule_pack_version), 'rule_pack_version is required');
    addError(errors, safeInteger(guardian.reviewed_count) && safeInteger(guardian.approved_count) && safeInteger(guardian.denied_count), 'guardian counts must be non-negative safe integers');
    addError(errors, plainRecordArray(guardian.items), 'items must contain decision records');
    if (Array.isArray(guardian.items)) {
      var approved = 0, denied = 0;
      var seenFindingIds = Object.create(null);
      for (var i = 0; i < guardian.items.length; i++) {
        var item = guardian.items[i];
        if (!isPlainRecord(item)) {
          errors.push('guardian item ' + i + ' must be a plain record');
          continue;
        }
        addError(errors, nonEmptyString(item.finding_id) && ['APPROVED', 'DENIED', 'LIMITED'].indexOf(item.decision) !== -1 && nonEmptyString(item.reason),
          'each guardian item requires finding_id, decision and reason');
        if (nonEmptyString(item.finding_id)) {
          addError(errors, !hasOwn(seenFindingIds, item.finding_id), 'guardian finding_id values must be unique');
          seenFindingIds[item.finding_id] = true;
        }
        if (item.decision === 'APPROVED') approved++;
        if (item.decision === 'DENIED' || item.decision === 'LIMITED') denied++;
      }
      addError(errors, guardian.reviewed_count === guardian.items.length && guardian.approved_count === approved && guardian.denied_count === denied,
        'guardian counts must reconcile exactly with per-item decisions; LIMITED is not approval');
    }
    addError(errors, plainRecordArray(guardian.overclaim_checks) && plainRecordArray(guardian.source_checks), 'overclaim/source checks must contain records');
    addError(errors, stringArray(guardian.unresolved_limitations), 'unresolved_limitations must be a string array');
    addError(errors, guardian.human_adjudication === 'NOT_ADJUDICATED', 'software guardian review cannot assert human adjudication');
    return { valid: errors.length === 0, errors: errors };
  }
  function createGuardianDecision(spec) {
    var record = cloneWithSchema(spec, SCHEMAS.GUARDIAN_DECISION);
    return finish(record, validateGuardianDecision(record).errors);
  }

  function validateFindingCertification(certification) {
    var errors = [];
    if (!isPlainRecord(certification)) return { valid: false, errors: ['FindingCertification must be a plain object'] };
    addError(errors, certification.schema === SCHEMAS.FINDING_CERTIFICATION, 'wrong FindingCertification schema');
    addError(errors, nonEmptyString(certification.certification_id) && nonEmptyString(certification.finding_id), 'certification_id and finding_id are required');
    ['constitution_sha512', 'run_id', 'evidence_bundle_sha512', 'finding_sha512', 'promotion_sha512'].forEach(function (key) {
      if (key === 'run_id') addError(errors, nonEmptyString(certification[key]), key + ' is required');
      else addError(errors, validHash(certification[key]), key + ' must be a SHA-512 identity');
    });
    addError(errors, nonEmptyString(certification.rule_pack_version) && nonEmptyString(certification.engine_version), 'rule-pack and engine versions are required');
    addError(errors, ['CERTIFIED', 'NOT_CERTIFIED', 'DEMOTED'].indexOf(certification.status) !== -1, 'certification status is not contracted');
    addError(errors, ['APPROVED', 'DENIED', 'LIMITED', 'NOT_EVALUATED'].indexOf(certification.guardian_decision) !== -1, 'guardian_decision is not contracted');
    addError(errors, nonEmptyString(certification.guardian_reason), 'guardian_reason is required');
    addError(errors, nonEmptyString(certification.reproducibility_statement), 'reproducibility_statement is required');
    addError(errors, certification.certification_scope === 'TECHNICAL_REPRODUCIBILITY_ONLY', 'certification must be limited to technical reproducibility');
    addError(errors, certification.human_adjudication === 'NOT_ADJUDICATED', 'certification cannot fabricate human adjudication');
    if (certification.status === 'CERTIFIED') addError(errors, certification.guardian_decision === 'APPROVED', 'CERTIFIED requires guardian APPROVED');
    if (certification.status !== 'CERTIFIED') addError(errors, certification.guardian_decision !== 'APPROVED' || certification.status === 'DEMOTED',
      'NOT_CERTIFIED cannot retain guardian approval; post-approval failure must be DEMOTED');
    return { valid: errors.length === 0, errors: errors };
  }
  function createFindingCertification(spec) {
    var record = cloneWithSchema(spec, SCHEMAS.FINDING_CERTIFICATION);
    return finish(record, validateFindingCertification(record).errors);
  }

  function validateEvidenceBundle(bundle, sourceTexts) {
    var errors = [];
    if (!isPlainRecord(bundle)) return { valid: false, errors: ['EvidenceBundle must be a plain object'] };
    addError(errors, bundle.schema === SCHEMAS.EVIDENCE_BUNDLE, 'wrong EvidenceBundle schema');
    addError(errors, nonEmptyString(bundle.bundle_id), 'bundle_id is required');
    addError(errors, plainRecordArray(bundle.evidence_atoms) && bundle.evidence_atoms.length > 0,
      'evidence_atoms must contain at least one EvidenceAtom record');
    addError(errors, plainRecordArray(bundle.claims), 'claims must contain ClaimRecord records');
    addError(errors, plainRecordArray(bundle.finding_audits), 'finding_audits must contain FindingAudit records');

    var atomsById = Object.create(null);
    if (Array.isArray(bundle.evidence_atoms)) {
      for (var i = 0; i < bundle.evidence_atoms.length; i++) {
        var atom = bundle.evidence_atoms[i];
        if (!isPlainRecord(atom)) continue;
        var atomResult = validateEvidenceAtom(atom, sourceTextFor(sourceTexts, atom.evidence_id));
        for (var a = 0; a < atomResult.errors.length; a++) errors.push('evidence_atoms[' + i + ']: ' + atomResult.errors[a]);
        if (nonEmptyString(atom.evidence_id)) {
          addError(errors, !hasOwn(atomsById, atom.evidence_id), 'EvidenceAtom IDs must be unique');
          if (!hasOwn(atomsById, atom.evidence_id)) atomsById[atom.evidence_id] = atom;
        }
      }
    }
    if (Array.isArray(bundle.claims)) {
      for (var c = 0; c < bundle.claims.length; c++) {
        var claim = bundle.claims[c];
        var claimResult = validateClaimRecord(claim);
        for (var cr = 0; cr < claimResult.errors.length; cr++) errors.push('claims[' + c + ']: ' + claimResult.errors[cr]);
        if (isPlainRecord(claim) && Array.isArray(claim.source_evidence_ids)) {
          for (var ce = 0; ce < claim.source_evidence_ids.length; ce++) {
            addError(errors, nonEmptyString(claim.source_evidence_ids[ce]) && hasOwn(atomsById, claim.source_evidence_ids[ce]),
              'claims[' + c + '] references missing EvidenceAtom ' + String(claim.source_evidence_ids[ce]));
          }
        }
      }
    }
    if (Array.isArray(bundle.finding_audits)) {
      for (var f = 0; f < bundle.finding_audits.length; f++) {
        var audit = bundle.finding_audits[f];
        var auditResult = validateFindingAudit(audit, sourceTexts);
        for (var ar = 0; ar < auditResult.errors.length; ar++) errors.push('finding_audits[' + f + ']: ' + auditResult.errors[ar]);
        if (!isPlainRecord(audit)) continue;
        if (Array.isArray(audit.source_evidence_ids)) {
          for (var ae = 0; ae < audit.source_evidence_ids.length; ae++) {
            addError(errors, nonEmptyString(audit.source_evidence_ids[ae]) && hasOwn(atomsById, audit.source_evidence_ids[ae]),
              'finding_audits[' + f + '] references missing EvidenceAtom ' + String(audit.source_evidence_ids[ae]));
          }
        }
        if (Array.isArray(audit.source_anchors)) {
          for (var s = 0; s < audit.source_anchors.length; s++) {
            var sourceAnchor = audit.source_anchors[s];
            if (!isPlainRecord(sourceAnchor) || !hasOwn(atomsById, sourceAnchor.evidence_id)) continue;
            try {
              var atomAnchor = C.canonicalClone(sourceAnchor);
              delete atomAnchor.evidence_id;
              addError(errors, C.stableStringify(atomAnchor) === C.stableStringify(atomsById[sourceAnchor.evidence_id].anchor),
                'finding_audits[' + f + '] source anchor must exactly match its referenced EvidenceAtom anchor');
            } catch (error) {
              errors.push('finding_audits[' + f + '] source anchor cannot be canonically compared: ' + error.message);
            }
          }
        }
      }
    }
    return { valid: errors.length === 0, errors: errors };
  }
  function createEvidenceBundle(spec, sourceTexts) {
    var record = cloneWithSchema(spec, SCHEMAS.EVIDENCE_BUNDLE);
    return finish(record, validateEvidenceBundle(record, sourceTexts).errors);
  }

  function hashRecordPayload(payload) {
    return C.sha512Hex(C.stableStringify(payload));
  }

  var api = {
    SCHEMAS: SCHEMAS,
    BRAIN_IDS: BRAIN_IDS,
    ENGAGEMENT_STATUSES: ENGAGEMENT_STATUSES,
    REVIEW_STATUSES: REVIEW_STATUSES,
    validateMediaAnchor: validateMediaAnchor,
    validateAnyAnchor: validateAnyAnchor,
    validateEvidenceAtom: validateEvidenceAtom,
    createEvidenceAtom: createEvidenceAtom,
    validateClaimRecord: validateClaimRecord,
    createClaimRecord: createClaimRecord,
    validateBrainRunRecord: validateBrainRunRecord,
    createBrainRunRecord: createBrainRunRecord,
    brainRunOutputPayload: brainRunOutputPayload,
    hashBrainRunOutput: hashBrainRunOutput,
    validatePromotionDecision: validatePromotionDecision,
    createPromotionDecision: createPromotionDecision,
    validateFindingAudit: validateFindingAudit,
    createFindingAudit: createFindingAudit,
    validateGuardianDecision: validateGuardianDecision,
    createGuardianDecision: createGuardianDecision,
    validateFindingCertification: validateFindingCertification,
    createFindingCertification: createFindingCertification,
    validateEvidenceBundle: validateEvidenceBundle,
    createEvidenceBundle: createEvidenceBundle,
    hashRecordPayload: hashRecordPayload
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VONineBrainContracts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
