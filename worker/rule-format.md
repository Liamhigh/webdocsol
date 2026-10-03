# Verum Omnis Rule Package Format v1

The Cloudflare Worker `webdocsol` (`worker/verum-rules.js`, which reports itself
as service `verum-rules`) serves signed forensic rule packages. Three clients
fetch them: the website's seal page (`seal-document.html`), the Android app
(`Liamhigh/1verum`) and the fraud-firewall (`Liamhigh/firebase`). A client MUST
verify the RSA signature before it trusts or applies a package.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/status` | `{ok, service, version, published_at}` |
| GET | `/api/v1/rules/manifest` | Signed manifest (below) |
| POST | `/api/v1/feedback/patterns` | Anonymized pattern feedback only |
| POST | `/api/v1/admin/publish` | Publish a new signed package (admin token) |
| GET | `/api/v1/rules/changelog` | What the trainer published, when, from which signals; the last run (below) |
| POST | `/api/v1/admin/curate-publish` | Run the trainer now (admin token); replies `{ok, run}` |
| POST | `/api/v1/ai/curate` | AI-drafted rule candidates from the feedback aggregate — a draft, never published (admin token) |

`/api/v1/status` and `/api/v1/rules/manifest` answer
`503 {ok:false, error:"no_rule_package"}` when no package has been published.
The website reads that code as "no rule package has been published yet".

Hosts: `https://verumglobal.foundation` and `https://www.verumglobal.foundation`
(zone routes in `wrangler.toml`), plus the Worker's `workers.dev` address
(`workers_dev = true`). **`https://verumglobal.foundation/api/v1/rules/manifest`
is a contract.** The Android app (`core/Constitution.kt`, `RULE_MANIFEST_URL`)
and the fraud-firewall (`src/core/ruleUpdate.ts`, `DEFAULT_RULE_MANIFEST_URL`)
hard-code it and pin key id `vo-master-1`. The path and the manifest shape never
move without changing both clients. The website fetches the relative path, so it
works on any host that serves this Worker. Whether the domain reaches this Worker
at a given moment is live Cloudflare state, not checkable from the repository:
after any routing change, confirm the manifest still answers. The
`live-site-probe` workflow prints it from outside.

## Manifest

```json
{
  "package": { "...rule package..." },
  "signature": "<base64>",
  "algorithm": "RSASSA-PKCS1-v1_5-SHA512",
  "publicKeyId": "vo-master-1"
}
```

`signature` is the base64-encoded RSA-4096 signature (RSASSA-PKCS1-v1_5 with
SHA-512 — JCA name `SHA512withRSA`) over the **canonical JSON** of `package`.

## Rule package schema

```json
{
  "version": "1.0.0",
  "published_at": "<ISO-8601 UTC>",
  "rules": {
    "contradiction_patterns": [ { "id": "CT01", "key": "CT01_DIRECT_STATEMENT", "name": "...", "desc": "...", "severity": 5, "category": "STATEMENTAL", "example": "...", "detectors": ["D01"] } ],
    "fraud_keywords":        [ { "id": "FK01", "group": "negation_pairs", "source_detector": "D01", "produces": "CT01", "description": "...", "pairs": [["paid","not paid"]] } ],
    "behavioral_markers":    [ { "id": "BM01", "name": "Urgency pressure", "source": "SP01 stage 4", "keywords": ["urgent"] } ],
    "serial_patterns":       [ { "id": "SP01", "key": "SP01_ADVANCE_FEE_FRAUD", "name": "...", "severity": 5, "category": "FINANCIAL_FRAUD", "stages": [ { "indicator": "...", "keywords": ["..."] } ], "match_rule": "flag when >=3 stages matched" } ],
    "case_configs":          []
  },
  "source": "webdocsol forensic-engine.js v2.0"
}
```

