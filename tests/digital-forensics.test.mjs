/**
 * Digital-forensics module (raw PDF structure): revision snapshots, saves after
 * a digital signature, embedded active content, XMP vs Info disagreement.
 * Synthetic byte fixtures — every check must fire on the doctored case and stay
 * quiet on the clean single-save case (a Verum-sealed output's shape).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ENGINE = require('../forensic-engine-page.js');
const SCAN = ENGINE.voDigitalForensicsScan;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  digital-forensics.test.mjs');
console.log('======================================================\n');

const bytes = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);
const pad = 'x'.repeat(200);
const fakeDoc = (over = {}) => ({
  getProducer: () => over.producer ?? 'pdf-lib (https://github.com/Hopding/pdf-lib)',
  getCreator: () => over.creator ?? '',
  getCreationDate: () => over.creationDate ?? new Date('2026-01-10T10:00:00Z'),
  getModificationDate: () => over.modDate ?? new Date('2026-01-10T10:00:00Z'),
});

// Clean single-save file (the shape of Verum's own sealed output): quiet.
{
  const f = SCAN(bytes('%PDF-1.7\n' + pad + '\nstartxref\n123\n%%EOF\n'), fakeDoc());
  ok(f.length === 0, 'clean single-revision file yields ZERO digital-forensics findings: got ' + f.map(x => x.type).join(','));
}

// Linearized file (2 EOFs) must NOT flag revisions.
{
  const f = SCAN(bytes('%PDF-1.7\n%%EOF\n' + pad + '\n%%EOF\n'), fakeDoc());
  ok(!f.some(x => x.type === 'CT30'), 'two EOFs (linearized) does not flag revision history');
}

// 3+ EOFs = embedded revision snapshots (CT30, low severity).
{
  const f = SCAN(bytes('%PDF-1.7\n%%EOF\n' + pad + '%%EOF\n' + pad + '%%EOF\n'), fakeDoc());
  const hit = f.find(x => x.type === 'CT30');
  ok(!!hit && hit.severity <= 2 && /revision snapshots/.test(hit.evidence),
    'three EOFs flags embedded revision snapshots at low severity');
}

// Saves after a digital signature (CT41): /ByteRange then 2 EOFs after it.
{
  const f = SCAN(bytes('%PDF-1.7\n%%EOF\n /ByteRange [0 100 200 50] ' + pad + '%%EOF\n' + pad + '%%EOF\n'), fakeDoc());
  const hit = f.find(x => x.type === 'CT41');
  ok(!!hit && /AFTER a digital signature/.test(hit.evidence), 'save after signature flags CT41');
}
// Signature as the LAST revision (normal signing) must NOT flag CT41.
{
  const f = SCAN(bytes('%PDF-1.7\n%%EOF\n' + pad + ' /ByteRange [0 100 200 50] ' + pad + '%%EOF\n'), fakeDoc());
  ok(!f.some(x => x.type === 'CT41'), 'signature in the final revision does not flag post-signing saves');
}

// Embedded JavaScript flags CT42 (low severity).
{
  const f = SCAN(bytes('%PDF-1.7\n /JavaScript (app.alert) ' + pad + '%%EOF\n'), fakeDoc());
  ok(f.some(x => x.type === 'CT42' && x.severity <= 2), 'embedded /JavaScript flags active content at low severity');
}

// XMP vs Info creation-date disagreement beyond 26h flags CT29.
{
  const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><xmp:CreateDate>2018-05-01T09:00:00Z</xmp:CreateDate></x:xmpmeta>';
  const f = SCAN(bytes('%PDF-1.7\n' + xmp + '\n' + pad + '%%EOF\n'), fakeDoc({ creationDate: new Date('2026-01-10T10:00:00Z') }));
  const hit = f.find(x => x.type === 'CT29');
  ok(!!hit && /metadata stores disagree/.test(hit.evidence), 'XMP vs Info creation-date gap flags CT29');
}
// Same date within tolerance stays quiet.
{
  const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><xmp:CreateDate>2026-01-10T11:30:00Z</xmp:CreateDate></x:xmpmeta>';
  const f = SCAN(bytes('%PDF-1.7\n' + xmp + '\n' + pad + '%%EOF\n'), fakeDoc({ creationDate: new Date('2026-01-10T10:00:00Z') }));
  ok(!f.some(x => x.type === 'CT29'), 'XMP vs Info dates within tolerance stay quiet');
}

// XMP vs Info producer mismatch flags CT24; substring agreement stays quiet.
{
  const xmp = '<x:xmpmeta><pdf:Producer>Microsoft Word 2016</pdf:Producer></x:xmpmeta>';
  const f = SCAN(bytes('%PDF-1.7\n' + xmp + '\n' + pad + '%%EOF\n'), fakeDoc({ producer: 'Adobe Acrobat Pro DC' }));
  ok(f.some(x => x.type === 'CT24' && /different creating tools/.test(x.evidence)),
    'XMP vs Info producer mismatch flags CT24');
}
{
  const xmp = '<x:xmpmeta><pdf:Producer>Adobe Acrobat</pdf:Producer></x:xmpmeta>';
  const f = SCAN(bytes('%PDF-1.7\n' + xmp + '\n' + pad + '%%EOF\n'), fakeDoc({ producer: 'Adobe Acrobat Pro DC' }));
  ok(!f.some(x => x.type === 'CT24'), 'XMP producer that is a substring of Info producer stays quiet');
}

// Defensive: no doc / tiny input never throws.
{
  ok(SCAN(bytes('%PDF'), null).length === 0, 'tiny input + null doc yields no findings and no throw');
}

console.log(`\n[digital-forensics] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[digital-forensics] FAILURES'); process.exit(1); }
console.log('[digital-forensics] ALL GREEN');
