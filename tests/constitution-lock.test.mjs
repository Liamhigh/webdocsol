/**
 * Constitution drift lock. The ratified constitution is v6.0 FINAL (sealed,
 * immutable, supersedes v5.2.7 and earlier). Sibling repos drifted after
 * ratification — the firewall's bare loadConstitution() default sat at 5.2.7
 * while seals were stamped 6.0.0 — so this site pins its own copy: the machine
 * copy (constitution.json), the human copy (constitution.html) and the pages
 * that cite a version must all agree, and no LIVE page text may claim a
 * superseded version. HTML comments (which record past corrections) are
 * stripped before checking, so the historical notes stay allowed.
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  constitution-lock.test.mjs');
console.log('======================================================\n');

const CURRENT = '6.0 FINAL';
const SUPERSEDED = ['5.2.7', '5.1.1'];

const json = JSON.parse(readFileSync('constitution.json', 'utf8'));
ok(json.version === CURRENT, `constitution.json version is "${CURRENT}" (got "${json.version}")`);
ok(/sealed/i.test(json.status || '') && /immutable/i.test(json.status || ''),
  'constitution.json status remains Sealed - Immutable');
ok(/5\.2\.7/.test(json.supersedes || ''), 'constitution.json records that it supersedes v5.2.7');
ok(json.humanFounder === 'Liam Anthony Highcock', 'constitution.json names the human founder');

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

const conHtml = stripComments(readFileSync('constitution.html', 'utf8'));
ok(conHtml.includes('Constitution v6.0 FINAL'), 'constitution.html displays Constitution v6.0 FINAL');

// No live page may present a superseded version as the current constitution.
// "supersedes ... v5.2.7" phrasing is allowed; "Constitution v5.2.7" as a
// standalone current-version claim is not.
for (const page of ['index.html', 'constitution.html', 'documents-resources.html', 'seal-document.html', 'verify.html', 'dashboard.html']) {
  let live;
  try { live = stripComments(readFileSync(page, 'utf8')); } catch { continue; }
  const staleClaims = [];
  for (const v of SUPERSEDED) {
    const re = new RegExp('Constitution v' + v.replace(/\./g, '\\.') + '(?![^<]*(?:and earlier|supersede))', 'g');
    let m;
    while ((m = re.exec(live)) !== null) {
      const ctx = live.slice(Math.max(0, m.index - 120), m.index + 60);
      // Allowed: history/supersession phrasing around the mention.
      if (/supersed|previous version|and earlier|was\s*["“]/i.test(ctx)) continue;
      staleClaims.push(v + ' @ ' + page);
    }
  }
  ok(staleClaims.length === 0, `${page} live text never claims a superseded constitution (${staleClaims.join('; ') || 'clean'})`);
}

// Engine version lineage lock. The web engine called itself "v2.0" while the
// sealed Python lineage stood at v5.3.1c — a detached version number is its
// own kind of drift. The constant, the banner comments and the module export
// must all carry the same lineage version, and it may never fall behind the
// sealed v5.3.1c baseline.
const engineSrc = readFileSync('forensic-engine-page.js', 'utf8');
const constMatch = engineSrc.match(/var VO_ENGINE_VERSION = '([^']+)'/);
ok(constMatch !== null, 'VO_ENGINE_VERSION constant exists in the engine');
if (constMatch) {
  const v = constMatch[1];
  ok(/^(\d+)\.(\d+)\.(\d+)-web$/.test(v), `engine version "${v}" follows the lineage format N.N.N-web`);
  const nums = v.match(/^(\d+)\.(\d+)\.(\d+)-web$/).slice(1).map(Number);
  ok(nums[0] > 5 || (nums[0] === 5 && (nums[1] > 3 || (nums[1] === 3 && nums[2] >= 2))),
    `engine version "${v}" is not behind the sealed v5.3.1c lineage`);
  const banners = engineSrc.match(/FORENSIC CONTRADICTION ENGINE v([^\s=]+)/g) || [];
  ok(banners.length >= 2 && banners.every((b) => b.endsWith('v' + v)),
    'every engine banner carries the same version as VO_ENGINE_VERSION');
}

// Ruleset-version bond. The Seal binds a report to its RULESET VERSION
// (Constitution v6.0) — yet the 1 Aug Greensky rerun sealed a findings JSON
// stamped engine_version "2.0" while v5.3.2-web ran, because the emitter and
// forensic-report.js carried hard-coded version strings the engine bump never
// touched. Locks: no stale "2.0" stamp may exist anywhere, and every version
// literal in the report/page layer must equal the engine's VO_ENGINE_VERSION.
if (constMatch) {
  const v = constMatch[1];
  const reportSrc = readFileSync('forensic-report.js', 'utf8');
  const pageSrc = readFileSync('seal-document.html', 'utf8');
  ok(!/engine[ _-]?version['"]?\s*[:=]\s*['"]2\.0['"]/i.test(reportSrc + pageSrc),
    'no hard-coded engine_version "2.0" stamp survives anywhere');
  ok(!/web[ -]engine v2\.0/i.test(reportSrc + pageSrc),
    'no "web engine v2.0" extraction/detector stamp survives anywhere');
  const rv = reportSrc.match(/var ENGINE_VERSION = '([^']+)'/);
  ok(rv !== null && rv[1] === v,
    `forensic-report.js ENGINE_VERSION ("${rv && rv[1]}") equals the engine's VO_ENGINE_VERSION ("${v}")`);
}

console.log(`\n[constitution-lock] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[constitution-lock] FAILURES'); process.exit(1); }
console.log('[constitution-lock] ALL GREEN');
