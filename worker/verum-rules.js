// ============================================================================
// verum-rules — Verum Omnis signed rule-package backend (Cloudflare Worker)
// ----------------------------------------------------------------------------
// Endpoints:
//   GET  /api/v1/status           service status + current rule version
//   GET  /api/v1/rules/manifest   signed rule package manifest
//   POST /api/v1/feedback/patterns  anonymized pattern feedback intake
//   POST /api/v1/admin/publish    admin: publish a new signed rule package
//   GET  /constitution.pdf        sealed Verum Omnis Constitution v6 PDF (from KV)
//   GET  /docs/constitution.pdf   alias of /constitution.pdf
//   GET  /images/logo-full.png    site logo PNG (from KV)
//   GET  /images/watermark_portrait.png  watermark PNG (from KV)
//   POST /api/v1/ai/gatekeep      AI licensing gatekeeper (commercial-use signals)
//   POST /api/v1/ai/classify      AI document triage classification (pre-engine scope)
//   POST /api/v1/ai/assess        AI antithesis review of candidate findings
//   POST /api/v1/ai/narrate       AI forensic report narrative drafting
//   POST /api/v1/ai/curate        admin: AI-drafted rule candidates from feedback
//
// Signing: RSASSA-PKCS1-v1_5 with SHA-512 over the canonical JSON of the
// package (object keys sorted recursively, compact separators, UTF-8).
// Android clients verify with "SHA512withRSA"; WebCrypto uses
// RSASSA-PKCS1-v1_5 + SHA-512. See rule-format.md.
//
// AI: Workers AI binding "AI". Every AI endpoint has a deterministic
// fallback so model errors/timeouts/invalid replies never break clients.
//
// Secrets (never commit): RULE_PRIVATE_KEY (PKCS8 DER base64), ADMIN_TOKEN.
// Bindings: RULES_KV (KV namespace "verum-rules-kv"), AI (Workers AI).
// ============================================================================

const ALGORITHM = 'RSASSA-PKCS1-v1_5-SHA512';
const PUBLIC_KEY_ID = 'vo-master-1';
const CURRENT_KEY = 'rules:current';
const SERVICE = 'verum-rules';

// Sealed Constitution v6 PDF stored in KV as base64 chunks
// (pdf:constitution-v6:meta + pdf:constitution-v6:chunk:000..NNN).
const PDF_META_KEY = 'pdf:constitution-v6:meta';
const PDF_CHUNK_PREFIX = 'pdf:constitution-v6:chunk:';

const MAX_FEEDBACK_BODY = 16 * 1024;   // 16 KB hard cap
const MAX_PUBLISH_BODY = 1024 * 1024;  // 1 MB cap for rule packages
const MAX_PATTERNS_PER_SUBMISSION = 200;
const MAX_FEEDBACK_RECORDS_PER_DAY = 2000;
const FEEDBACK_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days, then auto-delete
const MAX_TOTAL_RULES = 5000;          // constitution-check bound

// Fields that must NEVER appear in feedback: anything that could carry
// document content, quotes, or personal data. Case-insensitive, recursive.
const BANNED_FEEDBACK_FIELDS = new Set([
  'quote', 'evidence', 'text', 'content', 'document', 'name',
  'message', 'body', 'raw', 'excerpt', 'snippet', 'file', 'filename',
  'filepath', 'path', 'email', 'phone', 'address', 'subject',
  'description', 'comment', 'note', 'notes', 'details', 'payload',
  'pdf', 'attachment', 'image', 'ocr', 'hash', 'url'
]);

// ------------------------------- utilities --------------------------------

function corsHeaders(extra) {
  const h = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Max-Age': '86400'
  };
  if (extra) Object.assign(h, extra);
  return h;
}

function json(data, status = 200, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...(extraHeaders || {}) })
  });
}

function err(status, code, message, extra) {
  return json({ ok: false, error: code, message, ...(extra || {}) }, status);
}

// Canonical JSON: object keys sorted recursively, compact separators.
// MUST match the client-side canonicalization in rule-format.md exactly.
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// RSA key import is cached for the life of the isolate.
let _keyPromise = null;
function getSigningKey(env) {
  if (!_keyPromise) {
    const der = base64ToBytes(env.RULE_PRIVATE_KEY);
    _keyPromise = crypto.subtle.importKey(
      'pkcs8', der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
      false, ['sign']
    );
  }
  return _keyPromise;
}

async function signPackage(env, pkg) {
  const key = await getSigningKey(env);
  const data = new TextEncoder().encode(canonicalJson(pkg));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
  return bytesToBase64(new Uint8Array(sig));
}

