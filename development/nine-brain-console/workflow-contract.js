'use strict';

/*
 * Axiom-inspired design-by-contract and explicit state transitions for the
 * synthetic development console. This is a deterministic contract audit, not
 * an execution of Axiom/mCRL2, formal verification, or forensic verification.
 */
const { clone, freeze } = require('../nine-brain/util.js');

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

function createWorkflow() {
  return {
    schema: 'vo.development-workflow-contract.v1',
    development_only: true,
    state: 'INITIALIZED',
    history: []
  };
}

function assertEventAllowed(workflow, event) {
  if (!workflow || STATES.indexOf(workflow.state) === -1 ||
      !Object.prototype.hasOwnProperty.call(TRANSITIONS[workflow.state] || {}, event)) {
    throw new Error('Workflow contract rejected ' + String(event) + ' from ' + String(workflow && workflow.state));
  }
}

function transition(workflow, event) {
  assertEventAllowed(workflow, event);
  const from = workflow.state;
  const to = TRANSITIONS[from][event];
  workflow.history.push({ sequence: workflow.history.length + 1, from, event, to });
  workflow.state = to;
  return workflow.state;
}

function check(checks, checkId, passed, reason) {
  checks.push({ check_id: checkId, status: passed ? 'PASS' : 'FAIL', reason });
}

function exactBrains(pass) {
  return Array.isArray(pass) && pass.length === 9 &&
    pass.every((item, index) => item && item.brain_id === BRAIN_IDS[index]);
}

function auditSession(session) {
  const checks = [];
  const workflow = session && session.workflow;
  const run = session && session.run;
  const panel = session && session.panel;
  const history = session && session.store && typeof session.store.history === 'function'
    ? session.store.history(session.candidate.candidate_id) : [];
  const events = session && Array.isArray(session.events) ? session.events : [];
  const transitions = workflow && Array.isArray(workflow.history) ? workflow.history : [];
  const state = workflow && workflow.state;

  const canonical = !!run && exactBrains(run.first_pass) && exactBrains(run.second_pass);
  check(checks, 'WF-01-CANONICAL-BRAINS', canonical,
    'Both passes must contain exactly B1–B9 in canonical order.');

  const bounded = !!run && run.development_only === true && run.default_off === true &&
    run.release_flags && Object.values(run.release_flags).every((flag) => flag === false);
  check(checks, 'WF-02-DEVELOPMENT-BOUNDARY', bounded,
    'Development-only mode and every default-off release flag must remain intact.');

  let stateValid = STATES.indexOf(state) !== -1;
  if (state === 'INITIALIZED') stateValid = !panel && !session.disposition && !session.narrative && !session.annex;
  if (state === 'ORCHESTRATION_COMPLETE') stateValid = !!run && !panel && !session.disposition && !session.narrative && !session.annex;
  if (state === 'TECHNICAL_REVIEW_COMPLETE') stateValid = !!panel && !session.disposition && !session.narrative && !session.annex;
  if (state === 'HUMAN_DISPOSITION_COMMITTED') stateValid = !!panel && !!session.disposition && !session.narrative && !session.annex;
  if (state === 'ANNEX_PREPARED') stateValid = !!panel && !!session.disposition && !!session.narrative && !!session.annex;
  check(checks, 'WF-03-STATE-PRECONDITIONS', stateValid,
    'The current state must contain exactly the records required by its stage contract.');

  const reviews = panel && Array.isArray(panel.reviews) ? panel.reviews : [];
  const origins = reviews.map((review) => review && review.reviewer_origin);
  const expectedSlots = ['responsible_brain', 'mistral', 'deepseek'];
  const seatsValid = !panel || (reviews.length === 3 &&
    reviews.every((review, index) => review && review.reviewer_slot === expectedSlots[index]) &&
    new Set(origins).size === 3 && origins.every((origin) => typeof origin === 'string' && origin.length > 0));
  const supportedValid = !panel || panel.status !== PANEL_PASS ||
    (panel.errors.length === 0 && reviews.every((review) => review.status === 'PASS' &&
      review.source_test === 'PASS' && review.context_test === 'PASS' && review.independence_test === 'PASS'));
  check(checks, 'WF-04-THREE-SEAT-INTEGRITY', seatsValid && supportedValid,
    'Three distinct technical seats are required; supported status requires every seat and test to pass.');

  const providerCalls = session && Array.isArray(session.providerCalls) ? session.providerCalls : [];
  const isolated = reviews.every((review) => review.cross_reviewer_context_received === false && review.independent_submission === true) &&
    providerCalls.every((call) => call.mocked === true && call.other_reviewer_response_received === false);
  check(checks, 'WF-05-REVIEWER-ISOLATION', isolated,
    'External seats must remain isolated; synthetic transports must be mocked and carry no other-reviewer response.');

  const b4 = run && run.second_pass.find((item) => item.brain_id === 'B4');
  const b9 = run && run.second_pass.find((item) => item.brain_id === 'B9');
  const authorityValid = !!b4 && !!b9 && b4.finding_ids.length === 0 && b9.finding_ids.length === 0 &&
    b4.candidate_ids.length === 0 && b9.candidate_ids.length === 0;
  check(checks, 'WF-06-ADVISORY-AUTHORITY', authorityValid,
    'B4 may supply support only and B9 recommendations only; neither may issue second-pass findings.');

  const confirmedAfterFailure = !!panel && panel.status !== PANEL_PASS &&
    history.some((item) => item.disposition === 'CONFIRMED');
  check(checks, 'WF-07-FAIL-CLOSED-CONFIRMATION', !confirmedAfterFailure,
    'A failed, dissenting, unavailable or malformed panel must never acquire human CONFIRMED status.');

  const annexValid = !session.annex || (session.annex.sealed === false && session.annex.blockchain_anchor === null &&
    session.annex.production_report_modified === false && session.annex.production_seal_modified === false);
  check(checks, 'WF-08-PRODUCTION-IMMUTABILITY', annexValid,
    'Any prepared annex must remain unsealed, unanchored and outside production reports and seals.');

  const eventSequenceValid = events.every((event, index) => event && event.sequence === index + 1);
  const transitionSequenceValid = transitions.every((item, index) => item && item.sequence === index + 1 &&
    STATES.indexOf(item.from) !== -1 && TRANSITIONS[item.from] && TRANSITIONS[item.from][item.event] === item.to) &&
    transitions.every((item, index) => index === 0 || transitions[index - 1].to === item.from) &&
    (transitions.length === 0 ? state === 'INITIALIZED' : transitions[transitions.length - 1].to === state);
  check(checks, 'WF-09-ORDERED-AUDIT', eventSequenceValid && transitionSequenceValid,
    'Execution events and legal workflow transitions must be contiguous, ordered and reconcile with the current state.');

  return freeze({
    schema: 'vo.development-workflow-audit.v1',
    development_only: true,
    method: 'DETERMINISTIC_STATE_AND_CONTRACT_AUDIT',
    status: checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
    current_state: STATES.indexOf(state) === -1 ? 'INVALID' : state,
    allowed_events: Object.keys(TRANSITIONS[state] || {}),
    axiom_formal_verification_executed: false,
    forensic_truth_verified: false,
    legal_conclusion: false,
    checks,
    transition_history: clone(transitions)
  });
}

module.exports = {
  STATES, EVENTS, TRANSITIONS,
  createWorkflow, assertEventAllowed, transition, auditSession
};
