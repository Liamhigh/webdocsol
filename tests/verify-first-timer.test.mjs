import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

for (const path of ['verify.html', 'seal-module/web/verify.html']) {
  const html = readFileSync(path, 'utf8');
  const drop = html.slice(html.indexOf('id="dropZone"'), html.indexOf('id="gpsOptInBox"'));
  assert.ok(drop.includes('1. Get the sealed PDF (or .voice file) from the sender &middot; 2. Drop it here (or paste the QR payload) &middot; 3. Read the verdict and download your verification receipt.'));
  assert.ok(drop.includes('The file is required for an integrity verdict and verification receipt.'));
  assert.ok(html.includes('Scan a QR code with your device, then paste its payload here'));
}
const root = readFileSync('verify.html', 'utf8');
assert.ok(root.includes('Lost the original? Find a sealed document'));
assert.ok(root.includes('Choose PDFs to search on this device'));