async function loadCurrent(env) {
  const raw = await env.RULES_KV.get(CURRENT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function readBodyText(request, cap) {
  const len = request.headers.get('content-length');
  if (len && Number(len) > cap) return { tooBig: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > cap) return { tooBig: true };
  return { text };
}

// ------------------------------- handlers ---------------------------------

async function handleStatus(env) {
  const rec = await loadCurrent(env);
  if (!rec || !rec.package) {
    return err(503, 'no_rule_package', 'No rule package has been published yet.');
  }
  return json({
    ok: true,
    service: SERVICE,
    version: rec.package.version,
    published_at: rec.package.published_at
  });
}

async function handleManifest(env) {
  const rec = await loadCurrent(env);
  if (!rec || !rec.package || !rec.signature) {
    return err(503, 'no_rule_package', 'No rule package has been published yet.');
  }
  return json({
    package: rec.package,
    signature: rec.signature,
    algorithm: ALGORITHM,
    publicKeyId: PUBLIC_KEY_ID
  });
}

// Serve the sealed Constitution v6 PDF stored in KV as base64 chunks.
// Decodes base64 in slices to stay clear of call-stack / arg-count limits.
async function handleConstitutionPdf(env) {
  const metaRaw = await env.RULES_KV.get(PDF_META_KEY);
  if (!metaRaw) {
    return err(404, 'not_found', 'Constitution PDF is not available.');
  }
  let meta;
  try { meta = JSON.parse(metaRaw); } catch {
    return err(404, 'not_found', 'Constitution PDF is not available.');
  }
  if (!meta || !Number.isInteger(meta.chunks) || meta.chunks < 1) {
    return err(404, 'not_found', 'Constitution PDF is not available.');
  }

  const parts = [];
  for (let i = 0; i < meta.chunks; i++) {
    const chunk = await env.RULES_KV.get(PDF_CHUNK_PREFIX + String(i).padStart(3, '0'));
    if (chunk === null) {
      return err(404, 'not_found', 'Constitution PDF data is incomplete.');
    }
    parts.push(chunk);
  }
  const b64 = parts.join('');

  // Decode base64 in slices aligned to 4-char boundaries; atob on the whole
  // string at once is fine too, but slicing keeps memory use bounded.
  const SLICE = 32768; // multiple of 4, keeps atob input aligned
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  const totalLen = Math.floor(b64.length / 4) * 3 - padding;
  const bytes = new Uint8Array(totalLen);
  let offset = 0;
  for (let i = 0; i < b64.length; i += SLICE) {
    const bin = atob(b64.slice(i, i + SLICE));
    for (let j = 0; j < bin.length; j++) bytes[offset + j] = bin.charCodeAt(j);
    offset += bin.length;
  }

  const filename = typeof meta.filename === 'string' && meta.filename.length > 0
    ? meta.filename
    : 'verum-omnis-constitution-v6-final-sealed.pdf';
  return new Response(bytes, {
    status: 200,
    headers: corsHeaders({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="' + filename + '"',
      'Cache-Control': 'public, max-age=86400'
    })
  });
}

// Site images served from KV (single base64 key per image, e.g. img:logo-full:b64).
const SITE_IMAGES = {
  '/images/logo-full.png': { key: 'img:logo-full:b64', contentType: 'image/png' },
  '/images/watermark_portrait.png': { key: 'img:watermark-portrait:b64', contentType: 'image/png' }
};

// Serve a site image stored in KV as base64. Decodes base64 in slices to stay
// clear of call-stack / arg-count limits (same approach as handleConstitutionPdf).
async function handleImageKv(env, kvKey, contentType) {
  const b64 = await env.RULES_KV.get(kvKey);
  if (b64 === null) {
    return err(404, 'not_found', 'Image is not available.');
  }
  const SLICE = 32768; // multiple of 4, keeps atob input aligned
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  const totalLen = Math.floor(b64.length / 4) * 3 - padding;
  const bytes = new Uint8Array(totalLen);
  let offset = 0;
  for (let i = 0; i < b64.length; i += SLICE) {
    const bin = atob(b64.slice(i, i + SLICE));
    for (let j = 0; j < bin.length; j++) bytes[offset + j] = bin.charCodeAt(j);
    offset += bin.length;
  }
  return new Response(bytes, {
    status: 200,
    headers: corsHeaders({
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=86400'
    })
  });
}

// Recursively collect banned field names present anywhere in the value.
function findBannedFields(value, path, hits) {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) findBannedFields(value[i], path + '[' + i + ']', hits);
    return;
  }
  for (const k of Object.keys(value)) {
    if (BANNED_FEEDBACK_FIELDS.has(k.toLowerCase())) hits.push(path ? path + '.' + k : k);
    findBannedFields(value[k], path ? path + '.' + k : k, hits);
  }
}

function validPattern(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'pattern entries must be objects';
  const keys = Object.keys(p);
  const allowed = ['detectorId', 'type', 'severity', 'pageCount'];
  for (const k of keys) {
    if (!allowed.includes(k)) return 'unsupported field in pattern: "' + k + '" — only detectorId, type, severity, pageCount are accepted';
  }
  if (typeof p.detectorId !== 'string' || p.detectorId.length < 1 || p.detectorId.length > 64) {
    return 'detectorId must be a string of 1-64 characters';
  }
  if (typeof p.type !== 'string' || p.type.length < 1 || p.type.length > 64) {
    return 'type must be a string of 1-64 characters';
  }
  if (typeof p.severity !== 'number' || !Number.isInteger(p.severity) || p.severity < 1 || p.severity > 5) {
    return 'severity must be an integer from 1 to 5';
  }
  if (typeof p.pageCount !== 'number' || !Number.isInteger(p.pageCount) || p.pageCount < 0 || p.pageCount > 1000000) {
    return 'pageCount must be a non-negative integer';
  }
  return null;
}

async function handleFeedback(request, env) {
  const body = await readBodyText(request, MAX_FEEDBACK_BODY);
  if (body.tooBig) {
    return err(413, 'body_too_large', 'Request body exceeds the 16 KB limit.');
  }
  let data;
  try { data = JSON.parse(body.text); } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return err(400, 'invalid_shape', 'Body must be a JSON object of the form {"patterns": [...]}.');
  }
  const topKeys = Object.keys(data);
  for (const k of topKeys) {
    if (k !== 'patterns') {
      return err(400, 'invalid_shape', 'Unsupported top-level field: "' + k + '". Only "patterns" is accepted.');
    }
  }
  if (!Array.isArray(data.patterns) || data.patterns.length < 1) {
    return err(400, 'invalid_shape', '"patterns" must be a non-empty array.');
  }
  if (data.patterns.length > MAX_PATTERNS_PER_SUBMISSION) {
    return err(400, 'too_many_patterns', 'A submission may contain at most ' + MAX_PATTERNS_PER_SUBMISSION + ' patterns.');
  }

  // Privacy guardrail: reject any content-bearing fields anywhere in the body.
  const banned = [];
  findBannedFields(data, '', banned);
  if (banned.length > 0) {
    return err(422, 'privacy_violation',
      'This endpoint accepts ONLY anonymized pattern metadata (detectorId, type, severity, pageCount). ' +
      'Document content, quotes, evidence text, names, and any personal data are prohibited and were not stored.',
      { offending_fields: banned.slice(0, 20) });
  }

  for (let i = 0; i < data.patterns.length; i++) {
    const problem = validPattern(data.patterns[i]);
    if (problem) {
      return err(400, 'invalid_pattern', 'patterns[' + i + ']: ' + problem);
    }
  }

  // Store only the sanitized, anonymized fields.
  const sanitized = data.patterns.map(p => ({
    detectorId: p.detectorId,
    type: p.type,
    severity: p.severity,
    pageCount: p.pageCount
  }));
  const day = new Date().toISOString().slice(0, 10);
  const key = 'feedback:' + day;
  let bucket = [];
  try {
    const existing = await env.RULES_KV.get(key);
    if (existing) bucket = JSON.parse(existing);
    if (!Array.isArray(bucket)) bucket = [];
  } catch { bucket = []; }

  bucket.push({ received_at: new Date().toISOString(), count: sanitized.length, patterns: sanitized });
  if (bucket.length > MAX_FEEDBACK_RECORDS_PER_DAY) {
    bucket = bucket.slice(bucket.length - MAX_FEEDBACK_RECORDS_PER_DAY);
  }
  await env.RULES_KV.put(key, JSON.stringify(bucket), { expirationTtl: FEEDBACK_TTL_SECONDS });

  return json({ ok: true, stored: sanitized.length, bucket: day });
}

