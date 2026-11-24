import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const Lab = require('../development/nine-brain-console/runner.js');
const W = require('../development/nine-brain-console/workflow-contract.js');

console.log('======================================================');
console.log('RUN  nine-brain-workflow-contract.test.mjs');
console.log('======================================================\n');

function copySession(session) {
  return { ...JSON.parse(JSON.stringify(session)), store: session.store };
}

function failedCheck(audit, checkId) {
  const check = audit.checks.find((item) => item.check_id === checkId);
  return audit.status === 'FAIL' && check && check.status === 'FAIL';
}

const initial = Lab.createConsoleSession();
const initialAudit = Lab.getWorkflowAudit(initial);
ok(initialAudit.status === 'PASS' && initialAudit.current_state === 'INITIALIZED', 'Initial synthetic session satisfies its stage contract');
ok(initialAudit.checks.length === 9 && initialAudit.checks.every((item) => item.status === 'PASS'), 'All nine workflow contract checks pass at initialization');
ok(initialAudit.allowed_events.join(',') === 'RUN_ORCHESTRATION', 'Initialization permits only the orchestration transition');
ok(initialAudit.axiom_formal_verification_executed === false && initialAudit.forensic_truth_verified === false && initialAudit.legal_conclusion === false, 'Audit expressly disclaims Axiom formal verification, forensic truth and legal conclusions');
ok(throws(() => W.transition(initial.workflow, W.EVENTS.PREPARE_ANNEX)), 'State machine rejects annex preparation at initialization');
ok(initial.workflow.state === 'INITIALIZED' && initial.workflow.history.length === 0, 'Rejected transition leaves state and history unchanged');
let prematureReviewRejected = false;
try { await Lab.runTechnicalReview(initial, 'all-pass'); }
catch (error) { prematureReviewRejected = error.message.includes('Workflow contract rejected'); }
ok(prematureReviewRejected, 'Runner contract blocks technical review before orchestration');
ok(throws(() => W.transition(initial.workflow, 'UNKNOWN_EVENT')), 'Unknown workflow events fail closed');

Lab.runOrchestration(initial);
ok(initial.workflow.state === 'ORCHESTRATION_COMPLETE' && initial.workflow.history.length === 1, 'Orchestration records one legal transition');
ok(Lab.getWorkflowAudit(initial).status === 'PASS', 'Contract audit passes after orchestration');
ok(initial.workflow.history[0].from === 'INITIALIZED' && initial.workflow.history[0].to === 'ORCHESTRATION_COMPLETE', 'Transition history records exact source and destination');

for (const scenario of ['dissent', 'unavailable', 'malformed']) {
  const session = Lab.createConsoleSession();
  Lab.runOrchestration(session);
  await Lab.runTechnicalReview(session, scenario);
  ok(session.workflow.state === 'TECHNICAL_REVIEW_COMPLETE', scenario + ' enters the technical-review state');
  ok(Lab.getWorkflowAudit(session).status === 'PASS', scenario + ' preserves a valid failed-closed software workflow');
  ok(throws(() => Lab.commitHumanDisposition(session, {
    adjudicator: 'Synthetic human', disposition: 'CONFIRMED', reason: 'Attempted contract bypass'
  })), scenario + ' still rejects CONFIRMED at the adjudication boundary');
  const audit = Lab.getWorkflowAudit(session);
  ok(audit.status === 'PASS' && audit.checks.find((item) => item.check_id === 'WF-07-FAIL-CLOSED-CONFIRMATION').status === 'PASS', scenario + ' records no confirmation after a failed panel');
  const exported = Lab.exportSession(session);
  ok(exported.workflow_contract.status === 'PASS' && exported.workflow_contract.transition_history.length === 2, scenario + ' export includes its passing workflow audit and exact transitions');
}

