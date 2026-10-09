# webdocsol — Verum Omnis MASTER surface

**System context (read first):** [`VERUM_OMNIS_SYSTEM_PROMPT.md`](./VERUM_OMNIS_SYSTEM_PROMPT.md)
— this repository is one surface of the Verum Omnis system; that document is
meant to be identical in every Verum Omnis repository (today it is not — see Open today) and
governs how all surfaces fit together. Repo-specific architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**UI design (binding):** [`VERUM_UI_TOKENS.md`](./VERUM_UI_TOKENS.md) is the canonical
design specification for EVERY Verum Omnis surface — website, Android app, Fraud
Firewall and Windows Lite. It was extracted verbatim from the production site and it
is not a suggestion: any new screen or page must use its palette (dark navy #040D1B,
gold #D4A843, blue #4A7EC7), its type scale (Cormorant Garamond serif headings, mono
uppercase kicker labels, sans body) and its component anatomy (cards with id-field
rows, gold CTAs, honesty-note callouts, seal-footer strips). Web surfaces import
[`verum-ui.css`](./verum-ui.css) directly; native surfaces port the same tokens.
Document verification is ALWAYS a link to the Verification Hub
(verumglobal.foundation/verify.html) — no surface verifies locally.

**Engine work (binding):** [`ENGINE.md`](./ENGINE.md) is the definitive reference for the
forensic engine — every contradiction type, every detector, and **why each false-positive guard
exists**, with the real evidence bundle that caused it. This engine is the reference
implementation for the whole platform: where another surface disagrees, this one is correct.
**Read it before changing engine or report code.** Removing a guard to "increase recall"
re-introduces a false statement of fact under seal.

**Repo map:** [`REFERENCE.md`](./REFERENCE.md) — every page, script, worker endpoint and
directory, and what each one does.

## Start here — the state of the platform (updated 2026-10-05; describes `main` once PR #218 — the Combine 06 April 2026 run — is merged; PR #216 and #217 are live)

Read this section first; it is the two-minute orientation. Everything below it is the detail.

**What this is.** One public website and one Cloudflare Worker, both in this repository,
deployed *together* by Cloudflare Workers Builds on every merge to `main`. The visitor's
browser does the forensic work (in "Seal document" nothing leaves the device; in "Seal document
with forensic report" the engine still runs on the device, and only finding metadata, text
excerpts, the sealed page text for the Brain 9 sweep and voice-note audio go to the Worker's AI
endpoints, as the mode card states, and anonymous pattern signals — detector id, type, severity,
page count — go to `/api/v1/feedback/patterns`); the Worker serves the site and a small API.

| Piece | Source of truth | Where it runs |
|---|---|---|
| Website pages | repo root `*.html`, `verum-ui.css`, `images/`, `vendor/` | Served by the Worker as **Workers Static Assets** (`wrangler.toml [assets]`), through a fixed chain when a request reaches the Worker: bundled assets → the `main` branch on `raw.githubusercontent.com` → the legacy Cloudflare Pages origin. Files the platform serves straight from the bundled assets (the normal case) carry no extra header; an answer the Worker's own code serves names its tier in `X-VO-Site-Source` (`assets`, `repo`, `pages`, `kv`, `embedded`). `GET /api/v1/site/health` shows which tier answers for the home page, the seal page, the logo and the watermark (all `assets` on 27 September 2026). A path that matches no file falls through to the Pages tier, which answers 200 with the home page (probe, 27 September). The two site images also have embedded last-resort copies (`worker/site-assets.js`). Pages carry self-canonical links to the domain. |
| Forensic engine, PDF reports, sealing, OpenTimestamps, encryption | `forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`, `ots-proof.js`, `pdf-encrypt.js` — **inlined** into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers | The visitor's browser. The engine also applies the **signed rule package** the seal page fetches and verifies (`ENGINE.md` §12.7) — the same additive loop the Android app and the fraud-firewall run. Edit the source file, then re-splice the inline copy; `tests/inline-scripts.test.mjs` byte-compares them. |
| API `/api/v1/*` — AI review (classify, assess, narrate), the Brain 9 sweep of the sealed text (`/api/v1/ai/sweep`: anchored recommendations, never findings), the court-ready narrative (`/api/v1/ai/human-report`, automatic in "Seal document with forensic report" since 7 September), voice-note transcription (voice notes arrive singly or as a WhatsApp chat-export `.zip` unpacked on the device — `ENGINE.md` §12.6a), the licensing gatekeeper (`/api/v1/ai/gatekeep`), anonymous pattern feedback (`/api/v1/feedback/patterns`), signed rule packages (`/api/v1/rules/manifest`) and the trainer's log (`/api/v1/rules/changelog`), `/api/v1/status`, admin publish, admin curate and curate-publish, site health; and the weekly trainer run (cron) | `worker/verum-rules.js` (router and handlers), `worker/static-proxy.js` (site chain), `worker/site-assets.js` (embedded images) | Cloudflare Worker `webdocsol` on the zone routes `verumglobal.foundation/*` and `www.verumglobal.foundation/*` (`zone_name = "verumglobal.foundation"`), declared in `wrangler.toml` since 27 September 2026 (#210) and live since the founder re-pointed them that day; also on its own address `webdocsol.liamhigh78.workers.dev` (`workers_dev = true`), a second door that does not depend on the domain, which the probe checks too. Bindings `RULES_KV`, `AI`, `ASSETS`. Cron `[triggers] crons = ["0 3 * * 1"]`: on Cloudflare 1 is Sunday, so the trainer runs Sunday 03:00 UTC. Secrets set in the dashboard only: `ADMIN_TOKEN`, `RULE_PRIVATE_KEY` (absent on 27 September — see Open today), optional `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL`. `HUMAN_REPORT_MODEL` and `AUTO_CURATE` are plain vars. |
| Pages bridge | `functions/[[path]].js` | Only on the Cloudflare Pages project `verumglobal`, which still builds every push (the `Cloudflare Pages` check on every commit). It hands any request Pages receives to the Worker, loop-guarded by `X-VO-Chain`. Dormant since 27 September: the zone route on `www` runs before Pages. Never shipped as a Worker asset (`.assetsignore`, `SITE_DENY_RE`); `tests/pages-bridge.test.mjs`. |
| Outside probe | `.github/workflows/live-site-probe.yml` (manual dispatch) | GitHub Actions. It prints DNS answers for the apex and `www`, and for those two and `webdocsol.liamhigh78.workers.dev` the headers, the health and status endpoints, the manifest's shape, the trainer's changelog and an unknown path. Last run: 3 October 2026 11:56 UTC (run 37121243315, on 0561ea5, the #214 merge): all three hosts answered, health `ok: true` with every tier `assets`, manifest v1.1.0 under `vo-master-1`. |
| Dashboard data (`dashboard.html`) | This page only | It fetches `verum-forensic-hub.liamhigh78.workers.dev`, a **separate Worker that is not in this repository**. When it does not answer, the page says so; illustrative figures exist only behind `?demo=1` and are labelled. |

**How a change ships.** Edit → `node tests/run-all.js` (every suite green) and `npm run check`
→ re-splice inline copies if you touched an inlined file → pull request → merge to `main` **is**
the deploy. Read the PR checks honestly: the **Workers Builds** check passed through #184
(6 September), failed on every merge commit from #185 to #209 (the deploy's triggers step could
not bind the declared zone routes and then, from #195, the Custom Domains; the code still
uploaded), and has passed on every PR head and merge commit since #210 (27 September; GitHub
check runs, read 3 October 2026), so a red check is now a real signal. A PR-branch build uploads
a version; the build that deploys runs on the merge commit to `main` (branch settings are
dashboard state, not in this repository). Confirm a deploy with the Workers Builds check on the
merge commit and by reading `/api/v1/site/health` from outside (the probe). The connector's
`webdocsol.modified_on` is not proof on its own: it also moves when a branch build uploads a
version: on 3 October 2026 the connector read 00:18:48 UTC, the branch build of 72e391b (its
Workers Builds check completed 00:18:52), with nothing merged since #213. The sandbox used
by AI sessions cannot reach `verumglobal.foundation`, `*.pages.dev` or `*.workers.dev`; run the
**live-site-probe** GitHub Actions workflow (`actions_run_trigger` → `get_job_logs`) to see both
hosts from outside, ask the founder to open a URL, or read the connector. Read the log with
`get_job_logs` (`job_id`, `return_content: true`); the built-in `gh api` cannot fetch Actions
logs. The last probe ran on 3 October 2026 11:56 UTC on the #214 merge commit 0561ea5 (run 37121243315).

