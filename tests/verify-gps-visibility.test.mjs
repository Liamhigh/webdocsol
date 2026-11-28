import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

for (const path of ['verify.html', 'seal-module/web/verify.html']) {
  const html = readFileSync(path, 'utf8');
  const drop = html.indexOf('id="dropZone"');
  const gps = html.indexOf('id="gpsOptInBox"');
  const sharing = html.indexOf('id="shareMetaBox"');
  assert.ok(drop >= 0 && drop < gps && gps < sharing, `${path}: location follows the drop zone`);
  assert.match(html, /<input type="checkbox" id="custodyGpsOptIn">/);
  assert.ok(html.includes('Include my device-reported location in the verification record (not independent proof of presence)'));
}
