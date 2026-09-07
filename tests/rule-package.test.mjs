/**
 * Signed rule packages on the website — the engine-update loop's client side
 * (ENGINE.md §12.7, worker/rule-format.md). The Android app and the
 * fraud-firewall fetch /api/v1/rules/manifest, verify the RSA-SHA512
 * signature against the pinned master key and apply the package additively;
 * this locks the website's copy of that contract:
 *   1. canonical JSON is byte-identical to the Worker's (the signed bytes);
 *   2. the pinned key IS worker/public-key.der.b64;
 *   3. a signature verifies, and every tamper, wrong key, wrong algorithm,
 *      wrong key id or malformed package is refused with a named reason;
 *   4. compilation mirrors RuleProvider.kt and skips the engine's own
 *      vocabulary (groups whose source_detector is a built-in detector);
 *   5. application is additive, page-local, deduplicated against built-in
 *      findings, conservative in severity and weight, and capped;
 *   6. the engine is byte-identical with no package handed over;
 *   7. the seal page fetches, caches, awaits and reports; the reports and the
 *      findings JSON name the package.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const nodeCrypto = require('node:crypto');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  rule-package.test.mjs');
console.log('======================================================\n');

const E = require(path.join(root, 'forensic-engine-page.js'));
const seed = JSON.parse(readFileSync(path.join(root, 'worker', 'seed-rules.json'), 'utf8'));
const subtle = nodeCrypto.webcrypto.subtle;

// ---- 1. canonical JSON: the reference from rule-format.md is the oracle ----
function refCanonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(refCanonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + refCanonical(v[k])).join(',') + '}';
}
{
  const sample = { z: [3, { b: 'é — “quotes”', a: null, n: 5 }], a: { y: true, x: 'ünïcode\n"q"' }, m: 0 };
  ok(E.voCanonicalJson(sample) === refCanonical(sample), 'canonical JSON matches the rule-format.md reference on a nested unicode object');
  ok(E.voCanonicalJson(seed) === refCanonical(seed), 'canonical JSON matches the reference on the seed package');
  ok(E.voCanonicalJson({ b: 1, a: [1, { d: 2, c: 'x y' }] }) === '{"a":[1,{"c":"x y","d":2}],"b":1}', 'canonical JSON carries no insignificant whitespace and sorts keys at every depth');
  const workerSrc = readFileSync(path.join(root, 'worker', 'verum-rules.js'), 'utf8');
  ok(/function canonicalJson\(value\) \{\s*if \(value === null \|\| typeof value !== 'object'\) return JSON\.stringify\(value\);/.test(workerSrc),
    'the Worker still signs the same canonical form (source lock)');
}

// ---- 2. the pinned key is the file the Worker and the apps pin ----
{
  const file = readFileSync(path.join(root, 'worker', 'public-key.der.b64'), 'utf8').replace(/\s+/g, '');
  ok(E.VO_RULES_PUBLIC_KEY_DER_B64 === file, 'VO_RULES_PUBLIC_KEY_DER_B64 equals worker/public-key.der.b64 byte for byte');
  ok(E.VO_RULES_PUBLIC_KEY_ID === 'vo-master-1', 'key id vo-master-1');
  ok(E.VO_RULES_ALGORITHM === 'RSASSA-PKCS1-v1_5-SHA512', 'algorithm RSASSA-PKCS1-v1_5-SHA512');
  const spki = nodeCrypto.createPublicKey({ key: Buffer.from(file, 'base64'), format: 'der', type: 'spki' });
  ok(spki.asymmetricKeyType === 'rsa' && spki.asymmetricKeyDetails.modulusLength === 4096, 'pinned key is RSA-4096 SPKI (' + spki.asymmetricKeyDetails.modulusLength + ')');
}

// ---- 3. verification: sign like the Worker, verify like the page ----
function makeKey() {
  const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privateKey, publicB64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') };
}
function signManifest(pkg, privateKey, extra) {
  const canonical = Buffer.from(E.voCanonicalJson(pkg), 'utf8');
  const signature = nodeCrypto.sign('sha512', canonical, { key: privateKey, padding: nodeCrypto.constants.RSA_PKCS1_PADDING }).toString('base64');
  return Object.assign({ package: pkg, signature, algorithm: 'RSASSA-PKCS1-v1_5-SHA512', publicKeyId: 'vo-master-1' }, extra || {});
}
const curatedPkg = {
  version: '1.2.0',
  published_at: '2026-09-07T00:00:00.000Z',
  source: 'test',
  rules: {
    contradiction_patterns: seed.rules.contradiction_patterns.slice(0, 2),
    fraud_keywords: seed.rules.fraud_keywords.slice(0, 2).concat([
      { id: 'FK13', group: 'curated_pairs', produces: 'CT01', description: 'curated from feedback', pairs: [['delivered', 'never delivered'], ['signed', 'unsigned']], terms: ['flat term', ['co', 'occurrence']] },
      { id: 'FK14', group: 'curated_no_type', source_detector: 'D99', pairs: [['granted', 'refused']] },
      { id: 'FK15', group: 'curated_bad', pairs: [['ab', 'x'], ['same', 'same'], 'nope'] }
    ]),
    behavioral_markers: seed.rules.behavioral_markers.slice(0, 3),
    serial_patterns: [],
    case_configs: []
  }
};
const key = makeKey();
{
  const manifest = signManifest(curatedPkg, key.privateKey);
  const v = await E.voVerifyRulePackage(manifest, { subtle, publicKeyB64: key.publicB64 });
  ok(v.ok === true && v.reason === null, 'a correctly signed manifest verifies (' + v.reason + ')');
  ok(v.package === manifest.package, 'verification hands back the package object');
  const expectSha = nodeCrypto.createHash('sha512').update(Buffer.from(E.voCanonicalJson(curatedPkg), 'utf8')).digest('hex');
  ok(v.sha512 === expectSha, 'sha512 is the digest of the exact signed bytes');

  const tampered = JSON.parse(JSON.stringify(manifest)); tampered.package.rules.fraud_keywords[2].pairs.push(['a b', 'c d']);
  ok((await E.voVerifyRulePackage(tampered, { subtle, publicKeyB64: key.publicB64 })).reason === 'signature_invalid', 'a tampered package is refused: signature_invalid');
  const other = makeKey();
  ok((await E.voVerifyRulePackage(manifest, { subtle, publicKeyB64: other.publicB64 })).reason === 'signature_invalid', 'a signature from another key is refused');
  ok((await E.voVerifyRulePackage(manifest, { subtle })).reason === 'signature_invalid', 'against the PINNED key a test signature is refused (the pin is real)');
  ok((await E.voVerifyRulePackage(Object.assign({}, manifest, { algorithm: 'RSASSA-PKCS1-v1_5-SHA256' }), { subtle, publicKeyB64: key.publicB64 })).reason === 'algorithm_unsupported', 'another algorithm is refused before any cryptography');
  ok((await E.voVerifyRulePackage(Object.assign({}, manifest, { publicKeyId: 'vo-master-2' }), { subtle, publicKeyB64: key.publicB64 })).reason === 'key_id_unknown', 'an unknown key id is refused');
  ok((await E.voVerifyRulePackage(Object.assign({}, manifest, { signature: 'short' }), { subtle, publicKeyB64: key.publicB64 })).reason === 'signature_missing', 'a missing/short signature is refused');
  const noGroup = JSON.parse(JSON.stringify(manifest)); delete noGroup.package.rules.case_configs;
  ok((await E.voVerifyRulePackage(noGroup, { subtle, publicKeyB64: key.publicB64 })).reason === 'rules_group_missing:case_configs', 'a package missing a rule group is refused');
  const badVer = JSON.parse(JSON.stringify(manifest)); badVer.package.version = '1.2';
  ok((await E.voVerifyRulePackage(badVer, { subtle, publicKeyB64: key.publicB64 })).reason === 'version_invalid', 'a non-semver version is refused');
  ok((await E.voVerifyRulePackage(null, { subtle })).reason === 'manifest_not_object', 'null is refused');
  ok((await E.voVerifyRulePackage('{}', { subtle })).reason === 'manifest_not_object', 'a string is refused');
  const broken = await E.voVerifyRulePackage(manifest, { subtle: { importKey: async () => { throw new Error('boom'); } }, publicKeyB64: key.publicB64 });
  ok(broken.ok === false && /^verify_error:boom/.test(broken.reason), 'a failing WebCrypto is reported, never thrown (' + broken.reason + ')');
  // The real seed package signs and verifies too (the Worker's own shape).
  const seedManifest = signManifest(seed, key.privateKey);
  ok((await E.voVerifyRulePackage(seedManifest, { subtle, publicKeyB64: key.publicB64 })).ok === true, 'the seed package (43/12/10/17/0 rules) verifies when signed');
}

// ---- 4. compilation mirrors RuleProvider.kt and skips the engine's own vocabulary ----
{
  const c = E.voCompileRulePackage(seed, { sha512: 'abc', keyId: 'vo-master-1', fetchedFrom: 'live' });
  ok(c.version === '1.0.0' && c.sha512 === 'abc' && c.fetchedFrom === 'live', 'compiled package carries version and provenance');
  ok(c.pairs.length === 0, 'seed package: every fraud-keyword group is this engine\'s own vocabulary -> 0 pairs to apply (' + c.pairs.length + ')');
  ok(c.builtInGroupsSkipped.length === 12 && c.builtInGroupsSkipped[0] === 'FK01', 'seed package: 12 groups skipped by source_detector (' + c.builtInGroupsSkipped.length + ')');
  ok(c.markers.length === 10 && c.markers[0].keywords.length === 4, 'behavioral markers parsed and counted, never executed');
  ok(JSON.stringify(c.counts) === JSON.stringify({ contradiction_patterns: 43, fraud_keywords: 12, behavioral_markers: 10, serial_patterns: 17, case_configs: 0 }), 'per-group counts (' + JSON.stringify(c.counts) + ')');

  const cc = E.voCompileRulePackage(curatedPkg, { sha512: 'def' });
  ok(cc.pairs.length === 3, 'curated package: pairs from the non-built-in groups only (' + cc.pairs.length + ')');
  ok(cc.pairs[0].ruleId === 'FK13' && cc.pairs[0].first === 'delivered' && cc.pairs[0].second === 'never delivered' && cc.pairs[0].produces === 'CT01', 'FK13 pair compiled with its CT type');
  ok(cc.pairs[2].ruleId === 'FK14' && cc.pairs[2].produces === null, 'an unknown source_detector (D99) is not the engine\'s own; its pair applies with no type');
  // The engine's own vocabulary is the SEED's groups (by id) whose source_detector is a built-in detector — nothing else.
  const seedOwn = seed.rules.fraud_keywords.filter(g => /^D\d{2}$/.test(String(g.source_detector || '')) && Object.keys(E.DETECTORS).some(k => k.indexOf(g.source_detector + '_') === 0)).map(g => g.id);
  ok(JSON.stringify(seedOwn) === JSON.stringify(E.VO_ENGINE_OWN_RULE_GROUPS), 'VO_ENGINE_OWN_RULE_GROUPS equals the seed groups whose source_detector is a built-in detector (' + seedOwn.join(',') + ')');
  const labelled = E.voCompileRulePackage({ version: '1.1.0', rules: { fraud_keywords: [{ id: 'FK14', group: 'guaranteed_return_language', source_detector: 'D37', produces: 'CT43', pairs: [['guaranteed return', 'capital at risk']] }] } }, {});
  ok(labelled.pairs.length === 1 && labelled.builtInGroupsSkipped.length === 0 && labelled.pairs[0].produces === 'CT43', 'a curated group that merely labels a built-in detector (FK14 via D37, as published in v1.1.0) IS applied');
  ok(cc.pairs.every(p => p.ruleId !== 'FK15'), 'malformed pairs (too short, identical, not an array) are dropped');
  ok(cc.terms.length === 1 && cc.terms[0].term === 'flat term', 'terms: flat strings only, co-occurrence sets skipped (as RuleProvider.kt)');
  ok(cc.builtInGroupsSkipped.length === 2, 'the two seed groups in the curated package are skipped (' + cc.builtInGroupsSkipped.join(',') + ')');
  const bogus = E.voCompileRulePackage({ version: '9.9.9', rules: { fraud_keywords: [{ id: 'FKX', produces: 'CT99', pairs: [['alpha beta', 'gamma delta']] }] } }, {});
  ok(bogus.pairs.length === 1 && bogus.pairs[0].produces === null, 'a produces value that is not a known CT id is ignored (falls back at apply time)');
}

// ---- 5. application: additive, page-local, deduplicated, conservative, capped ----
{
  const cc = E.voCompileRulePackage(curatedPkg, { sha512: 'def' });
  const pages = [
    'Page one is ordinary correspondence about the lease and nothing else of note.',
    'The goods were delivered on 3 May, the manager wrote, yet he later swore they were never delivered to the site.',
    'Here delivered appears, and a very long stretch of unrelated prose follows for more than eighty characters before the phrase never delivered occurs again.',
    'The application was granted on Monday and refused on Tuesday by the same officer.'
  ];
  const r = E.voRunPackageRules(cc, pages, []);
  ok(r.findings.length === 2 && r.withheld === 0, 'two findings: the local pair on page 2 and the untyped pair on page 4 (' + r.findings.length + ')');
  const f2 = r.findings.find(f => f.location === 'Page 2');
  ok(f2 && f2.type === 'CT01' && f2.severity === 3, 'page 2: CT01 from the rule\'s produces, severity capped at MODERATE (' + (f2 && f2.severity) + ')');
  ok(f2 && f2.packageRule === 'FK13' && f2.packageVersion === '1.2.0' && f2.detectorId === 'DXX_SIGNED_RULE_PACKAGE', 'finding names its rule, package version and detector id');
  ok(f2 && /Signed rule FK13 \(package v1\.2\.0\): opposing phrases "delivered" and "never delivered" in one passage: "/.test(f2.evidence) && /never delivered to the site/.test(f2.evidence), 'evidence quotes the passage the anchor machinery can pin');
  const f4 = r.findings.find(f => f.location === 'Page 4');
  ok(f4 && f4.type === 'CT43' && f4.packageRule === 'FK14', 'an untyped rule falls back to CT43 (Document Internal Conflict)');
  ok(!r.findings.some(f => f.location === 'Page 3'), 'phrases more than one window apart do not fire');
  // "not paid" contains "paid": the positive side inside the negative is one phrase.
  const inside = E.voCompileRulePackage({ version: '1.0.1', rules: { fraud_keywords: [{ id: 'FKN', produces: 'CT01', pairs: [['paid', 'not paid']] }] } }, {});
  ok(E.voRunPackageRules(inside, ['The invoice was not paid by the due date.'], []).findings.length === 0, 'a phrase that only occurs inside its opposite does not fire');
  ok(E.voRunPackageRules(inside, ['The invoice was paid in full on the 3rd; the auditor recorded it as not paid.'], []).findings.length === 1, 'the same pair fires when both sides occur separately');
  // Deduplication against built-in findings on the same page.
  const dedup = E.voRunPackageRules(cc, pages, [{ type: 'CT01', location: 'Page 2', evidence: 'x' }]);
  ok(dedup.findings.length === 1 && dedup.withheld === 1, 'a built-in CT01 already on page 2 withholds the package finding there (withheld=' + dedup.withheld + ')');
  ok(E.voRunPackageRules(cc, pages, [{ type: 'CT01', location: 'Pages 1-3', evidence: 'x' }]).withheld === 1, 'a page-range location covers the page');
  ok(E.voRunPackageRules(cc, pages, [{ type: 'CT03', location: 'Page 2', evidence: 'x' }]).withheld === 0, 'a different type on the page does not withhold');
  ok(E.voRunPackageRules(cc, pages, [{ type: 'CT01', location: 'p. 2 vs 224', evidence: 'x' }]).withheld === 1, 'a "p. 2 vs 224" location covers page 2');
  ok(JSON.stringify(E.voRulePagesOf('Pages 3-6')) === '[3,4,5,6]' && JSON.stringify(E.voRulePagesOf('Pages 17, 17')) === '[17]' && JSON.stringify(E.voRulePagesOf('Full document')) === '[]', 'location page parser');
  // Single-block documents anchor to "Full document".
  ok(E.voRunPackageRules(cc, [pages.join(' ')], []).findings[0].location === 'Full document', 'one text block -> Full document');
  // Determinism and the cap.
  const many = E.voCompileRulePackage({ version: '1.0.2', rules: { fraud_keywords: [{ id: 'FKM', produces: 'CT01', pairs: [['alpha', 'not alpha']] }] } }, {});
  const lots = []; for (let i = 0; i < 40; i++) lots.push('alpha here and not alpha there on page ' + (i + 1));
  const capped = E.voRunPackageRules(many, lots, []);
  ok(capped.findings.length === E.voRunPackageRules(many, lots, []).findings.length && capped.findings.length === 25, 'deterministic and capped at 25 per scan (' + capped.findings.length + ')');
  ok(E.voRunPackageRules(null, pages, []).findings.length === 0 && E.voRunPackageRules({ version: '1', pairs: [] }, pages, []).findings.length === 0, 'no package / no pairs -> nothing');
  ok(E.VO_PACKAGE_RULE_CONFIDENCE === 0.5 && E.VO_PACKAGE_RULE_MAX_SEVERITY === 3, 'weight 0.5 and severity cap 3 (Android: MODERATE)');

  // ---- 5b. co-occurrence groups: the shape the curated v1.1.0 rules use (as published) ----
  const live = { version: '1.1.0', rules: { fraud_keywords: [
    { id: 'FK13', group: 'ml_staging_cooccurrence', source_detector: 'D37', produces: 'CT43', description: 'Money-laundering staging language observed in the investment/commission/trust case class; each term is benign alone - flag only when >=3 terms from the group co-occur in one document. Investigative indicator, not a determination.', groups: [['commission', 'investment', 'trust account', 'offshore', 'intermediary']] },
    { id: 'FK14', group: 'guaranteed_return_language', source_detector: 'D37', produces: 'CT43', description: 'Guaranteed-return solicitation language characteristic of investment-scam documentation in the same case class; flag when >=2 phrases from the group co-occur. Investigative indicator, not a determination.', groups: [['guaranteed returns', 'risk free', 'capital guaranteed', 'fixed returns', 'high yield']] }
  ] } };
  const lc = E.voCompileRulePackage(live, {});
  ok(lc.groups.length === 2 && lc.pairs.length === 0 && lc.builtInGroupsSkipped.length === 0, 'v1.1.0\'s two curated groups compile as co-occurrence groups (' + lc.groups.length + ')');
  ok(lc.groups[0].ruleId === 'FK13' && lc.groups[0].min === 3 && lc.groups[0].phrases.length === 5, 'FK13 threshold 3 read from its description (">=3 terms")');
  ok(lc.groups[1].ruleId === 'FK14' && lc.groups[1].min === 2 && lc.groups[1].produces === 'CT43', 'FK14 threshold 2 read from its description (">=2 phrases")');
  const gpages = ['Ordinary cover letter about the lease.', 'We offer guaranteed returns of 12% and the scheme is risk-free for participants.', 'Pay the commission into the trust account via an offshore intermediary.', 'Nothing of note here.'];
  const gr = E.voRunPackageRules(lc, gpages, []);
  ok(gr.findings.length === 2 && gr.withheld === 0, 'both groups fire on a document that carries their phrases (' + gr.findings.length + ')');
  const g14 = gr.findings.find(f => f.packageRule === 'FK14'), g13 = gr.findings.find(f => f.packageRule === 'FK13');
  ok(g14 && g14.type === 'CT43' && g14.severity === 3 && g14.location === 'Page 2' && /"guaranteed returns" \(p\. 2\), "risk free" \(p\. 2\)/.test(g14.evidence), 'FK14: CT43, severity 3, anchored to the page its phrases sit on, both phrases quoted (' + (g14 && g14.location) + ')');
  ok(g14 && /2 of 5 phrases of the "guaranteed_return_language" group co-occur \(threshold 2\)/.test(g14.evidence), 'FK14 evidence states the count and the threshold');
  ok(g13 && g13.location === 'Page 3' && /4 of 5 phrases/.test(g13.evidence), 'FK13: four phrases on page 3 clear the threshold of 3 (' + (g13 && g13.location) + ')');
  ok(E.voRunPackageRules(lc, ['We offer guaranteed returns of 12%.', 'Unrelated page.'], []).findings.length === 0, 'one phrase alone never fires (each term is benign alone)');
  ok(E.voRunPackageRules(lc, ['risk-free capital-guaranteed offer'], []).findings.length === 1, 'hyphenated spellings meet the group\'s phrases (risk-free = risk free)');
  const spread = E.voRunPackageRules(lc, ['commission paid', 'to the trust account', 'via an offshore route', 'x', 'y'], []);
  ok(spread.findings.length === 1 && spread.findings[0].location === 'Pages 1-3', 'phrases spread over the 3-page window co-occur and anchor to their pages (' + (spread.findings[0] && spread.findings[0].location) + ')');
  ok(E.voRunPackageRules(lc, ['commission paid', 'x', 'y', 'to the trust account', 'z', 'via an offshore route'], []).findings.length === 0, 'phrases further apart than the window do not co-occur');
  ok(E.voRunPackageRules(lc, gpages, [{ type: 'CT43', location: 'Page 2', evidence: 'x' }]).withheld === 1, 'a built-in CT43 already on the anchor page withholds the group finding');
  const explicit = E.voCompileRulePackage({ version: '1.2.0', rules: { fraud_keywords: [{ id: 'FK20', group: 'g', produces: 'CT43', min_cooccur: 4, groups: [['a b', 'c d', 'e f', 'g h', 'i j']] }, { id: 'FK21', group: 'h', groups: [['one two', 'three four', 'five six', 'seven eight']] }] } }, {});
  ok(explicit.groups[0].min === 4 && explicit.groups[1].min === 2, 'an explicit min_cooccur wins; with neither field nor prose the threshold is half the phrases, never below 2');
  ok(E.voCompileRulePackage({ version: '1.2.0', rules: { fraud_keywords: [{ id: 'FK22', groups: [['solo']] }] } }, {}).groups.length === 0, 'a one-phrase group is not a co-occurrence rule');
  ok(JSON.stringify(E.voRunPackageRules(lc, gpages, [])) === JSON.stringify(E.voRunPackageRules(lc, gpages, [])), 'group application is deterministic');
  ok(E.voSemverNewer('1.2.0', '1.1.9') && !E.voSemverNewer('1.1.0', '1.1.0') && !E.voSemverNewer('x', '1.0.0') && E.voSemverNewer('1.0.0', 'x'), 'semver comparison');
}

// ---- 6. the engine is inert without a package ----
{
  const src = readFileSync(path.join(root, 'forensic-engine-page.js'), 'utf8');
  ok(/var _pkg = _gp && _gp\.voRulePackage;\s*if \(_pkg && typeof _pkg === 'object' && _pkg\.version && \(Array\.isArray\(_pkg\.pairs\) \|\| Array\.isArray\(_pkg\.groups\)\)\)/.test(src), 'runForensicEngine reads only globalThis.voRulePackage, guarded');
  ok(/rulePackage: _rulePkgInfo,/.test(src), 'the engine result carries rulePackage (null when none applied)');
  ok(/if \(finding\.packageRule\) cw = Math\.min\(cw, VO_PACKAGE_RULE_CONFIDENCE\);/.test(src), 'scoring caps a package finding\'s weight');
  ok(typeof globalThis.voRulePackage === 'undefined', 'the Node harness never sets a package (regression suites run the built-in engine)');
  ok(!/Date\.now\(\)|Math\.random\(\)/.test(src.slice(src.indexOf('SIGNED RULE PACKAGES (additive engine update)'))), 'no Date.now / Math.random in the package code (determinism)');
  ok(!/\(\?<[=!]/.test(src.slice(src.indexOf('SIGNED RULE PACKAGES (additive engine update)'))), 'no regex lookbehind in the package code');
}

// ---- 7. the seal page and the reports ----
{
  const html = readFileSync(path.join(root, 'seal-document.html'), 'utf8');
  ok(/id="rulePackageStatus"/.test(html), 'the seal page shows the rule-package status under the feedback checkbox');
  ok(/var VO_RULES_MANIFEST_PATH = '\/api\/v1\/rules\/manifest';/.test(html), 'manifest path is relative (works on the domain and on workers.dev)');
  ok(/function voLoadRulePackage\(\)/.test(html) && /typeof document\.getElementById === 'function' && typeof fetch === 'function'\) \{\s*setTimeout\(function \(\) \{ voLoadRulePackage\(\); \}, 0\);/.test(html), 'the page starts loading the package at boot (browser only; the Node harnesses have no DOM)');
  ok(/await Promise\.race\(\[voLoadRulePackage\(\), new Promise\(function \(r\) \{ setTimeout\(r, VO_RULES_FETCH_TIMEOUT_MS \+ 500\); \}\)\]\);\s*\} catch \(eRP\) \{\}\s*forensicResult = await runForensicEngine\(/.test(html), 'the scan awaits the package decision (bounded) before the engine runs');
  ok(/localStorage\.setItem\(VO_RULES_CACHE_KEY, JSON\.stringify\(\{ manifest: body/.test(html) && /voVerifiedPackageFrom\(parsed\.manifest, 'cache'\)/.test(html), 'the last VERIFIED manifest is cached and re-verified on load');
  ok(/if \(live && cached && voSemverNewer\(cached\.version, live\.version\)\) chosen = cached;/.test(html), 'a newer verified package already on the device is never downgraded (version gate)');
  ok(/reason = 'no_api_at_this_address'/.test(html) && /reason = 'none_published'/.test(html), 'a web page instead of JSON and "no package published" are named reasons');
  ok((html.match(/rulePackage: \(fraudResult && fraudResult\.rulePackage\) \|\| null,/g) || []).length === 2 && (html.match(/rulePackageStatus: window\._voRulePackageStatus \|\| null,/g) || []).length === 2, 'both reports receive the package record and the status');
  ok(/rule_package: \(result && result\.rulePackage\) \? result\.rulePackage : null,/.test(html), 'the findings JSON carries rule_package');
  ok(/signed rule-package rule ' \+ f\.packageRule/.test(html) && /' \+ signed rule ' \+ f\.packageRule/.test(html), 'findings JSON names the rule on a package finding');
  ok(!/voRulePackage[^\n]*\/api\/v1\/feedback/.test(html), 'the package loader never touches the feedback endpoint');

  global.PDFLib = { rgb: (r, g, b) => ({ r, g, b }), StandardFonts: {}, PDFDocument: {} };
  const R = require(path.join(root, 'forensic-report.js'));
  ok(typeof R._rulePackageLine === 'function', 'report exposes rulePackageLine');
  const applied = R._rulePackageLine({ rulePackage: { version: '1.1.0', keyId: 'vo-master-1', sha512: 'ab'.repeat(64), publishedAt: '2026-07-19T18:42:32.699Z', pairRules: 4, applied: 1, withheld: 2 } });
  ok(/^Signed rule package: v1\.1\.0 \(key vo-master-1, canonical SHA-512 [a-f0-9]{16}(?:\.\.\.|…)[a-f0-9]{8}, published 2026-07-19\) — 4 phrase-pair rule\(s\) and 0 co-occurrence group\(s\) applied additively beside the built-in detectors; 1 candidate finding\(s\) raised, 2 withheld where a built-in detector had already reported the page\.$/.test(applied), 'applied line: ' + applied);
  ok(R._rulePackageLine({ rulePackage: null, rulePackageStatus: { state: 'unavailable', reason: 'no_api_at_this_address', reasonText: 'this address answered with a web page instead of the rules service' } }) ===
    'Signed rule package: none applied — built-in rules only (this address answered with a web page instead of the rules service).', 'none-applied line names the reason');
  ok(R._rulePackageLine({}) === 'Signed rule package: none applied — built-in rules only.', 'none-applied line with no status');
  const rsrc = readFileSync(path.join(root, 'forensic-report.js'), 'utf8');
  ok((rsrc.match(/rulePackage: opts\.rulePackage \|\| null,/g) || []).length === 3, 'all three report builders take rulePackage');
  ok(/ctx\.para\(rulePackageLine\(data\), \{ size: 9, font: ctx\.f\.courier, color: GRAY, after: 2 \}\);/.test(rsrc) && /ctx\.bullet\(rulePackageLine\(data\), \{ size: 9\.5 \}\);/.test(rsrc) && /rulePackageLine\(data\),\s*'Verification: verumglobal\.foundation\/verify\.html/.test(rsrc), 'the line prints on the cover, in Methodology and in the court-ready narrative\'s provenance record');
}

// ---- 8. the hybrid: the AI review prunes, anchors and feeds back ----
{
  const html = readFileSync(path.join(root, 'seal-document.html'), 'utf8');
  ok(/var dropped = \(v\.verdict === 'drop'\) \|\| \(v\.keep === false\);/.test(html), 'assess verdicts are read as the Worker sends them ({verdict:"drop"}), so the review can prune');
  ok(/var dupKey = aType \+ '\|' \+ aRationale\.toLowerCase\(\)/.test(html), 'AI additions are deduplicated across batches');
  ok(/var anchor = voAnchorAiQuote\(af\.quote, af\.page\);/.test(html) && /anchored: anchor\.found,/.test(html), 'every AI addition is anchored (or labelled unanchored) on this device');
  // Run the page's anchoring function in Node with a stubbed text store.
  const m = html.match(/function voAnchorAiQuote\(quote, pageHint\) \{[\s\S]*?\n\}\n/);
  ok(Boolean(m), 'voAnchorAiQuote is defined on the page');
  if (m) {
    const fn = new Function('_pipelineTextBlocks', m[0] + '; return voAnchorAiQuote;');
    const blocks = ['First page text about the lease.', 'The invoice   was  marked PAID in full and later recorded as not paid.', 'Third page.'];
    const anchor = fn(blocks);
    const hit = anchor('was marked paid in full and later recorded', 1);
    ok(hit.found === true && hit.location === 'Page 2' && /was marked paid in full/.test(hit.quote), 'a verbatim quote is found (whitespace/case-normalised) and pinned to its page even when the model names the wrong page (' + hit.location + ')');
    ok(anchor('was marked paid in full and later recorded', 2).location === 'Page 2', 'the model\'s page is used when the quote is there');
    const miss = anchor('this sentence is not in the document at all', 2);
    ok(miss.found === false && /unanchored \(AI candidate: quote not found/.test(miss.location) && miss.quote === null, 'a quote not in the sealed text stays unanchored');
    const none = anchor('', 1);
    ok(none.found === false && /no verbatim quote/.test(none.location), 'no quote -> unanchored, said plainly');
    ok(fn(['this is the only block of text there is'])('the only block of text', 1).location === 'Full document', 'single-block documents anchor to Full document');
  }
  ok(/if \(f\.packageRule\) detectorId = \('SIGNED_RULE_' \+ String\(f\.packageRule\)\)\.slice\(0, 64\);/.test(html), 'a package hit feeds back as SIGNED_RULE_<id>, never as the detector whose type it borrows');
  ok(/if \(!aType \|\| aType === 'SERIAL'\) continue;/.test(html) && !/\/\^CT\(0\[1-9\]\|\[1-3\]\[0-9\]\|4\[0-6\]\)\$\/\.test\(aType\)\) continue;/.test(html), 'CT-typed AI candidates now reach the feedback loop (the engine-missed-a-CT01 signal)');
  ok(/detectorId: af\.anchored \? 'AI_IDENTIFIED' : 'AI_IDENTIFIED_UNANCHORED'/.test(html), 'feedback tells anchored from unanchored AI candidates');
  ok(!/AI consensus review \(multi-model/.test(html) && !/multi-model, Gemma/.test(html), 'the report no longer calls one Llama call a multi-model consensus');
  ok(/AI review \(Llama 3\.3 70B on Cloudflare Workers AI, 8B fallback; single model, advisory\)/.test(html), 'the report names the model honestly');
  const wsrc = readFileSync(path.join(root, 'worker', 'verum-rules.js'), 'utf8');
  ok(/"quote":"verbatim","page":0\}\]\}'/.test(wsrc) && /No verbatim quote, no additional finding/.test(wsrc), 'the assess prompt requires a verbatim quote and a page for every additional finding');
  ok(/const quote = asStr\(f\.quote, 160\)\.trim\(\);/.test(wsrc) && /if \(quote\) item\.quote = quote;/.test(wsrc) && /if \(page > 0\) item\.page = page;/.test(wsrc), 'the Worker passes quote and page through its sanitizer');
}

console.log(`\n[rule-package] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[rule-package] FAILURES'); process.exit(1); }
