export async function installOfflineGuard(page, allowedOrigin = 'http://127.0.0.1:4173') {
  const external = [];
  const expectedOrigin = new URL(allowedOrigin).origin;
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const sameOriginAsset = url.origin === expectedOrigin &&
      (request.method() === 'GET' || request.method() === 'HEAD') &&
      !/^\/api(?:\/|$)/.test(url.pathname);
    if (sameOriginAsset) return route.continue();
    const body = request.postData() || '';
    const bodyBuffer = request.postDataBuffer();
    const staticAsset = (request.method() === 'GET' && !body && (
      (url.origin === expectedOrigin && url.pathname === '/api/v1/rules/manifest' && !url.search) ||
      (url.protocol === 'https:' && url.hostname === 'fonts.googleapis.com' && /^\/css2?$/.test(url.pathname)) ||
      (url.protocol === 'https:' && url.hostname === 'fonts.gstatic.com' && url.pathname.startsWith('/s/'))
    ));
    const allowedRuleManifest = staticAsset && url.origin === expectedOrigin && url.pathname === '/api/v1/rules/manifest';
    const timestampDigestCandidate = request.method() === 'POST' && url.protocol === 'https:' &&
      /^[a-z]\.pool\.opentimestamps\.org$/.test(url.hostname) && url.pathname === '/digest' &&
      bodyBuffer !== null && bodyBuffer.length === 32;
    external.push({
      method: request.method(),
      url: request.url(),
      headers: await request.allHeaders(),
      body,
      bodyBase64: bodyBuffer ? bodyBuffer.toString('base64') : '',
      staticAsset,
      timestampDigestCandidate
    });
    return allowedRuleManifest ? route.continue() : route.abort('failed');
  });
  return external;
}

export function expectNoDocumentEgress(expect, external, syntheticText, expectedTimestampDigest = null) {
  const fragments = [syntheticText, ...syntheticText.split(/\s+/).filter((word) => word.length >= 6)];
  const variants = new Set();
  for (const fragment of fragments) {
    variants.add(fragment.toLowerCase());
    variants.add(encodeURIComponent(fragment).toLowerCase());
    variants.add(Buffer.from(fragment, 'utf8').toString('base64').toLowerCase());
  }
  for (const request of external) {
    const allRequestData = JSON.stringify(request).toLowerCase();
    for (const variant of variants) {
      expect(allRequestData.includes(variant), `document fragment reached a blocked destination: ${variant}`).toBeFalsy();
    }
  }
  let expectedDigestBase64 = null;
  if (expectedTimestampDigest !== null) {
    const expectedDigest = Buffer.from(expectedTimestampDigest);
    if (expectedDigest.length !== 32) throw new TypeError('The expected OTS digest must be exactly 32 bytes');
    expectedDigestBase64 = expectedDigest.toString('base64');
  }
  const unexpected = external.filter((request) => {
    if (request.staticAsset) return false;
    if (request.timestampDigestCandidate && expectedDigestBase64 !== null && request.bodyBase64 === expectedDigestBase64) return false;
    return true;
  });
  expect(unexpected, `only the test origin, static fonts and the exact expected 32-byte OTS digest submission are permitted: ${JSON.stringify(unexpected)}`).toEqual([]);
}

export async function makeSyntheticPdf(page, text) {
  const base64 = await page.evaluate(async (sourceText) => {
    const doc = await PDFLib.PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    page.drawText(sourceText, { x: 50, y: 760, size: 11, font });
    doc.setTitle('Synthetic browser contract fixture');
    doc.setAuthor('Verum Omnis synthetic test');
    doc.setCreationDate(new Date('2026-11-15T00:00:00.000Z'));
    doc.setModificationDate(new Date('2026-11-15T00:00:00.000Z'));
    const bytes = await doc.save();
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  }, text);
  return Buffer.from(base64, 'base64');
}
