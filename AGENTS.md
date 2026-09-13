# webdocsol — Verum Omnis MASTER surface

**System context (read first):** [`VERUM_OMNIS_SYSTEM_PROMPT.md`](./VERUM_OMNIS_SYSTEM_PROMPT.md)
— this repository is one surface of the Verum Omnis system; that document is
identical in every Verum Omnis repository and governs how all surfaces fit
together. Repo-specific architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

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

## Start here — the state of the platform (updated 2026-09-06)

Read this section first; it is the two-minute orientation. Everything below it is the detail.

**What this is.** One public website and one Cloudflare Worker, both in this repository,
deployed *together* by Cloudflare Workers Builds on every merge to `main`. The visitor's
browser does the forensic work (nothing is uploaded to seal a document); the Worker serves
the site and a small API.

| Piece | Source of truth | Where it runs |
|---|---|---|
| Website pages | repo root `*.html`, `verum-ui.css`, `images/`, `vendor/` | Served by the Worker as **Workers Static Assets** (`wrangler.toml [assets]`), through a fixed chain when a request reaches the Worker: bundled assets → the `main` branch on `raw.githubusercontent.com` → the legacy Cloudflare Pages origin. Every answer names its tier in `X-VO-Site-Source`; `GET /api/v1/site/health` shows which tier answers for the home page, the seal page and both logos. The two site images also have embedded last-resort copies (`worker/site-assets.js`). |
| Forensic engine, PDF reports, sealing, OpenTimestamps, encryption | `forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`, `ots-proof.js`, `pdf-encrypt.js` — **inlined** into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers | The visitor's browser. The engine also applies the **signed rule package** the seal page fetches and verifies (`ENGINE.md` §12.7) — the same additive loop the Android app and the fraud-firewall run. Edit the source file, then re-splice the inline copy; `tests/inline-scripts.test.mjs` byte-compares them. |
| API `/api/v1/*` — AI review (classify, assess, narrate), the Brain 9 sweep of the sealed text (`/api/v1/ai/sweep`: anchored recommendations, never findings), the opt-in court-ready narrative, voice-note transcription (voice notes arrive singly or as a WhatsApp chat-export `.zip` unpacked on the device — `ENGINE.md` §12.6a), signed rule packages, admin publish, site health | `worker/verum-rules.js` (router and handlers), `worker/static-proxy.js` (site chain), `worker/site-assets.js` (embedded images) | Cloudflare Worker `webdocsol`, Custom Domains `verumglobal.foundation` and `www.verumglobal.foundation` declared in `wrangler.toml` (since 2026-09-07; the zone routes declared before never bound — see Known state), bindings `RULES_KV`, `AI`, `ASSETS`; secrets set in the dashboard only: `ADMIN_TOKEN`, `RULE_PRIVATE_KEY`, optional `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL`. `HUMAN_REPORT_MODEL` is a plain var. |
| Dashboard data (`dashboard.html`) | This page only | It fetches `verum-forensic-hub.liamhigh78.workers.dev`, a **separate Worker that is not in this repository**. When it does not answer, the page says so; illustrative figures exist only behind `?demo=1` and are labelled. |

**How a change ships.** Edit → `node tests/run-all.js` (every suite green) and `npm run check`
→ re-splice inline copies if you touched an inlined file → pull request → merge to `main` **is**
the deploy. Read the PR checks honestly: the **Workers Builds check fails instantly on every
PR branch** and means nothing; the build that deploys runs on the merge commit. Confirm a
deploy with the Cloudflare connector (`workers_list` → `webdocsol.modified_on` after the merge)
and by opening `/api/v1/site/health`. The sandbox used by AI sessions cannot reach
`verumglobal.foundation`, `*.pages.dev` or `*.workers.dev`; run the **live-site-probe** GitHub
Actions workflow (`actions_run_trigger` → `get_job_logs`) to see both hosts from outside, ask the
founder to open a URL, or read the connector.

**Other repositories that depend on this one.** `Liamhigh/1verum` (Android;
`core/Constitution.kt` hard-codes `https://verumglobal.foundation/api/v1/rules/manifest` and
pins `publicKeyId vo-master-1`; QR codes open `verify.html?h=<sha512 prefix>&m=<metadata>`)
and `Liamhigh/firebase` (fraud-firewall; `src/core/ruleUpdate.ts` hard-codes the same manifest
URL, `src/seal/sealMetadata.ts` the same QR). Never move those URLs or change the manifest
shape (`worker/rule-format.md`) without changing both clients. `VERUM_OMNIS_SYSTEM_PROMPT.md`
is meant to be identical across the three repositories — an edit here must be mirrored there.

