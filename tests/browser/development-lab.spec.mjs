import { test, expect } from '@playwright/test';
import { installOfflineGuard, expectNoDocumentEgress } from './helpers.mjs';

const SYNTHETIC_TEXT = 'Synthetic statement one: the amount is R100.00.';
const PAGE = '/development-lab.html';

function watchPage(page) {
  const errors = [];
  const badResponses = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === 'http://127.0.0.1:4173' && response.status() >= 400) {
      badResponses.push(response.status() + ' ' + response.url());
    }
  });
  return { errors, badResponses };
}

async function runBrains(page) {
  await page.locator('#runBrains').click();
  await expect(page.locator('#orchestrationResult')).toContainText('Valid two-pass run; deterministic replay matched');
  await expect(page.locator('.brain-table tbody tr')).toHaveCount(9);
}

async function runReview(page, scenario) {
  await page.locator('#scenario').selectOption(scenario);
  await page.locator('#runReview').click();
  await expect(page.locator('#runReview')).toBeEnabled();
  await expect(page.locator('.seat-grid .seat')).toHaveCount(3);
}

async function readDownloadedJson(download) {
  // The artifact path can become visible before a slower browser has flushed
  // its contents. Consume Playwright's completed download stream instead of
  // racing the filesystem with a one-shot read.
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('complete all-pass workflow, real JSON export, inspector, summary and reset', async ({ page }) => {
  const external = await installOfflineGuard(page);
  const { errors, badResponses } = watchPage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    window.__revokedObjectUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.__revokedObjectUrls.push(url);
      return revoke(url);
    };
  });
  await page.goto(PAGE);
  await expect(page).toHaveTitle('Development Test Lab | Verum Omnis');
  await expect(page.locator('#runReview')).toBeDisabled();
  await expect(page.locator('#commitDisposition')).toBeDisabled();
  await expect(page.locator('#prepareAnnex')).toBeDisabled();

  await runBrains(page);
  await expect(page.locator('#orchestrationResult')).toContainText('PARTIAL_EXPLICIT_GAPS');
  await expect(page.locator('#orchestrationResult')).toContainText('CROSS_BORDER_REVIEW_REQUIRED');
  await runReview(page, 'all-pass');
  await expect(page.locator('#reviewResult')).toContainText('TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION');
  await expect(page.locator('#reviewResult')).toContainText('Live provider/network calls: 0');

  await page.locator('#disposition').selectOption('CONFIRMED');
  await page.locator('#commitDisposition').click();
  await expect(page.locator('#dispositionResult')).toContainText('Revision 1: CONFIRMED');
  await expect(page.locator('#dispositionResult .record-history li')).toHaveCount(1);
  await page.locator('#prepareAnnex').click();
  await expect(page.locator('#annexResult')).toContainText('HUMAN_APPROVED_GROUNDED_NARRATIVE');
  await expect(page.locator('#annexResult')).toContainText('READY_FOR_EXISTING_EXTERNAL_SEALER');
  await expect(page.locator('#annexResult')).toContainText('Production report modified');
  await expect(page.locator('#annexResult')).toContainText('false');

  await page.locator('details').first().locator('summary').click();
  await page.locator('#recordSelect').selectOption('panel');
  await expect(page.locator('#recordJson')).toContainText('TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION');
  await page.locator('#recordSelect').selectOption('legal');
  await expect(page.locator('#recordJson')).toContainText('CROSS_BORDER_REVIEW_REQUIRED');
  await page.locator('#recordSelect').selectOption('annex');
  await expect(page.locator('#recordJson')).toContainText('"sealed": false');
  await page.locator('details').nth(1).locator('summary').click();
  await expect(page.locator('#auditTrail li')).toHaveCount(5);

  const revocationsBeforeDownload = await page.evaluate(() => window.__revokedObjectUrls.length);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#downloadResult').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('verum-development-test-all-pass.json');
  const exported = await readDownloadedJson(download);
  expect(exported.schema).toBe('vo.nine-brain-development-console-export.v1');
  expect(exported.synthetic_fixtures_only).toBe(true);
  expect(exported.mocked_external_reviewers).toBe(true);
  expect(exported.live_provider_calls).toBe(0);
  expect(exported.technical_panel.status).toBe('TECHNICALLY_SUPPORTED_PENDING_HUMAN_ADJUDICATION');
  expect(exported.disposition_history).toHaveLength(1);
  expect(exported.annex.sealed).toBe(false);
  expect(exported.production_findings_modified).toBe(false);
  expect(exported.production_report_modified).toBe(false);
  expect(exported.production_seal_modified).toBe(false);
  expect(await page.evaluate(() => window.__revokedObjectUrls.length)).toBe(revocationsBeforeDownload);

  await page.locator('#copySummary').click();
  await expect(page.locator('#message')).toContainText(/Plain-language test summary copied|Verum Omnis development test/);
  await Promise.all([
    page.waitForEvent('framenavigated'),
    page.locator('#resetButton').click()
  ]);
  await expect(page.locator('#orchestrationResult')).toContainText('Not run yet');
  await expect(page.locator('#runReview')).toBeDisabled();
  await expect(page.locator('#commitDisposition')).toBeDisabled();
  await expect(page.locator('#prepareAnnex')).toBeDisabled();

  expect(errors).toEqual([]);
  expect(badResponses).toEqual([]);
  expectNoDocumentEgress(expect, external, SYNTHETIC_TEXT);
});

