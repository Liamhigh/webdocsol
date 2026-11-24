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

const b4RoleTamper = copySession(session);
b4RoleTamper.run.second_pass[3].recommendation_ids.push('unauthorised-b4-recommendation');
ok(failedCheck(Lab.getWorkflowAudit(b4RoleTamper), 'WF-06-ADVISORY-AUTHORITY'), 'Audit detects B4 acquiring a B9-only recommendation output');

const b9RoleTamper = copySession(session);
b9RoleTamper.run.second_pass[8].support_ids.push('unauthorised-b9-support');
ok(failedCheck(Lab.getWorkflowAudit(b9RoleTamper), 'WF-06-ADVISORY-AUTHORITY'), 'Audit detects B9 acquiring a B4-only support output');

const orderTamper = copySession(session);
orderTamper.run.first_pass.reverse();
ok(failedCheck(Lab.getWorkflowAudit(orderTamper), 'WF-01-CANONICAL-BRAINS'), 'Audit detects altered canonical brain ordering');

const reviewerTamper = copySession(session);
reviewerTamper.panel.reviews[2].reviewer_origin = reviewerTamper.panel.reviews[1].reviewer_origin;
ok(failedCheck(Lab.getWorkflowAudit(reviewerTamper), 'WF-04-THREE-SEAT-INTEGRITY'), 'Audit detects duplicate reviewer origins');

const fabricatedOrigin = copySession(session);
fabricatedOrigin.panel.reviews[2].reviewer_origin = 'untrusted:synthetic-origin';
ok(failedCheck(Lab.getWorkflowAudit(fabricatedOrigin), 'WF-04-THREE-SEAT-INTEGRITY'), 'Audit rejects a fabricated reviewer origin even when it is distinct');

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

const deletedEvent = copySession(session);
deletedEvent.events.splice(2, 1);
deletedEvent.events.forEach((item, index) => { item.sequence = index + 1; });
ok(failedCheck(Lab.getWorkflowAudit(deletedEvent), 'WF-09-ORDERED-AUDIT'), 'Audit detects a deleted event even after the remaining entries are renumbered');

const skippedStage = copySession(session);
skippedStage.workflow.history.shift();
skippedStage.workflow.history.forEach((item, index) => { item.sequence = index + 1; });
skippedStage.events.splice(1, 1);
skippedStage.events.forEach((item, index) => { item.sequence = index + 1; });
ok(failedCheck(Lab.getWorkflowAudit(skippedStage), 'WF-09-ORDERED-AUDIT'), 'Audit rejects a truncated transition history that attempts to skip orchestration');

const missingFlag = copySession(session);
delete missingFlag.run.release_flags.production_promotion;
ok(failedCheck(Lab.getWorkflowAudit(missingFlag), 'WF-02-DEVELOPMENT-BOUNDARY'), 'Audit detects an omitted release-flag key');

const unknownFlag = copySession(session);
unknownFlag.run.release_flags.unreviewed_production_path = false;
ok(failedCheck(Lab.getWorkflowAudit(unknownFlag), 'WF-02-DEVELOPMENT-BOUNDARY'), 'Audit detects an unknown release-flag key');

const malformedPanel = copySession(session);
malformedPanel.panel.reviews[2].status = 'MAYBE';
malformedPanel.panel.reviews[2].reviewer_slot = 'unknown-seat';
ok(failedCheck(Lab.getWorkflowAudit(malformedPanel), 'WF-04-THREE-SEAT-INTEGRITY'), 'Audit rejects unknown panel statuses and reviewer seats');

const missingProviderCall = copySession(session);
missingProviderCall.providerCalls.pop();
ok(failedCheck(Lab.getWorkflowAudit(missingProviderCall), 'WF-05-REVIEWER-ISOLATION'), 'Audit requires a recorded call for each mocked external reviewer');

const brokenLineage = copySession(session);
brokenLineage.workflow.current.panel_sha512 = '0'.repeat(128);
ok(failedCheck(Lab.getWorkflowAudit(brokenLineage), 'WF-03-STATE-PRECONDITIONS'), 'Audit rejects a panel that no longer matches the active workflow lineage');

const malformedSession = copySession(session);
malformedSession.panel.reviews = null;
let malformedAudit;
try { malformedAudit = Lab.getWorkflowAudit(malformedSession); } catch (error) { malformedAudit = null; }
ok(!!malformedAudit && malformedAudit.status === 'FAIL', 'Malformed nested session data returns a failed audit instead of throwing');

const malformedPanelErrors = copySession(session);
malformedPanelErrors.panel.errors = null;
let malformedPanelAudit;
try { malformedPanelAudit = Lab.getWorkflowAudit(malformedPanelErrors); } catch (error) { malformedPanelAudit = null; }
ok(!!malformedPanelAudit && failedCheck(malformedPanelAudit, 'WF-04-THREE-SEAT-INTEGRITY'), 'A malformed panel error list fails closed without crashing the audit');