// Deterministic "constitution check" stub: structural bounds only.
function constitutionCheck(rules) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return 'rules must be an object with the five rule arrays';
  }
  const groups = ['contradiction_patterns', 'fraud_keywords', 'behavioral_markers', 'serial_patterns', 'case_configs'];
  let total = 0;
  for (const g of groups) {
    if (!Array.isArray(rules[g])) return 'rules.' + g + ' must be an array';
    total += rules[g].length;
  }
  if (total === 0) return 'constitution check failed: package contains no rules';
  if (total > MAX_TOTAL_RULES) {
    return 'constitution check failed: package contains ' + total + ' rules, exceeding the ' + MAX_TOTAL_RULES + ' rule bound';
  }
  return null;
}

async function handleAdminPublish(request, env) {
  if (!env.ADMIN_TOKEN) {
    return err(500, 'not_configured', 'Admin token is not configured on this service.');
  }
  const token = request.headers.get('x-admin-token');
  if (!token) return err(401, 'missing_admin_token', 'Provide the x-admin-token header.');
  if (token !== env.ADMIN_TOKEN) return err(403, 'invalid_admin_token', 'The admin token is incorrect.');

  const body = await readBodyText(request, MAX_PUBLISH_BODY);
  if (body.tooBig) return err(413, 'body_too_large', 'Rule package exceeds the 1 MB limit.');

  let pkg;
  try { pkg = JSON.parse(body.text); } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON.');
  }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    return err(400, 'invalid_shape', 'Rule package must be a JSON object.');
  }
  if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    return err(400, 'invalid_version', 'Package version must be a semver string like "1.0.0".');
  }
  const check = constitutionCheck(pkg.rules);
  if (check) return err(422, 'constitution_check_failed', check);

  // Server stamps the publish time; the rest of the package is used as sent.
  const toPublish = { ...pkg, published_at: new Date().toISOString() };
  const signature = await signPackage(env, toPublish);
  const record = {
    package: toPublish,
    signature,
    algorithm: ALGORITHM,
    publicKeyId: PUBLIC_KEY_ID,
    stored_at: new Date().toISOString()
  };
  await env.RULES_KV.put(CURRENT_KEY, JSON.stringify(record));

  const counts = {};
  for (const g of ['contradiction_patterns', 'fraud_keywords', 'behavioral_markers', 'serial_patterns', 'case_configs']) {
    counts[g] = toPublish.rules[g].length;
  }
  return json({ ok: true, version: toPublish.version, published_at: toPublish.published_at, rule_counts: counts });
}

// ------------------------- AI layer (Workers AI) --------------------------

const AI_MODEL_FAST = '@cf/meta/llama-3.1-8b-instruct-fp8';
const AI_MODEL_STRONG = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_AI_BODY = 16 * 1024;          // 16 KB hard cap for AI endpoints
const AI_GATEKEEP_TIMEOUT_MS = 10000;   // 10 s for the fast model
const AI_TIMEOUT_MS = 30000;            // 30 s for the strong model
const MAX_ASSESS_FINDINGS = 40;
const MAX_NARRATE_FINDINGS = 25;
const MAX_EVIDENCE_CHARS = 300;
const MAX_CURATE_CANDIDATES = 10;
const MAX_ADDITIONAL_FINDINGS = 20;
const MAX_CLASSIFY_SAMPLE = 4000;   // server-side cap on classify textSample
const CURATE_WINDOW_DAYS = 7;

const GATEKEEP_SYSTEM = 'You are a licensing gatekeeper for the Verum Omnis forensic platform ' +
  '(free for private citizens and law enforcement; commercial use requires a licence). ' +
  'Given usage signals, classify commercial likelihood. Reply ONLY compact JSON: ' +
  '{"likelihood":"low|medium|high","reasons":[...max 3...]}';

const CLASSIFY_SYSTEM = 'You are a document triage classifier for the Verum Omnis forensic ' +
  'contradiction engine. Given a text sample from a document, decide its class, whether it is ' +
  'ABOUT fraud, and which detector categories the engine should run. Classes: court_filing, ' +
  'contract, invoice, financial_application, personal_correspondence, business_record, other. ' +
  'Affidavits and witness statements ARE court_filing: recognise them by sworn-language markers ' +
  'such as "I hereby make oath and state", "the contents of this affidavit", "deponent", ' +
  '"commissioner of oaths", numbered deposition paragraphs, and police or court references ' +
  '(for example SAPS, Hawks, or court case numbers); classify them court_filing with medium or ' +
  'high confidence when such markers are present instead of defaulting to "other". ' +
  'aboutFraud MUST be true when the document CONTAINS fraud allegations, accusations or heavy ' +
  'fraud vocabulary (e.g. a court filing, complaint or affidavit ABOUT fraud) so the client can ' +
  'suppress serial-pattern labels that would otherwise false-fire on vocabulary alone; it is ' +
  'false for documents that merely ARE routine contracts, invoices or correspondence. ' +
  'recommendedScope lists detector categories worth running, chosen from "financial_fraud", ' +
  '"identity", "document_integrity", "serial_patterns"; include serial_patterns only when the ' +
  'document is not primarily ABOUT fraud; use all four when unsure. Be conservative: when the ' +
  'sample is thin, lower confidence rather than guessing. Reply ONLY compact JSON: ' +
  '{"documentClass":"...","confidence":"low|medium|high","aboutFraud":true|false,"recommendedScope":["..."]}';

const VALID_DOC_CLASSES = new Set(['court_filing', 'contract', 'invoice', 'financial_application', 'personal_correspondence', 'business_record', 'other']);
const VALID_SCOPES = new Set(['financial_fraud', 'identity', 'document_integrity', 'serial_patterns']);

