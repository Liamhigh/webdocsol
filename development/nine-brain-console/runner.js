'use strict';

/*
 * Browser-safe development-console runner. Every input is synthetic, both
 * external review transports are local mocks, and no production route, report,
 * finding, seal, provider credential or network API is used.
 */
const C = require('../../analysis-contracts.js');
const O = require('../nine-brain/orchestration.js');
const V = require('../nine-brain/verification.js');
const Legal = require('../nine-brain/legal.js');
const Allen = require('../nine-brain/allen-algebra.js');
const W = require('./workflow-contract.js');
const {
  makeBase, completeReviews, providerConfig, passingModelResponse
} = require('../../tests/nine-brain-fixtures.js');

let nextSessionNumber = 0;

const SCENARIOS = Object.freeze({
  'all-pass': 'All three technical reviews pass',
  dissent: 'DeepSeek dissents; the panel fails closed',
  unavailable: 'DeepSeek is unavailable; the panel fails closed',
  malformed: 'DeepSeek returns malformed output; the panel fails closed'
});

function createConsoleSession() {
  nextSessionNumber += 1;
  const sessionId = 'console-session-' + nextSessionNumber;
  const base = makeBase();
  const preview = O.buildDevelopmentRun(base);
  const run = O.buildDevelopmentRun({
    ...base,
    promotionReviews: completeReviews(preview)
  });
  const candidate = run.candidates.find((item) => item.brain_id === 'B1');
  if (!candidate) throw new Error('Synthetic B1 candidate unavailable');
  const audit = run.finding_audits.find(
    (item) => item.original_finding_id === candidate.candidate_id
  );
  const packet = V.buildEvidencePacket(
    candidate, base.bundle.evidence_atoms, base.sourceTexts, base.constitution
  );
  const legal = Legal.buildCrossBorderObservation({
    explicit_jurisdictions: ['za', 'gb'],
    selected_pack_ids: ['za'],
    connecting_factors: [{
      factor_type: 'performance_location', jurisdiction: 'gb',
      foreign_element: true, source_evidence_ids: ['evidence-one']
    }],
    citation_occurrences: [{
      occurrence_id: 'citation-1', jurisdiction: 'za',
      anchor: base.bundle.evidence_atoms[0].anchor
    }]
  });
  return {
    base, run, candidate, audit, packet, legal,
    store: new V.DispositionStore(),
    workflow: { ...W.createWorkflow(), session_id: sessionId },
    panel: null,
    disposition: null,
    narrative: null,
    annex: null,
    busy: false,
    reviewId: null,
    scenario: 'all-pass',
    providerCalls: [],
    events: [{
      sequence: 1,
      kind: 'SESSION_INITIALIZED',
      transition_sequence: 0,
      workflow_generation: 0,
      workflow_session_id: sessionId,
      event: 'Synthetic development records prepared locally; no provider, human adjudication, production report or sealing action executed.'
    }]
  };
}

function beginOperation(session) {
  if (!session || session.busy) throw new Error('Another workflow operation is already in progress');
  session.busy = true;
}

function record(session, event, transitionEvent) {
  const transition = session.workflow.history[session.workflow.history.length - 1];
  if (!transition || transition.event !== transitionEvent) {
    throw new Error('Workflow execution event does not match its committed transition');
  }
  session.events.push({
    sequence: session.events.length + 1,
    transition_sequence: transition.sequence,
    transition_event: transition.event,
    workflow_generation: transition.generation,
    workflow_session_id: session.workflow.session_id,
    event
  });
}

function runOrchestration(session) {
  beginOperation(session);
  try {
    W.assertEventAllowed(session.workflow, W.EVENTS.RUN_ORCHESTRATION);
    const validation = O.validateDevelopmentRun(session.run);
    if (!validation.valid) throw new Error('Development run failed validation: ' + validation.errors.join('; '));
    const replay = O.buildDevelopmentRun({
      ...session.base,
      promotionReviews: completeReviews(O.buildDevelopmentRun(session.base))
    });
    if (C.stableStringify(replay) !== C.stableStringify(session.run)) {
      throw new Error('Deterministic replay did not reproduce the development run');
    }
    W.transition(session.workflow, W.EVENTS.RUN_ORCHESTRATION, {
      run_sha512: session.run.run_sha512,
      packet_sha512: session.packet.packet_sha512
    });
    session.panel = null;
    session.disposition = null;
    session.narrative = null;
    session.annex = null;
    session.reviewId = null;
    session.providerCalls = [];
    record(session, 'NB-2–NB-10 two-pass run and deterministic replay completed; nine brain identities preserved.', W.EVENTS.RUN_ORCHESTRATION);
    return {
      run: session.run,
      legal: session.legal,
      allen: {
        relation_count: Allen.RELATIONS.length,
        composition_count: Object.values(Allen.COMPOSITION)
          .reduce((sum, row) => sum + Object.keys(row).length, 0),
        meeting_example: Allen.relation({ start: 0, end: 1 }, { start: 1, end: 2 })
      }
    };
  } finally {
    session.busy = false;
  }
}

