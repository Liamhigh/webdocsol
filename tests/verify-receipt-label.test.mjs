import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

for (const path of ['verify.html', 'seal-module/web/verify.html']) {
  const html = readFileSync(path, 'utf8');
  const section = html.slice(html.indexOf('id="custodyBox"'), html.indexOf('id="previewBox"'));
  assert.ok(section.includes('Your verification receipt'), `${path}: receipt heading`);
  assert.match(section, /verdict, including whether the fingerprint matches, the verification time \(UTC\), and the custody chain/);
  assert.match(section, /fingerprint of its custody record is submitted to OpenTimestamps for Bitcoin anchoring when available/);
  assert.match(section, /id="custodyReceiptBtn" onclick="downloadCustodyReceipt\(\)">Download your verification receipt \(JSON\)/);
}