const ASSESS_SYSTEM = 'You are the antithesis reviewer in a forensic contradiction engine. ' +
  'For each candidate finding you receive (type, quoted evidence, location), decide KEEP ' +
  '(genuine contradiction/indicator) or DROP (benign context, definitional text, format ' +
  'artifact, or keyword coincidence). ' +
  'You MUST ALSO catch contradictions the engine missed: when the supplied evidence contains ' +
  'a clear contradiction or inconsistency that is ABSENT from the submitted findings, add it ' +
  'to additionalFindings. Be conservative: flag only clear contradictions/inconsistencies ' +
  'supported by the evidence text you were given; never invent findings or new quotes; keep ' +
  'any quoted fragment under 120 characters; use an existing CT01-CT43 type name where one ' +
  'fits, otherwise a short descriptive UPPER_SNAKE type. Return additionalFindings: [] when ' +
  'nothing was missed. ' +
  'Reply ONLY compact JSON: {"verdicts":[{"id":...,"verdict":"keep|drop","reason":"<=12 words"}],' +
  '"additionalFindings":[{"type":"CT01|UPPER_SNAKE","severity":1-5,"rationale":"brief"}]}';

const NARRATE_SYSTEM = 'You are a forensic report writer for Verum Omnis Constitutional Forensic AI. ' +
  'Generate a DETAILED COURT-READY forensic narrative from the supplied findings JSON. ' +
  'Structure: (1) Executive Summary (300-400 words) with core findings, financial impact, and confirmed victim count; ' +
  '(2) Key Findings section (400-600 words) with EVERY major finding anchored to evidence citations [F1], [F2], etc.; ' +
  '(3) Perjury Analysis (200-300 words) comparing sworn statements vs. sealed documentary evidence; ' +
  '(4) Victim Evidence Profiles (200+ words) naming each confirmed victim, their losses, and evidence chain; ' +
  '(5) Contradiction Patterns (250-400 words) documenting all identified contradictions with legal significance; ' +
  '(6) Legal Framework Analysis (300-400 words) citing applicable statutes, common law principles, and court precedent; ' +
  '(7) Offence Matrix (200-300 words) mapping findings to criminal charges/civil causes of action; ' +
  '(8) Page-by-Page Evidence Map (150-250 words) - reference format "Bundle p.XXX" for each key document. ' +
  'TONE: formal forensic English, third person, measured professional. ' +
  'RULES: (1) State only facts from supplied findings - never invent; (2) ALWAYS cite finding IDs [F#] after every factual claim; ' +
  '(3) Anchor victims by name/ID and documented losses; (4) Reference page numbers from source bundles; ' +
  '(5) Flag any contradictions between statements; (6) NO probability estimates - use HIGH/VERY HIGH confidence grading from findings; ' +
  '(7) End with CLOSING: "These findings are investigative indicators, not determinations of guilt. Court admission requires verification of seal integrity and expert authentication." ' +
  'Reply ONLY valid JSON: ' +
  '{"executiveSummary":"...","keyFindings":"...","perjuryAnalysis":"...","victimProfiles":"...","contradictions":"...","legalFramework":"...","offenceMatrix":"...","evidenceMap":"...","closing":"..."}';

const CURATE_SYSTEM = 'You are a conservative fraud-rules curator for the Verum Omnis forensic ' +
  'platform. You receive aggregated, anonymized detector statistics; no document content exists ' +
  'and none may be invented. Draft at most 10 candidate NEW rules for the rule groups ' +
  '"fraud_keywords" and "behavioral_markers". Rules: precision over recall — draft a candidate ' +
  'only when the statistics show a recurring pattern; never include personal data, names, ' +
  'quotes, or document content; use only generic fraud terminology; every candidate must carry ' +
  'a short evidence-based rationale; if the statistics are insufficient, draft fewer candidates ' +
  'or none. Reply ONLY compact JSON: ' +
  '{"candidates":[{"group":"fraud_keywords|behavioral_markers","term":"...","rationale":"<=20 words"}]}';

const CLOSING_SENTENCE = 'These findings are investigative indicators, not determinations of guilt.';

// Reject if `promise` does not settle within `ms`. The loser keeps running in
// the background and is simply discarded by the runtime.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timed out after ' + ms + ' ms')), ms))
  ]);
}

// Single entry point for Workers AI chat-style calls. Throws on any failure;
// callers are responsible for their deterministic fallback.
async function callAi(env, model, system, userPayload, opts) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new Error('Workers AI binding "AI" is not configured on this service.');
  }
  const o = opts || {};
  const run = env.AI.run(model, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPayload }
    ],
    max_tokens: o.maxTokens || 1024,
    temperature: (o.temperature === undefined) ? 0 : o.temperature
  });
  const res = await withTimeout(run, o.timeoutMs || AI_TIMEOUT_MS, 'Workers AI call');
  if (!res) throw new Error('empty response from model');
  // The binding returns a string for prose replies but may return an already
  // parsed object when the model emits valid JSON — normalise both to text.
  let text;
  if (typeof res.response === 'string') {
    text = res.response;
  } else if (res.response !== null && res.response !== undefined) {
    try { text = JSON.stringify(res.response); } catch { text = ''; }
  } else {
    text = '';
  }
  if (!text.trim()) throw new Error('model returned no text');
  return text;
}

// Models sometimes wrap JSON in prose or code fences. Extract the outermost
// brace-delimited object and parse it; return null when that is impossible.
function extractJsonObject(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

function asStr(v, max) {
  if (v === null || v === undefined) return '';
  return String(v).slice(0, max);
}

function asCount(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n >= 0) ? Math.floor(n) : 0;
}

// --- a. /api/v1/ai/gatekeep ------------------------------------------------

// Deterministic licensing heuristic used when the model is unavailable or
// returns something unusable.
function gatekeepFallback(sig, declaredTier) {
  if (declaredTier === 'commercial') {
    return { likelihood: 'high', reasons: ['declared commercial tier'] };
  }
  const reasons = [];
  let score = 0;
  if (sig.regNumberHits > 0) { score += 2; reasons.push('company registration numbers present'); }
  if (sig.vatHits > 2) { score += 2; reasons.push('multiple VAT references present'); }
  if (sig.invoiceKeywordHits > 3) { score += 1; reasons.push('invoice terminology present'); }
  if (sig.companySuffixHits > 2) { score += 1; reasons.push('multiple company suffixes present'); }
  if (score >= 2) return { likelihood: 'medium', reasons: reasons.slice(0, 3) };
  return { likelihood: 'low', reasons: reasons.length ? reasons.slice(0, 3) : ['no commercial signals detected'] };
}

