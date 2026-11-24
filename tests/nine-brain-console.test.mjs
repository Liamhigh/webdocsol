import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const Lab = require('../development/nine-brain-console/runner.js');

console.log('======================================================');
console.log('RUN  nine-brain-console.test.mjs');
console.log('======================================================\n');

const realFetch = globalThis.fetch;
let networkAttempts = 0;
globalThis.fetch = async () => {
  networkAttempts++;
  throw new Error('Network access is prohibited in the synthetic console');
};

try {
  ok(Object.keys(Lab.SCENARIOS).join(',') === 'all-pass,dissent,unavailable,malformed', 'Console exposes exactly the all-pass and three fail-closed scenarios');

  for (const scenario of ['dissent', 'unavailable', 'malformed']) {
    const session = Lab.createConsoleSession();
    Lab.runOrchestration(session);
    const panel = await Lab.runTechnicalReview(session, scenario);
    ok(panel.status === 'FAIL', scenario + ' fails the complete technical panel closed');
    ok(panel.reviews[0].status === 'PASS' && panel.reviews[1].status === 'PASS', scenario + ' retains the two passing seats without majority promotion');
    const expectedSeatStatus = scenario === 'dissent' ? 'FAIL' : scenario === 'unavailable' ? 'UNAVAILABLE' : 'MALFORMED';
    ok(panel.reviews[2].status === expectedSeatStatus, scenario + ' preserves the exact DeepSeek failure status');
    ok(session.providerCalls.length === 2 && session.providerCalls.every((call) => call.mocked && !call.other_reviewer_response_received), scenario + ' uses only two isolated local mock transports');
    ok(throws(() => Lab.commitHumanDisposition(session, {
      adjudicator: 'Synthetic human', disposition: 'CONFIRMED', reason: 'Attempted majority override'
    })), scenario + ' cannot be overridden by human CONFIRMED');
    ok(session.disposition === null && session.narrative === null && session.annex === null, scenario + ' creates no downstream disposition, narrative or annex');
  }

  const session = Lab.createConsoleSession();
  let unknownScenarioRejected = false;
  try { await Lab.runTechnicalReview(session, 'unknown-scenario'); }
  catch (error) { unknownScenarioRejected = error.message.includes('Unknown review scenario'); }
  ok(unknownScenarioRejected, 'Unknown scenarios are rejected rather than defaulted to all-pass');
  ok(throws(() => Lab.commitHumanDisposition(session, {
    adjudicator: 'Synthetic human', disposition: 'CONFIRMED', reason: 'Panel has not run'
  })), 'Human disposition cannot precede the technical panel');
  ok(throws(() => Lab.approveNarrativeAndPrepareAnnex(session, 'Synthetic approver')), 'Narrative and annex cannot precede human disposition');

  const orchestration = Lab.runOrchestration(session);
  const brainIds = orchestration.run.first_pass.map((item) => item.brain_id);
  ok(brainIds.join(',') === 'B1,B2,B3,B4,B5,B6,B7,B8,B9', 'Two-pass run preserves exactly nine canonical brain identities in order');
  ok(orchestration.run.second_pass.map((item) => item.brain_id).join(',') === brainIds.join(','), 'Second pass preserves the same exact B1–B9 identities');
  ok(orchestration.run.first_pass.every((item) => item.engagement_status === 'NOT_ENGAGED'), 'Console does not mislabel existing-finding mapping as new production detector execution');
  ok(orchestration.run.first_pass.find((item) => item.brain_id === 'B9').recommendation_ids.length === 1 && orchestration.run.second_pass.every((item) => item.brain_id !== 'B9' || item.finding_ids.length === 0), 'B9 remains advisory and issues no findings');
  ok(orchestration.run.release_flags && Object.values(orchestration.run.release_flags).every((flag) => flag === false), 'Every development release flag remains false');
  ok(orchestration.legal.coverage_status === 'PARTIAL_EXPLICIT_GAPS' && orchestration.legal.conflicts_status === 'CROSS_BORDER_REVIEW_REQUIRED' && orchestration.legal.governing_law === null, 'B7 preserves explicit cross-border gaps and makes no governing-law conclusion');
  ok(orchestration.allen.relation_count === 13 && orchestration.allen.composition_count === 169 && orchestration.allen.meeting_example === 'm', 'Allen interval groundwork returns 13 relations, 169 compositions and the meeting abbreviation');
  ok(session.events.some((event) => event.event.includes('deterministic replay')), 'Successful deterministic replay is recorded in the execution audit');

  const panel = await Lab.runTechnicalReview(session, 'all-pass');
  ok(panel.status === 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION' && panel.errors.length === 0, 'All-pass scenario reaches technical support while still requiring human adjudication');
  ok(panel.reviews.length === 3 && new Set(panel.reviews.map((review) => review.reviewer_origin)).size === 3, 'Three technical seats have three distinct review origins');
  ok(panel.reviews.every((review) => review.source_test === 'PASS' && review.context_test === 'PASS' && review.independence_test === 'PASS'), 'Source, context and independence tests pass separately in all three seats');
  ok(session.providerCalls.length === 2 && session.providerCalls.every((call) => call.mocked && call.endpoint.endsWith('.example.invalid/review') && !call.other_reviewer_response_received), 'Mock calls carry no cross-reviewer context and never become live provider calls');
  ok(networkAttempts === 0, 'No network fetch occurs during any console scenario');

  const disposition = Lab.commitHumanDisposition(session, {
    adjudicator: 'Synthetic test adjudicator', disposition: 'CONFIRMED',
    reason: 'Separate synthetic human review accepted the bounded proposition after all three technical reviews.'
  });
  ok(disposition.revision === 1 && disposition.disposition === 'CONFIRMED' && disposition.human, 'Separate human adjudication commits revision one after a passing panel');
  ok(session.store.history(session.candidate.candidate_id).length === 1, 'Committed human disposition enters immutable history');
  ok(throws(() => session.store.commit(session.candidate.candidate_id, {
    candidate_id: session.candidate.candidate_id, packet: session.packet, panel: session.panel,
    disposition: 'REJECTED', adjudicator: 'Synthetic test adjudicator', human: true,
    reason: 'Stale synthetic update', resolution_evidence_ids: []
  }, 0)), 'Compare-and-swap rejects stale revision zero after revision one');

  const { narrative, annex } = Lab.approveNarrativeAndPrepareAnnex(session, 'Synthetic narrative approver');
  ok(narrative.status === 'HUMAN_APPROVED_GROUNDED_NARRATIVE' && narrative.disposition_sha512 === disposition.disposition_sha512, 'Grounded narrative approval binds to the exact human disposition digest');
  ok(narrative.statements.length === 1 && narrative.statements[0].text === session.packet.evidence[0].anchor.quote, 'Narrative contains only verbatim packet evidence');
  ok(annex.sealing_status === 'READY_FOR_EXISTING_EXTERNAL_SEALER' && annex.sealed === false && annex.blockchain_anchor === null, 'Annex is prepared but neither sealed nor blockchain anchored');
  ok(annex.production_report_modified === false && annex.production_seal_modified === false, 'Annex leaves production report and seal semantics untouched');

  const exported = Lab.exportSession(session);
  ok(exported.schema === 'vo.nine-brain-development-console-export.v1' && exported.development_only && exported.default_off && exported.synthetic_fixtures_only, 'Export is explicitly development-only, default-off and synthetic');
  ok(exported.mocked_external_reviewers && exported.live_provider_calls === 0 && !exported.production_findings_modified && !exported.production_report_modified && !exported.production_seal_modified, 'Export records mocked reviewers, zero live calls and no production mutations');
  ok(exported.technical_panel.panel_sha512 === panel.panel_sha512 && exported.disposition_history.length === 1 && exported.annex.committed_disposition_revision === 1, 'Export includes the actual run, panel, disposition and annex records');
  ok(exported.events.length === 5 && exported.events.every((event, index) => event.sequence === index + 1), 'Export retains a complete ordered execution audit');
  ok(exported.workflow_contract.status === 'PASS' && exported.workflow_contract.checks.length === 9 && exported.workflow_contract.current_state === 'ANNEX_PREPARED', 'Export includes a passing nine-check workflow contract in the annex-prepared state');
  ok(exported.workflow_contract.axiom_formal_verification_executed === false && exported.workflow_contract.forensic_truth_verified === false, 'Workflow audit cannot be mistaken for Axiom formal verification or forensic truth verification');
  ok(!JSON.stringify(exported).includes('secret-value') && !JSON.stringify(exported).includes('LLM_API_KEY'), 'Export contains no provider credentials');
  ok(networkAttempts === 0, 'Complete all-pass flow and export remain entirely local');
} finally {
  globalThis.fetch = realFetch;
}

done('nine-brain-console');