for (const scenario of ['dissent', 'unavailable', 'malformed']) {
  test(scenario + ' fails closed through visible controls and rejects human CONFIRMED', async ({ page }) => {
    const external = await installOfflineGuard(page);
    const { errors, badResponses } = watchPage(page);
    await page.goto(PAGE);
    await runBrains(page);
    await runReview(page, scenario);
    await expect(page.locator('#reviewResult')).toContainText('The panel failed closed');
    await expect(page.locator('#reviewResult .seat').nth(0)).toContainText('PASS');
    await expect(page.locator('#reviewResult .seat').nth(1)).toContainText('PASS');
    const expected = scenario === 'dissent' ? 'FAIL' : scenario === 'unavailable' ? 'UNAVAILABLE' : 'MALFORMED';
    await expect(page.locator('#reviewResult .seat').nth(2)).toContainText(expected);
    await expect(page.locator('#reviewResult')).toContainText('Fail-closed reasons');

    await page.locator('#disposition').selectOption('CONFIRMED');
    await page.locator('#commitDisposition').click();
    await expect(page.locator('#message')).toHaveClass('alert');
    await expect(page.locator('#message')).not.toBeEmpty();
    await expect(page.locator('#dispositionResult')).not.toContainText('Revision 1: CONFIRMED');
    await expect(page.locator('#prepareAnnex')).toBeDisabled();

    const downloadEvent = page.waitForEvent('download');
    await page.locator('#downloadResult').click();
    const download = await downloadEvent;
    const exported = await readDownloadedJson(download);
    expect(exported.scenario).toBe(scenario);
    expect(exported.technical_panel.status).toBe('FAIL');
    expect(exported.disposition_history).toEqual([]);
    expect(exported.narrative).toBeNull();
    expect(exported.annex).toBeNull();
    expect(exported.live_provider_calls).toBe(0);
    expect(errors).toEqual([]);
    expect(badResponses).toEqual([]);
    expectNoDocumentEgress(expect, external, SYNTHETIC_TEXT);
  });
}

test('responsive workflow stays inside the viewport at phone, tablet and desktop widths', async ({ page }) => {
  const external = await installOfflineGuard(page);
  const { errors, badResponses } = watchPage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(PAGE);
  await runBrains(page);
  await runReview(page, 'all-pass');

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('#runBrains')).toBeVisible();
    await expect(page.locator('#downloadResult')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      clippedStatuses: [...document.querySelectorAll('.status')]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent.trim())
    }));
    expect(dimensions.document, 'document overflow at ' + width + 'px').toBeLessThanOrEqual(width);
    expect(dimensions.body, 'body overflow at ' + width + 'px').toBeLessThanOrEqual(width);
    expect(dimensions.clippedStatuses, 'clipped status at ' + width + 'px').toEqual([]);
    const buttonBox = await page.locator('#runBrains').boundingBox();
    expect(buttonBox.height).toBeGreaterThanOrEqual(46);
  }
  expect(errors).toEqual([]);
  expect(badResponses).toEqual([]);
  expectNoDocumentEgress(expect, external, SYNTHETIC_TEXT);
});
