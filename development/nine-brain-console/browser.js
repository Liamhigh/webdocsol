'use strict';

const Lab = require('./runner.js');

const $ = (id) => document.getElementById(id);
const names = {
  B1: 'Contradiction Engine', B2: 'Document & Image Forensics',
  B3: 'Communications Integrity', B4: 'Behavioral & Linguistic Patterns',
  B5: 'Timeline & Continuity', B6: 'Financial Exposure',
  B7: 'Legal Subject Mapping', B8: 'Audio & Rich Media',
  B9: 'Research & Advisory Mesh'
};
let session = Lab.createConsoleSession();
let orchestrationRan = false;

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function badge(value) {
  const status = String(value || 'NOT RUN');
  const style = /PASS|CERTIFIED|CONFIRMED|HUMAN_ADJUDICATED/.test(status) ? 'pass'
    : /FAIL|REJECT|MALFORMED|UNAVAILABLE/.test(status) ? 'fail'
      : /PENDING|UNRESOLVED|INSUFFICIENT|NOT_/.test(status) ? 'pending' : 'neutral';
  return '<span class="status status-' + style + '">' + escapeHtml(status) + '</span>';
}
function showMessage(text, kind) {
  const box = $('message');
  box.className = kind === 'error' ? 'alert' : 'success';
  box.textContent = text;
  box.classList.remove('hidden');
  box.focus({ preventScroll: true });
}
function clearMessage() {
  $('message').className = 'hidden';
  $('message').textContent = '';
}
function showError(error) {
  showMessage(error && error.message ? error.message : String(error), 'error');
}
function pretty(value) {
  return value ? JSON.stringify(value, null, 2) : 'Not generated in this session.';
}
function currentRecord() {
  const selected = $('recordSelect').value;
  if (selected === 'run') return session.run;
  if (selected === 'panel') return session.panel;
  if (selected === 'disposition') return session.disposition;
  if (selected === 'narrative') return session.narrative;
  if (selected === 'annex') return session.annex;
  if (selected === 'packet') return session.packet;
  if (selected === 'legal') return session.legal;
  if (selected === 'workflow') return Lab.getWorkflowAudit(session);
  return Lab.exportSession(session);
}
function refreshInspector() {
  const workflow = Lab.getWorkflowAudit(session);
  const workflowResult = $('workflowResult');
  workflowResult.replaceChildren();
  const outcome = document.createElement('div');
  outcome.className = 'outcome ' + (workflow.status === 'PASS' ? 'pass' : 'fail');
  const heading = document.createElement('strong');
  heading.textContent = 'Workflow contract: ' + workflow.status;
  const detail = document.createElement('p');
  detail.className = 'help';
  detail.textContent = 'State: ' + workflow.current_state + '. Nine deterministic contract checks. This audits software workflow only; Axiom formal verification has not been executed.';
  outcome.append(heading, detail);
  const checks = document.createElement('ul');
  checks.className = 'tests';
  workflow.checks.forEach((item) => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = item.check_id;
    const status = document.createElement('span');
    status.className = 'status status-' + (item.status === 'PASS' ? 'pass' : 'fail');
    status.textContent = item.status;
    row.append(label, status);
    checks.appendChild(row);
  });
  workflowResult.append(outcome, checks);
  $('recordJson').textContent = pretty(currentRecord());
  $('auditTrail').innerHTML = session.events.map((event) =>
    '<li><span>' + String(event.sequence).padStart(2, '0') + '</span><div>' + escapeHtml(event.event) + '</div></li>'
  ).join('');
}
function renderOrchestration(result) {
  const rows = result.run.first_pass.map((first, index) => {
    const second = result.run.second_pass[index];
    return '<tr><td>' + first.brain_id + '</td><td>' + escapeHtml(names[first.brain_id]) + '</td><td>' +
      badge(first.engagement_status) + '</td><td>' + first.candidate_ids.length + ' / ' + second.candidate_ids.length +
      '</td><td>' + first.support_ids.length + '</td><td>' + first.recommendation_ids.length + '</td><td>' +
      second.finding_ids.length + '</td></tr>';
  }).join('');
  $('orchestrationResult').innerHTML =
    '<div class="outcome pass"><strong>Valid two-pass run; deterministic replay matched</strong><span class="mono">Run ' + escapeHtml(result.run.run_id) + '</span><p class="help">All release flags remain false. Existing-finding mapping creates development candidates; NOT_ENGAGED means no new production detector execution is claimed.</p></div>' +
    '<div class="table-scroll"><table class="brain-table"><thead><tr><th>Brain</th><th>Role</th><th>Engagement</th><th>Candidates P1/P2</th><th>Support</th><th>Advisory</th><th>Certified dev IDs</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="result"><h3>B7 cross-border and research checks</h3><div class="table-scroll"><table class="data-table"><tbody>' +
    '<tr><th>Declared jurisdictions</th><td>' + escapeHtml(result.legal.explicit_jurisdictions.join(', ').toUpperCase()) + '</td></tr>' +
    '<tr><th>Coverage</th><td>' + badge(result.legal.coverage_status) + '</td></tr>' +
    '<tr><th>Conflicts process</th><td>' + badge(result.legal.conflicts_status) + '</td></tr>' +
    '<tr><th>Governing-law conclusion</th><td>' + escapeHtml(result.legal.governing_law) + ' — deliberately none</td></tr>' +
    '<tr><th>Allen interval algebra</th><td>' + result.allen.relation_count + ' relations; ' + result.allen.composition_count + ' generated compositions; meeting example “' + escapeHtml(result.allen.meeting_example) + '”</td></tr>' +
    '</tbody></table></div></div>';
  $('runReview').disabled = false;
  $('reviewResult').innerHTML = '<div class="empty">Ready. Choose a reviewer scenario, then run the technical review.</div>';
  refreshInspector();
}
function renderPanel(panel) {
  const seats = panel.reviews.map((review, index) =>
    '<article class="seat"><div class="stage-number">Seat 0' + (index + 1) + '</div><h3>' + escapeHtml(review.provider) + '</h3><div class="origin">' + escapeHtml(review.reviewer_origin) + '</div><div class="result">' + badge(review.status) + '</div><ul class="tests">' +
    ['source_test', 'context_test', 'independence_test'].map((key) =>
      '<li><span>' + escapeHtml(key.replace(/_/g, ' ')) + '</span>' + badge(review[key]) + '</li>'
    ).join('') + '</ul></article>'
  ).join('');
  const passed = panel.status === 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION';
  $('reviewResult').innerHTML =
    '<div class="outcome ' + (passed ? 'pass' : 'fail') + '"><strong>' + escapeHtml(panel.status) + '</strong><p class="help">' +
    (passed ? 'All three technical seats passed. A separate human decision is still required.' : 'The panel failed closed. Two passing seats, a provider outage or malformed output cannot become verification.') +
    '</p></div><div class="seat-grid">' + seats + '</div>' +
    (panel.errors.length ? '<div class="alert"><strong>Fail-closed reasons</strong><ul>' + panel.errors.map((error) => '<li>' + escapeHtml(error) + '</li>').join('') + '</ul></div>' : '') +
    '<p class="help">Mock transport calls: ' + session.providerCalls.length + '. Live provider/network calls: 0. Neither external seat receives the other seat’s response.</p>';
  $('commitDisposition').disabled = false;
  $('dispositionResult').innerHTML = '<div class="empty">Technical panel complete. Enter the separate human adjudication.</div>';
  refreshInspector();
}
function renderDisposition(disposition) {
  const history = session.store.history(session.candidate.candidate_id);
  $('dispositionResult').innerHTML =
    '<div class="outcome ' + (disposition.disposition === 'CONFIRMED' ? 'pass' : '') + '"><strong>Revision ' + disposition.revision + ': ' + escapeHtml(disposition.disposition) + '</strong><p>' + escapeHtml(disposition.reason) + '</p><p class="help">Adjudicator: ' + escapeHtml(disposition.adjudicator) + '. Evidence retained: ' + disposition.evidence_retained + '. Audit history retained: ' + disposition.audit_history_retained + '.</p></div>' +
    '<h3>Immutable disposition history</h3><ol class="record-history">' + history.map((item) =>
      '<li>' + badge(item.disposition) + ' <span class="mono">revision ' + item.revision + ' · generation ' + escapeHtml(item.workflow_generation) +
      ' · ' + escapeHtml(item.workflow_session_id || 'legacy') + ' · ' + escapeHtml(item.disposition_sha512.slice(0, 20)) + '…</span></li>'
    ).join('') + '</ol>';
  $('prepareAnnex').disabled = false;
  $('annexResult').innerHTML = '<div class="empty">Ready for separate narrative approval and unsealed annex preparation.</div>';
  refreshInspector();
}
function renderAnnex(result) {
  $('annexResult').innerHTML =
    '<div class="outcome pass"><strong>' + escapeHtml(result.narrative.status) + '</strong><p class="help">Narrative revision ' + result.narrative.disposition_revision + ' is grounded in verbatim packet evidence and separately approved.</p></div>' +
    '<div class="table-scroll"><table class="data-table"><tbody>' +
    '<tr><th>Annex state</th><td>' + badge(result.annex.sealing_status) + '</td></tr>' +
    '<tr><th>Sealed</th><td>' + result.annex.sealed + '</td></tr>' +
    '<tr><th>Blockchain anchor</th><td>' + escapeHtml(result.annex.blockchain_anchor) + '</td></tr>' +
    '<tr><th>Production report modified</th><td>' + result.annex.production_report_modified + '</td></tr>' +
    '<tr><th>Production seal modified</th><td>' + result.annex.production_seal_modified + '</td></tr>' +
    '</tbody></table></div>';
  refreshInspector();
}
function resetDownstream() {
  $('commitDisposition').disabled = true;
  $('prepareAnnex').disabled = true;
  $('dispositionResult').innerHTML = '<div class="empty">Run the technical panel first.</div>';
  $('annexResult').innerHTML = '<div class="empty">Commit a human disposition first.</div>';
}

