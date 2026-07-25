/**
 * The forensic scripts are inlined into seal-document.html so the scan can
 * never fail on a dropped /forensic-engine-page.js request (on this deployment,
 * root-level .js paths intermittently serve the home page HTML instead of the
 * file). This test guards the inline copies against drift: each block marked
 * VO-INLINE:<file> must byte-match the source file at repo root. If someone
 * edits the engine but not the inlined copy (or vice versa), this fails.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  inline-scripts.test.mjs');
console.log('======================================================\n');

const html = readFileSync('seal-document.html', 'utf8');
const FILES = ['forensic-report.js', 'forensic-engine-page.js', 'ots-proof.js', 'pdf-encrypt.js'];

// No external root-.js <script src> tags may remain in the seal page.
for (const f of FILES) {
  ok(!new RegExp('<script[^>]*\\bsrc="/' + f.replace('.', '\\.')).test(html),
    `${f} is inlined, not loaded via <script src>`);
}

for (const f of FILES) {
  const re = new RegExp('/\\* VO-INLINE:' + f.replace('.', '\\.') + ':START \\*/\\n([\\s\\S]*?)\\n/\\* VO-INLINE:' + f.replace('.', '\\.') + ':END \\*/');
  const m = html.match(re);
  ok(Boolean(m), `${f} inline block present`);
  if (!m) continue;
  const source = readFileSync(f, 'utf8').replace(/\n+$/, '');
  ok(m[1] === source, `${f} inline copy matches the source file (no drift)`);
}

console.log(`\n[inline-scripts] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[inline-scripts] FAILURES'); process.exit(1); }
console.log('[inline-scripts] ALL GREEN');