const session = Lab.createConsoleSession();
Lab.runOrchestration(session);
await Lab.runTechnicalReview(session, 'all-pass');
Lab.commitHumanDisposition(session, {
  adjudicator: 'Synthetic human', disposition: 'CONFIRMED',
  reason: 'Separate human adjudication after three passing synthetic technical reviews.'
});
ok(session.workflow.state === 'HUMAN_DISPOSITION_COMMITTED', 'Human adjudication advances to its own explicit state');
Lab.approveNarrativeAndPrepareAnnex(session, 'Synthetic approver');
const complete = Lab.getWorkflowAudit(session);
ok(session.workflow.state === 'ANNEX_PREPARED' && complete.status === 'PASS', 'Complete all-pass workflow passes every contract check');
ok(complete.transition_history.map((item) => item.event).join(',') === 'RUN_ORCHESTRATION,RUN_TECHNICAL_REVIEW,COMMIT_HUMAN_DISPOSITION,PREPARE_ANNEX', 'Complete workflow retains the four legal transitions in order');
ok(complete.allowed_events.includes('RUN_ORCHESTRATION') && complete.allowed_events.includes('RUN_TECHNICAL_REVIEW') && complete.allowed_events.includes('COMMIT_HUMAN_DISPOSITION') && complete.allowed_events.includes('PREPARE_ANNEX'), 'Only deliberate rerun and downstream transitions remain available');

const releaseTamper = copySession(session);
releaseTamper.run.release_flags.production_promotion = true;
ok(failedCheck(Lab.getWorkflowAudit(releaseTamper), 'WF-02-DEVELOPMENT-BOUNDARY'), 'Audit detects any enabled production release flag');

const brainTamper = copySession(session);
brainTamper.run.second_pass[8].finding_ids.push('unauthorised-b9-finding');
ok(failedCheck(Lab.getWorkflowAudit(brainTamper), 'WF-06-ADVISORY-AUTHORITY'), 'Audit detects B9 acquiring finding authority');

const orderTamper = copySession(session);
orderTamper.run.first_pass.reverse();
ok(failedCheck(Lab.getWorkflowAudit(orderTamper), 'WF-01-CANONICAL-BRAINS'), 'Audit detects altered canonical brain ordering');

const reviewerTamper = copySession(session);
reviewerTamper.panel.reviews[2].reviewer_origin = reviewerTamper.panel.reviews[1].reviewer_origin;
ok(failedCheck(Lab.getWorkflowAudit(reviewerTamper), 'WF-04-THREE-SEAT-INTEGRITY'), 'Audit detects duplicate reviewer origins');

const contextTamper = copySession(session);
contextTamper.panel.reviews[1].cross_reviewer_context_received = true;
ok(failedCheck(Lab.getWorkflowAudit(contextTamper), 'WF-05-REVIEWER-ISOLATION'), 'Audit detects cross-reviewer context');

const stateTamper = copySession(session);
stateTamper.workflow.state = 'ANNEX_PREPARED';
stateTamper.annex = null;
ok(failedCheck(Lab.getWorkflowAudit(stateTamper), 'WF-03-STATE-PRECONDITIONS'), 'Audit detects a state whose required annex is absent');

const annexTamper = copySession(session);
annexTamper.annex.sealed = true;
ok(failedCheck(Lab.getWorkflowAudit(annexTamper), 'WF-08-PRODUCTION-IMMUTABILITY'), 'Audit detects an annex claiming to be sealed');

const transitionTamper = copySession(session);
transitionTamper.workflow.history[1].event = 'PREPARE_ANNEX';
ok(failedCheck(Lab.getWorkflowAudit(transitionTamper), 'WF-09-ORDERED-AUDIT'), 'Audit detects an illegal transition inserted into history');

const eventTamper = copySession(session);
eventTamper.events[1].sequence = 99;
ok(failedCheck(Lab.getWorkflowAudit(eventTamper), 'WF-09-ORDERED-AUDIT'), 'Audit detects non-contiguous execution-event sequencing');

const frozenWorkflow = W.createWorkflow();
W.transition(frozenWorkflow, W.EVENTS.RUN_ORCHESTRATION);
W.transition(frozenWorkflow, W.EVENTS.RUN_TECHNICAL_REVIEW);
ok(throws(() => W.transition(frozenWorkflow, W.EVENTS.PREPARE_ANNEX)), 'Direct state-machine use cannot skip human adjudication');
W.transition(frozenWorkflow, W.EVENTS.COMMIT_HUMAN_DISPOSITION);
W.transition(frozenWorkflow, W.EVENTS.PREPARE_ANNEX);
ok(frozenWorkflow.state === 'ANNEX_PREPARED' && frozenWorkflow.history.length === 4, 'Direct state-machine use permits the complete legal sequence');

done('nine-brain-workflow-contract');