async function handleAiGatekeep(request, env) {
  const body = await readBodyText(request, MAX_AI_BODY);
  if (body.tooBig) return err(413, 'body_too_large', 'Request body exceeds the 16 KB limit.');
  let data;
  try { data = JSON.parse(body.text); } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return err(400, 'invalid_shape', 'Body must be a JSON object with declaredTier, pageCount, byteSize, findingsSummary and entitySignals.');
  }
  const declaredTier = data.declaredTier;
  if (declaredTier !== 'private' && declaredTier !== 'commercial') {
    return err(400, 'invalid_tier', 'declaredTier must be "private" or "commercial".');
  }
  const es = (data.entitySignals && typeof data.entitySignals === 'object' && !Array.isArray(data.entitySignals)) ? data.entitySignals : {};
  const entitySignals = {
    companySuffixHits: asCount(es.companySuffixHits),
    regNumberHits: asCount(es.regNumberHits),
    invoiceKeywordHits: asCount(es.invoiceKeywordHits),
    vatHits: asCount(es.vatHits)
  };
  const fs = (data.findingsSummary && typeof data.findingsSummary === 'object' && !Array.isArray(data.findingsSummary)) ? data.findingsSummary : {};
  const byCategory = (fs.byCategory && typeof fs.byCategory === 'object' && !Array.isArray(fs.byCategory)) ? fs.byCategory : {};
  const signals = {
    declaredTier,
    pageCount: asCount(data.pageCount),
    byteSize: asCount(data.byteSize),
    findingsSummary: { total: asCount(fs.total), byCategory },
    entitySignals
  };

  try {
    const text = await callAi(env, AI_MODEL_FAST, GATEKEEP_SYSTEM, JSON.stringify(signals),
      { timeoutMs: AI_GATEKEEP_TIMEOUT_MS, maxTokens: 256, temperature: 0 });
    const parsed = extractJsonObject(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('model reply is not a JSON object');
    }
    const likelihood = parsed.likelihood;
    if (likelihood !== 'low' && likelihood !== 'medium' && likelihood !== 'high') {
      throw new Error('model reply has an invalid likelihood value');
    }
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map(r => asStr(r, 200).trim()).filter(Boolean).slice(0, 3)
      : [];
    return json({ likelihood, reasons, model: 'llama-3.1-8b' });
  } catch (e) {
    const fb = gatekeepFallback(entitySignals, declaredTier);
    return json({ likelihood: fb.likelihood, reasons: fb.reasons, model: 'deterministic-fallback' });
  }
}

// --- a2. /api/v1/ai/classify -----------------------------------------------

// Deterministic triage fallback: run everything, claim nothing.
function classifyFallback() {
  return { documentClass: 'other', confidence: 'low', aboutFraud: false, recommendedScope: ['all'], model: 'fallback' };
}

async function handleAiClassify(request, env) {
  const body = await readBodyText(request, MAX_AI_BODY);
  if (body.tooBig) return err(413, 'body_too_large', 'Request body exceeds the 16 KB limit.');
  let data;
  try { data = JSON.parse(body.text); } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return err(400, 'invalid_shape', 'Body must be a JSON object of the form {"textSample": "...", "pageCount": N}.');
  }
  if (typeof data.textSample !== 'string') {
    return err(400, 'invalid_sample', 'textSample must be a non-empty string.');
  }
  // Server-side cap: at most MAX_CLASSIFY_SAMPLE characters reach the model.
  const textSample = data.textSample.slice(0, MAX_CLASSIFY_SAMPLE).trim();
  if (!textSample) {
    return err(400, 'invalid_sample', 'textSample must be a non-empty string.');
  }
  const pageCount = asCount(data.pageCount);

  try {
    const text = await callAi(env, AI_MODEL_FAST, CLASSIFY_SYSTEM, JSON.stringify({ textSample, pageCount }),
      { timeoutMs: AI_GATEKEEP_TIMEOUT_MS, maxTokens: 300, temperature: 0 });
    const parsed = extractJsonObject(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('model reply is not a JSON object');
    }
    const documentClass = VALID_DOC_CLASSES.has(parsed.documentClass) ? parsed.documentClass : 'other';
    const confidence = (parsed.confidence === 'low' || parsed.confidence === 'medium' || parsed.confidence === 'high')
      ? parsed.confidence : 'low';
    const aboutFraud = parsed.aboutFraud === true || parsed.aboutFraud === 'true';
    let recommendedScope = Array.isArray(parsed.recommendedScope)
      ? [...new Set(parsed.recommendedScope.map(s => asStr(s, 64).trim()).filter(s => VALID_SCOPES.has(s)))]
      : [];
    if (recommendedScope.length === 0) recommendedScope = ['all'];
    return json({ documentClass, confidence, aboutFraud, recommendedScope, model: 'llama-3.1-8b' });
  } catch (e) {
    return json(classifyFallback());
  }
}

// --- b. /api/v1/ai/assess --------------------------------------------------

// Coerce a client finding into the strict shape sent to the model. Evidence
// is truncated server-side to MAX_EVIDENCE_CHARS. Returns null if unusable.
function sanitizeFinding(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  if (typeof f.id !== 'string' && typeof f.id !== 'number') return null;
  const id = String(f.id).slice(0, 64);
  if (!id) return null;
  const sev = Number(f.severity);
  return {
    id,
    type: asStr(f.type, 64) || 'unknown',
    severity: (Number.isInteger(sev) && sev >= 1 && sev <= 5) ? sev : 0,
    location: asStr(f.location, 200),
    evidence: asStr(f.evidence, MAX_EVIDENCE_CHARS)
  };
}

function keepAllVerdicts(findings, reason) {
  return findings.map(f => ({ id: f.id, verdict: 'keep', reason }));
}

// Coerce model-proposed new findings (contradictions the engine missed) into
// the strict schema: {type, severity, rationale, source}. Fields outside the
// schema are stripped; severity is clamped to an integer 1-5; source is always
// forced to "ai"; at most MAX_ADDITIONAL_FINDINGS are returned.
function sanitizeAdditionalFindings(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const f of value) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) continue;
    const type = asStr(f.type, 64).trim();
    if (!type) continue;
    const sev = Number(f.severity);
    if (!Number.isFinite(sev)) continue;
    const severity = Math.min(5, Math.max(1, Math.round(sev)));
    const rationale = asStr(f.rationale, 300).trim();
    if (!rationale) continue;
    out.push({ type, severity, rationale, source: 'ai' });
    if (out.length >= MAX_ADDITIONAL_FINDINGS) break;
  }
  return out;
}

