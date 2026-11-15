export async function installOfflineGuard(page) {
  const external = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    external.push({ method: request.method(), url: request.url(), body: request.postData() || '' });
    return route.abort('failed');
  });
  return external;
}

export function expectNoDocumentEgress(expect, external, syntheticText) {
  expect(external.every((request) => !request.body.includes(syntheticText))).toBeTruthy();
  expect(external.every((request) => !/\/api\/v1\/ai\/|\/api\/v1\/feedback\//.test(request.url))).toBeTruthy();
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
