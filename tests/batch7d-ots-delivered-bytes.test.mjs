// Batch 7d — OpenTimestamps receipts must verify against the exact delivered file.
// Legacy SHA-256(SHA-512 hex text) receipts remain valid historical proofs.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const crypto = require('node:crypto');
const t = require('./_assert');
require('../ots-proof.js');

const seal = readFileSync('seal-document.html', 'utf8');
const verify = readFileSync('verify.html', 'utf8');
const report = readFileSync('forensic-report.js', 'utf8');
const sha256 = (bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const sha512 = (bytes) => crypto.createHash('sha512').update(Buffer.from(bytes)).digest('hex');
const originalBytes = new TextEncoder().encode('original upload bytes');
const sealedBytes = new TextEncoder().encode('sealed PDF bytes — including the seal');
const encryptedBytes = new TextEncoder().encode('encrypted bytes actually delivered');
const originalSha512 = sha512(originalBytes);
const legacyDigest = sha256(new TextEncoder().encode(originalSha512));
const sealedDigest = sha256(sealedBytes);
const encryptedDigest = sha256(encryptedBytes);

t.ok(sealedDigest !== legacyDigest && encryptedDigest !== legacyDigest && encryptedDigest !== sealedDigest,
  'the controls distinguish original hash-of-hash, sealed-file and encrypted-delivery digests');

// Exercise the real sealer helpers, not a reimplementation of their formula.
const qrStart = seal.indexOf("var VO_OTS_DELIVERED_FILE_SCHEME = 'delivered-file-sha256';");
const qrEnd = seal.indexOf('// Watermark loads eagerly at boot', qrStart);
const sealerSandbox = {
  window: {}, document: { getElementById: () => null }, console,
  TextEncoder, Uint8Array,
  computeSHA256: async (bytes) => sha256(bytes),
  submitToOTS: async (digest) => ({ success: true, calendar: 'https://calendar.example', submittedDigest: digest })
};
sealerSandbox.globalThis = sealerSandbox;
if (qrStart >= 0 && qrEnd > qrStart) vm.runInNewContext(seal.slice(qrStart, qrEnd), sealerSandbox);
t.ok(typeof sealerSandbox.voSubmitDeliveredFileOTS === 'function',
  'the sealer exposes one post-seal delivered-byte submission helper');
let sealedSubmission = null;
let encryptedSubmission = null;
if (typeof sealerSandbox.voSubmitDeliveredFileOTS === 'function') {
  sealedSubmission = await sealerSandbox.voSubmitDeliveredFileOTS(sealedBytes);
  encryptedSubmission = await sealerSandbox.voSubmitDeliveredFileOTS(encryptedBytes);
}
t.ok(sealedSubmission && sealedSubmission.digestHex === sealedDigest &&
  sealedSubmission.result.submittedDigest === sealedDigest && sealedSubmission.scheme === 'delivered-file-sha256',
  'a new unprotected receipt submits SHA-256 of the exact sealed bytes');
t.ok(encryptedSubmission && encryptedSubmission.digestHex === encryptedDigest &&
  encryptedSubmission.result.submittedDigest === encryptedDigest,
  'a password-protected receipt submits the encrypted bytes actually delivered, not the plaintext seal');
if (sealedSubmission) {
  const receipt = globalThis.VoOts.buildPendingReceipt(sealedSubmission.digestHex, ['https://calendar.example']);
  t.ok(globalThis.VoOts.parseSummary(receipt).digestHex === sealedDigest &&
    globalThis.VoOts.bytesToHex(receipt.slice(33, 65)) === sealedDigest,
    'the detached OpenTimestamps receipt itself carries the delivered-file digest');
} else t.ok(false, 'the detached receipt carries the delivered-file digest');

if (typeof sealerSandbox.buildQrPayload === 'function') {
  const qr = sealerSandbox.buildQrPayload({ v: '1.2', t: 1, type: 'private', sha512: originalSha512,
    sealId: 'VO-TEST', otsDigestScheme: 'delivered-file-sha256' }, null);
  t.ok(qr.otsDigestScheme === 'delivered-file-sha256' && !Object.prototype.hasOwnProperty.call(qr, 'otsDigest'),
    'new QR metadata names the delivered-file scheme without embedding a self-referential final digest');
} else t.ok(false, 'new QR metadata carries the scheme marker');

// No legacy digest may be computed during intake, and no calendar submission may
// happen before the final delivered bytes exist.
const intakeStart = seal.indexOf('async function startSealing(');
const pipelineStart = seal.indexOf('async function runSealingPipeline(');
const pipelineEnd = seal.indexOf('// Native share via the Web Share API', pipelineStart);
const intake = seal.slice(intakeStart, pipelineStart);
const pipeline = seal.slice(pipelineStart, pipelineEnd);
t.ok(!/computeSHA256\(new TextEncoder\(\)\.encode\(sha512\)\)/.test(intake),
  'document intake no longer derives a new receipt from the original SHA-512 hex text');
t.ok(!/computeSHA256\(new TextEncoder\(\)\.encode\((?:rSha512|hSha512|fnSha512)\)\)/.test(pipeline) &&
  !/submitToOTS\(/.test(pipeline),
  'the main and report pipelines never submit the legacy digest or bypass the delivered-byte helper');
t.ok((pipeline.match(/voSubmitDeliveredFileOTS\(/g) || []).length === 4,
  'the main document, technical report, court-ready narrative and forensic narrative all use the helper');
const deliveredPos = pipeline.indexOf('var _deliveredBytes = (password && encryptedBytes) ? encryptedBytes : sealedBytes;');
const mainSubmitPos = pipeline.indexOf('voSubmitDeliveredFileOTS(_deliveredBytes)');
t.ok(deliveredPos >= 0 && mainSubmitPos > deliveredPos &&
  pipeline.indexOf('sealedBytes = await buildSealedPDF') < deliveredPos,
  'the main receipt is created only after sealing and optional encryption select the delivered bytes');
for (const [variable, sealCall] of [['rSealedBytes', 'var rSealedBytes = await window.VerumReport.seal'],
  ['hSealedBytes', 'var hSealedBytes = await window.VerumReport.seal'],
  ['fnSealed', 'var fnSealed = await window.VerumReport.seal']]) {
  const submitPos = pipeline.indexOf('voSubmitDeliveredFileOTS(' + variable + ')');
  t.ok(submitPos > pipeline.indexOf(sealCall),
    variable + ' is timestamped only after its final sealed bytes exist');
}
t.ok(/otsDigestScheme:\s*VO_OTS_DELIVERED_FILE_SCHEME/.test(pipeline) &&
  /OTS DIGEST \(SHA-256 OF THE EXACT DELIVERED FILE BYTES\)/.test(seal),
  'the anchor certificate records the delivered-byte digest and labels it honestly');
t.ok(/OTS:DELIVERED-FILE-SHA256/.test(seal) && /OTS:DELIVERED-FILE-SHA256/.test(report),
  'new document and report Subjects retain the scheme marker even when QR generation fails');
t.ok(!verify.includes('Original Content SHA-512 (submitted to OpenTimestamps)') &&
  verify.includes("meta.otsDigestScheme === 'delivered-file-sha256'") &&
  !verify.includes('fingerprint of the original upload existed'),
  'verifier wording distinguishes original fingerprints from delivered-file receipts in both schemes');

// Verify the real digest-resolution functions with legacy and new controls.
const resolveStart = verify.indexOf('// Pure digest derivation');
const resolveEnd = verify.indexOf('// Poll the calendars', resolveStart);
const verifierSandbox = {
  window: { crypto: webcrypto }, crypto: webcrypto, TextEncoder, Uint8Array,
  qrPayload: null,
  bufToHex: (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(''),
  console
};
verifierSandbox.globalThis = verifierSandbox;
if (resolveStart >= 0 && resolveEnd > resolveStart) vm.runInNewContext(verify.slice(resolveStart, resolveEnd), verifierSandbox);
const resolve = verifierSandbox.resolveOtsDigest;
t.ok(typeof resolve === 'function', 'the verifier digest resolver is available for compatibility controls');
if (typeof resolve === 'function') {
  const legacyQrDigest = '11'.repeat(32);
  verifierSandbox.qrPayload = { meta: { sealId: 'VO-LEGACY', otsDigest: legacyQrDigest } };
  const legacyQr = await resolve({ sealId: 'VO-LEGACY' }, { scheme: 'v2', sealId: 'VO-LEGACY', origHash: originalSha512 }, sealedBytes);
  t.ok(legacyQr && legacyQr.digestHex === legacyQrDigest,
    'a legacy QR digest keeps precedence for a legacy seal');

  verifierSandbox.qrPayload = null;
  const embeddedDigest = '22'.repeat(32);
  const legacyEmbedded = await resolve({ sealId: 'VO-LEGACY', otsDigest: embeddedDigest },
    { scheme: 'v2', sealId: 'VO-LEGACY', origHash: originalSha512 }, sealedBytes);
  t.ok(legacyEmbedded && legacyEmbedded.digestHex === embeddedDigest,
    'a legacy embedded-metadata digest keeps precedence for a legacy seal');

  const legacyOrig = await resolve({ sealId: 'VO-LEGACY' },
    { scheme: 'v2', sealId: 'VO-LEGACY', origHash: originalSha512 }, sealedBytes);
  t.ok(legacyOrig && legacyOrig.digestHex === legacyDigest,
    'a legacy seal without an embedded digest still recomputes SHA-256 of the ORIG SHA-512 hex text');

  verifierSandbox.qrPayload = { meta: { sealId: 'VO-NEW', otsDigestScheme: 'delivered-file-sha256', otsDigest: legacyDigest } };
  const rawQr = await resolve({ sealId: 'VO-NEW' },
    { scheme: 'v2', sealId: 'VO-NEW', origHash: originalSha512 }, sealedBytes);
  t.ok(rawQr && rawQr.digestHex === sealedDigest && rawQr.digestHex !== legacyDigest,
    'a new QR scheme marker recomputes from delivered bytes and never trusts a stale embedded digest');

  verifierSandbox.qrPayload = null;
  const rawSubject = await resolve({ sealId: 'VO-NEW', otsDigestScheme: 'delivered-file-sha256' },
    { scheme: 'v2', sealId: 'VO-NEW', origHash: originalSha512, otsDigestScheme: 'delivered-file-sha256' }, encryptedBytes);
  t.ok(rawSubject && rawSubject.digestHex === encryptedDigest,
    'a new Subject marker works without a QR and hashes the encrypted delivered bytes');
  const noBytes = await resolve({ sealId: 'VO-NEW', otsDigestScheme: 'delivered-file-sha256' },
    { scheme: 'v2', sealId: 'VO-NEW', origHash: originalSha512, otsDigestScheme: 'delivered-file-sha256' }, null);
  t.ok(noBytes === null,
    'a delivered-file scheme never silently falls back to the legacy digest when delivered bytes are unavailable');

  const anchorDigest = '33'.repeat(32);
  const anchor = await resolve({ sealId: 'VO-ANCHOR', otsDigest: anchorDigest },
    { scheme: 'anchorcert', sealId: 'VO-ANCHOR', otsDigest: anchorDigest }, sealedBytes);
  t.ok(anchor && anchor.digestHex === anchorDigest,
    'an anchor certificate remains a detached proof record carrying its explicit digest');

  verifierSandbox.qrPayload = { meta: { sealId: 'VO-CERT', otsDigestScheme: 'delivered-file-sha256' } };
  const certificateDigest = '44'.repeat(32);
  const certificate = await resolve({ sealId: 'VO-CERT', otsDigest: certificateDigest },
    { scheme: 'sealcert', sealId: 'VO-CERT', embeddedHash: originalSha512, otsDigest: certificateDigest }, sealedBytes);
  const anchorWithQr = await resolve({ sealId: 'VO-CERT', otsDigest: certificateDigest },
    { scheme: 'anchorcert', sealId: 'VO-CERT', otsDigest: certificateDigest }, sealedBytes);
  t.ok(certificate && certificate.digestHex === certificateDigest && anchorWithQr && anchorWithQr.digestHex === certificateDigest &&
    certificate.digestHex !== sha256(sealedBytes),
    'detached certificate digests beat a matching document QR and never hash the certificate itself');
  verifierSandbox.qrPayload = null;
}

const subjectStart = verify.indexOf('function parseSealSubject(subject)');
const subjectEnd = verify.indexOf('// SEAL-CERT|', subjectStart);
const subjectSandbox = { VO_SEAL2_PREFIX: 'VO-SEAL2|' };
vm.runInNewContext(verify.slice(subjectStart, subjectEnd), subjectSandbox);
const parsedNewSubject = subjectSandbox.parseSealSubject(
  'VO-SEAL2|' + 'a'.repeat(128) + '|VO-NEW|ORIG:' + originalSha512 + '|OTS:DELIVERED-FILE-SHA256');
t.ok(parsedNewSubject && parsedNewSubject.otsDigestScheme === 'delivered-file-sha256',
  'the verifier reads the new Subject scheme marker');

const certSubjectStart = verify.indexOf("var VO_SEALCERT_PREFIX = 'SEAL-CERT|';");
const certSubjectEnd = verify.indexOf('// ANCHOR-CERT|', certSubjectStart);
const certSandbox = {};
vm.runInNewContext(verify.slice(certSubjectStart, certSubjectEnd), certSandbox);
const certDigest = '55'.repeat(32);
const parsedCert = certSandbox.parseSealCertSubject(
  'SEAL-CERT|' + originalSha512 + '|VO-CERT|OTS:' + certDigest);
const parsedLegacyCert = certSandbox.parseSealCertSubject('SEAL-CERT|' + originalSha512 + '|VO-LEGACY');
const certBases = seal.split('var certBase =').slice(1);
t.ok(parsedCert && parsedCert.otsDigest === certDigest && parsedLegacyCert && parsedLegacyCert.otsDigest === null &&
  /'\|OTS:' \+ certOtsDigest/.test(seal) && certBases.length === 2 &&
  certBases.every((block) => block.slice(0, 650).includes('otsDigest: otsDigestHex')),
  'new PDF and raw-media Seal Certificates carry their explicit submitted digest while legacy certificates stay readable');

t.ok(/verifyPdf\(pdfBytes\.buffer, pdfName, buf\)/.test(verify) &&
  /runOtsAnchorCheck\(meta, seal, pageCount, deliveredBytes\)/.test(verify),
  'voice delivery retains the original encrypted bytes for OTS while verifying the decrypted PDF seal');

const encryptionHelperStart = verify.indexOf('function hasPdfEncryptionDictionary(bytes)');
const encryptionHelperEnd = verify.indexOf('async function verifyPdf(', encryptionHelperStart);
const encryptionSandbox = { Uint8Array };
vm.runInNewContext(verify.slice(encryptionHelperStart, encryptionHelperEnd), encryptionSandbox);
const encryptedPdfShape = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<< /Encrypt 7 0 R >>\n%%EOF');
const unencryptedPdfShape = new TextEncoder().encode('%PDF-1.7\nstream\n/Encrypt is discussed here\nendstream\n%%EOF');
t.ok(encryptionSandbox.hasPdfEncryptionDictionary(encryptedPdfShape) &&
  !encryptionSandbox.hasPdfEncryptionDictionary(unencryptedPdfShape) &&
  /meta\.otsDigestScheme = 'delivered-file-sha256'/.test(verify) &&
  /verdict !== 'NO_SEAL' \|\| standardEncryptedDelivery/.test(verify) &&
  /showNoSeal\(hashHex, standardEncryptedDelivery\)/.test(verify),
  'standard encrypted PDFs check their delivered-byte receipt without claiming their locked seal was inspected');

const passwordHelperStart = verify.indexOf('function pdfPasswordRequired(error)');
const passwordHelperEnd = verify.indexOf('// pdf.js-based detection', passwordHelperStart);
const passwordSandbox = {};
vm.runInNewContext(verify.slice(passwordHelperStart, passwordHelperEnd), passwordSandbox);
const staleTrailerShape = new TextEncoder().encode('%PDF-1.7\ntrailer\n<< /Encrypt 7 0 R /Root 2 0 R >>\n%%EOF');
t.ok(encryptionSandbox.hasPdfEncryptionDictionary(staleTrailerShape) &&
  passwordSandbox.pdfPasswordRequired({ name: 'PasswordException', message: 'No password given' }) &&
  !passwordSandbox.pdfPasswordRequired(new Error('ordinary parser failure')) &&
  /standardEncryptedDelivery = standardEncryptedDelivery && !!\(pdfSeal && pdfSeal\.passwordRequired\)/.test(verify),
  'a stale encryption trailer cannot trigger encrypted-delivery wording unless pdf.js actually requires a password');

t.ok(!verify.includes('PENDING — submitted to calendars') &&
  verify.includes('pending, or this digest was not submitted') &&
  verify.includes('not the unprotected sender copy') &&
  verify.includes('Older encrypted deliveries may use the legacy digest') &&
  verify.includes('DELIVERED_FILE_SHA256 (digest recomputed from delivered bytes; not embedded in the QR)'),
  'pending, protected-copy, legacy-encrypted and custody wording never invents a submission or embedded digest');

const pdfLib = require('../vendor/pdf-lib.min.js');
globalThis.PDFLib = pdfLib;
const engine = require('../forensic-engine-page.js');
for (const [name, source] of [
  ['live', seal],
  ['module', readFileSync('seal-module/web/seal-document.html', 'utf8')]
]) {
  let clock = '2026-12-31T23:59:59.123Z';
  let calls = 0;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
  }
  const submitStart = source.indexOf('async function submitToOTS(');
  const submitEnd = source.indexOf('\nfunction updateStep(', submitStart);
  const sandbox = {
    Date: Clock, Uint8Array, AbortController, setTimeout, clearTimeout,
    console, hexToBytes: () => new Uint8Array([1, 2, 3]),
    fetch: async () => {
      calls++;
      if (calls === 1) return { ok: false };
      if (calls === 2) return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
      clock = '2027-01-01T23:30:45.123Z';
      return { ok: true, arrayBuffer: async () => {
        clock = '2027-01-01T23:31:45.123Z';
        return new Uint8Array([4, 5]).buffer;
      } };
    }
  };
  vm.runInNewContext(source.slice(submitStart, submitEnd), sandbox);
  const result = await sandbox.submitToOTS('00');
  t.ok(result.success && result.submittedAt === '2027-01-01T23:30:45.123Z' &&
    result.calendar.includes('eternitywall') && Array.from(result.proof).join(',') === '4,5',
    name + ': successful calendar response captures its own time before reading the proof, after failures');
  sandbox.fetch = async () => ({ ok: false });
  const failure = await sandbox.submitToOTS('00');
  t.ok(!failure.success && !('submittedAt' in failure), name + ': failed submissions have no submission time');

  const certStart = source.indexOf('async function buildAnchorCertificate(');
  const certEnd = source.indexOf('// ==================== SEALING FLOW', certStart);
  const draws = [];
  const PDFDocument = {
    create: async () => {
      const doc = await pdfLib.PDFDocument.create();
      const addPage = doc.addPage.bind(doc);
      doc.addPage = (...args) => {
        const page = addPage(...args.map(arg => Array.isArray(arg) ? Array.from(arg) : arg));
        const drawText = page.drawText.bind(page);
        page.drawText = (text, options) => { draws.push({ text, ...options }); return drawText(text, options); };
        return page;
      };
      return doc;
    }
  };
  const buildAnchorCertificate = new Function('PDFDocument', 'StandardFonts', 'rgb',
    source.slice(certStart, certEnd) + '\nreturn buildAnchorCertificate;')(PDFDocument, pdfLib.StandardFonts, pdfLib.rgb);
  const options = { timestampISO: result.submittedAt, sealId: 'VO-TEST', sha512: 'a'.repeat(128),
    sealedSha512: 'b'.repeat(128), otsDigest: 'c'.repeat(64), calendars: ['https://calendar.example'] };
  const certBytes = await buildAnchorCertificate(options);
  const loaded = await pdfLib.PDFDocument.load(certBytes);
  const text = (await engine.extractPageText(certBytes, 0, loaded)).join(' ').replace(/\s+/g, ' ');
  t.ok(text.includes('BITCOIN CONFIRMATION PENDING') && text.includes('Submitted ' + result.submittedAt) &&
    text.includes('confirmation expected by 2027-01-02T01:30:45.123Z') &&
    text.includes('estimate; typically 1-2 hours; set by the Bitcoin network, not by this platform') &&
    text.includes('Upgrade the receipt at verumglobal.foundation/verify.html after that time.'),
    name + ': rendered certificate carries the submission, estimated UTC window and upgrade pointer');
  t.ok(draws.filter(d => d.text === result.submittedAt).length === 1 &&
    source.slice(source.indexOf('// Anchor Certificate (BOTH modes')).includes('timestampISO: otsResult.submittedAt'),
    name + ': the submitted row and status use the calendar time passed to the anchor builder');
  const body = draws.filter(d => d.text !== 'VERUM OMNIS FOUNDATION  |  PATENT PENDING' &&
    !d.text.startsWith('Check the seal and its anchor') && !d.text.startsWith('Confirm and upgrade'));
  t.ok(body.every(d => d.y > 60) &&
    (name !== 'module' || draws.find(d => d.text === result.submittedAt).y > 250),
    name + ': certificate body clears the footer and the module statement box');
  let rejected = false;
  try { await buildAnchorCertificate({}); } catch (e) { rejected = /submission time unavailable/.test(e.message); }
  t.ok(rejected, name + ': missing submission time is not silently replaced by another clock');
}

t.done('batch7d-ots-delivered-bytes');
