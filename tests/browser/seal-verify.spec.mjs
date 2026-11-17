import { test, expect } from '@playwright/test';
import { installOfflineGuard, expectNoDocumentEgress, makeSyntheticPdf } from './helpers.mjs';

const SYNTHETIC_TEXT = 'Synthetic sealing record total R250.00 dated 2 January 2026.';

test('synthetic PDF seals with QR and manifest metadata, then verifies at root verify.html', async ({ page, browserName }) => {
  const external = await installOfflineGuard(page);
  // Exercise one real, guarded digest submission. Stop calendar fallback and
  // upgrade polling before they become additional browser requests; this test
  // covers sealing/verification, not the remote timestamp calendar workflow.
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (/^https:\/\/[a-z]\.pool\.(?:opentimestamps\.org|eternitywall\.com)\//.test(url) &&
          url !== 'https://a.pool.opentimestamps.org/digest') {
        return Promise.reject(new TypeError('Offline test: timestamp fallback and polling disabled'));
      }
      return nativeFetch(input, init);
    };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  await page.goto('/seal-document.html');
  const pdf = await makeSyntheticPdf(page, SYNTHETIC_TEXT);
  await page.locator('#fileInput').setInputFiles({ name: 'synthetic-browser-fixture.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.locator('#sealBtn')).toBeEnabled();
  await page.locator('#sealBtn').click();
  await expect(page.locator('#results')).toHaveClass(/visible/, { timeout: 90000 });
  await expect(page.locator('#downloadSealedPdf')).toHaveAttribute('href', /^blob:/);
  await expect(page.locator('#downloadSealedPdf')).toHaveAttribute('download', 'synthetic-browser-fixture-sealed.pdf');
  await expect(page.locator('#sealIdDisplay')).toHaveText(/^VO-[0-9A-F]{12}$/);
  await expect(page.locator('#sha512Display')).toHaveText(/^[0-9a-f]{128}$/);
  const qr = await page.locator('#qrPreview').evaluate((canvas) => canvas.toDataURL());
  expect(qr.length).toBeGreaterThan(1000);
  const verifyHref = await page.locator('#verifyLink').getAttribute('href');
  expect(verifyHref).toContain('/verify.html?h=');
  expect(verifyHref).toContain('&m=');

  const downloadEvent = page.waitForEvent('download');
  await page.locator('#downloadSealedPdf').click();
  const download = await downloadEvent;
  const sealedStream = await download.createReadStream();
  const sealedChunks = [];
  for await (const chunk of sealedStream) sealedChunks.push(chunk);
  const sealedPdf = Buffer.concat(sealedChunks);
  expect(sealedPdf.length).toBeGreaterThan(1000);

  const sealedMetadata = await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const doc = await PDFLib.PDFDocument.load(bytes);
    return { subject: doc.getSubject() || '', producer: doc.getProducer() || '', pages: doc.getPageCount() };
  }, sealedPdf.toString('base64'));
  expect(sealedMetadata.subject).toContain('VO-SEAL2|');
  expect(sealedMetadata.subject).toContain('|ORIG:');
  expect(sealedMetadata.producer.length).toBeGreaterThan(0);
  expect(sealedMetadata.pages).toBe(1);

  await page.goto('/verify.html');
  const shareMetadata = page.locator('#shareMetaOptIn');
  if (await shareMetadata.count()) await shareMetadata.uncheck();
  await page.locator('#fileInput').setInputFiles({ name: 'synthetic-browser-fixture-sealed.pdf', mimeType: 'application/pdf', buffer: sealedPdf });
  await expect(page.locator('#resultBox')).toHaveClass(/visible/, { timeout: 60000 });
  await expect(page.locator('#statusTitle')).toHaveText(/Verified|Seal Verified|Integrity Verified/i);
  await expect(page.locator('#statusMessage')).toContainText(/match|integrity|authentic/i);
  await expect(page.locator('#errorBox')).not.toHaveClass(/visible/);
  const verificationQr = await page.locator('#qrCanvas').evaluate((canvas) => canvas.toDataURL());
  expect(verificationQr.length).toBeGreaterThan(1000);
  // PDF.js 3.11.174 can emit recovered rendering diagnostics for the encrypted
  // fixture. The wording differs by browser engine, but the integrity and QR
  // assertions above remain mandatory; every other page/worker exception is fatal.
  const unexpectedErrors = errors.filter((message) => {
    if (/(?:The compressed data was not valid|The input data is corrupted): invalid stored block lengths/.test(message)) return false;
    if (browserName === 'webkit' && message.includes('TypeError: Failed to Decode Data.')) return false;
    return true;
  });
  expect(unexpectedErrors).toEqual([]);
  expectNoDocumentEgress(expect, external, SYNTHETIC_TEXT);
});