function sourceContextReview(session) {
  return {
    source_test: 'PASS',
    context_test: 'PASS',
    source_reason: 'Synthetic reviewer checked each exact quote against its original source anchor.',
    context_reason: 'Synthetic reviewer checked the bounded proposition against qualifying surrounding context.',
    reviewed_evidence_ids: session.packet.evidence.map((item) => item.evidence_id)
  };
}

function mockTransport(session, provider, providerCalls, reviewId, generation, scenario) {
  return async (request) => {
    if (request.raw_response || request.other_reviewer_response) {
      throw new Error('Cross-reviewer context reached an isolated mock transport');
    }
    providerCalls.push({
      sequence: providerCalls.length + 1,
      provider,
      endpoint: request.endpoint,
      packet_sha512: request.packet_sha512,
      session_id: session.workflow.session_id,
      review_id: reviewId,
      workflow_generation: generation,
      other_reviewer_response_received: false,
      mocked: true
    });
    if (provider === 'deepseek') {
      if (scenario === 'unavailable') {
        throw new Error('Synthetic DeepSeek outage requested by the console scenario');
      }
      if (scenario === 'malformed') {
        return { status: 200, body: '{this is deliberately malformed JSON' };
      }
      if (scenario === 'dissent') {
        return {
          status: 200,
          body: passingModelResponse(session.packet, {
            status: 'FAIL', context_test: 'FAIL',
            reasons: ['Synthetic DeepSeek dissent preserved; majority agreement is not verification.']
          })
        };
      }
    }
    return { status: 200, body: passingModelResponse(session.packet) };
  };
}

async function runTechnicalReview(session, scenario) {
  if (!Object.prototype.hasOwnProperty.call(SCENARIOS, scenario)) {
    throw new TypeError('Unknown review scenario');
  }
  beginOperation(session);
  try {
    W.assertEventAllowed(session.workflow, W.EVENTS.RUN_TECHNICAL_REVIEW);
    const generation = session.workflow.generation;
    const reviewId = session.workflow.session_id + '-review-' + generation + '-' + session.packet.packet_sha512.slice(0, 24);
    const providerCalls = [];
    const responsible = V.responsibleBrainReview(
      session.packet, session.audit, session.base.sourceTexts, sourceContextReview(session)
    );
    const mistral = providerConfig('mistral');
    const deepseek = providerConfig('deepseek');
    const panel = await V.runIndependentPanel(
      session.packet, responsible, mistral, deepseek,
      mockTransport(session, 'mistral', providerCalls, reviewId, generation, scenario),
      mockTransport(session, 'deepseek', providerCalls, reviewId, generation, scenario)
    );
    const panelValidation = V.validatePanel(panel, session.packet);
    if (!panelValidation.valid) throw new Error('Technical panel failed contract validation: ' + panelValidation.errors.join('; '));
    W.transition(session.workflow, W.EVENTS.RUN_TECHNICAL_REVIEW, {
      session_id: session.workflow.session_id,
      review_id: reviewId,
      packet_sha512: session.packet.packet_sha512,
      panel_sha512: panel.panel_sha512
    });
    session.scenario = scenario;
    session.reviewId = reviewId;
    session.providerCalls = providerCalls;
    session.panel = panel;
    session.disposition = null;
    session.narrative = null;
    session.annex = null;
    record(session, 'VER-1–VER-4 panel executed with two isolated mocked providers; status ' + panel.status + '.', W.EVENTS.RUN_TECHNICAL_REVIEW);
    return panel;
  } finally {
    session.busy = false;
  }
}