async function handleAiAssess(request, env) {
  const body = await readBodyText(request, MAX_AI_BODY);
  if (body.tooBig) return err(413, 'body_too_large', 'Request body exceeds the 16 KB limit.');
  let data;
  try { data = JSON.parse(body.text); } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return err(400, 'invalid_shape', 'Body must be a JSON object of the form {"findings": [...]}.');
  }
  if (!Array.isArray(data.findings) || data.findings.length < 1) {
    return err(400, 'invalid_shape', '"findings" must be a non-empty array.');
  }
  if (data.findings.length > MAX_ASSESS_FINDINGS) {
    return err(400, 'too_many_findings', 'A request may contain at most ' + MAX_ASSESS_FINDINGS + ' findings.');
  }
  const findings = [];
  for (let i = 0; i < data.findings.length; i++) {
    const s = sanitizeFinding(data.findings[i]);
    if (!s) {
      return err(400, 'invalid_finding', 'findings[' + i + '] must be an object with a string or numeric id.');
    }
    findings.push(s);
  }

  try {
    const text = await callAi(env, AI_MODEL_STRONG, ASSESS_SYSTEM, JSON.stringify({ findings }),
      { timeoutMs: AI_TIMEOUT_MS, maxTokens: 1500, temperature: 0 });
    const parsed = extractJsonObject(text);
    if (!parsed || !Array.isArray(parsed.verdicts)) {
      throw new Error('model reply has no verdicts array');
    }
    // Keep only well-formed verdicts that reference submitted ids; the first
    // verdict per id wins; verdicts for unknown ids are ignored entirely.
    const submitted = new Set(findings.map(f => f.id));
    const byId = new Map();
    for (const v of parsed.verdicts) {
      if (!v || typeof v !== 'object') continue;
      if (typeof v.id !== 'string' && typeof v.id !== 'number') continue;
      const vid = String(v.id);
      if (!submitted.has(vid) || byId.has(vid)) continue;
      if (v.verdict !== 'keep' && v.verdict !== 'drop') continue;
      byId.set(vid, { id: vid, verdict: v.verdict, reason: asStr(v.reason, 160) || 'no reason given' });
    }
    // Findings the model never judged default to KEEP (conservative).
    const verdicts = findings.map(f => byId.get(f.id) || { id: f.id, verdict: 'keep', reason: 'no verdict returned — kept by default' });
    // Contradictions the engine missed, proposed by the model and sanitized
    // server-side. A missing/malformed reply degrades to an empty list.
    const additionalFindings = sanitizeAdditionalFindings(parsed.additionalFindings);
    return json({ ok: true, reviewed: true, model: 'llama-3.3-70b', verdicts, additionalFindings });
  } catch (e) {
    return json({ ok: true, reviewed: false, model: 'fallback-keep-all', verdicts: keepAllVerdicts(findings, 'ai unavailable — kept by default'), additionalFindings: [] });
  }
}

// --- c. /api/v1/ai/narrate -------------------------------------------------

// Deterministic narrative built purely from the structured input. Used when
// the model fails or its output cannot be trusted (e.g. no valid citation).
function narrateTemplate(input, kept) {
  const top = kept.slice(0, 3);
  let executiveSummary =
    'The document "' + input.documentName + '" (' + input.pageCount + ' page(s)) was analysed by the ' +
    'Verum Omnis contradiction engine on ' + input.generatedUtc + '. The automated analysis produced an ' +
    'integrity score of ' + input.score + ' with a confidence rating of ' + input.confidence + '. Following ' +
    'antithesis review, ' + kept.length + ' finding(s) were retained and ' + input.findingsPruned +
    ' candidate(s) were pruned as benign. ';
  if (top.length) {
    executiveSummary += 'The most significant retained findings are identified as ' +
      top.map(f => '[' + f.id + ']').join(', ') + ' and are set out in the critical-evidence narrative. ';
  } else {
    executiveSummary += 'No findings were retained for narrative reporting. ';
  }
  executiveSummary += 'This summary states only facts present in the supplied findings and quantifies ' +
    'nothing beyond them. ' + CLOSING_SENTENCE;

  let criticalEvidence;
  if (top.length) {
    criticalEvidence = top.map(f =>
      'Finding ' + f.id + ' (' + f.type + ', severity ' + f.severity + '), recorded at ' +
      (f.location || 'an unspecified location') + ', states: "' + f.evidence + '" [' + f.id + '].'
    ).join(' ') +
      ' The findings quoted above are the highest-severity indicators present in the supplied record. ' +
      'No facts beyond the supplied findings are asserted. ' + CLOSING_SENTENCE;
  } else {
    criticalEvidence = 'No findings were supplied for narrative reporting and no factual claims can ' +
      'therefore be made. ' + CLOSING_SENTENCE;
  }
  return { executiveSummary, criticalEvidence };
}