`source` is a free-text label; the seed's value names the engine as it was
called in July 2026 (today `forensic-engine-page.js`). The repository holds only
the seed, `worker/seed-rules.json`: v1.0.0, 43 contradiction patterns, 12
fraud-keyword groups (FK01–FK12), 10 behavioural markers, 17 serial patterns and
no case configs. On 2026-09-07 the Worker served v1.1.0: the seed plus the
curated groups FK13 and FK14 (ENGINE.md §12.7). For the live version, read
`/api/v1/status` or `/api/v1/rules/changelog`.

- `contradiction_patterns`: the engine's contradiction types (43 in v1.0.0/v1.1.0, CT01–CT43; the web engine itself now defines CT01–CT46 — the package lags its taxonomy and is never merged over it).
  `detectors` lists the automated detector ids that can produce each type
  (D01–D37 in the seed; the web engine itself now defines D01–D40). An empty
  array means the type is defined for manual or other analysis.
- `fraud_keywords`: in the seed (FK01–FK12), keyword sets extracted verbatim
  from detector source (`pairs`, `terms`, `items`, or `groups` depending on the
  group); curated and trainer entries (FK13 onwards) add vocabulary the engine
  does not have, and may carry `min_cooccur` and `curated_from`.
- `behavioral_markers`: coercion/urgency/secrecy/oath language markers derived
  from the engine's behavioral detectors and serial-pattern stages.
- `serial_patterns`: the engine's 17 multi-stage fraud schemes (SP01–SP17).
- `case_configs`: reserved; empty in v1.0.0 (the engine defines none).

## Canonical JSON (the signed bytes)

The signature covers the package serialized as **canonical JSON**:

1. UTF-8 encoding.
2. No insignificant whitespace (compact separators: `,` and `:`).
3. Object keys sorted **recursively** at every depth, in UTF-16 code-unit
   order: JavaScript's default `sort()`, which Java and Kotlin `String`
   ordering also uses. For keys inside the Basic Multilingual Plane this is
   code-point order. Array order is preserved as-is.
4. Strings exactly as JavaScript `JSON.stringify` writes them: `\"` and `\\`,
   the short escapes `\b \t \n \f \r`, any other character below U+0020 as
   lowercase `\u00xx`, and everything else as raw UTF-8. That includes all
   non-ASCII, `/`, U+007F–U+009F and U+2000–U+20FF. Do not use a library quote
   function that escapes more (org.json's `JSONObject.quote` does, and its
   bytes do not verify).
5. Numbers: integers are emitted without a decimal point or exponent
   (e.g. `5`, not `5.0`). The v1 package contains only integers and strings.

### JavaScript / Worker reference

```js
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalJson(value[k]))
    .join(',') + '}';
}
```

## How clients apply a package (2026-09-07; checked against the code 2026-10-03)

Every client verifies first, then applies **additively**: built-in detectors and their
keyword lists are never modified or removed, and a client with no verified package behaves
exactly like a fresh install. Each client's engine has its own matching model, so the same
package yields different findings on different clients — by design, and disclosed:

| Client | What it applies | How a hit is reported |
| --- | --- | --- |
| Website engine (`forensic-engine-page.js`, `voCompileRulePackage`, `voRunPackageRules`) | `fraud_keywords[].pairs` and `fraud_keywords[].groups` (co-occurrence sets) from every group except the seed's own vocabulary. A group is skipped when its id is FK01–FK12 and its `source_detector` is a built-in detector (`VO_ENGINE_OWN_RULE_GROUPS`); a curated group that only labels a built-in detector (v1.1.0's FK13/FK14 say `D37`) is applied. Pair phrases shorter than 3 characters are dropped | one finding per page where both phrases sit in one 80-character passage and no built-in finding of the same type reports that page (such a hit is withheld and counted). A phrase that occurs only inside its opposite ("paid" in "not paid") does not count. Type = `produces` when it is a CT id this engine defines, else CT43. Severity = min(type severity, 3), weight 0.5, at most 25 package findings per scan. The report and findings JSON name the rule, the package version and its SHA-512 |
| Android app (Liamhigh/1verum: `update/RuleUpdateClient.kt` fetches and verifies, `update/RuleProvider.kt` parses, `ContradictionDetectors.detectDownloadedFraudPairs` applies) | `fraud_keywords[].pairs` only — a `groups` rule (v1.1.0's FK13/FK14) is counted, not executed | a BEHAVIORAL/MODERATE contradiction `DOWNLOADED_RULE_<id>` when two claims sharing an actor or subject contain opposite sides |
| Fraud-firewall (Liamhigh/firebase: `src/core/ruleUpdate.ts` fetches and verifies, `src/pipeline/rules.ts` applies) | every string in `fraud_keywords[].pairs/terms/items/groups` as a phrase, the pairs as pairs, and `behavioral_markers` keywords/patterns | signals on transaction text (substring match); confidence from a score, LOW for one phrase, rising with more phrases and with a co-occurring pair |

The Android and fraud-firewall rows describe other repositories: last checked 2026-10-03,
when `RuleProvider.kt` was last changed in 1verum `5c7fda9` and `rules.ts` in firebase `397e705`.

On the website and the app, `fraud_keywords[].terms` and `[].items`, `behavioral_markers`,
`contradiction_patterns`, `serial_patterns` and `case_configs` are parsed and counted, but not
executed: a single keyword is not a contradiction. The app also skips `groups`.

### `groups` — co-occurrence sets

```json
{ "id": "FK14", "group": "guaranteed_return_language", "produces": "CT43", "min_cooccur": 2,
  "description": "…flag when >=2 phrases from the group co-occur…",
  "groups": [["guaranteed returns", "risk free", "capital guaranteed", "fixed returns", "high yield"]] }
```

Each inner array is one set of phrases that are benign alone and meaningful together. A client
fires the rule once when at least `min_cooccur` distinct phrases of a set co-occur (the website:
inside a 3-page window, located on the pages the matched phrases sit on and withheld when a
built-in finding of the same type reports the lowest of them). Publish
`min_cooccur` explicitly (an integer ≥ 2). Without one, or with one below 2, the website reads
">= N", "≥ N", "at least N", "minimum of N" or "no fewer than N" from `description`; failing
that it uses half the phrases, never below 2. The threshold never exceeds the number of
phrases. Phrases under three characters and duplicates are dropped, and a set left with fewer
than two phrases is ignored. Hyphens match spaces ("risk-free" = "risk free").

## Auto-curated entries and the changelog

The Worker's trainer run (ENGINE.md §12.9, `runAutoCuration`) appends `fraud_keywords`
entries of this shape, never touching existing ones. The run is weekly, Monday 03:00 UTC
(`wrangler.toml` `[triggers]`), or on demand with `POST /api/v1/admin/curate-publish`.
`AUTO_CURATE = "off"` disables it, and it needs `RULE_PRIVATE_KEY`. It appends at most three
groups, bumps the patch version, signs, and keeps the previous record under
`rules:history:<version>`:

```json
{ "id": "FK15", "group": "invoice_splitting", "source_detector": "B9", "produces": "CT43",
  "description": "…rationale… Auto-curated 2026-09-14 from 7 anonymous reports over 3 days (Brain 9 trainer run); recommendation tier, not a determination.",
  "curated_from": { "type": "INVOICE_SPLITTING", "detectorId": "AI_IDENTIFIED", "support": 7, "days": 3, "window_days": 7 },
  "min_cooccur": 2, "groups": [["split invoice", "below approval limit", "…"]] }
```

`GET /api/v1/rules/changelog` → `{ok, current:{version, published_at, published_by}, trainer:{schedule,
min_support, min_days, max_new_rules_per_run, enabled}, lastRun, entries:[{version, previous,
published_at, trigger, model, signals_considered, added:[{id, group, type, produces, support,
days, phrases, min_cooccur, dropped_phrases}], rejected}]}`.

- `lastRun` = `{trigger, started_at, finished_at, status (disabled|skipped|no_change|failed|published),
  reason, signals, drafted, accepted, rejected, published, model, changelog}`, or `null` before
  the first run.
- `current` is `null` when nothing is published; `published_by` is `admin`, `trainer:cron` or
  `trainer:admin`. `trainer.schedule` is the literal `"weekly (wrangler.toml [triggers])"`.
- `entries`: at most 200, newest first.

`source_detector: "B9"` marks a trainer rule. The website and the fraud-firewall apply it like
any other group; the Android app does not execute `groups` yet, so a trainer rule changes
nothing there. `lastRun.changelog` is `null` until a run publishes, then `"written"` or
`"not_written"`: a published run whose changelog entry could not be stored still shows its
version in `current` and in `lastRun.published`.

## Versioning

`version` is strict semver (`x.y.z`, no leading zeros). The Worker refuses a malformed or
leading-zero version with `400 invalid_version`. Every client applies only a **strictly
newer** version than the one it holds, so the Worker also refuses one that is not newer than
the published one (`409 version_not_newer`, with `current`). Roll a bad package back by
publishing a higher version. (The website's own shape check, `/^\d+\.\d+\.\d+$/`, also accepts
leading zeros; that is harmless only because the Worker never signs one.)

## Client verification

### Website (`voVerifyRulePackage`, `forensic-engine-page.js`)

Structure first, cryptography second (`voRulePackageShape`). A manifest is refused with a
named reason before any key is imported: `manifest_not_object`, `package_missing`,
`signature_missing` (no base64 string of at least 64 characters), `algorithm_unsupported`,
`key_id_unknown`, `version_invalid`, `rules_missing`, `rules_group_missing:<group>`,
`rules_empty` or `rules_too_many` (more than 5000). Then WebCrypto (RSASSA-PKCS1-v1_5,
SHA-512) verifies the signature against the pinned `VO_RULES_PUBLIC_KEY_DER_B64`.
`tests/rule-package.test.mjs` locks that constant to `worker/public-key.der.b64` byte for
byte. A failure reads `no_webcrypto`, `signature_invalid` or `verify_error:<msg>`. On success
the result carries the SHA-512 of the canonical bytes, the fingerprint the report prints.

The seal page (`voLoadRulePackage`, `seal-document.html`) fetches the relative path with an
8-second timeout. It keeps the last verified manifest in `localStorage`
(`vo.rulePackage.manifest.v1`) and re-verifies it on every load. It never replaces a newer
cached package with an older live one. With no verified package it runs the built-in rules only.

### Java (illustrative; the shipped Android client is `update/RuleUpdateClient.kt` in Liamhigh/1verum)

Never use `JSONObject.quote`: it escapes characters that `JSON.stringify` writes raw, and its
bytes do not verify (see the note on `quoteJsonString` in `RuleUpdateClient.kt`).

```java
// 1. Fetch
Request req = new Request.Builder()
    .url("https://verumglobal.foundation/api/v1/rules/manifest").build();
Response resp = okHttpClient.newCall(req).execute();
JSONObject manifest = new JSONObject(resp.body().string());

JSONObject pkg = manifest.getJSONObject("package");
byte[] signature = Base64.decode(manifest.getString("signature"), Base64.DEFAULT);

// 2. Canonicalize (recursive key sort, compact separators, UTF-8, no ASCII-escaping)
byte[] canonical = canonicalJson(pkg).getBytes(StandardCharsets.UTF_8);

// 3. Verify with the pinned public key (worker/public-key.der.b64, SPKI/DER)
byte[] der = Base64.decode(PINNED_PUBLIC_KEY_B64, Base64.DEFAULT);
PublicKey pub = KeyFactory.getInstance("RSA")
    .generatePublic(new X509EncodedKeySpec(der));
Signature sig = Signature.getInstance("SHA512withRSA");
sig.initVerify(pub);
sig.update(canonical);
boolean ok = sig.verify(signature);   // MUST be true before applying rules

static String canonicalJson(Object v) throws JSONException {
  if (v == null || v == JSONObject.NULL) return "null";
  if (v instanceof JSONObject) {
    JSONObject o = (JSONObject) v;
    List<String> keys = new ArrayList<>();
    for (Iterator<String> it = o.keys(); it.hasNext();) keys.add(it.next());
    Collections.sort(keys);
    StringBuilder sb = new StringBuilder("{");
    for (int i = 0; i < keys.size(); i++) {
      if (i > 0) sb.append(',');
      sb.append(quoteJsonString(keys.get(i))).append(':')
        .append(canonicalJson(o.get(keys.get(i))));
    }
    return sb.append('}').toString();
  }
  if (v instanceof JSONArray) {
    JSONArray a = (JSONArray) v;
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < a.length(); i++) {
      if (i > 0) sb.append(',');
      sb.append(canonicalJson(a.get(i)));
    }
    return sb.append(']').toString();
  }
  if (v instanceof String) return quoteJsonString((String) v);
  if (v instanceof Number) {
    // integers only in v1 packages — emit without decimals
    return String.valueOf(((Number) v).longValue());
  }
  if (v instanceof Boolean) return v.toString();
  throw new JSONException("unsupported value");
}

// JSON.stringify string quoting: \" \\ \b \t \n \f \r, lowercase \u00xx below
// U+0020, every other character raw (non-ASCII, '/', U+007F–U+009F, U+2000–U+20FF).
static String quoteJsonString(String s) {
  StringBuilder b = new StringBuilder("\"");
  for (char c : s.toCharArray()) {
    switch (c) {
      case '"':  b.append("\\\""); break;
      case '\\': b.append("\\\\"); break;
      case '\b': b.append("\\b"); break;
      case '\t': b.append("\\t"); break;
      case '\n': b.append("\\n"); break;
      case '\f': b.append("\\f"); break;
      case '\r': b.append("\\r"); break;
      default:
        if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
        else b.append(c);
    }
  }
  return b.append('"').toString();
}
```

### Node.js

```js
// Run as an ES module (.mjs), Node 18+ for global fetch.
import crypto from 'node:crypto';

function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(v).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalJson(v[k]))
    .join(',') + '}';
}

const manifest = await (await fetch(
  'https://verumglobal.foundation/api/v1/rules/manifest')).json();
const publicKey = crypto.createPublicKey({
  key: Buffer.from(PINNED_PUBLIC_KEY_B64, 'base64'), format: 'der', type: 'spki'
});
const ok = crypto.verify(
  'sha512',
  Buffer.from(canonicalJson(manifest.package), 'utf8'),
  { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
  Buffer.from(manifest.signature, 'base64')
); // ok === true
```

### OpenSSL (debugging)

```sh
# canonical.json = the canonical package bytes (no trailing newline);
# signature.bin  = the base64-decoded signature.
curl -s https://verumglobal.foundation/api/v1/rules/manifest > manifest.json
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('manifest.json','utf8'));const c=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(c).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+c(v[k])).join(',')+'}';fs.writeFileSync('canonical.json',c(m.package));fs.writeFileSync('signature.bin',Buffer.from(m.signature,'base64'))"
base64 -d public-key.der.b64 | openssl pkey -pubin -inform DER -out pub.pem
openssl dgst -sha512 -verify pub.pem -signature signature.bin canonical.json
# => Verified OK
```

## Feedback intake contract

`POST /api/v1/feedback/patterns` accepts ONLY anonymized pattern metadata:

```json
{ "patterns": [ { "detectorId": "D01", "type": "CT01", "severity": 5, "pageCount": 12 } ] }
```

- Body ≤ 16 KB (`413 body_too_large`). Only the top-level key `patterns`:
  1–200 entries, each exactly `{detectorId, type, severity, pageCount}`.
  `detectorId` and `type` are strings of 1–64 characters, `severity` an integer
  1–5, `pageCount` an integer 0–1,000,000 (`400 invalid_json`, `invalid_shape`,
  `too_many_patterns` or `invalid_pattern` otherwise).
- Any key, at any depth and in any case, named for content or personal data is
  refused with `422 privacy_violation` and `offending_fields`, and nothing is
  stored. This check runs before the per-pattern checks. The names include
  `quote`, `evidence`, `text`, `content`, `document`, `name`, `description`,
  `subject`, `path`, `file`, `hash`, `url`, `email` and `phone`; the full list
  is `BANNED_FEEDBACK_FIELDS` in `worker/verum-rules.js`.
- Stored in daily KV buckets `feedback:YYYY-MM-DD` (UTC date), at most 2000
  submissions a day (the oldest dropped first), with a 90-day TTL. Reply:
  `{ok, stored, bucket}`.

## Admin publish contract

`POST /api/v1/admin/publish` with header `x-admin-token`:

- Body: a complete rule package (schema above), at most 1 MB (`413
  body_too_large`), a valid JSON object (`400 invalid_json` / `invalid_shape`).
  `version` is strict `x.y.z` (`400 invalid_version`) and strictly newer than
  the published one (`409 version_not_newer`).
- Deterministic constitution check: all five rule arrays exist, and the total
  rule count is > 0 and ≤ 5000 (`422 constitution_check_failed`).
- On success the server overwrites `published_at`, signs the package otherwise
  exactly as sent (extra keys are signed too), stores it as current and returns
  `{ok, version, published_at, rule_counts}`. It keeps no history copy and
  writes no changelog entry; `/api/v1/rules/changelog` then shows
  `published_by: "admin"`.
- `500 not_configured` when `ADMIN_TOKEN` is unset, `401` without the header,
  `403` with a wrong token (constant-time compare).

## Key management

- `publicKeyId`: `vo-master-1` (RSA-4096). Public key: `public-key.der.b64`
  (SubjectPublicKeyInfo DER, base64). Pin it in client builds.
- The Worker reads the private key only from the `RULE_PRIVATE_KEY` secret
  (PKCS#8 DER, base64), set in the Cloudflare dashboard. No private key is
  committed to git. Whether any other copy exists cannot be checked from the
  repository.
- Rotation is not implemented. `vo-master-1` is hard-coded in
  `worker/verum-rules.js` (`PUBLIC_KEY_ID`), in the engine
  (`VO_RULES_PUBLIC_KEY_ID` and the pinned `VO_RULES_PUBLIC_KEY_DER_B64`,
  test-locked to `public-key.der.b64`), in the Android app
  (`core/Constitution.kt`) and in the fraud-firewall (`src/core/ruleUpdate.ts`).
  Every client refuses a package under any other key id. A rotation must first
  ship clients that accept both keys, then switch the Worker's secret and key
  id. Open with the founder.

## What locks this document

`tests/rule-package.test.mjs` (129 assertions) uses the JavaScript canonicaliser above as its
oracle, and locks the engine's pinned key to `worker/public-key.der.b64` and the key id to
`vo-master-1`. It also covers verification refusals, compile and apply.
`tests/worker.test.mjs` (311 assertions) covers publish, feedback and the trainer. Change
this format only together with the Worker, the engine, the Android app and the
fraud-firewall.

## Live state

Last recorded 2026-09-07 (ENGINE.md §12.7): v1.1.0, published 2026-07-19, 43/14/10/17/0
rules. The trainer may have published patch versions since. The repository cannot show what
is live now: run the `live-site-probe` workflow, which prints `/api/v1/status`,
`/api/v1/rules/manifest` (shape only) and `/api/v1/rules/changelog`, or open `/api/v1/status`.