$('runBrains').addEventListener('click', () => {
  clearMessage();
  try {
    const result = Lab.runOrchestration(session);
    resetDownstream();
    orchestrationRan = true;
    renderOrchestration(result);
    showMessage('B1–B9 completed as a development run. All nine identities are present and the deterministic replay matched.', 'success');
  } catch (error) { showError(error); }
});
$('runReview').addEventListener('click', async () => {
  clearMessage();
  if (!orchestrationRan) return showError(new Error('Run B1–B9 first'));
  $('runReview').disabled = true;
  $('runReview').textContent = 'Running…';
  try {
    const panel = await Lab.runTechnicalReview(session, $('scenario').value);
    renderPanel(panel);
    showMessage(panel.status === 'TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION'
      ? 'All three technical seats passed. Human adjudication is now unlocked.'
      : 'The selected failure scenario correctly failed closed. Inspect the reasons in the panel.', 'success');
  } catch (error) { showError(error); }
  finally {
    $('runReview').disabled = false;
    $('runReview').textContent = 'Run technical review';
  }
});
$('dispositionForm').addEventListener('submit', (event) => {
  event.preventDefault();
  clearMessage();
  try {
    const disposition = Lab.commitHumanDisposition(session, {
      adjudicator: $('adjudicator').value,
      disposition: $('disposition').value,
      reason: $('reason').value
    });
    renderDisposition(disposition);
    showMessage('Human disposition committed as revision ' + disposition.revision + '. Narrative approval is now unlocked.', 'success');
  } catch (error) { showError(error); }
});
$('prepareAnnex').addEventListener('click', () => {
  clearMessage();
  try {
    const result = Lab.approveNarrativeAndPrepareAnnex(session, $('approver').value);
    renderAnnex(result);
    showMessage('Grounded narrative approved and annex prepared. Nothing was sealed, anchored or added to a production report.', 'success');
  } catch (error) { showError(error); }
});
$('recordSelect').addEventListener('change', refreshInspector);
$('downloadResult').addEventListener('click', () => {
  clearMessage();
  const exported = Lab.exportSession(session);
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'verum-development-test-' + session.scenario + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // A short timer can revoke the URL before Chromium finishes consuming the
  // Blob, leaving an empty download. Retain it for this synthetic session;
  // pagehide releases every generated URL and document teardown is the final
  // fallback. No network or persistent storage is involved.
  window.addEventListener('pagehide', () => URL.revokeObjectURL(url), { once: true });
  showMessage('Synthetic test JSON downloaded. You can send that file back for review.', 'success');
});
$('copySummary').addEventListener('click', async () => {
  clearMessage();
  const disposition = session.disposition;
  const lines = [
    'Verum Omnis development test — synthetic fixtures only',
    'Nine-brain run: ' + (orchestrationRan ? 'completed; deterministic replay matched' : 'not run'),
    'Reviewer scenario: ' + session.scenario,
    'Technical panel: ' + (session.panel ? session.panel.status : 'not run'),
    'Human disposition: ' + (disposition ? disposition.disposition + ' revision ' + disposition.revision : 'not committed'),
    'Narrative: ' + (session.narrative ? session.narrative.status : 'not generated'),
    'Annex: ' + (session.annex ? session.annex.sealing_status : 'not generated'),
    'Workflow contract: ' + Lab.getWorkflowAudit(session).status + ' (software audit only; not Axiom formal verification)',
    'Live provider calls: 0',
    'Production findings/report/seal modified: false'
  ];
  const text = lines.join('\n');
  try {
    if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
    showMessage('Plain-language test summary copied.', 'success');
  } catch (error) {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    showMessage(copied ? 'Plain-language test summary copied.' : text, copied ? 'success' : 'error');
  }
});
$('resetButton').addEventListener('click', () => window.location.reload());
// Firefox can restore dynamic button state across reloads. Reassert the
// initial gated state whenever a fresh synthetic session is constructed.
$('runReview').disabled = true;
$('commitDisposition').disabled = true;
$('prepareAnnex').disabled = true;
refreshInspector();