**Known state right now.**
- **7 September 2026, 01:16 SAST — the live domain is NOT served by this Worker yet.** The
  `live-site-probe` workflow (two runs, five minutes apart, after the deploy that declared both
  routes) showed: the apex `verumglobal.foundation` answers **every** path — `/`, the seal page,
  both images, `/api/v1/status`, `/api/v1/site/health` — with a 1.5 KB React shell whose scripts
  load from `3exuldgsw7sci.kimi.page` (the March design mock-up; the assets-only Worker
  `verum-omnis-forensic-web` in the account, whose script is `export default { fetch() {} }`,
  holds that shell and almost certainly the apex as a Custom Domain); `www` answers from the
  Cloudflare Pages project `verumglobal` (Pages headers, `308 /seal-document.html →
  /seal-document`, index.html for every unknown path including `/api/*`). No response on either
  host carried `X-VO-Site-Source`. So the zone routes this Worker declared never bound.
  Cloudflare's documented rules say why that is decisive: a route on a hostname that is another
  Worker's Custom Domain runs *before* that Worker, so a bound route would have answered; and a
  zone route only runs in front of a proxied DNS record it does not create. `wrangler.toml`
  therefore now declares both hostnames as **Custom Domains** (`custom_domain = true`) — this
  Worker is their origin, Cloudflare creates the DNS records and certificates, every deploy
  re-asserts the binding. Consequences until the binding exists: the API does not exist on
  either public host (the "transcription service error" is the home page HTML coming back from
  `www`), QR verify links on the apex open the mock-up, the Android app's manifest URL returns
  HTML, and every Workers Builds deploy uploads the code and then fails its triggers step
  (expected). Fix, in the dashboard, once, by the founder: release the apex from
  `verum-omnis-forensic-web` (remove its Custom Domain or delete that Worker); remove `www` from
  the Pages project `verumglobal` and delete the leftover `www` CNAME under DNS → Records (a
  Custom Domain cannot be created over a CNAME); then either add both Custom Domains to
  `webdocsol` (Settings → Domains & Routes → Add → Custom Domain — immediate) or let the next
  deploy create them. Re-run `live-site-probe` and expect `X-VO-Site-Source` on both hosts.
  The Worker's own address `webdocsol.liamhigh78.workers.dev` is kept ON (`workers_dev = true`)
  as a second door that does not depend on the domain: the probe checks it too, and the seal
  page works there today. Pages carry self-canonical links to the domain.
- 7 September 2026: **the trainer run.** The Worker curates and publishes signed rule packages
  weekly from anonymous signals (founder direction item 13; `ENGINE.md` §12.9). It needs
  `RULE_PRIVATE_KEY` on the Worker (present: v1.1.0 was signed there in July) and records every
  outcome at `/api/v1/rules/changelog`. First scheduled run: Monday 03:00 UTC.
- 7 September 2026: **two modes, no switches.** "Seal document" or "Seal document with forensic
  report"; the second runs every AI step and produces the court-ready narrative with the
  technical report automatically (founder direction item 12). The mode card is the disclosure.
- 11 September 2026: **the annexure EB run and the precision release.** The founder sealed
  the 528-page AllFuels "annexure EB" bundle with a forensic report and had the outputs
  reviewed by an outside model. Two facts first: the run was made on the old Pages host, so
  every AI leg said "NOT RUN (HTTP 405)" — the domain problem again (see the first bullet) —
  and the engine had misquoted the record ("R231.3 Million" sealed as "R2313 Million")
  because the extractor dropped punctuation glyphs. Shipped: verbatim glyph extraction;
  context-aware CT01/CT09/CT20/CT23/CT33/CT08/CT18; OCR provenance with consequences
  (severity cap, footer-only pages, per-page confidence); honest labels (`NOT REVIEWED`,
  "engine findings", cover banners); findings JSON v1.3.0 (additive); forensic mode refuses
  to run on a host with no API; the OCR cap asks before leaving pages unread. `ENGINE.md`
  §12.10; suite `annexure-eb-regression.test.mjs`. The founder should re-run annexure EB on
  the Worker address and compare the findings count before/after.
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
  OCR-rendered input). `ENGINE.md` §12.11. Still open: the court-ready narrator's drafts
  all failed the server gate on this run — a prompt/quality question, not a gate to loosen.