function commitHumanDisposition(session, spec) {
  beginOperation(session);
  try {
    if (!session.panel) throw new Error('Run the three technical review seats first');
    W.assertEventAllowed(session.workflow, W.EVENTS.COMMIT_HUMAN_DISPOSITION);
    if (!spec || typeof spec.adjudicator !== 'string' || !spec.adjudicator.trim() ||
        typeof spec.reason !== 'string' || !spec.reason.trim()) {
      throw new TypeError('A human adjudicator identity and substantive reason are required');
    }
    if (session.workflow.current.review_id !== session.reviewId ||
        session.workflow.current.panel_sha512 !== session.panel.panel_sha512 ||
        session.workflow.current.packet_sha512 !== session.packet.packet_sha512) {
      throw new Error('Human disposition does not match the active workflow review');
    }
    const current = session.store.current(session.candidate.candidate_id);
    const disposition = session.store.commit(session.candidate.candidate_id, {
      candidate_id: session.candidate.candidate_id,
      packet: session.packet,
      panel: session.panel,
      disposition: spec.disposition,
      adjudicator: spec.adjudicator.trim(),
      human: true,
      reason: spec.reason.trim(),
      workflow_generation: session.workflow.generation,
      workflow_session_id: session.workflow.session_id,
      review_id: session.reviewId,
      resolution_evidence_ids: spec.disposition === 'RESOLVED_IN_CONTEXT'
        ? [session.packet.evidence[0].evidence_id]
        : []
    }, current ? current.revision : 0);
    W.transition(session.workflow, W.EVENTS.COMMIT_HUMAN_DISPOSITION, {
      generation: session.workflow.generation,
      review_id: session.reviewId,
      panel_sha512: session.panel.panel_sha512,
      disposition_sha512: disposition.disposition_sha512
    });
    session.disposition = disposition;
    session.narrative = null;
    session.annex = null;
    record(session, 'VER-5 separate human disposition committed at revision ' + session.disposition.revision + '; evidence and history retained.', W.EVENTS.COMMIT_HUMAN_DISPOSITION);
    return session.disposition;
  } finally {
    session.busy = false;
  }
}

function approveNarrativeAndPrepareAnnex(session, approver) {
  beginOperation(session);
  try {
    if (!session.disposition) throw new Error('Commit a separate human disposition first');
    W.assertEventAllowed(session.workflow, W.EVENTS.PREPARE_ANNEX);
    if (typeof approver !== 'string' || !approver.trim()) {
      throw new TypeError('A separate narrative approver identity is required');
    }
    const quote = session.packet.evidence[0].anchor.quote;
    const narrative = V.buildNarrativeProvenance({
      disposition: session.disposition,
      packet: session.packet,
      statements: [{
        text: quote,
        source_ids: [session.packet.evidence[0].evidence_id]
      }],
      authorized_excerpts: {
        [session.packet.evidence[0].evidence_id]: quote
      },
      human_approval: {
        approved: true,
        adjudicator: approver.trim(),
        disposition_sha512: session.disposition.disposition_sha512,
        disposition_revision: session.disposition.revision
      }
    });
    const annex = V.buildVerificationAnnex({
      packet: session.packet,
      panel: session.panel,
      disposition: session.disposition,
      disposition_store: session.store,
      narrative
    });
    W.transition(session.workflow, W.EVENTS.PREPARE_ANNEX, {
      generation: session.workflow.generation,
      review_id: session.reviewId,
      disposition_sha512: session.disposition.disposition_sha512,
      narrative_sha512: narrative.narrative_sha512,
      annex_sha512: annex.annex_sha512
    });
    session.narrative = narrative;
    session.annex = annex;
    record(session, 'VER-6–VER-7 grounded narrative approved and unsealed annex prepared; production report and seal unchanged.', W.EVENTS.PREPARE_ANNEX);
    return { narrative, annex };
  } finally {
    session.busy = false;
  }
}

function getWorkflowAudit(session) {
  return W.auditSession(session);
}

function exportSession(session) {
  return {
    schema: 'vo.nine-brain-development-console-export.v1',
    development_only: true,
    default_off: true,
    synthetic_fixtures_only: true,
    mocked_external_reviewers: true,
    live_provider_calls: 0,
    production_findings_modified: false,
    production_report_modified: false,
    production_seal_modified: false,
    workflow_contract: getWorkflowAudit(session),
    scenario: session.scenario,
    run: session.run,
    cross_border_observation: session.legal,
    immutable_packet: session.packet,
    technical_panel: session.panel,
    current_disposition: session.disposition,
    disposition_history: session.store.history(session.candidate.candidate_id),
    narrative: session.narrative,
    annex: session.annex,
    provider_calls: session.providerCalls,
    events: session.events
  };
}

module.exports = {
  SCENARIOS,
  createConsoleSession,
  runOrchestration,
  runTechnicalReview,
  commitHumanDisposition,
  approveNarrativeAndPrepareAnnex,
  getWorkflowAudit,
  exportSession
};