**Other repositories that depend on this one.** `Liamhigh/1verum` (Android;
`core/Constitution.kt` hard-codes `https://verumglobal.foundation/api/v1/rules/manifest` and
pins `publicKeyId vo-master-1`; QR codes open `verify.html?h=<sha512 prefix>&m=<metadata>`)
and `Liamhigh/firebase` (fraud-firewall; `fraud-firewall/src/core/ruleUpdate.ts` hard-codes the
same manifest URL, `fraud-firewall/src/seal/sealMetadata.ts` the same QR; in `1verum` the QR is
built in `seal/SealMetadata.kt`) — paths checked through the GitHub API on 3 October 2026. Never
move those URLs or change the manifest shape (`worker/rule-format.md`) without changing both
clients. `VERUM_OMNIS_SYSTEM_PROMPT.md` is meant to be identical across the three repositories —
an edit here must be mirrored there. As of 3 October 2026 this copy differs from the 1verum and
firebase copies (which match each other) in two passages added here by #189 and #199; that file
is never edited in this repository without mirroring it, so the reconciliation is open with the
founder.

**Known state right now.** Two parts: what is open today, then the dated history, oldest first
(the newest entry is last).

**Open today (as of 5 October 2026; true of `main` once PR #218 is merged).** Each
item says who holds it. Live Cloudflare state is "last verified" on the date given. Live state was
last read from outside by the probe of 3 October 2026 11:56 UTC (on 0561ea5, the #214 merge).
- **Founder — the signing key (decided 5 October 2026: leave it).** `RULE_PRIVATE_KEY` is not on
  the Worker, and the founder does not hold the original `vo-master-1` private key. Every client
  pins that key, so a new key must never be set on its own: it would make the website, the
  Android app and the fraud-firewall refuse every package. The founder chose to leave it as it is
  for now: the package stays v1.1.0 (published 19 July by an admin publish, still valid on every
  client), the weekly trainer run keeps reading "skipped — no signing key on this service"
  (last seen on the probe of 5 October for the 4 October run), and engine improvements ship as
  code through pull requests. Do not ask the founder for the key again. Restoring signed updates
  means a key rotation (`worker/rule-format.md`, "Key management"): the founder generates a new
  pair on his own machine and hands over only the public half; all three clients ship accepting
  `vo-master-1` and the new key (the Android change reaches users only with an app release); then
  the new secret and key id go on the Worker. Not started; it waits on the founder.
- **Founder — roll the Cloudflare API token** pasted into chat on 24 September (recorded as
  still open on 27 September, #210; this repository cannot see whether it has been rolled).
- **Founder — from the Public Protector run (`ENGINE.md` §12.14 "Open, with the founder"):**
  (a) the VO-SEAL2 hash is self-referential: anyone can alter a sealed copy and re-seal it with
  its own hash, keeping the seal ID and ORIG, and verify.html shows a match. The fix is
  architectural (anchor or sign the sealed-file hash) and touches the verify contract, so for now
  the copy says only what the check cannot show. (b) Resolved 5 October 2026: the founder
  dropped the word "verified" from the reports (`ENGINE.md` §12.16). (c) H208/25: this file and the Worker's honesty clause say "in good faith and in the
  interest of justice" records the respondent's own affidavit, while `constitution.json`,
  `llms.txt` and `constitution.html` say the Court found the conduct good-faith. The founder holds
  the judgment; until he rules, state neither version as the Court's finding. (d) D16 (font
  anomaly) never fires on production blocks, which carry no line breaks; do not revive it by
  restoring newlines. (e) A single-token trading name ("AllFuels") can never be a party, and no
  rule ties one person to two different sites. Both are candidate rules, not shipped on one
  example.
- **Founder, with the 1verum and firebase repositories — the findings-JSON schema (from the
  evidence-bundle-7-docs run, `ENGINE.md` §12.16).** The shared `FINDINGS_JSON_SCHEMA` v1.0.0
  requires `verification_status: "ENGINE-VERIFIED"`, band-word severity and confidence enums, and
  AI candidates inside `contradictions`. The founder's 5 October rulings (no "verified", no bands
  in print) are met in every printed report; the JSON keeps the schema's words until a schema v2
  (a neutral status such as `ENGINE-FINDING`, a separate `ai_candidates` array) is agreed for all
  three repositories. Do not change the contract in this repository alone.
- **Founder — the Constitution's own fingerprint line.** `constitution.html` and
  `CONSTITUTION-v8.md` read "SHA-512: [To be generated upon sealing]" in the verification section
  (found by the compliance review of the Combine 06 April 2026 run, `ENGINE.md` §12.17). The
  instrument is locked (`tests/constitution-lock.test.mjs`); completing that line is the
  founder's act, never an edit here.
- **Next live run — confirm the OCR hold.** On the Combine 06 April 2026 run no finding on the
  203 OCR-recovered pages was held, and the cause could not be reproduced without the bundle
  (`ENGINE.md` §12.17 item 2). The engine now also reads the OCR pages from the text itself. On
  the next run with scanned pages, check that the findings JSON shows `ocr_anchored: true` on
  OCR-only findings and that the extraction notes carry "OCR provenance: …".
- **Founder — the narrator's event-level instruction (`ENGINE.md` §12.16, "Open, with the
  founder").** `NARRATE_SYSTEM` still allows "the documents evidence fraud" for corroborated
  events (v6.1 EVENT-LEVEL DETERMINATION); the gates pass it. Whether it survives the 5 October
  rulings is a constitutional decision, not a gate change.
- **Founder — the system prompt has drifted.** This repository's `VERUM_OMNIS_SYSTEM_PROMPT.md`
  differs from the 1verum and firebase copies in two passages (#189, #199), and it still calls
  the narrative "opt-in" (GitHub API, 3 October 2026).
- **Founder — `vanessa.pdf`.** This confidential real-matter report was removed from the tree on
  6 September (#189; no test used it). It is still in the git history of this repository, which
  is public (GitHub API, 3 October 2026). Whether to purge the history or make the repository
  private is his decision.
- **Founder — the Pages project `verumglobal`** is still connected and builds every push (the
  `Cloudflare Pages` check on every commit). It is not the origin of either host. It is the
  Worker's last serving tier and the home of the dormant bridge, and on both hosts a path that
  matches no file answers 200 with the home page from that tier (27 September). Disconnecting it
  removes both.
- **Unconfirmed since the domain moved.** Voice-note transcription was last reported failing on
  the host with no API (6–7 September). On the 13 September re-run every court-ready narrator
  draft failed the server gate, which is a prompt and quality question, never a reason to loosen
  the gate. Neither has been measured since the domain moved on 27 September: the 2 and 3 October
  runs on the live site were reviewed for their findings and wording (`ENGINE.md` §12.14,
  §12.15), and the repository records no transcription result or narrator gate count from them.
  On the next run, read the narrative's Authentication & Provenance page (sections written vs
  printed, gate counts) and the voice-note report's transcription note.
- **Not this repository's** (found 7 September): the Android app and the fraud-firewall send no
  feedback; the Android `detectDownloadedFraudPairs` has no inside-phrase guard; the firewall
  publishes its own manifest under the same key id; the Android app executes `pairs` only, so
  v1.1.0's `groups` (FK13/FK14) change nothing there.
- Deferred or not adopted, with reasons: `ENGINE.md` §12.13 ("Deferred" in item 12; "Not
  adopted" in the paragraph that closes the section).

**History, oldest first.** Each entry was the live state on its date (PR #214 is live since its
merge on 3 October, PR #216 since 5 October; the last entry describes PR #218, live once merged); superseded state is
marked.
- 6 September 2026: the two retired Workers (`verum-rules`, `verumglobal-static`) were deleted
  from the dashboard; this Worker was meant to own the domain through declared routes (PRs
  #184–#186); the 7 September probe showed it did not, and it did only from 27 September. The
  court-ready narrative shipped (#188). The live site showed broken logos afterwards: the Worker
  answered `/images/logo-full.png` from KV, which holds no such key, and whether the Workers
  Builds deploy carries its static assets could not be confirmed from the sandbox — hence the
  serving chain, the embedded images and the health endpoint. Voice-note transcription returned
  "service error" on 6 September. Since #187 the report note names the actual failure. Cause
  found on 7 September: the host had no API, so the call got the home page. Both hosts have
  reached the Worker since 27 September, but no transcription has been confirmed since (now in
  Open today).
- 7 September 2026, 01:16 SAST — **SUPERSEDED on 27 September (see that entry): the diagnosis of
  who held the apex was wrong.** **The live domain is NOT served by this Worker yet.** The
  `live-site-probe` workflow (two runs, five minutes apart, after the deploy that declared both
  routes) showed: the apex `verumglobal.foundation` answers **every** path — `/`, the seal page,
  both images, `/api/v1/status`, `/api/v1/site/health` — with a 1.5 KB React shell whose scripts
  load from `3exuldgsw7sci.kimi.page` (the March design mock-up; the shell came from the July
  Worker `verum-omnis-verify-production` through its zone route, found on 27 September); `www`
  answers from the Cloudflare Pages project `verumglobal` (Pages headers, `308
  /seal-document.html → /seal-document`, index.html for every unknown path including `/api/*`).
  No response on either host carried `X-VO-Site-Source`. So the zone routes this Worker declared
  never bound. Cloudflare's documented rules say why that is decisive: a route on a hostname that
  is another Worker's Custom Domain runs *before* that Worker, so a bound route would have
  answered; and a zone route only runs in front of a proxied DNS record it does not create.
  `wrangler.toml` therefore then declared both hostnames as **Custom Domains** (`custom_domain =
  true`, #195; replaced by zone routes in #210) — this Worker was to be their origin, with
  Cloudflare creating the DNS records and certificates and every deploy re-asserting the
  binding. Consequences recorded then, until a binding existed: the API did not exist on either
  public host (the "transcription service error" is the home page HTML coming
  back from `www`), QR verify links on the apex open the mock-up, the Android app's manifest URL
  returns HTML, and every Workers Builds deploy uploads the code and then fails its triggers step
  (expected). The Custom Domain declaration (#195) never bound: every deploy's triggers step
  failed on the existing records until #210 declared the two zone routes the founder had
  re-pointed.
- 7 September 2026: the founder's first real run of the court-ready narrative (a 332-page
  Greensky case file) came back with **no AI text in any section** — every section said
  "(network)" — because the page was served by the host that has no API (see the 7 September
  domain entry). The forensic report's **five findings on that file are correct, not a
  regression**: the engine was unchanged from 22 August to that run and those five are the
  detections `tests/greensky-regression` protects. PR #193 makes a section the narrator could
  not write name its reason in plain words, retires the separate plain-language narrative PDF,
  gives the narrative a contents page and sets its section budgets at the reference document's
  depth. (The 3 October re-run, last entry below, sealed a different file: the 451-page
  Greensky bundle the reference document was written over.)
- 7 September 2026: the engine-update loop now closes on the website. The seal page fetches
  `/api/v1/rules/manifest`, verifies the RSA-SHA512 signature against the pinned key, caches the
  last verified package and applies it additively (`ENGINE.md` §12.7); the report and the
  findings JSON name the package. The Worker serves package v1.1.0 (19 July); its two curated
  rules (FK13/FK14) are co-occurrence `groups`, which the website now executes and the Android
  app does not (pairs only). Fixed on the way:
  the AI review's verdicts never pruned anything (the client looked for a `keep` field the
  Worker never sends); AI candidates now carry a verbatim quote the page anchors in the sealed
  text, or are labelled unanchored; CT-typed AI candidates now reach the feedback loop; the
  report no longer calls a single Llama 3.3 70B call a "multi-model consensus". Known gaps that
  are NOT this repository's: the Android app and the firewall send no feedback; the Android
  `detectDownloadedFraudPairs` flags a single claim containing "not paid" as both sides of the
  pair (no inside-phrase guard); the firewall publishes its own manifest under the same key id.
- 7 September 2026: **Brain 9 reads the sealed text.** Founder direction: the AI must read
  the sealed files so nothing is missed, state what it finds, and the loop must let the engine
  catch it next time; Brain 9 verifies the model's claims are real and in the text. Built as
  `POST /api/v1/ai/sweep` + `aiBrain9Sweep` (`ENGINE.md` §12.8) under Constitution v8 §2.10:
  recommendations, never findings; every quote verified verbatim twice (Worker and device);
  stated on the results panel and in an unsealed JSON; counted (pages read, logged,
  discarded) in the sealed reports; fed to the loop as `B9_RECOMMENDATION`. Never merged into
  sealed findings, the findings JSON or the narrative — do not "promote" them without a signed
  rule. The website has no chat; this runs inside the seal pipeline only.
- 7 September 2026: **two modes, no switches.** "Seal document" or "Seal document with forensic
  report"; the second runs every AI step and produces the court-ready narrative with the
  technical report automatically (founder direction item 12). The mode card is the disclosure.
- 7 September 2026: **the trainer run.** The Worker curates and publishes signed rule packages
  weekly from anonymous signals (founder direction item 13; `ENGINE.md` §12.9). It needs
  `RULE_PRIVATE_KEY` on the Worker, which was absent on 27 September (the changelog's last run:
  "skipped — no signing key on this service"; v1.1.0 was published by an admin publish on 19
  July), and it records every outcome at `/api/v1/rules/changelog`. Schedule: `crons = ["0 3 * *
  1"]`, which on Cloudflare (1 = Sunday) is Sunday 03:00 UTC. The 27 September run started 03:01
  UTC, and docs and comments that say Monday are wrong.
- 11 September 2026: **the annexure EB run and the precision release.** The founder sealed
  the 528-page AllFuels "annexure EB" bundle with a forensic report and had the outputs
  reviewed by an outside model. Two facts first: the run was made on the old Pages host, so
  every AI leg said "NOT RUN (HTTP 405)" — the domain problem again (see the 7 September domain
  entry) — and the engine had misquoted the record ("R231.3 Million" sealed as "R2313 Million")
  because the extractor dropped punctuation glyphs. Shipped: verbatim glyph extraction;
  context-aware CT01/CT09/CT20/CT23/CT33/CT08/CT18; OCR provenance with consequences
  (severity cap, footer-only pages, per-page confidence); honest labels (`NOT REVIEWED`,
  "engine findings", cover banners); findings JSON v1.3.0 (additive); forensic mode refuses
  to run on a host with no API; the OCR cap asks before leaving pages unread. `ENGINE.md`
  §12.10; suite `annexure-eb-regression.test.mjs`. The founder re-ran it on the Worker address
  on 13 September (next entry).
- 13 September 2026: **the re-run and the honesty release.** Re-run on the Worker: 15 engine
  findings retained, 3 AI candidates, 23 Brain 9 recommendations, the cover quote verbatim.
  The second outside review found the engine had scanned the Verum Omnis supplementary
  report bound into the bundle as evidence, paired a lessee clause about one party with an
  ownership line about another (CT44), read distinct quoted terms as one word (CT08), linked
  an expiry to another exhibit's invoice (CT04), and that the report's lead was the Worker's
  template ("integrity score of 41 with a confidence rating of MODERATE") labelled as the AI
  narrator's, with three different finding counts in one report. Shipped: embedded-report
  exclusion with disclosure; CT44 side alignment; CT08 whole quoted terms; CT04
  same-instrument link (and `voDetectDocuments` ignores the bundle's own running numbering);
  the template prints no score or band and is labelled local; the §15.2 gate drops score and
  band sentences; one count everywhere; the narrator provenance line says "asked for N
  sections; no draft passed the gate"; Brain 9 neutral language; the results panel states
  original vs sealed size (the seal adds ~1–4 %; the 88 MB output was the size of the
  OCR-rendered input). `ENGINE.md` §12.11. Open at the time (now in Open today): the court-ready
  narrator's drafts all failed the server gate on this run — a prompt and quality question, not
  a gate to loosen.
  **Hotfix the same night (PR #205):** the size line called `fmtBytes`, which lives inside
  the inlined report script's closure, so every seal on the Worker ended "Sealing Failed —
  fmtBytes is not defined" for about an hour after the deploy. The page now has its own
  `voFmtBytes`, the results-panel extras are wrapped in try/catch, and a test scans the
  page-level script for closure-private names. Lesson, in one line: the five inlined
  scripts are closures — page code calls page helpers only, and the headless check must
  read the results panel, not just whether `showResults` was reached.
  **And the first document sealed after that (PR #206):** a 17-page report printed from
  Chrome reached the engine as empty pages — Chromium draws Type3 fonts with one-byte codes
  and the decoder assumed two — and, once readable, a SAPS case number was an "impossible
  date" and a valid registration number was cut by a 40-character window. Fixed with tests
  (§15 of the annexure EB suite); an AI-compiled summary is now disclosed as secondary in
  the extraction notes. `ENGINE.md` §12.11 items 11–16.
- 24 September 2026: **the www bridge.** The domain steps were still untaken and `www` still
  answered from the Pages project, which builds this repository on every push. So the
  repository now carries `functions/[[path]].js`: on Pages, every request is handed to the
  Worker and its answer returned unchanged (loop-guarded by `X-VO-Chain`; static fallback if
  the Worker is unreachable). `www` therefore serves the Worker's site, API and forensic
  service without any DNS change; the apex still needs the founder (release it from
  `verum-omnis-forensic-web` in the dashboard, or give this session a Cloudflare API token
  as an environment secret). (Superseded 27 September: the apex was held by a zone route on
  `verum-omnis-verify-production`, which the founder re-pointed; since then the zone route on
  `www` runs before Pages and the bridge is dormant.) `DEPLOYMENT.md` "The bridge";
  `tests/pages-bridge.test.mjs`.
- 27 September 2026: **the domain, resolved.** The apex was held by the zone route
  `verumglobal.foundation/*` on the July Worker `verum-omnis-verify-production` (not by a
  Custom Domain, which is why the dashboard showed none to remove). The founder re-pointed
  it to `webdocsol` and added `www.verumglobal.foundation/*`; no DNS change. Both hostnames
  now serve the Worker directly; `wrangler.toml` declares those two routes. Lesson: read the
  zone's Workers Routes page before theorising about Custom Domains, and print small bodies
  whole in the probe. Still with the founder (now in Open today): `RULE_PRIVATE_KEY` on the
  Worker (the scheduled run of Sunday 27 September, 03:01 UTC, was skipped: "no signing key on
  this service"), and rolling the API token pasted into chat on the 24th.
- 27 September 2026, later: **the evidence-bundle-2-docs run.** An outside review of a
  sealed 68-page bundle of previously sealed exhibits found three false findings (CT02 on
  "R116" vs "R 8000" across two customers' letters; CT18 on a case reference and two mobile
  numbers; CT37 on "multiple email domains") and a narrative that repeated them. Underneath:
  the embedded-report rule from 13 September had excluded the first 38 pages on the
  platform's own sealed-document footer, and every seal footer decoded as CJK. Fixed in
  `ENGINE.md` §12.12 (eleven items, `tests/annexure-eb-regression.test.mjs` §16, which now
  renders the technical report and the court-ready narrative and reads them back). Lesson,
  in the founder's own rule 14: a shared word is not a shared proposition — a label word
  ("amount") across two exhibits is not one figure, and a footer that names this platform
  is not a report. The one finding that survives on that bundle is real: a lookalike
  domain, `standandbank.co.za`, on p.48.
- 1 October 2026: **the evidence-bundle-4-docs run (PR #212, merged 2 October).** A 651-page
  bundle of previously sealed exhibits sealed with the report and the narrative; an outside
  review could support one of 44 findings. The engine's own seal footer was the largest cause (25 "impossible date"
  findings from "30/09/2026 15:41:47" read as "0/09/2026"; timeline rows on the seal date):
  `voStripSealFurniture` now removes the platform's footers before detection, after the
  document boundaries have been read from them. Also: OCR variants of clean registration
  numbers, a typeset quote pair in D30, an "owner of certain Intellectual Property" in D38,
  pleading-form admissions in D01, an invoice parse with no plausibility check in D13, an
  extract prepared on the seal date scanned as the record (secondary sources are leads now),
  findings dated from unrelated lines, court and form-label "parties", the missing
  FRANCHISE_LEASE matrix category, candidate law trimmed by finding type, "cannot be changed"
  replaced by "any change is detectable", reduced-weight findings counted apart.
  `ENGINE.md` §12.13; `tests/annexure-eb-regression.test.mjs` §17 (213 assertions).
- 2 October 2026, morning: **critique round two on the evidence-bundle-4 rules (PR #213).** The
  eleven critics that had not run, then a verification pass over the fold-in. The primary record
  is never a secondary source. Engine notes are returned structurally and printed with their
  page (`contextNotes`), never as findings. A contradiction anchored only on OCR-recovered pages
  is held below serious (`ocrHeld`, severity 3) until a person reads the page image. Every count
  tells OCR-anchored and secondary-source findings apart (`voCountPhrase`). There is no
  immutability claim, and the report says "anchored to the Bitcoin blockchain" only once the
  proof is confirmed (`anchorPhrase`). The verbatim columns print every passage the record states
  and mark the engine's computations as its own (`anchorQuotes`). Review-dropped findings leave
  the timeline and the person index. Findings JSON v1.4.0 adds `secondary_capped` and
  `ocr_anchored`, and v1.5.0 adds `ocr_held`. `ENGINE.md` §12.13 items 11–12;
  `tests/annexure-eb-regression.test.mjs` §17.
- 2 October 2026: **the Public Protector submission run** (PR #214, live from its merge; `ENGINE.md` §12.14). The
  founder sealed his own 20-page submission to the DMPR's Director-General and the NDPP with the
  forensic report, the court-ready narrative and the anchor certificate. All three sealed
  findings were false. CT14 read "compliant" inside "non-compliant". CT37 read two genuine
  domains of one renamed department, dmre.gov.za and dmpr.gov.za, as a lookalike. CT23 read the
  plural "unsigned agreements" in the author's allegation as one unsigned instrument. The reports
  attributed the author's words to a company named on the page, filed the unsigned-agreement
  sentence under forgery law and lost the record's own quotation marks. A three-lens review, then
  a five-lens adversarial verification pass, found the rest. Shipped, in the engine: a party's
  submission that cites other Verum seals is a secondary source (leads, never findings) up to the
  first page that opens a new record, and a captioned pleading is never a submission
  (`voSubmissionSpan`). Only domains under restricted government suffixes are exempt from CT37.
  A category plural skips CT23, but specific plural instruments still fire. A labelled "Date:" on
  a document's first page later than the analysis day is an engine note: the seal page passes
  the instant in (`opts.referenceTime`; the engine never reads the clock), and findings JSON
  1.6.0 records it as `analysis_reference_utc`. Quotes are read nesting-aware. In the reports: a
  finding concerns a party only when the Case details declare that party and the finding's own
  words name it (`declaredPartyFor`; a person is named by the whole name or by an initial and
  the surname, never by a shared surname alone), and a counter-narrative quotes a party only when
  that party is the speaker (`speakerOf`). There is one F#/P# numbering (`humanNumberable`). The
  unsigned-agreement shape is a contract question, "Unsigned Agreement Stated". The Nine-Brain
  blocks keep the §15.4 template's headers ("TAMPER FOUND", "COMMUNICATION GAP FOUND"), each with
  a Finding line stating the measured fact; kinds no block describes (an unsigned-agreement
  statement, a legal-reference check CT33, a procedure check CT35, a lookalike domain CT37) are
  named apart instead of under "TAMPER FOUND". When no AI-written section passed the gates, the
  narrative's cover and certification call it the deterministic record. There is no scorecard,
  no "liabilities", no severity column and no confidence band. In the Worker: the four-pillars
  gate holds every pillar claim to the elements table's types, so knowledge and inducement or
  reliance appear only as INSUFFICIENT, and the court-recognition ban is broadened (statutory
  "admissible" is kept). The anchor certificate labels each fingerprint by its bytes, prints the
  delivered file's real SHA-512, says the Bitcoin block proves existence no later than its time,
  and never claims a permanent record before Bitcoin confirms. verify.html recognises the
  certificate (`ANCHOR-CERT|`), never lets a certificate subject override a seal it found, and
  reads an OTS-format footer as "Seal Present". Open items (a)–(e): see Open today. Tests:
  `tests/annexure-eb-regression.test.mjs` §18 (83 assertions), §18i (29, the verification pass)
  and §18j (9, the last verification items of 3 October), `tests/worker.test.mjs` (the pillar
  gate, the court language, the template) and `tests/human-report.test.mjs` (the pillar map
  against the elements table).
- 3 October 2026: **the Greensky re-run** (the same PR #214, live from its merge; `ENGINE.md` §12.15). The founder sealed
  the 451-page Greensky bundle on the live site (report VO-WEB-20261003-0222): 19 findings, of
  which at least 17 were wrong. Fourteen "Impossible date" findings were the commodity-code
  tokens 15.20.9094 and 15.20.9115 on transport invoice pages; D03 now reads a date-shaped token
  as a date only when its year field lies within 1200–2200 (31/02/2021 still fires), and
  identical impossible tokens are one finding naming every page. An AI case summary bound into
  the bundle ("Forensic Finding:** This is an explicit admission of guilt") was sealed as the
  record's admission; a sentence that calls another statement an admission is now a
  characterisation (`VO_ADM_CHARACTERISATION_RE`), and pages carrying chat-style markdown are
  secondary wherever they sit (`voMarkdownAnalysisPages`). "Timestamp Manipulation" and
  "Metadata Contradiction" were this platform's own seal pass; a file wearing the seal footers
  is now treated as sealed here (`sealedByThisPlatform`), the XMP-against-Info comparison is
  suppressed and the suppression disclosed. "Forensic Finding" and role phrases such as "General
  Manager" are never parties. In the report: the cover and SEALED FINDINGS now agree (file-level
  findings, numbered P#, are counted beside the page-anchored ones); CT39, CT29 and CT24 carry
  their own wording, and CT39 is never rendered as a B1 contradiction; identical plain-words lines
  collapse into one bullet naming every page. Tests: `tests/greensky-regression.test.js` §9. With
  both runs, PR #214 stands at 33 suites and 2535 assertions.
- 5 October 2026: **the evidence-bundle-7-docs run and the founder's rulings** (PR #216, live
  since its merge at 02:28 UTC on 5 October; `ENGINE.md` §12.16). The founder sealed a 65-page bundle (his email to the Public
  Protector, the Protector's letters, a 49-page sealed exhibit of his own Verum Omnis analysis,
  printed emails, a sealed timeline) and had DeepSeek review the three PDFs against Constitution
  v8.0. Of four sealed findings one is real: the lookalike domain (`protect.org` on p. 1 beside
  the Protector's `pprotect.org` on pp. 5 and 7). Three rested on the founder's own analysis
  pages (a CIPC K-form enterprise number, a reference to an affidavit that records the custody,
  "The MOU was never countersigned"), and the advisory AI review had removed two more findings.
  Founder rulings 16–18 below: the AI review never removes or changes an engine finding; the
  word "verified" is dropped; the §15.4 template leads. Shipped: the review adds notes and
  candidates only; no severity, score or "most serious" words, and no score-chosen summary
  sentence; a Thesis / Antithesis / Synthesis table stating that PD13's three verifiers are not
  met; every finding under one brain; the explainer page removed; the overclaim rule in both
  narrative gates; the AI prompts say tamper-evident; the engine reads the CIPC K-form, a custody
  reference, set-aside pages, a document's stated last page and a Verum Omnis analysis's running
  title correctly; findings JSON 1.7.0. On the real bundle the engine now seals one finding, the
  lookalike domain. Tests: `tests/evidence-bundle-7-regression.test.mjs` and updated assertions
  across the suites. Two independent reviews of the change then found five blocking and
  seventeen minor defects (AI candidates discarded as duplicates, unnumbered pages after two
  documents read as one, evidence sealed after a report page read as analysis, a month test that
  matched any word, CT33/CT35 printed as two positions, among others); each confirmed one is
  fixed with the reviewer's reproduction as a test (`ENGINE.md` §12.16 item 10). 34 suites and
  2658 assertions. Open: the cross-repository findings-JSON schema and the narrator's "the
  documents evidence fraud" instruction (Open today).
- 5 October 2026, evening: **the Combine 06 April 2026 run** (PR #218, live once merged;
  `ENGINE.md` §12.17). The founder sealed a 684-page bundle on the live site after #216 and had
  two AI reviews written from the findings JSON. Read against the engine, most of the 19
  findings were the engine's error: a CT01 on a markdown analysis page and a CT45 inside a Verum
  Omnis analysis escaped the secondary-source rule because their page was found later; two
  invoices' dates, two documents' date conventions and an expiry in a page of notes beside an
  invoice were "contradictions"; scanned pages OCR could barely read were "format anomalies"; an
  identity number in the complainant's field was a finding; two sites' "Premises", one definition
  read twice by OCR and a longer defined term were "defined differently"; a conditional clause
  was read as ownership; two AI candidates without a quote restated engine findings; and the
  court-ready narrative printed "a coordinated scheme of fraud … by the directors" and "a pattern
  of systemic commercial fraud and theft". Each is fixed and pinned
  (`tests/combine-06-april-regression.test.mjs` and the suites named in §12.17); an independent
  review of the fixes found two blocking and eight minor defects, all fixed and pinned (§12.17
  item 14). 40 suites, 2843 assertions. Findings JSON 1.8.0 adds `candidate_law`. Not fixed here: why no OCR-only finding was held on that run
  (mitigated; Open today), and the Constitution's own SHA-512 placeholder (founder).
- 6 October 2026: **photos sealed as documents** (`ENGINE.md` §12.18). The founder chose a photo
  on the live seal page from a phone and was refused ("Chat exports (.txt) and screenshots
  accompany a voice-note batch — add the voice notes first."): a PNG or JPEG was accepted only
  as a screen grab beside voice notes. Now a photo chosen without a voice note is placed on its
  own PDF page on the device (JPEG bytes embedded unchanged, EXIF orientation applied, the file
  name and the original file's SHA-512 printed under the picture and set as the PDF subject) and
  joins the PDF bundle, where on-device OCR reads it. A voice-note batch keeps its screenshots
  as before; a chat `.txt` alone is still refused, with a way forward.
  `tests/photo-intake.test.mjs` (41 assertions, after the Sourcery review on #219); 40 suites, 2843 assertions.
- 6 October 2026: **the Louw v Naidoo run** (`evidence-bundle-6-docs`, Case 341/2025;
  `ENGINE.md` §12.19). A third-party AI review graded the deterministic engine a C-, but it
  mistook the anomaly engine for the **human forensic narrative** (a separate instrument that
  already carried the ownership chain, swap-then-sale, charter breach, SAMSA prohibition and
  attorney conflict). Two real precision defects were fixed: D06/CT09 fused one man's SA ID
  (typed solid and spaced), a DFFE fishing right `LF210223` and a second man's ID into "4
  different identity numbers for one subject" — D06 now classifies the identifier type and
  compares within one type, canonicalises whitespace, and fires a `said` pair only for the same
  resolved person; and D25/CT37 emitted six findings over one lookalike-email cluster — D25 now
  emits one finding per cluster. The review's calls for severity tiers or "detect fraud" are
  rejected (Prime Directive 1 and Verdict Reservation). `tests/louw-naidoo-regression.test.mjs`
  (14 assertions). Cross-document contradiction recall is a
  design note awaiting the founder.
- 6 October 2026: **the empty timeline fixed** (`ENGINE.md` §12.20). The Louw v Naidoo report's
  §25 said "no dated events" though the pages named many real dates; the timeline was built only
  from dates a finding carried, and that bundle's findings were dateless. `voBuildTimeline` now
  also reads the dates the page text states (text layer and OCR), orders them with page anchors,
  excludes impossible dates (never guessing a true date) and infers nothing; a finding date and
  the same date in the text on one page are one event. `tests/timeline-dates.test.mjs`.
- 6 October 2026: **cross-document reading, stage A** (`ENGINE.md` §12.21). The founder approved
  building the cross-document design (`CROSS-DOC-CONTRADICTION-DESIGN.md`) in three sequenced PRs:
  A a descriptive fact index (this change), B conflict detection (held behind a wording sign-off),
  C the sign-off gate between them. Stage A classifies each page and extracts a page-anchored fact
  record (vessel, parties + owner direction, date, amount, right, company reg) with a verbatim
  quote — descriptive only, no contradiction, no verdict; secondary/analysis pages are excluded
  from the record set. `voClassifyPage`/`voExtractPageFacts`/`voBuildFactIndex`, the `factIndex`
  result, a "DOCUMENT FACT INDEX" report section, `tests/doc-fact-index.test.mjs`. Stages B and C
  are not in this change.
- 6 October 2026: **cross-document reading, stage B** (`ENGINE.md` §12.22; HELD for wording
  sign-off). `voCrossDocConflicts` reads the stage-A fact index and reports where two RECORD pages
  name a different new owner of the SAME vessel. The founder's wording review split it by SHAPE:
  type A (same transferor, same date → "both cannot be the sole transfer") and type B (same
  transferor, different dates → the chain-of-title gap "does not explain how the previous owner
  retained the vessel…"); the engine classifies the conflict before writing. Each is quoted and
  paged — no offence, no owner determination, no verdict, pinned by a
  forbidden-words test; a same-party check keeps "R. Louw"/"Ritzema Louw" from being a false
  conflict; an analysis/secondary page can never raise one. `crossDocConflicts`, a held
  "CROSS-DOCUMENT OBSERVATIONS" section, `tests/cross-doc-conflicts.test.mjs`. Per the founder's
  instruction (stage C) the PR is held and the exact statements go to the founder for language
  sign-off before merge; B and C are not merged together.
- 9 October 2026: **cross-document stage B — wording signed off and merged** (`ENGINE.md` §12.22;
  `CROSS-DOC-CONTRADICTION-DESIGN.md` §6). The founder approved both forms with one wording change
  and one merge condition: type A now names both new owners inline, symmetric with type B (a reader
  sees at a glance which two parties conflict; both names are facts of the record). The condition:
  the forbidden-words guard is a **labelled channel** — it filters the engine's generated statement
  only, never the verbatim quotes, so a quote that contains "title"/"valid"/"void" is emitted
  intact and only engine prose is blocked. Two regression assertions lock both directions (now 18
  in `cross-doc-conflicts.test.mjs`). Lesson logged: an evidence system separates (a) the engine
  describing the record from (b) the record itself; any future engine-side filter (PII redaction,
  summarisation) is scoped to (a) only — the record is not editable. Next: the founder re-runs a
  real bundle on the live seal page so the output is verified against the originals.
- 9 October 2026: **shape-correctness hardening** (`ENGINE.md` §12.23; `ENGINE-QA-BUNDLE-19.md`).
  The `evidence-bundle-19` run drew two independent reviews — a third-party AI performance report
  and Sourcery on #224 — that found the SAME defect: a detector reading a NEGATED clause as a
  positive assertion ("…was never signed by or on behalf of…" raised a CT11 authority finding;
  "…was never transferred from X to Y" could become a false cross-document conflict). One shared
  matcher, `voNegatedBefore`, now gates BOTH D08 (CT11) and the cross-document owner-direction
  extractor — not two separate patches (founder directive). Also shape-correctness: the conflict
  date is read from the transfer's own clause (`ownerDate`/`voTransferDate`), never the first date
  on the page, so an unrelated date cannot flip Type A↔B. The founder approved the shape pair, then
  the **precision hardening** landed on the same branch: a shared surname alone no longer merges two
  people (`voNameFirstCompatible`, #1), a transfer is bound to its own vessel on a multi-vessel page
  (`ownerVessel`, #2), a transfer stated in the title sentence is not stripped (`voHasOwnerDir`, #4),
  and the quote is stored **byte-faithfully** (`ownerQuoteFull`) with the report saying "quoted from
  the page" and marking excerpts, never "verbatim" (#7). O(n²) pairwise (#6) deferred; printing the
  cross-document passages in the §26 appendix is an optional follow-on. Pinned in
  `detector-recall.test.mjs` (110) and `cross-doc-conflicts.test.mjs` (35). The bundle-6 re-run stays
  blocked until this lands. Process note: #224 was merged while Sourcery's review was in flight; the
  review then surfaced these — for court-facing paths, wait for the bot or annotate the merge.

**What must never be done.** The founder rulings and the seven regressions below; the §15.2
language gate and the PD2 anchor gate are never loosened; no secret is ever committed; no
`Date.now()` / `Math.random()` in an analysis path; no regex lookbehind; the inline copies are
never "de-duplicated"; the rules-manifest URL and the QR verify URL never move; no court is
ever described as having adopted, endorsed or validated anything; a seal or a record is
tamper-evident, never permanent, immutable or unalterable, and "anchored to the Bitcoin
blockchain" is written only once the OpenTimestamps proof is confirmed, and then only to say the
file existed no later than that block (`anchorPhrase`); D16 is never revived by restoring
newlines; the optional Case details "Parties" field never becomes a required input. Read the
bible for the area before changing it: `ENGINE.md` (engine and reports), `DEPLOYMENT.md`
(shipping and serving), `REFERENCE.md` (every file and endpoint), `FORENSIC-DEBUG.md` (what a
failure looks like).

## Quick facts
- Static site + one Cloudflare Worker (`worker/verum-rules.js`, `static-proxy.js`, `site-assets.js`). No servers, no database, no build step; the site ships as the Worker's static assets. A Pages Function, `functions/[[path]].js`, runs only on the Pages project and has been dormant since 27 September.
- Forensic engine: `forensic-engine-page.js` (CT01–CT46, detectors D01–D40, `VO_ENGINE_VERSION 5.3.5-web`); report generator: `forensic-report.js` (`ENGINE_VERSION 5.3.5-web`); findings JSON 1.8.0 (adds `candidate_law`; 1.7.0 added `display_name`, `brain`, `triple_verification`, `ai_review_note`).
- The forensic scripts are ALSO inlined into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers. After editing any source file, re-splice the inline copy — `tests/inline-scripts.test.mjs` byte-compares them and fails on drift. Do NOT "de-duplicate" them into a shared module.
- Tests: `node tests/run-all.js` — **40 suites, 2843 assertions** (counted 9 October 2026), **must be green before any push**. Many exist only to stop specific regressions; the per-suite counts and what each guards are in `ENGINE.md` §10.
- Report language is constitutional (PD16): findings stated as fact and anchored — no scores, no confidence bands, no hedging; the verdict on any named person is for the court.
- Deterministic: no `Date.now()` / `Math.random()` in analysis paths. (`setTimeout` for an OCR deadline is a deadline, not a clock reading — permitted and disclosed.)
- **No regex lookbehind in new code.** Safari < 16.4 throws at parse time and the whole scan dies silently. See `ENGINE.md` §4.16.

## The stakes — read this before anything else

**The platform's output is now evidence in live proceedings.** As recorded on 22 August 2026
(#173), from the founder: sealed documents and forensic reports produced by this code have been filed in the
Constitutional Court of South Africa (rescission, CCT237/20 & CCT19/20), in a KwaZulu-Natal High
Court matter (2026-179949), in SAPS and Hawks dockets, and in served evidence schedules whose
SHA-512 values opposing senior counsel have been invited to verify. The repository holds no
record of the High Court filing. Filing is not a ruling: none of those forums has ruled on Verum
Omnis. The rule below that no High Court is among the courts of record concerns where the
Constitution itself was placed, and it stands. That means:

- **A regression is not a bug — it is a discrepancy an opposing expert can put to a judge.**
  Determinism (same input → same findings on every run) is what lets anyone, an opposing expert
  included, reproduce a finding; the founder reports it has been shown in the field. Any change that could make two runs differ
  is a constitutional breach, not a refactor.
- **The honesty locks are load-bearing.** The §15.2 language gate, the institutional-engagement
  clause, the never-write list below — these exist because overstated claims were found and
  corrected in served documents. Weakening one re-introduces a claim the founder has already
  had to retract.
- **The sealing flow is used by a person whose safety depends on it behaving as documented** —
  see the certificate privacy latch (item 6 below).

## The seven things most likely to be regressed

Each was a real failure the founder reported. Read `ENGINE.md` before touching any of them.

1. **Report order** — the §15.4 template leads: cover, contents, sections 1–7, then the
   annexes with the plain-language pages first (`ENGINE.md` §7; founder ruling 18 below, which
   replaced ruling 5's story-first order on 5 October 2026). Moving the plain-language pages back
   in front of section 1 undoes the ruling.
2. **The §15.2 narrative gate** — `scrubNarrative` DROPS prohibited sentences and never
   rewrites them; `voGatePasses` requires `kept >= 2 && kept >= dropped` or the deterministic
   narrative is used instead (`ENGINE.md` §4.13). The worker prompt is a request; the gate is
   the guarantee.
3. **OCR deadlines** — `voOcrDeadline` + worker retirement + the raster cap. Without them a
   worker killed by the OS leaves a promise that never settles and the scan hangs forever
   (`ENGINE.md` §12.1).
4. **Seal geometry** — pages are EXTENDED (`setMediaBox` / `setCropBox`), never overlaid.
   Overlaid furniture prints on top of signatures (`ENGINE.md` §12.2).
5. **Share order** — `saveFiles(files)` is called BEFORE `navigator.share(data)`, and several
   files save as ONE store-only ZIP. Reversing the order kills the share sheet on Samsung
   Internet; separate downloads trip the incognito multiple-download prompt
   (`ENGINE.md` §12.3).
6. **Certificate privacy** — the default Seal Certificate carries NO identity, address, GPS or
   device; only the separate `-PRIVATE-do-not-share` variant does, and `buildSealCertificate`
   renders the identity block only when `opts.includePrivate` is true (`ENGINE.md` §12.6).
   Re-merging the two variants, or passing identity opts to the shareable build, hands the
   sealer's home address to every recipient of a distributed evidence folder.
7. **Oath context stays factual** — `voDetectSwornPages` measures oath language; findings gain
   `swornContext` and the report states the fact plus candidate law. The word "perjury" appears
   in the report ONLY inside candidate-law lines and in engine output NOT AT ALL — both
   test-locked (`ENGINE.md` §4.18). Do not "improve" this into a perjury flag; the founder's
   ruling is explicit: a forensic engine states facts, verdicts belong to the court.

### Founder rulings (2026-08-14, Constitution v8.0 VO-9A4F3C5E825C)

Recorded so no session or external review re-litigates them:

1. **§15.4 governs the report format.** The report generator (`forensic-report.js`) was
   rebuilt to the seven-section narrative template, whose sections lead Part 2 of the report
   (Critical Legal Subjects, Dishonesty Detection Matrix, Nine-Brain Extraction Findings, Triple
   Verification Summary, Sealed Findings, Verdict Reservation, Certification),
   with today's additional sections (timeline, person index, evidence
   appendix, statutory anchoring, …) preserved as ANNEXES after Section 7.
2. **Severity word-labels are removed from display.** "CRITICAL / HIGH /
   MODERATE / LOW" must not print in reports (§15.2 names those tokens as
   prohibited bands). Severity remains an INTERNAL weight: findings stay
   in the engine's ranked order, and the ordering carries the weight. Since
   5 October 2026 (rulings 16–18) no "most serious", "by severity",
   "serious" or "minor" wording prints either: the report says only that the
   findings are in the engine's fixed order (`VO_ORDER_NOTE`).
3. **Nine-Brain equivalence stands (v8.0 §2).** The 46 contradiction types
   across 40 detectors ARE the Nine-Brain architecture — "the spec and the
   code describe the same machine." Reviews claiming the engine "ignores the
   Nine-Brain spec" misread the Constitution.
4. **No summary judgments, ever.** Reviews repeatedly demand the report state
   "this is a pattern of fraud"; §15.2 prohibits exactly that ("X is guilty
   of Y" — verdict belongs to the court). The engine states anchored facts
   and cites candidate law (POCA s1 included); the last step is the court's.
5. **The human story leads, and the first pages state the provenance.**
   *(Order superseded on 5 October 2026 by ruling 18: the §15.4 template now
   leads and the plain-language pages are annexes; the provenance statement
   stays on the cover and opens THE STORY IN PLAIN LANGUAGE, and the "HOW ANY
   CHANGE" page was removed. The text below records the order as it was.)* The
   main report reads Story First, Evidence Second. Part 1, in order:
   the EXECUTIVE SUMMARY front page ("IN ONE PAGE", the findings that
   matter most, key dates, what to do next), "DOCUMENTS IN THIS BUNDLE"
   (which documents are in a consolidated bundle, their page ranges, and
   which findings cross between them), "THE SHORT VERSION" (one line per
   finding), "THE STORY IN PLAIN LANGUAGE", "PAGES THE ENGINE COULD NOT
   READ" (every unread page named, with its reason and a human-review
   instruction), then "HOW ANY CHANGE TO THIS RECORD IS DETECTED" (renamed from "WHY THIS RECORD
   CANNOT BE ALTERED" on 2 October 2026, #213: a hash makes tampering detectable, it does not
   prevent it) — and only THEN
   the table of contents and the §15.4 sections 1-7 with their annexes.
   The first pages of both report documents state that the findings are
   the output of deterministic forensic software — fixed detection rules,
   page-anchored quotes — not the opinion of a generative AI (the optional
   AI-review layer stays labelled and advisory). §15.4 heading names are
   constitutional and are NOT renamed for accessibility. Full anatomy:
   `ENGINE.md` §7.
6. **GPS fixes the home jurisdiction; documents fix the cross-border legs.**
   When the user shared their location at sealing, deterministic bounding
   boxes (ZA / AE / GB / US — no geocoding service) set `home`; any other
   jurisdiction named in the record becomes a foreign leg (the Greensky MOU
   named the UAE while sealing happened in South Africa). Statutory
   anchoring lists the home jurisdiction first.
7. **The system names the parties; it never asks the user to.** Parties are
   derived from `anchor.who` on the findings themselves
   (`documentParties` → `effectiveParties` → `effectivePartiesWithRoles`),
   deduped by `samePartyName` so "L. Highcock" and "Liam Highcock" are one
   party. Jurisdiction likewise (ruling 6). A report that prints "No parties
   were supplied" above a finding naming someone is a bug, not a
   configuration problem — do not add a form field to "fix" it.
   Since 2 October 2026 (`ENGINE.md` §12.14 item 4): the party index and the names on the cited
   pages still come from `anchor.who`, but a finding is said to *concern* a party, and a
   counter-narrative quotes a party, only when that party is declared in the optional Case
   details "Parties" field (`casePartiesInput`) and named in the finding's own words
   (`declaredPartyFor`, `partyStronglyNamed`, `speakerOf`). Otherwise the names on the page are
   stated descriptively ("Named on the cited page (descriptive, not an attribution)"). The field
   stays optional.
8. **The engine finds contradictions, not repetitions.** Consolidating more
   documents into one bundle does not, by itself, turn a repeated pattern
   into an anchored finding — it can only surface a finding where two
   documents actually conflict. Do not promise a user that adding documents
   will produce new findings; say what the engine can and cannot do.
9. **A "verdict" is delivered as a Statement of Case, never in the sealed
   report.** When the founder asks for a verdict (and he has), the
   constitutional answer is a separate covering brief — the Statement of
   Case — that assembles the sealed, anchored findings into a case
   narrative for an attorney. §15.2 still forbids "X is guilty of Y" inside
   the sealed report, and ruling 4 stands. Do not add verdict language to
   `forensic-report.js` under any framing.
### Founder direction (2026-09-06) — the court-ready narrative ("human report")

The founder asked for an LLM-written, court-ready narrative report with the
structure of the Greensky reference (Executive Summary, Evidence Index,
Chronology, Four Pillars, Contradictions Matrix, Critical Evidence Analysis,
Perjury Analysis, Coercive Conduct, Legal Framework, Offence Matrix,
Court-Ready Declaration, Recommendations, Authentication, Annexures). It ships
as `buildHumanReport` + `POST /api/v1/ai/human-report` (ENGINE.md §13). The
decisions below are binding on every later change:

1. **It is the ruling-9 document, not the sealed forensic report.** A separate,
   sealed, advisory companion titled COURT-READY NARRATIVE REPORT. It adds no
   findings; `forensic-report.js` report sections and the §15.4 headings are
   untouched; never title it "Verum Omnis Forensic Report".
2. **The writer originates nothing.** The engine supplies every table, page,
   quotation and number; the model writes prose only, one section per call.
   A sentence citing a finding, page or quotation not in the inputs is
   dropped server-side (PD2). Do not widen the inputs with anything the
   sealed record does not contain.
3. **Two gates, never loosened.** The worker's `humanGate` (no anchor, no
   sentence; anchors verified in every spelling; quotations verified; §15.2
   language; overstated court history; court-recognition paraphrases (statutory
   "admissible" and "court-appointed" excepted); the four-pillars rule — a pillar cites
   only a finding whose type evidences it, knowledge and inducement or reliance are
   written only as INSUFFICIENT, a held finding evidences nothing (`gate.pillar`);
   "perjury" outside candidate law;
   headings gated) and the render-time `scrubNarrative` → `voGatePasses` gate
   (headings gated). A section that loses either prints its deterministic twin
   labelled as not machine-written. "Better-sounding prose" is not a reason to
   relax a regex; the only anchor-free lines are the sanctioned exact answers,
   the verdict reservation and a stated INSUFFICIENT gap.
4. **Section names follow the Constitution, not the reference.** "How to Use
   This Report" is absent (§15.2); "Perjury Analysis" is *Sworn Statements &
   Candidate Law*; Counter-Narratives & Rebuttals exists for fairness; empty
   sections say so (PD6).
5. **Opt-in, default OFF, honest copy** *(reversed by item 12 on 2026-09-07: the narrative is
   now automatic in "Seal document with forensic report")*. `#humanReportOptIn`; the copy names
   what leaves the device and says "Leave unticked for privileged or
   sensitive matters". GPS, device and sealer identity are not payload fields.
6. **Provenance is inverted honestly.** The cover says this document *is*
   machine-written; Authentication & Provenance names the model, contract,
   temperature 0, the sealed technical report and findings JSON it was
   written from, sections written vs printed, gate counts, and that no
   language-model verification of the findings is claimed.
7. **Keyless by default.** `HUMAN_REPORT_MODEL` on Workers AI with the 8B
   fallback; an external OpenAI-compatible provider only through the three
   `LLM_*` secrets, never committed.

### Founder direction (2026-09-07 to 2026-09-13) — after the first real run (Greensky, 332 pages) and the runs that followed

The founder ran a 332-page Greensky case file and read the three PDFs against
the reference "forensic goal" document. Decisions (items 8–11 PR #193; 12 PR #200;
13 PR #201; 14 PR #203; 15 PR #204; 16–18 PR #216), binding like the seven above. The
runs of 27 September – 3 October added no numbered direction; they are recorded in the history
and in `ENGINE.md` §12.12–§12.15.

8. **One narrative, not two.** The plain-language narrative PDF (the
   standalone `buildNarrative` download) is retired from the seal page: the
   technical report's Part 1 already tells the findings in plain words and the
   court-ready narrative is the covering document. `buildNarrative` stays in
   `forensic-report.js` for the annex path and its tests; the page-boot and
   human-report locks now pin the button's absence. Do not bring it back
   without a founder decision.
9. **A section the narrator could not write names its reason.** `failReason`
   in the seal page maps the failure (an HTML answer where JSON was expected
   is `no_api_at_this_address`, the Greensky case) and the `reasonText` map in
   `buildHumanReport` prints the sentence — no_api_at_this_address, network,
   timeout, ai_unavailable, gate_failed, no_json, empty, time_budget,
   invalid_response, not_generated. A bare "(network)" is never printed again.
10. **Depth follows the reference document; shape follows the Constitution.**
   A contents page with real page numbers; an executive summary of 350–650
   words (core pattern → KEY FINDINGS, one paragraph per finding → WHAT THE
   RECORD ESTABLISHES); Critical Evidence with a heading line per finding
   then 3–6 anchored sentences; the other budgets widened
   (`HUMAN_SECTION_RULES`). The reference document's severity labels and
   person-level verdicts are not adopted; the gates are unchanged.
11. **Five findings on the 332-page file is not a regression.** Earlier,
   higher counts were false positives removed deliberately (ENGINE.md §4.12);
   the reference document was written over a different 451-page bundle. Do
   not tune detectors to reproduce another document's count.
12. **Two modes, no switches (2026-09-07, reverses item 5).** The seal page
   offers "Seal document" and "Seal document with forensic report" and nothing
   else. The second runs the engine, the AI review, the Brain 9 sweep,
   transcription of voice notes and the court-ready narrative beside the
   technical report, automatically; the mode card states what leaves the
   device, and "Seal document" is the choice for privileged matters (nothing
   leaves the device). `#aiReviewEnabled`, `#humanReportOptIn` and
   `#voTranscribeOptIn` and `#sharePatterns` no longer exist; `isAiReviewEnabled()` is
   `sealMode === 'forensic'`, and anonymous pattern sharing (detector ids, types, severities,
   page counts — "not personal information", the founder ruled) is automatic in that mode.
   Do not reintroduce AI or sharing tick boxes.
13. **The engine improves itself on a schedule (2026-09-07).** No servers: the Worker's
   trainer run (`runAutoCuration`, `wrangler.toml [triggers]` weekly, `POST
   /api/v1/admin/curate-publish` on demand) turns recurring `AI_IDENTIFIED` /
   `B9_RECOMMENDATION` signals into co-occurrence rules, validates them
   deterministically, appends at most three to the current package (existing
   rules byte-untouched), signs and publishes, and logs to
   `GET /api/v1/rules/changelog` (`ENGINE.md` §12.9). Additive only; candidate
   tier on every client; `AUTO_CURATE = "off"` stops it; an admin publish of a
   higher version supersedes it. Never let the trainer remove, reweight or
   retitle an existing rule.
14. **Precision over volume; provenance with consequences (2026-09-11).** After the annexure
   EB review the founder said "the word" to the fix list: a quote is the record's own
   characters; a shared word is not a shared proposition; a format check on an OCR page is a
   Low note until a person has read the page image; a report that was not reviewed says
   `NOT REVIEWED` and never "verified" (since item 17, no report says "verified" at all); forensic mode does not run where the service is
   absent. `ENGINE.md` §12.10. Do not re-widen a detector to recover a finding the
   annexure EB suite pins as false; add a positive control instead.
15. **The engine never reads a Verum Omnis report as evidence; one count; no template in
   AI's clothes (2026-09-13).** A prior Verum Omnis report bound into a bundle is excluded
   from scanning and the exclusion disclosed; every count a reader sees is the
   engine count, AI candidates told apart; deterministic template text is never
   labelled as the AI narrator's and never carries a score or band. `ENGINE.md` §12.11.
16. **The AI review never removes or changes an engine finding (2026-10-05).** The founder's
   words: "The ai cannot delete findings from the engine it can read the json the sealed evidence
   and the sealed forensic report it cannot alter this. The ai must do a forensic report based on
   the findings of the engine and it must report missed contradictions and improve the engine".
   The review reads the findings and the sealed text; it may add a note to a finding (printed as
   advice, fed to the loop) and raise candidates the engine missed. An engine finding the model
   thinks wrong is fixed by a detector guard with a regression test, never by the model's
   verdict. `ENGINE.md` §4.10, §12.16.
17. **No "verified" (2026-10-05).** Prime Directive 13 asks for three independent verifiers;
   the platform has one deterministic engine and at most one advisory model, so no report calls
   a finding verified. The Triple Verification Summary is a Thesis / Antithesis / Synthesis table
   that says so. (The findings JSON keeps the shared schema's `ENGINE-VERIFIED` until the
   cross-repository schema changes; Open today.)
18. **Template first (2026-10-05, replaces ruling 5's order).** The report opens with the
   §15.4 sections 1–7 after the cover and contents; the plain-language pages follow as annexes;
   the "How any change is detected" page is gone (PD20: no manuals; section 7 states what the seal
   shows and cannot show). `ENGINE.md` §7.

### How the Constitution's standing may be described (v8.0 §12)

The Constitution has been placed before courts, and that fact is part of why the
platform exists — future systems reading a sealed Verum Omnis document should be
able to find the instrument that governs how it was produced. **But §12 opens by
setting its own limit, and that limit is binding on every surface:**

> *"Every entry below is stated so that it survives being checked against the
> primary record. Judicial endorsement is not."*

The record, stated exactly:

| Forum | Reference | What actually happened |
|---|---|---|
| Constitutional Court of South Africa | CCT237/20 & CCT19/20 | Application **filed** (founding affidavit 23 June 2026, `constitution.json`); receipt acknowledged by the Registrar's office on 9 July 2026. Notice to oppose filed. **No ruling on the merits.** Which Constitution version was filed is open with the founder: `constitution.html` and `constitution.json` name v6.0, whose seal is dated 14 July 2026, after the acknowledgement. |
| Port Shepstone **Magistrate's** Court | H208/25 | A sealed case file was **placed before the Court and relied upon** — not excluded, struck out, or challenged on admissibility. The application was **dismissed** (harassment not proved) and the Court made **no finding on Verum Omnis**; both parties were unrepresented. |

**Never write, and never let a prompt imply:** that a court has adopted,
endorsed, validated, accredited or ruled on the merits of Verum Omnis, its
engine or its methodology; that the platform is "court-recognised" or
"judicially validated"; or that a **High Court** is among the courts of record
(it is not — the forums are the Constitutional Court and a Magistrate's Court).

**Also never write:** that a matter was "reassessed as criminal" or reclassified from
commercial to criminal by instructed counsel — the correspondence of 19 May 2025 records the
opposite, counsel classifying it as commercial over the complainant's written objection; that
any charge has been **laid**, or that any offence is a "verified charge" — offences named in a
complaint are alleged and mapped to statute, and no prosecutor has ruled; that the
Constitution becomes "recorded in the public records" or is "seeded" if any application
succeeds — a filed document is already in the court file, a procedural remedy such as
rescission carries no view on documents filed in support, and no outcome converts a filing
into legal recognition; or any superlative nobody can verify, such as "first-ever in South
African legal history" — the true and stronger claim is that the application was filed by the
applicant **in person, without instructed counsel**.

State an allegation as an allegation and name whose it is.

**The R231 million figure — keep it, and keep it labelled.** It is the **complainant's
estimate** of loss across seven affected operators, reached on industry-standard goodwill
valuation by someone with thirteen years operating a site, working from average litreage. That
is a legitimate basis for a claimed amount, and consistency matters: the figure has been used
from the outset and changing it mid-matter would be worse than holding it. Quantum in
litigation is proved later by expert evidence — a valuer or forensic accountant — and the
complainant is not holding himself out as one.

So: **do not delete it, do not inflate it, and do not describe it as computed, quantified,
derived or anchored.** The published working (goodwill = 36 × monthly profit) yields
approximately R29 million on its stated inputs; the difference is unexplained, so any claim
that the figure follows from a formula does not survive checking. "Estimates at over R231
million… quantum for determination on expert evidence" is honest, consistent and unattackable.

**Never publish the extrapolations.** R2.6bn (34 sites), R2.95bn, and especially R65bn+ across
"850+ branded marketer sites" multiply a per-victim figure across sites where no loss has been
examined. The last one alleges industry-wide criminality against major oil companies that are
not parties and against whom no victim-level evidence exists — a defamation exposure against
the best-resourced litigants in the country, and an easy way to lose a strong case to a fight
that was never necessary.

**"Accepted" is the word to watch.** It has been softened out of `index.html`
three separate times — "accepted as prima facie evidence", "accepted into court
record", "accepted as formal proof of cyber forgery" — because it is the
natural way to say it and it is wrong every time. A court *accepting* evidence
means an admissibility ruling went in its favour. What happened is that the
sealed file was **placed before the Court and not challenged** — nobody ruled
either way. "Placed before the Court and relied upon; not excluded, struck out
or challenged on admissibility" is the long way round, and it is the only
version that survives being checked. Use it.
The phrase *"in good faith and in the interest of justice"* in H208/25: this file and the
Worker's honesty clause (locked by `tests/worker.test.mjs`) say it records the **respondent's own
affidavit**, not a finding by the Court; `constitution.json`, `llms.txt` and `constitution.html`
say the Court found the conduct good-faith. Open with the founder since 2 October 2026
(`ENGINE.md` §12.14 (c)); he holds the judgment. Until he rules, do not attribute the phrase to
the Court anywhere new, and do not edit either side to match the other.
The Daubert / ECT Act / ISO 27037 analysis is a **Legal Expert Report**; no
tribunal has found those standards met.

Filing is not validation. Not being challenged on admissibility is not a finding
on the merits. Both are worth stating — precisely because they are true and
checkable, they are stronger than an inflated claim that an opponent can
disprove in one sentence. This is the same discipline as PD16 applied to the
platform's own history.

The honesty clause lives in `worker/verum-rules.js` (the constitution embedded in
the AI prompts) and is **locked by `tests/worker.test.mjs`** — seven assertions
that fail the build if any part of it is softened or removed. `index.html` was
already corrected once, when a "JUDICIALLY RECOGNIZED" pill and claims that the
file was "accepted into court record" and "recognized as admissible" were
removed. Do not let them back.

- All verification happens at `verify.html` (the Verification Hub). No surface verifies locally.
- Deploys automatically on merge to `main`: Workers Builds ships the Worker and the site together
  (the site is the Worker's static assets since #186). The Pages project still builds every
  push, but it is the origin of neither host; it answers only as the Worker's last tier.
- Published documents must never mention any particular attorney's access
  arrangements. Check before publishing anything reader-facing.