- 7 September 2026: **Brain 9 reads the sealed text.** Founder direction: the AI must read
  the sealed files so nothing is missed, state what it finds, and the loop must let the engine
  catch it next time; Brain 9 verifies the model's claims are real and in the text. Built as
  `POST /api/v1/ai/sweep` + `aiBrain9Sweep` (`ENGINE.md` §12.8) under Constitution v8 §2.10:
  recommendations, never findings; every quote verified verbatim twice (Worker and device);
  stated on the results panel and in an unsealed JSON; counted (pages read, logged,
  discarded) in the sealed reports; fed to the loop as `B9_RECOMMENDATION`. Never merged into
  sealed findings, the findings JSON or the narrative — do not "promote" them without a signed
  rule. The website has no chat; this runs inside the seal pipeline only.
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
- 7 September 2026: the founder's first real run of the court-ready narrative (a 332-page
  Greensky case file) came back with **no AI text in any section** — every section said
  "(network)" — because the page was served by the host that has no API (previous bullet).
  The forensic report's **five findings on that file are correct, not a regression**: the
  engine is unchanged since 22 August and those five are the detections
  `tests/greensky-regression` protects. PR #193 makes a section the narrator could not write
  name its reason in plain words, retires the separate plain-language narrative PDF, gives the
  narrative a contents page and sets its section budgets at the reference document's depth.
- 6 September 2026: the two retired Workers (`verum-rules`, `verumglobal-static`) were deleted
  from the dashboard; this Worker owns the domain (PRs #184–#186). The court-ready narrative
  shipped (#188). The live site showed broken logos afterwards: the Worker answered
  `/images/logo-full.png` from KV, which holds no such key, and whether the Workers Builds
  deploy carries its static assets could not be confirmed from the sandbox — hence the serving
  chain, the embedded images and the health endpoint.
- The Cloudflare Pages project `verumglobal` is still connected to the repo and builds every
  push, but its production deployment is stale and it is **not** the origin the site is served
  from. The founder can disconnect it or point its production branch at `main`.
- Voice-note transcription returned "service error" on 6 September; since #187 the report note
  names the actual failure. Root cause still open — the next report PDF will say.
- `vanessa.pdf`, a confidential real-matter report, was removed from the tree on 6 September
  (no test used it); it remains in git history of this public repository until the founder
  decides on a history purge or private visibility.

**What must never be done.** The founder rulings and the seven regressions below; the §15.2
language gate and the PD2 anchor gate are never loosened; no secret is ever committed; no
`Date.now()` / `Math.random()` in an analysis path; no regex lookbehind; the inline copies are
never "de-duplicated"; the rules-manifest URL and the QR verify URL never move; no court is
ever described as having adopted, endorsed or validated anything. Read the bible for the area
before changing it: `ENGINE.md` (engine and reports), `DEPLOYMENT.md` (shipping and serving),
`REFERENCE.md` (every file and endpoint), `FORENSIC-DEBUG.md` (what a failure looks like).

## Quick facts
- Static site + one Cloudflare Worker (`worker/verum-rules.js`, `static-proxy.js`, `site-assets.js`). No servers, no database, no build step; the site ships as the Worker's static assets.
- Forensic engine: `forensic-engine-page.js` (CT01–CT46, detectors D01–D40, `VO_ENGINE_VERSION 5.3.5-web`); report generator: `forensic-report.js`.
- The forensic scripts are ALSO inlined into `seal-document.html` between `/* VO-INLINE:<file>:START/END */` markers. After editing any source file, re-splice the inline copy — `tests/inline-scripts.test.mjs` byte-compares them and fails on drift. Do NOT "de-duplicate" them into a shared module.
- Tests: `node tests/run-all.js` — **32 suites, 2039 assertions**, **must be green before any push**. Many exist only to stop specific regressions; see `ENGINE.md` §10.
- Report language is constitutional (PD16): findings stated as fact and anchored — no scores, no confidence bands, no hedging; the verdict on any named person is for the court.
- Deterministic: no `Date.now()` / `Math.random()` in analysis paths. (`setTimeout` for an OCR deadline is a deadline, not a clock reading — permitted and disclosed.)
- **No regex lookbehind in new code.** Safari < 16.4 throws at parse time and the whole scan dies silently. See `ENGINE.md` §4.16.

## The stakes — read this before anything else

**The platform's output is now evidence in live proceedings.** Sealed documents and forensic
reports produced by this code sit in the record of the Constitutional Court of South Africa
(rescission, CCT237/20 & CCT19/20), the KwaZulu-Natal High Court (2026-179949), SAPS and Hawks
dockets, and served evidence schedules whose SHA-512 values opposing senior counsel have been
invited to verify. That means:

- **A regression is not a bug — it is a discrepancy an opposing expert can put to a judge.**
  Determinism (same input → same findings, forever) has been demonstrated in the field and is
  now part of the platform's credibility in court. Any change that could make two runs differ
  is a constitutional breach, not a refactor.
- **The honesty locks are load-bearing.** The §15.2 language gate, the institutional-engagement
  clause, the never-write list below — these exist because overstated claims were found and
  corrected in served documents. Weakening one re-introduces a claim the founder has already
  had to retract.
- **The sealing flow is used by a person whose safety depends on it behaving as documented** —
  see the certificate privacy latch (item 6 below).

## The seven things most likely to be regressed

Each was a real failure the founder reported. Read `ENGINE.md` before touching any of them.

1. **Report order** — the human story leads, the table of contents follows (`ENGINE.md` §7,
   ruling 5 below). Moving Part 1 behind the TOC undoes the whole restructure.
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

1. **§15.4 governs the report format.** The report generator is to be rebuilt
   to the seven-section narrative template (Critical Legal Subjects,
   Dishonesty Detection Matrix, Nine-Brain Extraction Findings, Triple
   Verification Summary, Sealed Findings, Verdict Reservation, Certification),
   with today's additional sections (timeline, person index, evidence
   appendix, statutory anchoring, …) preserved as ANNEXES after Section 7.
2. **Severity word-labels are removed from display.** "CRITICAL / HIGH /
   MODERATE / LOW" must not print in reports (§15.2 names those tokens as
   prohibited bands). Severity remains an INTERNAL weight: findings stay
   ranked most-serious-first, and the ordering carries the weight.
