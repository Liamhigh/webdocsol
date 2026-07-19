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
//
// Signing: RSASSA-PKCS1-v1_5 with SHA-512 over the canonical JSON of the
// package (object keys sorted recursively, compact separators, UTF-8).
// Android clients verify with "SHA512withRSA"; WebCrypto uses
// RSASSA-PKCS1-v1_5 + SHA-512. See rule-format.md.
//
// Secrets (never commit): RULE_PRIVATE_KEY (PKCS8 DER base64), ADMIN_TOKEN.
// Binding: RULES_KV (KV namespace "verum-rules-kv").
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
  if ((path === '/constitution.pdf' || path === '/docs/constitution.pdf') && request.method === 'GET') return handleConstitutionPdf(env);

  const known = ['/api/v1/status', '/api/v1/rules/manifest', '/api/v1/feedback/patterns', '/api/v1/admin/publish', '/constitution.pdf', '/docs/constitution.pdf'];
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