// True when the text contains at least one [id] citation matching a supplied id.
function hasCitation(text, idSet) {
  const re = /\[([^\[\]]+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (idSet.has(m[1].trim())) return true;
  }
  return false;
}

async function handleAiNarrate(request, env) {
  const body = await readBodyText(request, MAX_AI_BODY);
  if (body.tooBig) return err(413, 'body_too_large', 'Request body exceeds the 16 KB limit.');
  let data;
  try { data = JSON.parse(body.text); } catch {
    return err(400, 'invalid_json', 'Request body is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return err(400, 'invalid_shape', 'Body must be a JSON object with documentName, pageCount, score, confidence, findingsKept, findingsPruned and generatedUtc.');
  }
  if (!Array.isArray(data.findingsKept)) {
    return err(400, 'invalid_shape', '"findingsKept" must be an array (it may be empty).');
  }
  // Server-side caps: at most MAX_NARRATE_FINDINGS findings, evidence truncated.
  const kept = [];
  for (let i = 0; i < data.findingsKept.length && kept.length < MAX_NARRATE_FINDINGS; i++) {
    const s = sanitizeFinding(data.findingsKept[i]);
    if (s) kept.push(s);
  }
  const input = {
    documentName: asStr(data.documentName, 200) || 'unnamed document',
    pageCount: asCount(data.pageCount),
    score: (typeof data.score === 'number' && Number.isFinite(data.score)) ? data.score : (asStr(data.score, 32) || 'not supplied'),
    confidence: (typeof data.confidence === 'number' && Number.isFinite(data.confidence)) ? data.confidence : (asStr(data.confidence, 32) || 'not supplied'),
    findingsPruned: asCount(data.findingsPruned),
    generatedUtc: asStr(data.generatedUtc, 64) || new Date().toISOString()
  };

  // With no findings there is nothing the model may cite; go straight to the
  // deterministic template instead of burning a model call.
  if (kept.length === 0) {
    return json({ ok: true, ...narrateTemplate(input, kept), model: 'template-fallback' });
  }

  const idSet = new Set(kept.map(f => f.id));
  try {
    const text = await callAi(env, AI_MODEL_STRONG, NARRATE_SYSTEM,
      JSON.stringify({ ...input, findingsKept: kept }),
      { timeoutMs: AI_TIMEOUT_MS, maxTokens: 4096, temperature: 0.2 });
    const parsed = extractJsonObject(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('model reply is not a JSON object');
    }

    // Support detailed court-ready format (new) with fallback to basic format (legacy)
    const narrative = {
      executiveSummary: asStr(parsed.executiveSummary, 4000).trim(),
      keyFindings: asStr(parsed.keyFindings, 8000).trim(),
      perjuryAnalysis: asStr(parsed.perjuryAnalysis, 5000).trim(),
      victimProfiles: asStr(parsed.victimProfiles, 5000).trim(),
      contradictions: asStr(parsed.contradictions, 6000).trim(),
      legalFramework: asStr(parsed.legalFramework, 6000).trim(),
      offenceMatrix: asStr(parsed.offenceMatrix, 4000).trim(),
      evidenceMap: asStr(parsed.evidenceMap, 3000).trim(),
      closing: asStr(parsed.closing, 500).trim()
    };

    // If detailed sections are missing, fall back to legacy format
    if (!narrative.executiveSummary && !parsed.criticalEvidence) {
      throw new Error('model reply contains no narrative sections');
    }

    // Legacy fallback: if only basic sections provided
    if (narrative.executiveSummary && !narrative.keyFindings) {
      let criticalEvidence = asStr(parsed.criticalEvidence, 6000).trim();
      if (!criticalEvidence) throw new Error('model reply is missing narrative sections');
      if (!hasCitation(narrative.executiveSummary + '\n' + criticalEvidence, idSet)) {
        throw new Error('model reply contains no citation of a supplied finding id');
      }
      if (narrative.executiveSummary.indexOf('investigative indicators') < 0 && criticalEvidence.indexOf('investigative indicators') < 0) {
        criticalEvidence += (criticalEvidence.endsWith(' ') ? '' : ' ') + CLOSING_SENTENCE;
      }
      return json({ ok: true, executiveSummary: narrative.executiveSummary, criticalEvidence, format: 'legacy', model: 'llama-3.3-70b' });
    }

    // Validate detailed format has citations
    const allText = Object.values(narrative).join('\n');
    if (!hasCitation(allText, idSet)) {
      throw new Error('model reply contains no citation of a supplied finding id');
    }

    // Ensure closing sentence
    if (narrative.closing.indexOf('investigative indicators') < 0) {
      narrative.closing = (narrative.closing ? narrative.closing + ' ' : '') + CLOSING_SENTENCE;
    }

    return json({ ok: true, ...narrative, format: 'detailed', model: 'llama-3.3-70b' });
  } catch (e) {
    return json({ ok: true, ...narrateTemplate(input, kept), format: 'template', model: 'template-fallback' });
  }
}

// --- d. /api/v1/ai/curate (admin only) -------------------------------------

// Shared discipline for rule candidates, whether AI-drafted or supplied by a
// client for review: only the two curatable groups, sane lengths,
// case-insensitive dedupe, capped. Returns the accepted list and a count of
// entries dropped as invalid, duplicate or overflow.
function sanitizeCandidates(list, cap) {
  const seen = new Set();
  const candidates = [];
  let dropped = 0;
  for (const c of list) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) { dropped++; continue; }
    const group = (c.group === 'fraud_keywords' || c.group === 'behavioral_markers') ? c.group : null;
    const term = asStr(c.term, 160).trim();
    const rationale = asStr(c.rationale, 300).trim();
    if (!group || term.length < 2 || !rationale) { dropped++; continue; }
    const dedupe = group + ':' + term.toLowerCase();
    if (seen.has(dedupe)) { dropped++; continue; }
    if (candidates.length >= cap) { dropped++; continue; }
    seen.add(dedupe);
    candidates.push({ group, term, rationale });
  }
  return { candidates, dropped };
}

// The same deterministic constitution discipline as /admin/publish, applied
// to AI-drafted candidates: non-empty, sane size, no banned content fields.
function curateConstitutionCheck(candidates) {
  const problems = [];
  if (!Array.isArray(candidates) || candidates.length === 0) {
    problems.push('no candidates produced');
    return { ok: false, problems };
  }
  if (candidates.length > MAX_CURATE_CANDIDATES) {
    problems.push('candidate count ' + candidates.length + ' exceeds the ' + MAX_CURATE_CANDIDATES + ' candidate bound');
  }
  const banned = [];
  findBannedFields(candidates, '', banned);
  if (banned.length) {
    problems.push('banned content fields present: ' + banned.slice(0, 10).join(', '));
  }
  return { ok: problems.length === 0, problems };
}