3. **Nine-Brain equivalence stands (v8.0 §2).** The 46 contradiction types
   across 40 detectors ARE the Nine-Brain architecture — "the spec and the
   code describe the same machine." Reviews claiming the engine "ignores the
   Nine-Brain spec" misread the Constitution.
4. **No summary judgments, ever.** Reviews repeatedly demand the report state
   "this is a pattern of fraud"; §15.2 prohibits exactly that ("X is guilty
   of Y" — verdict belongs to the court). The engine states anchored facts
   and cites candidate law (POCA s1 included); the last step is the court's.
5. **The human story leads, and the first pages state the provenance.** The
   main report reads Story First, Evidence Second. Part 1, in order:
   the EXECUTIVE SUMMARY front page ("IN ONE PAGE", the findings that
   matter most, key dates, what to do next), "DOCUMENTS IN THIS BUNDLE"
   (which documents are in a consolidated bundle, their page ranges, and
   which findings cross between them), "THE SHORT VERSION" (one line per
   finding), "THE STORY IN PLAIN LANGUAGE", "PAGES THE ENGINE COULD NOT
   READ" (every unread page named, with its reason and a human-review
   instruction), then "WHY THIS RECORD CANNOT BE ALTERED" — and only THEN
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
   language; overstated court history; "perjury" outside candidate law;
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

### Founder direction (2026-09-07) — after the first real run (Greensky, 332 pages)

The founder ran a 332-page Greensky case file and read the three PDFs against
the reference "forensic goal" document. Decisions (PR #193), binding like the
seven above:

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
   `NOT REVIEWED` and never "verified"; forensic mode does not run where the service is
   absent. `ENGINE.md` §12.10. Do not re-widen a detector to recover a finding the
   annexure EB suite pins as false; add a positive control instead.
15. **The engine never reads a Verum Omnis report as evidence; one count; no template in
   AI's clothes (2026-09-13).** A prior Verum Omnis report bound into a bundle is excluded
   from scanning and the exclusion disclosed; every count a reader sees is the
   engine-verified count, AI candidates told apart; deterministic template text is never
   labelled as the AI narrator's and never carries a score or band. `ENGINE.md` §12.11.

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
| Constitutional Court of South Africa | CCT237/20 & CCT19/20 | v6.0 **filed**; receipt acknowledged by the Registrar's office. Notice to oppose filed. **No ruling on the merits.** |
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
The phrase *"in good faith and in the interest of justice"* in the H208/25
judgment records the **respondent's own affidavit**, not a finding by the Court.
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
- Deploys automatically on push to `main` (Worker via Workers Builds, site via Pages).
- Published documents must never mention any particular attorney's access
  arrangements. Check before publishing anything reader-facing.