const malformedRun = copySession(session);
malformedRun.run.second_pass = {};
let malformedRunAudit;
try { malformedRunAudit = Lab.getWorkflowAudit(malformedRun); } catch (error) { malformedRunAudit = null; }
ok(!!malformedRunAudit && malformedRunAudit.status === 'FAIL', 'A malformed second pass fails closed without crashing the audit');

const concurrent = Lab.createConsoleSession();
Lab.runOrchestration(concurrent);
const firstReview = Lab.runTechnicalReview(concurrent, 'all-pass');
let overlapRejected = false;
try { await Lab.runTechnicalReview(concurrent, 'dissent'); }
catch (error) { overlapRejected = error.message.includes('already in progress'); }
await firstReview;
ok(overlapRejected && concurrent.panel.status === 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION', 'A concurrent review cannot replace the in-flight review packet or panel');

const rerun = Lab.createConsoleSession();
Lab.runOrchestration(rerun);
await Lab.runTechnicalReview(rerun, 'all-pass');
Lab.commitHumanDisposition(rerun, {
  adjudicator: 'Synthetic human', disposition: 'CONFIRMED',
  reason: 'Prior generation was adjudicated after all three synthetic reviews passed.'
});
Lab.approveNarrativeAndPrepareAnnex(rerun, 'Synthetic approver');
const priorDisposition = rerun.disposition;
Lab.runOrchestration(rerun);
ok(rerun.workflow.generation === 2 && rerun.workflow.state === 'ORCHESTRATION_COMPLETE' &&
  rerun.panel === null && rerun.disposition === null && rerun.narrative === null && rerun.annex === null,
'A successful orchestration rerun starts a new generation and atomically invalidates current downstream records');
ok(rerun.store.history(rerun.candidate.candidate_id).some((item) =>
  item.disposition_sha512 === priorDisposition.disposition_sha512), 'A rerun preserves the earlier human decision in disposition history');
await Lab.runTechnicalReview(rerun, 'dissent');
const rerunAudit = Lab.getWorkflowAudit(rerun);
ok(rerunAudit.status === 'PASS' &&
  rerunAudit.checks.find((item) => item.check_id === 'WF-07-FAIL-CLOSED-CONFIRMATION').status === 'PASS',
'A historical CONFIRMED disposition is not misattributed to a later dissenting panel');
ok(rerunAudit.workflow_generation === 2 && rerunAudit.transition_history.length === 6,
'Transition history replays across generations and remains linked to the active review');
ok(Lab.exportSession(rerun).current_disposition === null &&
  Lab.exportSession(rerun).disposition_history.some((item) => item.disposition_sha512 === priorDisposition.disposition_sha512),
'Export distinguishes the current disposition from preserved decisions in historical records');

const reset = Lab.createConsoleSession();
Lab.runOrchestration(reset);
await Lab.runTechnicalReview(reset, 'all-pass');
Lab.commitHumanDisposition(reset, {
  adjudicator: 'Synthetic human', disposition: 'CONFIRMED',
  reason: 'First review generation was separately adjudicated.'
});
await Lab.runTechnicalReview(reset, 'dissent');
ok(reset.workflow.state === 'TECHNICAL_REVIEW_COMPLETE' && reset.disposition === null &&
  Lab.getWorkflowAudit(reset).status === 'PASS' &&
  reset.store.history(reset.candidate.candidate_id).some((item) =>
    item.workflow_generation === 1 && item.review_id !== reset.reviewId),
'Replacing a technical review invalidates its current disposition while retaining its historical review linkage');

const frozenWorkflow = W.createWorkflow();
const fakeSha = 'a'.repeat(128);
const packetSha = 'b'.repeat(128);
const panelSha = 'c'.repeat(128);
const dispositionSha = 'd'.repeat(128);
const narrativeSha = 'e'.repeat(128);
const annexSha = 'f'.repeat(128);
W.transition(frozenWorkflow, W.EVENTS.RUN_ORCHESTRATION, { run_sha512: fakeSha, packet_sha512: packetSha });
W.transition(frozenWorkflow, W.EVENTS.RUN_TECHNICAL_REVIEW, {
  session_id: frozenWorkflow.session_id, review_id: 'review-1',
  packet_sha512: packetSha, panel_sha512: panelSha
});
ok(throws(() => W.transition(frozenWorkflow, W.EVENTS.PREPARE_ANNEX, {})), 'Direct state-machine use cannot skip human adjudication');
W.transition(frozenWorkflow, W.EVENTS.COMMIT_HUMAN_DISPOSITION, {
  generation: 1, review_id: 'review-1', panel_sha512: panelSha,
  disposition_sha512: dispositionSha
});
W.transition(frozenWorkflow, W.EVENTS.PREPARE_ANNEX, {
  generation: 1, review_id: 'review-1', disposition_sha512: dispositionSha,
  narrative_sha512: narrativeSha, annex_sha512: annexSha
});
ok(frozenWorkflow.state === 'ANNEX_PREPARED' && frozenWorkflow.history.length === 4, 'Direct state-machine use permits the complete legal sequence');

done('nine-brain-workflow-contract');
