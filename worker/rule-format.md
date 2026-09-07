# Verum Omnis Rule Package Format v1

The `verum-rules` worker distributes signed forensic rule packages to offline
clients (Android, web, desktop). Clients MUST verify the RSA signature before
trusting or applying a package.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/status` | `{ok, service, version, published_at}` |
| GET | `/api/v1/rules/manifest` | Signed manifest (below) |
| POST | `/api/v1/feedback/patterns` | Anonymized pattern feedback only |
| POST | `/api/v1/admin/publish` | Publish a new signed package (admin token) |

Base URLs: `https://verumglobal.foundation` and `https://www.verumglobal.foundation`.

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

- `contradiction_patterns`: the engine's contradiction types (43 in v1.0.0/v1.1.0, CT01–CT43; the web engine itself now defines CT01–CT46 — the package lags its taxonomy and is never merged over it).
  `detectors` lists the automated detector ids (D01–D37) that can produce each
  type; an empty array means the type is defined for manual/other analysis.
- `fraud_keywords`: keyword sets extracted verbatim from detector source
  (`pairs`, `terms`, `items`, or `groups` depending on the group).
- `behavioral_markers`: coercion/urgency/secrecy/oath language markers derived
  from the engine's behavioral detectors and serial-pattern stages.
- `serial_patterns`: the engine's 17 multi-stage fraud schemes (SP01–SP17).
- `case_configs`: reserved; empty in v1.0.0 (the engine defines none).

## Canonical JSON (the signed bytes)

The signature covers the package serialized as **canonical JSON**:

1. UTF-8 encoding.
2. No insignificant whitespace (compact separators: `,` and `:`).
3. Object keys sorted lexicographically (code-point order) **recursively** at
   every depth. Array order is preserved as-is.
4. Strings emitted as JSON strings. Do NOT escape non-ASCII characters; emit
   them as raw UTF-8. Only the escapes JSON requires (`\"`, `\\`, control
   characters) are used — this is exactly what JavaScript `JSON.stringify`
   produces.
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

## How clients apply a package (2026-09-07)

Every client verifies first, then applies **additively**: built-in detectors and their
keyword lists are never modified or removed, and a client with no verified package behaves
exactly like a fresh install. Each client's engine has its own matching model, so the same
package yields different findings on different clients — by design, and disclosed:

| Client | What it applies | How a hit is reported |
| --- | --- | --- |
| Website engine (`forensic-engine-page.js`, `voRunPackageRules`) | `fraud_keywords[].pairs` and `fraud_keywords[].groups` (co-occurrence sets) from every group except the seed's twelve (FK01–FK12, its own exported vocabulary) | one finding per page where both phrases sit in one 80-character passage and no built-in finding of the same type reports that page; type = `produces` (else CT43), severity ≤ 3, weight 0.5; the report and findings JSON name the rule and the package version and SHA-512 |
| Android app (`RuleProvider.kt`, `detectDownloadedFraudPairs`) | `fraud_keywords[].pairs` only — a `groups` rule (v1.1.0's FK13/FK14) is counted, not executed | a BEHAVIORAL/MODERATE contradiction `DOWNLOADED_RULE_<id>` when two claims sharing an actor or subject contain opposite sides |
| Fraud-firewall (`pipeline/rules.ts`) | `fraud_keywords` phrases/pairs and `behavioral_markers` keywords/patterns | LOW-confidence signals on transaction text (substring match) |

`terms`, `contradiction_patterns`, `serial_patterns` and `case_configs` are parsed and counted
by the website and the app but not executed; a single keyword is not a contradiction.

### `groups` — co-occurrence sets

```json
{ "id": "FK14", "group": "guaranteed_return_language", "produces": "CT43", "min_cooccur": 2,
  "description": "…flag when >=2 phrases from the group co-occur…",
  "groups": [["guaranteed returns", "risk free", "capital guaranteed", "fixed returns", "high yield"]] }
```

Each inner array is one set of phrases that are benign alone and meaningful together. A client
fires the rule once when at least `min_cooccur` distinct phrases of a set co-occur (the website:
inside a 3-page window, anchored to the pages the phrases sit on). Publish `min_cooccur`
explicitly; a client without it reads ">= N" / "at least N" from `description`, and failing
that uses half the phrases (never below 2). Groups with one phrase are ignored.

## Auto-curated entries and the changelog

The Worker's trainer run (ENGINE.md §12.9) appends `fraud_keywords` entries of this shape,
never touching existing ones:

```json
{ "id": "FK15", "group": "invoice_splitting", "source_detector": "B9", "produces": "CT43",
  "description": "…rationale… Auto-curated 2026-09-14 from 7 anonymous reports over 3 days (Brain 9 trainer run); recommendation tier, not a determination.",
  "curated_from": { "type": "INVOICE_SPLITTING", "detectorId": "AI_IDENTIFIED", "support": 7, "days": 3, "window_days": 7 },
  "min_cooccur": 2, "groups": [["split invoice", "below approval limit", "…"]] }
```

`GET /api/v1/rules/changelog` → `{ok, current:{version, published_at, published_by}, trainer:{schedule,
min_support, min_days, max_new_rules_per_run, enabled}, lastRun, entries:[{version, previous,
published_at, trigger, model, signals_considered, added:[{id, group, type, produces, support,
days, phrases, min_cooccur}], rejected}]}`. `source_detector: "B9"` marks a trainer rule; clients
apply it exactly like any other group.

## Versioning

`version` is strict semver (`x.y.z`, no leading zeros). Every client applies only a
**strictly newer** version than the one it holds, so the Worker refuses to publish a version
that is not newer than the published one (`409 version_not_newer`). Roll a bad package back
by publishing a higher version.

## Client verification

### Android (Kotlin/Java, OkHttp)

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
      sb.append(JSONObject.quote(keys.get(i))).append(':')
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
  if (v instanceof String) return JSONObject.quote((String) v);
  if (v instanceof Number) {
    // integers only in v1 packages — emit without decimals
    return String.valueOf(((Number) v).longValue());
  }
  if (v instanceof Boolean) return v.toString();
  throw new JSONException("unsupported value");
}
```

### Node.js

```js
const crypto = require('crypto');

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
base64 -d public-key.der.b64 | openssl pkey -pubin -inform DER -out pub.pem
openssl dgst -sha512 -verify pub.pem -signature signature.bin canonical.json
# => Verified OK
```

## Feedback intake contract

`POST /api/v1/feedback/patterns` accepts ONLY anonymized pattern metadata:

```json
{ "patterns": [ { "detectorId": "D01", "type": "CT01", "severity": 5, "pageCount": 12 } ] }
```

- Body limit: 16 KB. `severity`: integer 1–5. `pageCount`: non-negative integer.
- Any field that could carry document content or personal data
  (`quote`, `evidence`, `text`, `content`, `document`, `name`, …) anywhere in
  the body is rejected with HTTP 422 `privacy_violation` and is never stored.
- Submissions are aggregated in daily KV buckets (`feedback:YYYY-MM-DD`) with a
  90-day TTL.

## Admin publish contract

`POST /api/v1/admin/publish` with header `x-admin-token`:

- Body: a complete rule package (schema above). `version` must be `x.y.z`.
- Deterministic constitution check: all five rule arrays must exist; total rule
  count must be > 0 and ≤ 5000 (HTTP 422 otherwise).
- On success the server stamps `published_at`, signs the package with the
  master key, stores it as current, and returns `{ok, version, published_at,
  rule_counts}`.
- 401 without the header, 403 with a wrong token.

## Key management

- `publicKeyId`: `vo-master-1` (RSA-4096). Public key: `public-key.der.b64`
  (SubjectPublicKeyInfo DER, base64). Pin it in client builds.
- The private key exists only as the `RULE_PRIVATE_KEY` Worker secret
  (PKCS#8 DER, base64). It is never committed to git.
- Key rotation: publish a new package signed by the new key under a new
  `publicKeyId`, and ship the new public key in the next client release.
