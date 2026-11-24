'use strict';

/*
 * Axiom-inspired design-by-contract and explicit state transitions for the
 * synthetic development console. This is a deterministic contract audit, not
 * an execution of Axiom/mCRL2, formal verification, or forensic verification.
 */
const C = require('../../analysis-contracts.js');
const O = require('../nine-brain/orchestration.js');
const V = require('../nine-brain/verification.js');
const {
  clone, freeze, hash, id, plain, safeValidate, SHA512_RE
} = require('../nine-brain/util.js');

const STATES = freeze([
  'INITIALIZED',
  'ORCHESTRATION_COMPLETE',
  'TECHNICAL_REVIEW_COMPLETE',
  'HUMAN_DISPOSITION_COMMITTED',
  'ANNEX_PREPARED'
]);
const EVENTS = freeze({
  RUN_ORCHESTRATION: 'RUN_ORCHESTRATION',
  RUN_TECHNICAL_REVIEW: 'RUN_TECHNICAL_REVIEW',
  COMMIT_HUMAN_DISPOSITION: 'COMMIT_HUMAN_DISPOSITION',
  PREPARE_ANNEX: 'PREPARE_ANNEX'
});
const TRANSITIONS = freeze({
  INITIALIZED: freeze({ RUN_ORCHESTRATION: 'ORCHESTRATION_COMPLETE' }),
  ORCHESTRATION_COMPLETE: freeze({
    RUN_ORCHESTRATION: 'ORCHESTRATION_COMPLETE',
    RUN_TECHNICAL_REVIEW: 'TECHNICAL_REVIEW_COMPLETE'
  }),
  TECHNICAL_REVIEW_COMPLETE: freeze({
    RUN_ORCHESTRATION: 'ORCHESTRATION_COMPLETE',
    RUN_TECHNICAL_REVIEW: 'TECHNICAL_REVIEW_COMPLETE',
    COMMIT_HUMAN_DISPOSITION: 'HUMAN_DISPOSITION_COMMITTED'
  }),
  HUMAN_DISPOSITION_COMMITTED: freeze({
    RUN_ORCHESTRATION: 'ORCHESTRATION_COMPLETE',
    RUN_TECHNICAL_REVIEW: 'TECHNICAL_REVIEW_COMPLETE',
    COMMIT_HUMAN_DISPOSITION: 'HUMAN_DISPOSITION_COMMITTED',
    PREPARE_ANNEX: 'ANNEX_PREPARED'
  }),
  ANNEX_PREPARED: freeze({
    RUN_ORCHESTRATION: 'ORCHESTRATION_COMPLETE',
    RUN_TECHNICAL_REVIEW: 'TECHNICAL_REVIEW_COMPLETE',
    COMMIT_HUMAN_DISPOSITION: 'HUMAN_DISPOSITION_COMMITTED',
    PREPARE_ANNEX: 'ANNEX_PREPARED'
  })
});
const BRAIN_IDS = freeze(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9']);
const PANEL_PASS = 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION';
const RELEASE_FLAG_KEYS = freeze(Object.keys(O.RELEASE_FLAGS).sort(C.compareStrings));
const PANEL_STATUSES = freeze(['FAIL', PANEL_PASS]);
const EXPECTED_SLOTS = freeze(['responsible_brain', 'mistral', 'deepseek']);

function emptyCurrent() {
  return {
    run_sha512: null,
    packet_sha512: null,
    review_id: null,
    panel_sha512: null,
    disposition_sha512: null,
    narrative_sha512: null,
    annex_sha512: null
  };
}

function createWorkflow() {
  return {
    schema: 'vo.development-workflow-contract.v1',
    development_only: true,
    session_id: 'workflow-session-unassigned',
    state: 'INITIALIZED',
    generation: 0,
    current: emptyCurrent(),
    history: []
  };
}

function assertEventAllowed(workflow, event) {
  if (!plain(workflow) || STATES.indexOf(workflow.state) === -1 ||
      !Object.prototype.hasOwnProperty.call(TRANSITIONS[workflow.state] || {}, event)) {
    throw new Error('Workflow contract rejected ' + String(event) + ' from ' + String(workflow && workflow.state));
  }
}

function validSha(value) {
  return typeof value === 'string' && SHA512_RE.test(value);
}

function requiredSha(context, key) {
  if (!plain(context) || !validSha(context[key])) {
    throw new TypeError('Workflow transition requires a valid ' + key);
  }
}

function transition(workflow, event, context) {
  assertEventAllowed(workflow, event);
  if (!plain(workflow.current) || !Number.isSafeInteger(workflow.generation) || workflow.generation < 0 ||
      !Array.isArray(workflow.history)) {
    throw new TypeError('Workflow state is malformed');
  }
  const supplied = plain(context) ? clone(context) : {};
  const current = workflow.current;
  if (event === EVENTS.RUN_ORCHESTRATION) {
    requiredSha(supplied, 'run_sha512');
    requiredSha(supplied, 'packet_sha512');
  } else if (event === EVENTS.RUN_TECHNICAL_REVIEW) {
    requiredSha(supplied, 'packet_sha512');
    requiredSha(supplied, 'panel_sha512');
    if (!validSha(current.run_sha512) || supplied.packet_sha512 !== current.packet_sha512 ||
        supplied.session_id !== workflow.session_id ||
        typeof supplied.review_id !== 'string' || !supplied.review_id) {
      throw new Error('Technical review must bind to the current orchestration generation and packet');
    }
  } else if (event === EVENTS.COMMIT_HUMAN_DISPOSITION) {
    requiredSha(supplied, 'disposition_sha512');
    if (!validSha(current.panel_sha512) || supplied.panel_sha512 !== current.panel_sha512 ||
        supplied.review_id !== current.review_id || supplied.generation !== workflow.generation) {
      throw new Error('Disposition must bind to the current generation, review and panel');
    }
  } else if (event === EVENTS.PREPARE_ANNEX) {
    requiredSha(supplied, 'narrative_sha512');
    requiredSha(supplied, 'annex_sha512');
    if (!validSha(current.disposition_sha512) || supplied.disposition_sha512 !== current.disposition_sha512 ||
        supplied.review_id !== current.review_id || supplied.generation !== workflow.generation) {
      throw new Error('Annex must bind to the current generation, review and disposition');
    }
  }

  const from = workflow.state;
  const to = TRANSITIONS[from][event];
  if (event === EVENTS.RUN_ORCHESTRATION) {
    workflow.generation += 1;
    workflow.current = {
      run_sha512: supplied.run_sha512,
      packet_sha512: supplied.packet_sha512,
      review_id: null,
      panel_sha512: null,
      disposition_sha512: null,
      narrative_sha512: null,
      annex_sha512: null
    };
  } else if (event === EVENTS.RUN_TECHNICAL_REVIEW) {
    workflow.current.review_id = supplied.review_id;
    workflow.current.panel_sha512 = supplied.panel_sha512;
    workflow.current.disposition_sha512 = null;
    workflow.current.narrative_sha512 = null;
    workflow.current.annex_sha512 = null;
  } else if (event === EVENTS.COMMIT_HUMAN_DISPOSITION) {
    workflow.current.disposition_sha512 = supplied.disposition_sha512;
    workflow.current.narrative_sha512 = null;
    workflow.current.annex_sha512 = null;
  } else {
    workflow.current.narrative_sha512 = supplied.narrative_sha512;
    workflow.current.annex_sha512 = supplied.annex_sha512;
  }
  const entry = {
    sequence: workflow.history.length + 1,
    session_id: workflow.session_id,
    generation: workflow.generation,
    from,
    event,
    to,
    context: supplied
  };
  workflow.history.push(entry);
  workflow.state = to;
  return workflow.state;
}

function check(checks, checkId, passed, reason) {
  checks.push({ check_id: checkId, status: passed ? 'PASS' : 'FAIL', reason });
}

function exactBrains(pass) {
  return Array.isArray(pass) && pass.length === BRAIN_IDS.length &&
    pass.every((item, index) => plain(item) && item.brain_id === BRAIN_IDS[index]);
}

function exactReleaseFlags(flags) {
  if (!plain(flags)) return false;
  const keys = Object.keys(flags).sort(C.compareStrings);
  return C.stableStringify(keys) === C.stableStringify(RELEASE_FLAG_KEYS) &&
    keys.every((key) => flags[key] === false);
}

function currentGeneration(workflow, record) {
  return !!record && record.workflow_generation === workflow.generation &&
    record.review_id === workflow.current.review_id &&
    record.workflow_session_id === workflow.session_id;
}

function validDispositionHistory(history, candidateId) {
  if (!Array.isArray(history)) return false;
  let prior = null;
  for (const item of history) {
    if (!plain(item) || !safeValidate(V.validateDisposition, item).valid ||
        item.candidate_id !== candidateId ||
        item.previous_disposition_sha512 !== (prior ? prior.disposition_sha512 : null)) return false;
    prior = item;
  }
  return true;
}

function validateAnnex(annex, session, workflow) {
  if (!plain(annex) || !session.panel || !session.disposition || !session.narrative) return false;
  if (annex.development_only !== true || annex.default_off !== true ||
      annex.sealed !== false || annex.blockchain_anchor !== null ||
      annex.production_report_modified !== false || annex.production_seal_modified !== false ||
      annex.sealing_status !== 'READY_FOR_EXISTING_EXTERNAL_SEALER') return false;
  if (annex.candidate_id !== session.candidate.candidate_id ||
      annex.committed_disposition_revision !== session.disposition.revision ||
      annex.committed_disposition_sha512 !== session.disposition.disposition_sha512 ||
      C.stableStringify(annex.panel) !== C.stableStringify(session.panel) ||
      C.stableStringify(annex.disposition) !== C.stableStringify(session.disposition) ||
      C.stableStringify(annex.narrative) !== C.stableStringify(session.narrative)) return false;
  const copy = clone(annex);
  delete copy.annex_id;
  delete copy.annex_sha512;
  if (annex.annex_id !== id('vo.verification-annex.v1', 'ANNEX', copy)) return false;
  const digestCopy = clone(annex);
  delete digestCopy.annex_sha512;
  if (!validSha(annex.annex_sha512) || hash(digestCopy) !== annex.annex_sha512) return false;
  return currentGeneration(workflow, session.disposition) &&
    workflow.current.annex_sha512 === annex.annex_sha512 &&
    workflow.current.narrative_sha512 === session.narrative.narrative_sha512;
}

function auditSession(session) {
  const checks = [];
  const safeSession = plain(session) ? session : {};
  const workflow = plain(safeSession.workflow) ? safeSession.workflow : {};
  const run = safeSession.run;
  const panel = safeSession.panel;
  const candidate = plain(safeSession.candidate) ? safeSession.candidate : {};
  const store = safeSession.store;
  const events = Array.isArray(safeSession.events) ? safeSession.events : [];
  const transitions = Array.isArray(workflow.history) ? workflow.history : [];
  const state = workflow.state;
  const current = plain(workflow.current) ? workflow.current : {};
  let dispositionHistory = [];
  try {
    if (store && typeof store.history === 'function' && typeof candidate.candidate_id === 'string') {
      dispositionHistory = store.history(candidate.candidate_id);
    }
  } catch (error) {
    dispositionHistory = null;
  }

  const brainsValid = exactBrains(run && run.first_pass) && exactBrains(run && run.second_pass);
  check(checks, 'WF-01-CANONICAL-BRAINS', brainsValid,
    'Both passes must contain exactly B1–B9 in canonical order.');

  const runValid = safeValidate(O.validateDevelopmentRun, run).valid;
  const bounded = runValid && run.development_only === true && run.default_off === true &&
    exactReleaseFlags(run.release_flags);
  check(checks, 'WF-02-DEVELOPMENT-BOUNDARY', bounded,
    'The development run must validate, include exactly the known release flags, and keep every flag false.');

  const generationValid = Number.isSafeInteger(workflow.generation) && workflow.generation >= 0 &&
    plain(workflow.current) && workflow.schema === 'vo.development-workflow-contract.v1' &&
    workflow.development_only === true && typeof workflow.session_id === 'string' &&
    workflow.session_id.length > 0;
  let stateValid = generationValid && STATES.indexOf(state) !== -1;
  if (state === 'INITIALIZED') {
    stateValid = stateValid && workflow.generation === 0 && !panel && !safeSession.disposition &&
      !safeSession.narrative && !safeSession.annex && current.run_sha512 === null;
  }
  if (state === 'ORCHESTRATION_COMPLETE') {
    stateValid = stateValid && !!run && !panel && !safeSession.disposition &&
      !safeSession.narrative && !safeSession.annex &&
      current.run_sha512 === run.run_sha512 && current.packet_sha512 === (safeSession.packet && safeSession.packet.packet_sha512) &&
      current.review_id === null && current.panel_sha512 === null;
  }
  if (state === 'TECHNICAL_REVIEW_COMPLETE') {
    stateValid = stateValid && !!panel && !safeSession.disposition &&
      !safeSession.narrative && !safeSession.annex &&
      current.packet_sha512 === (safeSession.packet && safeSession.packet.packet_sha512) &&
      current.panel_sha512 === panel.panel_sha512 && typeof current.review_id === 'string';
  }
  if (state === 'HUMAN_DISPOSITION_COMMITTED') {
    stateValid = stateValid && !!panel && !!safeSession.disposition &&
      !safeSession.narrative && !safeSession.annex &&
      current.panel_sha512 === panel.panel_sha512 &&
      current.disposition_sha512 === safeSession.disposition.disposition_sha512 &&
      currentGeneration(workflow, safeSession.disposition);
  }
  if (state === 'ANNEX_PREPARED') {
    stateValid = stateValid && !!panel && !!safeSession.disposition &&
      !!safeSession.narrative && !!safeSession.annex &&
      current.panel_sha512 === panel.panel_sha512 &&
      current.disposition_sha512 === safeSession.disposition.disposition_sha512 &&
      current.narrative_sha512 === safeSession.narrative.narrative_sha512 &&
      current.annex_sha512 === safeSession.annex.annex_sha512 &&
      currentGeneration(workflow, safeSession.disposition);
  }
  check(checks, 'WF-03-STATE-PRECONDITIONS', stateValid,
    'The current generation must contain only records linked to its exact workflow stage.');

  let panelValid = panel === null;
  if (panel) {
    panelValid = safeValidate(V.validatePanel, panel, safeSession.packet).valid &&
      PANEL_STATUSES.includes(panel.status) &&
      panel.packet_sha512 === current.packet_sha512 &&
      Array.isArray(panel.reviews) && panel.reviews.length === EXPECTED_SLOTS.length &&
      panel.reviews.every((review, index) => plain(review) && review.reviewer_slot === EXPECTED_SLOTS[index]) &&
      new Set(panel.reviews.map((review) => review.reviewer_origin)).size === EXPECTED_SLOTS.length;
  }
  const panelPresent = !!panel;
  const b4 = run && Array.isArray(run.second_pass) && run.second_pass.find((item) => item.brain_id === 'B4');
  const b9 = run && Array.isArray(run.second_pass) && run.second_pass.find((item) => item.brain_id === 'B9');
  const supports = run && Array.isArray(run.support_register) ? run.support_register : [];
  const recommendations = run && Array.isArray(run.recommendation_register) ? run.recommendation_register : [];
  const advisoryValid = runValid && !!b4 && !!b9 && [run.first_pass[3], b4].every((item) =>
    item && item.finding_ids.length === 0 && item.candidate_ids.length === 0 &&
    item.recommendation_ids.length === 0 && item.opposition_ids.length === 0 && item.exclusion_ids.length === 0) &&
    [run.first_pass[8], b9].every((item) => item && item.voting === false &&
      item.finding_ids.length === 0 &&
      item.candidate_ids.length === 0 && item.support_ids.length === 0 &&
      item.opposition_ids.length === 0 && item.exclusion_ids.length === 0) &&
    b4.support_ids.length === supports.length && b4.support_ids.every((supportId) =>
      supports.some((support) => support.support_id === supportId && support.support_only === true &&
        support.independent_corroboration === false && support.production_finding === false)) &&
    b9.recommendation_ids.length === recommendations.length &&
    b9.recommendation_ids.every((recommendationId) =>
      recommendations.some((recommendation) => recommendation.recommendation_id === recommendationId &&
        recommendation.brain_id === 'B9' && recommendation.voting === false &&
        recommendation.finding === false && recommendation.authoritative === false));
  check(checks, 'WF-04-THREE-SEAT-INTEGRITY', panelValid,
    'A present panel must validate from trusted lineage, bind to the current packet, and contain exactly the three contracted seats.');
  check(checks, 'WF-05-REVIEWER-ISOLATION', (() => {
    if (!panelPresent) return Array.isArray(safeSession.providerCalls) && safeSession.providerCalls.length === 0;
    const calls = safeSession.providerCalls;
    if (!Array.isArray(calls) || calls.length !== 2 || !panelValid) return false;
    return ['mistral', 'deepseek'].every((provider) => {
      const entries = calls.filter((call) => plain(call) && call.provider === provider);
      const review = panel.reviews.find((item) => item.reviewer_slot === provider);
      return entries.length === 1 && !!review && entries[0].mocked === true &&
        entries[0].other_reviewer_response_received === false &&
        entries[0].session_id === workflow.session_id &&
        entries[0].packet_sha512 === panel.packet_sha512 &&
        entries[0].endpoint === review.endpoint &&
        entries[0].review_id === current.review_id &&
        entries[0].workflow_generation === workflow.generation;
    }) && new Set(calls.map((call) => call.endpoint)).size === 2;
  })(),
  'Exactly one mocked, isolated provider call per external seat must bind to the current generation, review and packet.');

  check(checks, 'WF-06-ADVISORY-AUTHORITY', advisoryValid,
    'B4 may emit support only and B9 recommendations only; neither may issue findings or exercise another role.');

  const currentDisposition = safeSession.disposition;
  const dispositionHistoryValid = validDispositionHistory(dispositionHistory, candidate.candidate_id);
  const dispositionValid = dispositionHistoryValid && (currentDisposition === null ||
    (safeValidate(V.validateDisposition, currentDisposition).valid &&
      currentDisposition.packet_sha512 === (safeSession.packet && safeSession.packet.packet_sha512) &&
      currentDisposition.panel_sha512 === (panel && panel.panel_sha512) &&
      currentGeneration(workflow, currentDisposition) &&
      currentDisposition.workflow_generation === workflow.generation &&
      currentDisposition.workflow_session_id === workflow.session_id &&
      dispositionHistory.some((item) => item.disposition_sha512 === currentDisposition.disposition_sha512)));
  const confirmedFailedPanel = !!panel && panel.status !== PANEL_PASS &&
    !!currentDisposition && currentDisposition.disposition === 'CONFIRMED' &&
    currentDisposition.workflow_generation === workflow.generation &&
    currentDisposition.review_id === current.review_id &&
    currentDisposition.panel_sha512 === panel.panel_sha512 &&
    currentDisposition.packet_sha512 === panel.packet_sha512;
  check(checks, 'WF-07-FAIL-CLOSED-CONFIRMATION', dispositionValid && !confirmedFailedPanel,
    'Only a valid disposition linked to the active review may count; historic confirmations cannot be attributed to a later panel.');

  const narrativeValid = safeSession.narrative === null ||
    (safeValidate(V.validateNarrative, safeSession.narrative, safeSession.packet, currentDisposition).valid &&
      safeSession.narrative.narrative_sha512 === current.narrative_sha512);
  let annexValid = safeSession.annex === null;
  if (!annexValid) {
    try { annexValid = validateAnnex(safeSession.annex, safeSession, workflow); }
    catch (error) { annexValid = false; }
  }
  check(checks, 'WF-08-PRODUCTION-IMMUTABILITY', narrativeValid && annexValid,
    'Narrative and annex must validate against current records and remain unsealed, unanchored, and outside production reports and seals.');

  let eventHistoryValid = generationValid && Array.isArray(workflow.history) &&
    Array.isArray(safeSession.events) && safeSession.busy !== true;
  if (eventHistoryValid) {
    try {
      const replay = createWorkflow();
      replay.session_id = workflow.session_id;
      for (let index = 0; index < transitions.length; index += 1) {
        const item = transitions[index];
        if (!plain(item) || item.sequence !== index + 1 || item.generation !==
            (item.event === EVENTS.RUN_ORCHESTRATION ? replay.generation + 1 : replay.generation) ||
            item.session_id !== workflow.session_id) {
          eventHistoryValid = false;
          break;
        }
        transition(replay, item.event, item.context);
        if (C.stableStringify(replay.history[index]) !== C.stableStringify(item)) {
          eventHistoryValid = false;
          break;
        }
      }
      if (eventHistoryValid && (replay.state !== state || replay.generation !== workflow.generation ||
          C.stableStringify(replay.current) !== C.stableStringify(current))) eventHistoryValid = false;
      if (eventHistoryValid && events.length !== transitions.length + 1) eventHistoryValid = false;
      if (eventHistoryValid) {
        const initial = events[0];
        if (!plain(initial) || initial.sequence !== 1 || initial.kind !== 'SESSION_INITIALIZED' ||
            initial.transition_sequence !== 0 || initial.workflow_generation !== 0 ||
            initial.workflow_session_id !== workflow.session_id) eventHistoryValid = false;
      }
      for (let index = 0; eventHistoryValid && index < transitions.length; index += 1) {
        const event = events[index + 1];
        const item = transitions[index];
        if (!plain(event) || event.sequence !== index + 2 ||
            event.transition_sequence !== item.sequence ||
            event.transition_event !== item.event ||
            event.workflow_generation !== item.generation ||
            event.workflow_session_id !== workflow.session_id) eventHistoryValid = false;
      }
    } catch (error) {
      eventHistoryValid = false;
    }
  }
  check(checks, 'WF-09-ORDERED-AUDIT', eventHistoryValid,
    'Transitions must replay from INITIALIZED, and every ordered execution event must map to exactly one transition and generation.');

  let allowedEvents = [];
  try { allowedEvents = Object.keys(TRANSITIONS[state] || {}); } catch (error) { allowedEvents = []; }
  let transitionHistory = [];
  try { transitionHistory = clone(transitions); } catch (error) { transitionHistory = []; }
  return freeze({
    schema: 'vo.development-workflow-audit.v1',
    development_only: true,
    method: 'DETERMINISTIC_STATE_AND_CONTRACT_AUDIT',
    status: checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
    current_state: STATES.indexOf(state) === -1 ? 'INVALID' : state,
    workflow_generation: Number.isSafeInteger(workflow.generation) ? workflow.generation : null,
    allowed_events: allowedEvents,
    axiom_formal_verification_executed: false,
    forensic_truth_verified: false,
    legal_conclusion: false,
    checks,
    transition_history: transitionHistory
  });
}

module.exports = {
  STATES, EVENTS, TRANSITIONS,
  createWorkflow, assertEventAllowed, transition, auditSession
};