async function handleAiCurate(request, env) {
  if (!env.ADMIN_TOKEN) {
    return err(500, 'not_configured', 'Admin token is not configured on this service.');
  }
  const token = request.headers.get('x-admin-token');
  if (!token) return err(401, 'missing_admin_token', 'Provide the x-admin-token header.');
  if (token !== env.ADMIN_TOKEN) return err(403, 'invalid_admin_token', 'The admin token is incorrect.');

  // Optional review mode: the caller supplies AI-proposed candidates (e.g.
  // from assess/narrate flows) for validation + constitution check, instead
  // of drafting new ones from the feedback window. An empty/absent body keeps
  // the original aggregate-and-draft behaviour.
  const body = await readBodyText(request, MAX_AI_BODY);
  if (body.tooBig) return err(413, 'body_too_large', 'Request body exceeds the 16 KB limit.');
  let data = null;
  if (body.text && body.text.trim()) {
    try { data = JSON.parse(body.text); } catch {
      return err(400, 'invalid_json', 'Request body is not valid JSON.');
    }
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && Object.prototype.hasOwnProperty.call(data, 'candidates')) {
    if (!Array.isArray(data.candidates)) {
      return err(400, 'invalid_shape', '"candidates" must be an array of {"group","term","rationale"}.');
    }
    if (data.candidates.length > MAX_CURATE_CANDIDATES) {
      return err(400, 'too_many_candidates', 'A review submission may contain at most ' + MAX_CURATE_CANDIDATES + ' candidates.');
    }
    const review = sanitizeCandidates(data.candidates, MAX_CURATE_CANDIDATES);
    return json({
      ok: true,
      candidates: review.candidates,
      dropped: review.dropped,
      constitution_check: curateConstitutionCheck(review.candidates),
      model: 'client-supplied',
      note: 'Draft only — nothing published. Review and publish via /api/v1/admin/publish.'
    });
  }

  // Aggregate feedback buckets from the last CURATE_WINDOW_DAYS days.
  const cutoff = new Date(Date.now() - CURATE_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  let names;
  try {
    const listed = await env.RULES_KV.list({ prefix: 'feedback:' });
    names = (listed.keys || []).map(k => k.name)
      .filter(n => n.slice('feedback:'.length) >= cutoff)
      .sort();
  } catch (e) {
    return err(500, 'kv_error', 'Could not list feedback buckets.');
  }

  const byDetectorId = {};
  const byType = {};
  const pairs = {};
  let totalPatterns = 0;
  const daysUsed = [];
  for (const name of names) {
    let bucket;
    try {
      const raw = await env.RULES_KV.get(name);
      if (!raw) continue;
      bucket = JSON.parse(raw);
    } catch { continue; }
    if (!Array.isArray(bucket)) continue;
    daysUsed.push(name.slice('feedback:'.length));
    for (const rec of bucket) {
      const pats = (rec && Array.isArray(rec.patterns)) ? rec.patterns : [];
      for (const p of pats) {
        if (!p || typeof p !== 'object') continue;
        const d = asStr(p.detectorId, 64);
        const t = asStr(p.type, 64);
        if (!d && !t) continue;
        totalPatterns++;
        if (d) byDetectorId[d] = (byDetectorId[d] || 0) + 1;
        if (t) byType[t] = (byType[t] || 0) + 1;
        const pk = d + '|' + t;
        if (!pairs[pk]) pairs[pk] = { detectorId: d, type: t, count: 0, severitySum: 0 };
        pairs[pk].count++;
        pairs[pk].severitySum += asCount(p.severity);
      }
    }
  }
  const topPatterns = Object.values(pairs)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(p => ({ detectorId: p.detectorId, type: p.type, count: p.count, avgSeverity: Math.round((p.severitySum / p.count) * 100) / 100 }));
  const aggregation = {
    window_days: daysUsed,
    buckets: daysUsed.length,
    totalPatterns,
    byDetectorId,
    byType,
    topPatterns
  };

  if (totalPatterns === 0) {
    return json({
      ok: true,
      candidates: [],
      aggregation,
      constitution_check: curateConstitutionCheck([]),
      model: 'none',
      note: 'No feedback patterns in the window; nothing to curate. Draft only — nothing published.'
    });
  }

  let candidates = [];
  let model = 'llama-3.3-70b';
  let aiError = null;
  try {
    const text = await callAi(env, AI_MODEL_STRONG, CURATE_SYSTEM,
      JSON.stringify({ window_days: daysUsed, totalPatterns, topPatterns }),
      { timeoutMs: AI_TIMEOUT_MS, maxTokens: 2000, temperature: 0.2 });
    const parsed = extractJsonObject(text);
    if (!parsed || !Array.isArray(parsed.candidates)) {
      throw new Error('model reply has no candidates array');
    }
    candidates = sanitizeCandidates(parsed.candidates, MAX_CURATE_CANDIDATES).candidates;
  } catch (e) {
    model = 'ai-unavailable';
    candidates = [];
    aiError = 'AI drafting unavailable; aggregation is returned for manual review.';
  }

  const check = curateConstitutionCheck(candidates);
  if (aiError) check.problems.push(aiError);
  return json({
    ok: true,
    candidates,
    aggregation,
    constitution_check: check,
    model,
    note: 'Draft only — nothing published. Review and publish via /api/v1/admin/publish.'
  });
}

// -------------------------------- router ----------------------------------

async function route(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/v1/status' && request.method === 'GET') return handleStatus(env);
  if (path === '/api/v1/rules/manifest' && request.method === 'GET') return handleManifest(env);
  if (path === '/api/v1/feedback/patterns' && request.method === 'POST') return handleFeedback(request, env);
  if (path === '/api/v1/admin/publish' && request.method === 'POST') return handleAdminPublish(request, env);
  if (path === '/api/v1/ai/gatekeep' && request.method === 'POST') return handleAiGatekeep(request, env);
  if (path === '/api/v1/ai/classify' && request.method === 'POST') return handleAiClassify(request, env);
  if (path === '/api/v1/ai/assess' && request.method === 'POST') return handleAiAssess(request, env);
  if (path === '/api/v1/ai/narrate' && request.method === 'POST') return handleAiNarrate(request, env);
  if (path === '/api/v1/ai/curate' && request.method === 'POST') return handleAiCurate(request, env);
  if ((path === '/constitution.pdf' || path === '/docs/constitution.pdf') && request.method === 'GET') return handleConstitutionPdf(env);
  if ((path === '/images/logo-full.png' || path === '/images/watermark_portrait.png') && request.method === 'GET') return handleImageKv(env, SITE_IMAGES[path].key, SITE_IMAGES[path].contentType);

  const known = ['/api/v1/status', '/api/v1/rules/manifest', '/api/v1/feedback/patterns', '/api/v1/admin/publish',
    '/api/v1/ai/gatekeep', '/api/v1/ai/classify', '/api/v1/ai/assess', '/api/v1/ai/narrate', '/api/v1/ai/curate', '/constitution.pdf', '/docs/constitution.pdf', '/images/logo-full.png', '/images/watermark_portrait.png'];
  if (known.includes(path)) {
    return err(405, 'method_not_allowed', request.method + ' is not supported on ' + path + '.', { allow: path.startsWith('/api/v1/rules') || path === '/api/v1/status' || path.endsWith('/constitution.pdf') ? 'GET' : 'POST' });
  }
  return err(404, 'not_found', 'Unknown endpoint: ' + path);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env);
    } catch (e) {
      // Honest error, never leak internals/stack traces to clients.
      return err(500, 'internal_error', 'An internal error occurred while processing the request.');
    }
  }
};
