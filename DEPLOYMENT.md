# Deployment Guide — Verum Omnis Document Sealing & Forensic Analysis

## Hosting & Infrastructure

**Current Host**: [Cloudflare Workers](https://workers.cloudflare.com/)  
**Production Domain**: `verumglobal.foundation` and `www.verumglobal.foundation` (zone routes), plus the Worker's own `webdocsol.liamhigh78.workers.dev`  
**Infrastructure Type**: Serverless (Cloudflare Workers)  
**Configuration**: `wrangler.toml`

## Deployment Architecture

One Worker serves `verumglobal.foundation` and `www`, and one deploy carries everything:
Cloudflare Workers Builds builds the merge commit on `main` and ships the Worker
**with the repository root as its static assets**. There is no separate site deploy
any more — "I changed the page but the site looks the same" now means the merge
build has not run yet, or the browser cached the page.

```
                    verumglobal.foundation
                             │
                   Worker: webdocsol
      origin of verumglobal.foundation and www through the
      two zone routes declared in wrangler.toml (2026-09-27);
      built by Workers Builds on every push; main is the deploy
             ┌───────────────┴────────────────┐
             │                                │
        API traffic                   website (everything else)
         (/api/*)                              │
             │                    1. bundled static assets ([assets] = repo root)
    the router in                 2. the main branch on raw.githubusercontent.com
    worker/verum-rules.js         3. the legacy Pages origin (verumglobal.pages.dev)
                                  (the two site images: assets → main branch → KV →
                                   embedded copy; never Pages)
                                  X-VO-Site-Source names the tier on every site
                                  answer the Worker gives (a file the assets layer
                                  serves directly carries none)
```

**Superseded — the 2026-09-07 diagnosis (history; its account of the apex was wrong, see
"Resolved (2026-09-27)" below).** The
`live-site-probe` workflow showed the zone routes this file used to declare were not in effect:
the apex was answered by the assets-only Worker `verum-omnis-forensic-web` (the March Kimi
mock-up shell, holding the apex as a Workers Custom Domain) and `www` by the Cloudflare Pages
project `verumglobal` (a Pages custom domain, i.e. a CNAME); nothing reached this Worker on
either host. Cloudflare's own rules explain it: a zone route only runs in front of a proxied
DNS record it does not create, and a route on a hostname that is another Worker's Custom
Domain runs *before* that Worker — so a route that had bound would have answered; it never
bound. From 2026-09-07 to 2026-09-27 `wrangler.toml` therefore declared both hostnames as **Custom Domains**
(`custom_domain = true`), the documented replacement for a `/*` route: Cloudflare creates the
DNS records and certificates and every deploy re-asserts the binding. The plan needed two things in
the dashboard first, once, by the founder: the apex to be released by
`verum-omnis-forensic-web` (remove its Custom Domain or delete that Worker) and `www` by the
Pages project (remove the custom domain, then delete the leftover `www` CNAME under DNS →
Records) — a Custom Domain cannot be created over an existing CNAME. They never bound: until
2026-09-27 every Workers Builds run reported failure, on branches and on `main` alike. The plan
also allowed the founder to add the two Custom Domains by hand (`webdocsol` → Settings → Domains
& Routes → Add → Custom Domain), then re-run `live-site-probe` to see JSON at
`/api/v1/site/health` on both hostnames and no `x-vo-bridge` header. None of these dashboard
steps was taken or needed. Do not
take them now: the live binding is the two zone routes, and the lock test refuses a
`custom_domain`.

**Resolved (2026-09-27).** The apex was never a Custom Domain. The probe, once it printed the
apex's small HTML body whole, showed the March mock-up shell (scripts from `kimi.page`) served
by the July Worker `verum-omnis-verify-production` through the zone route
`verumglobal.foundation/*`. The founder re-pointed that route to `webdocsol` in the zone's
**Workers Routes** page and added `www.verumglobal.foundation/*` beside it; no DNS record
changed. Confirmed from outside the same hour: JSON at `/api/v1/site/health` on both hostnames,
the seal page redirect from the Worker, no `x-vo-bridge` header (a route runs before the DNS
target, so Pages no longer sees `www`). `wrangler.toml` now declares exactly those two routes
(`zone_name = "verumglobal.foundation"`) so every deploy re-asserts the live state; the Custom
Domain declaration it replaces never bound. The narrower `verumglobal.foundation/api/v1/ai/*`
dashboard route, also on `webdocsol` and not declared in `wrangler.toml`, is redundant and
harmless (dashboard state as recorded on 2026-09-27; not checkable from the repository). The
bridge below stays as a dormant fallback.

**The bridge (2026-09-24).** Seventeen days on, neither dashboard step had been taken and `www`
still answered from the Pages project. The Pages project builds this repository on every push,
so the repository now carries a Pages Function, `functions/[[path]].js`, that hands every
request Pages receives to the Worker (`https://webdocsol.liamhigh78.workers.dev`, the same
path and query, method, headers and body) and returns the Worker's answer unchanged with an
`x-vo-bridge: pages-to-worker` header. From 2026-09-24 to 2026-09-27, on `www` the site, the API
and the forensic service were therefore the Worker's, while the DNS was untouched. Loop guard: the Worker's own Pages tier
(`serveStatic`) marks its requests `X-VO-Chain: worker`, and the bridge answers a marked
request from the static files, never by proxying back. An unreachable Worker falls back to the
static files with `x-vo-bridge: worker-unreachable`. The bridge never ships as a Worker asset
(`.assetsignore`, `SITE_DENY_RE`). It did nothing for the apex, which was then believed to be
held by `verum-omnis-forensic-web`; it was the zone route on `verum-omnis-verify-production`
(see "Resolved"). Since the `www.verumglobal.foundation/*` route was added on 2026-09-27, that
route answers `www` before Pages, so the bridge is dormant. It now runs only for requests made
to `verumglobal.pages.dev` itself, and the Worker's own Pages-tier requests (marked
`X-VO-Chain: worker`) are answered from Pages' static files.
Tests: `tests/pages-bridge.test.mjs`.

**The trainer run (cron).** `wrangler.toml [triggers] crons = ["0 3 * * 1"]` (both environments,
drift-locked) runs `runAutoCuration` once a week at 03:00 UTC. On Cloudflare day 1 is
**Sunday**, not Monday: the run observed on Sunday 27 September 2026 started 03:01 UTC. The
comment in `wrangler.toml` and the assertion label in `tests/wrangler-config.test.mjs` that say
"Monday" are wrong. It needs
`RULE_PRIVATE_KEY` on the Worker and writes `rules:current`, `rules:history:<version>`,
`rules:changelog` and `rules:auto-curate:last-run` in `RULES_KV`. Read `/api/v1/rules/changelog`
to see what it did. Last verified 2026-09-27: that run was `skipped` with "no signing key on this
service" (`/api/v1/rules/changelog`, live-site-probe run 36293574099), so on that date the trainer
had published nothing. Setting the key is open with the founder. `POST /api/v1/admin/curate-publish`
(`x-admin-token`) runs it on demand. To stop it, set `AUTO_CURATE = "off"` in both `[vars]` and
`[env.production.vars]`, and change the assertion in `tests/wrangler-config.test.mjs` (which pins
`"on"`) in the same reviewed PR. A dashboard-only change lasts only until the next deploy:
`wrangler.toml` declares `[vars]` and has no `keep_vars`. ENGINE.md §12.9.

**The second door — `webdocsol.liamhigh78.workers.dev`.** The 2026-09-07 probe found the Worker's
own workers.dev address switched off (Cloudflare error 1042: wrangler disables it once routes
or domains are declared), so on 7 September the Worker was reachable on no host at all.
`workers_dev = true` in both environments keeps that address on: same Worker, same bindings,
same code, independent of the domain binding. Use it to verify a deploy from outside, to seal
on while the domain is being repaired, and to read `/api/v1/status` (whether a signed rule
package is published). Every page carries a self-canonical link to the domain, so the second
address is never the one search engines index.

**Routing history:** until 2026-09-06 a stale dashboard route pointed `/api/*`
at the retired `verum-rules` Worker (frozen 2026-07-20) and site traffic ran
through the retired `verumglobal-static` Worker, with `wrangler.toml`
reclaiming first the transcribe path and then `/api/v1/ai/*` via the
most-specific-route rule. On 2026-09-06 both retired Workers were deleted in
the dashboard — and their routes, including the site's, vanished with them.
Since then `webdocsol` was meant to own the whole domain through declared zone
routes — `verumglobal.foundation/*` and, from 2026-09-07, `www.verumglobal.foundation/*`
— but the probe showed they never bound (see the superseded 2026-09-07 diagnosis above), so
the same day the file switched to Custom Domains for both hostnames, which never bound either.
On 2026-09-27 the founder re-pointed the dashboard route `verumglobal.foundation/*` from
`verum-omnis-verify-production` to `webdocsol` and added `www.verumglobal.foundation/*`, and the
file returned to those two zone routes (PR #210); the site moved into the
Worker as static assets on 2026-09-06 (PR #186), and the serving chain above was
added after the deploy still showed a broken logo (PR #189). The Cloudflare Pages project `verumglobal`
is still connected to the repository and builds every push, and it is only the last tier of
the chain. Its "Cloudflare Pages" check succeeds on every commit, `main` included. Whether its
production deployment matches `main` has not been checked since 2026-09-27; that day's probe
saw, through `workers.dev`, a 94,239-byte home page from it, the size of `index.html` then. It
answers any path it has no file for with its home page and status 200.

### Third-party scripts

The pages load pdf-lib, qrcodejs, pdf.js and Tesseract (OCR, with its wasm cores
and `eng.traineddata.gz`) from `/vendor/`, committed to this repo. The vendored
copy is always tried first. `seal-document.html` keeps pinned CDN copies of the
same versions only as fallbacks: unpkg (pdf-lib 1.17.1, pdfjs-dist 3.11.174),
cdnjs (qrcodejs 1.0.0), jsdelivr (tesseract.js 5.1.1) and
tessdata.projectnaptha.com (language data). Do not make a CDN the first source
again. When one was slow or blocked, `pdf-lib` was undefined, and
`const { PDFDocument } = PDFLib || {}` threw a ReferenceError that aborted the
entire inline script, so every button on the sealing page silently stopped
working. `tests/page-boot.test.mjs` guards this: no CDN `<script src>`, the
vendored files present, and the version-matched fallbacks.

### Why Cloudflare Workers?

- **One deploy**: the Worker and the site (Workers Static Assets) ship together from `main`.
- **Workers AI** (binding `AI`): the AI review, the Brain 9 sweep, the narratives and
  transcription run on Cloudflare's servers, never on the visitor's device. The forensic engine
  runs in the visitor's browser.
- **KV** (binding `RULES_KV`): the signed rule package and its history, anonymous feedback, the
  trainer's log, the constitution PDF served at `/constitution.pdf`, and legacy copies of the two
  site images.
- **Cron trigger**: the weekly trainer run.

No WAF or rate-limiting rule is configured from this repository.

## Deployment Process

### Prerequisites

For a by-hand deploy only; the normal path is a merge to `main`.

1. **Cloudflare account** access to the `verumglobal.foundation` zone.
2. **`CLOUDFLARE_API_TOKEN`**: never committed and never pasted into a chat; AI sessions are not
   given one.
3. **Node.js**.
4. **wrangler** is not a dependency of this repository: run it as `npx wrangler`. (The build
   and deploy commands Workers Builds runs are set in the Cloudflare dashboard, not here.)

### Step 1: Pull request, then merge

Work on a branch and open a pull request. Before the PR: `node tests/run-all.js` green,
`npm run check` clean, and the inline copies re-spliced into `seal-document.html`. The PR is
squash-merged into `main`, and that merge is the deploy. Never push to `main` directly: it
deploys at once, with no review. Steps 2-3 below are only for when Workers Builds is
unavailable.

### Step 2: Authenticate with Cloudflare

Set your Cloudflare API token as an environment variable:

```bash
export CLOUDFLARE_API_TOKEN=<your-token-here>
```

**To create a token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Grant permissions for `verumglobal.foundation` zone
5. Copy the token and set it as shown above

### Step 3: Deploy to Production

```bash
git checkout main && git pull --ff-only
npx wrangler deploy
```

Deploy by hand only from an up-to-date `main`: whatever the checkout holds goes live, and the
next Workers Builds run replaces it. Check the result with Step 4, not with wrangler's output.

### Step 4: Verify Deployment

1. The build: `gh api repos/Liamhigh/webdocsol/commits/<merge-sha>/check-runs`. "Workers
   Builds: webdocsol" is `success`, with a `Version ID` in its summary.
2. The Worker: the Cloudflare connector's `workers_list` shows `webdocsol.modified_on` at or
   after that build (branch builds move it too).
3. From outside: run **live-site-probe**. Expect JSON at `/api/v1/site/health` on all three
   hosts, `assetsBinding: true`, `source: "assets"` for the home page, the seal page and both
   images, and no `x-vo-bridge` header. `/seal-document.html` answering 307 to `/seal-document`
   is the assets layer, not a fault. The AI sessions' sandbox cannot reach these hosts; the
   probe can.
4. By hand: seal a document in each mode ("Seal document", and "Seal document with forensic
   report") on the live site.

## Configuration Files

### `wrangler.toml`

Main configuration for Cloudflare Workers deployment:

- **name**: `webdocsol` — the Worker that Workers Builds redeploys on every
  push to `main`
- **main**: `worker/verum-rules.js` — Entry point (API router plus the
  static-site proxy fallback)
- Everything is declared twice, at the top level and under `[env.production]`
  (`workers_dev`, `routes`, `assets`, KV, AI, `vars`, `observability`,
  `triggers`), so `wrangler deploy` builds the same Worker with or without
  `--env production`. `tests/wrangler-config.test.mjs` asserts the KV, AI,
  assets, vars, observability and triggers values equal key by key and pins
  the same two routes in both; `workers_dev = true` is mirrored by hand (the
  test does not check it):
  - **kv_namespaces**: `RULES_KV` (see KV Namespace)
  - **ai**: `AI`, Workers AI (gatekeep, classify, assess, sweep, narrate,
    human-report, transcribe, curate and the trainer)
  - **vars**: `ENVIRONMENT`, `SERVICE_VERSION`, `HUMAN_REPORT_MODEL`, `AUTO_CURATE`
  - **assets**: the site itself (see Static Assets)
  - **triggers**: the weekly trainer cron
  - **secrets** (names only; set in the Cloudflare dashboard or with
    `wrangler secret put`, never in this file): `ADMIN_TOKEN`,
    `RULE_PRIVATE_KEY`, and the optional `LLM_API_BASE` / `LLM_API_KEY` /
    `LLM_MODEL` for an external court-ready-narrative provider

**Domains**: `wrangler.toml` declares two zone routes,
`verumglobal.foundation/*` and `www.verumglobal.foundation/*`, each with
`zone_name = "verumglobal.foundation"`, in both environments, plus
`workers_dev = true`. They are the routes the founder set in the zone's
**Workers Routes** page on 2026-09-27, so every deploy re-asserts the live
state. The Worker serves site pages through the serving chain and `/api/*`
through the router. `tests/wrangler-config.test.mjs` pins exactly those two
patterns, each naming its zone, and refuses a `custom_domain` beside them: the
Custom Domain declaration of 2026-09-07 never bound. (The comments at the top
and bottom of `wrangler.toml` still say "Custom Domains" in places; the
declarations are the truth.)

## Static Assets

Since 2026-09-06 the website ships **inside the Worker deploy** as Workers
Static Assets (`[assets] directory = "./"` in `wrangler.toml`, mirrored under
`[env.production]` and drift-locked by `tests/wrangler-config.test.mjs`).
Every file in the repo root that `.assetsignore` does not exclude is served
directly — `seal-document.html`, `verify.html`, `constitution.html`,
`images/`, `vendor/` and the rest — so what is merged to `main` *is* the live
site. `/api/*` always runs the Worker first (`run_worker_first`).

**The serving chain (`worker/static-proxy.js` `serveSite`).** A site request
that reaches the Worker — because no bundled asset matched, or because a
deploy did not carry its assets — is answered in a fixed order, and every
answer names its tier in the `X-VO-Site-Source` response header:

| Tier | Source | When |
|---|---|---|
| `assets` | `env.ASSETS` — the files bundled with the deploy | binding present and the file exists |
| `repo` | `https://raw.githubusercontent.com/Liamhigh/webdocsol/main` — the same files straight from version control | assets missed; the repo is public, `main` is the live site by definition |
| `pages` | the legacy Cloudflare Pages project (`verumglobal.pages.dev`, `serveStatic`) | repo unreachable; it answers any file it does not have with its home page and status 200 (which is how it once served stale pages), so it is last. Requests to it carry `X-VO-Chain: worker` so the Pages bridge answers them from static files and never proxies back |
| `kv`, `embedded` | the two site images only (`/images/logo-full.png`, `/images/watermark_portrait.png`): the legacy KV keys `img:logo-full:b64` and `img:watermark-portrait:b64`, then the copies embedded in `worker/site-assets.js` | assets and repo both missed; for these two images the Pages origin is never asked, so a broken logo cannot ship |

Source, config, docs and fixtures are never site files on any tier
(`SITE_DENY_RE` mirrors `.assetsignore`; `tests/site-serving.test.mjs` locks
the two lists together and checks that every local reference in every page
resolves to a served file). **`GET /api/v1/site/health`** reports which tier
answers for the home page, the seal page and both images — open it first
when a page or a logo is wrong; it turns the next outage into a one-URL
diagnosis. The Worker's own tiers set caching themselves: HTML is `no-store`,
other files are `public, max-age=300, must-revalidate`, and failures are never
cached. On the Pages tier, a successful non-HTML file may also sit in
Cloudflare's edge cache for an hour. Files the assets layer serves, directly or
through the Worker's `assets` tier, keep the platform's own caching headers
(Cloudflare's default, `public, max-age=0, must-revalidate`; nothing in this
repository sets them).

Extensionless URLs (`/verify` → `verify.html`) are handled by the assets
layer's default `auto-trailing-slash` behaviour, so a page added to the repo
is reachable at its extensionless URL on the next deploy with no list to
update on the assets tier (the fallback tiers do keep one; see below). `.assetsignore` keeps source (`worker/`, `tests/`), config, docs and
the test-fixture PDFs out of the public upload.

A `.html` URL answers 307 to its extensionless form (`/seal-document.html` →
`/seal-document`), so `curl -I` on a `.html` URL shows a redirect, not the
page. The repo and Pages tiers map extensionless URLs through the `PAGES` list
in `worker/static-proxy.js`, and no test ties that list to the root `.html`
files, so add a new page there too. A path with no file anywhere is not a 404.
An extensionless path gets the Pages project's home page with status 200
(`X-VO-Site-Source: pages`; see the probe's `/this-path-does-not-exist`). A
missing non-HTML file gets a 503 `no-store` from the HTML-as-asset guard. Both
rely on the Pages project answering a missing file with its home page. Only
`/api/*` paths, denied files (`SITE_DENY_RE`) and `/constitution.pdf` when KV
lacks it answer a JSON 404.

## API Endpoints

API routes are handled by `worker/verum-rules.js`:

```
GET  /api/v1/status               — service status + current rule-package version (503 no_rule_package when none)
GET  /api/v1/site/health          — which tier would serve the site (assets / repo / kv / embedded / pages)
GET  /api/v1/rules/manifest       — signed rule package (hard-coded by the Android app and the fraud firewall; never moves)
GET  /api/v1/rules/changelog      — what the trainer published, when, and its last run
POST /api/v1/feedback/patterns    — anonymous pattern feedback (seal and verify pages)
POST /api/v1/admin/publish        — sign (RULE_PRIVATE_KEY) and publish a rule package (x-admin-token = ADMIN_TOKEN)
POST /api/v1/admin/curate-publish — run the trainer now (ADMIN_TOKEN)
POST /api/v1/ai/curate            — AI-drafted rule candidates from the feedback (ADMIN_TOKEN)
POST /api/v1/ai/gatekeep          — advisory licensing banner, sent only when a tier is chosen; never blocks sealing
POST /api/v1/ai/classify          — document triage (forensic mode)
POST /api/v1/ai/assess            — AI review of candidate findings (forensic mode)
POST /api/v1/ai/sweep             — Brain 9 sweep of the sealed text: anchored recommendations, never findings (forensic mode)
POST /api/v1/ai/narrate           — AI narrative (forensic mode)
POST /api/v1/ai/human-report      — court-ready narrative, one gated section per call (forensic mode)
POST /api/v1/ai/transcribe        — voice-note transcription, a machine reading aid, never evidence (forensic mode)
GET  /constitution.pdf, /docs/constitution.pdf — constitution PDF from KV
GET  /images/logo-full.png, /images/watermark_portrait.png — reach the Worker only when the asset is missing
```

Forensic mode is "Seal document with forensic report". Since 2026-09-07 (#200) it runs every AI
step automatically, after a pre-flight that reads `/api/v1/site/health` and refuses to start a
forensic report when the forensic service does not answer. "Seal document" makes no review,
narrative or transcription call and sends no feedback; the tier selector that triggers gatekeep
is shown only in forensic mode. A failed AI call never undoes a seal: triage, assessment and the
narratives fall back to deterministic output, the Brain 9 sweep adds nothing, and a voice note
carries no transcript. An unknown `/api/*` path answers a JSON 404, and a known path with the
wrong method answers 405.

## Environment Variables

Set in `wrangler.toml` under `[vars]` and, identically, `[env.production.vars]`:

| Variable | Value | Purpose |
|---|---|---|
| `ENVIRONMENT` | `production` | environment name |
| `SERVICE_VERSION` | `1.5.1-20260721-mistral-enhanced` | a fixed label reported by `/api/v1/site/health`; not a commit, so it cannot confirm a deploy |
| `HUMAN_REPORT_MODEL` | `@cf/meta/llama-4-scout-17b-16e-instruct` | the court-ready narrative's Workers AI model |
| `AUTO_CURATE` | `on` | the trainer switch (pinned by the lock test) |

Every deploy writes these values back (there is no `keep_vars`), so change them here, not in the
dashboard.

## KV Namespace

**Binding**: `RULES_KV` · **Namespace**: `verum-rules-kv` · **ID**:
`3e032b900b5344bd8785371cd1fd1810` (both environments; the test pins them equal).

Used for: `rules:current` (the signed rule package the manifest serves; serial patterns are part
of it), `rules:history:<version>`, `rules:changelog` and `rules:auto-curate:last-run`;
`feedback:<day>` (anonymous pattern feedback, with a time-to-live); `pdf:constitution-v6:meta`
and `pdf:constitution-v6:chunk:<n>` (served at `/constitution.pdf`); `img:logo-full:b64` and
`img:watermark-portrait:b64` (legacy image copies). The Worker keeps no rate-limiting state.
(Until 2026-10-03 this section gave the ID `3ecf5dc4e00c45b89f3e2d7c1b4a2e9f`, which was never
in `wrangler.toml`.)

## Workers AI

**Binding**: `AI`. **Models** (`worker/verum-rules.js`): `@cf/meta/llama-3.1-8b-instruct-fp8`
for gatekeep, classify and narrate, and as the fallback model for assess, the sweep, the
trainer and the court-ready narrative; `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for assess,
the Brain 9 sweep, curate and the trainer; `HUMAN_REPORT_MODEL` (default `@cf/meta/llama-4-scout-17b-16e-instruct`) for the
court-ready narrative, or an external OpenAI-compatible provider when the `LLM_*` secrets are
set; `@cf/openai/whisper` for transcription. No Mistral model is used; the word survives only in
the `SERVICE_VERSION` label.

## Debugging Deployments

These need Cloudflare credentials (`CLOUDFLARE_API_TOKEN`, or a `wrangler login`); AI sessions have none and should use `gh api` check runs and
the read-only Cloudflare connector. Run wrangler as `npx wrangler`.

### Check Deployment Status

```bash
npx wrangler deployments list
```

### View Logs

```bash
npx wrangler tail
```

### Rollback to Previous Version

Prefer a revert PR merged to `main`: a rollback made in the dashboard or with wrangler lasts
only until the next Workers Builds run. If a rollback is needed at once, ask the founder
(dashboard → webdocsol → Deployments), or use wrangler's rollback command for the installed
version (`npx wrangler --help`).

## Testing Locally (Before Deploying)

The local check is the suite: `node tests/run-all.js` and `npm run check`.
`tests/worker.test.mjs`, `tests/site-serving.test.mjs` and `tests/pages-bridge.test.mjs` run the
Worker, the serving chain and the bridge against stub bindings. `npx wrangler dev`
(http://localhost:8787) needs a Cloudflare login and is not part of the workflow.

## Common Issues & Solutions

### Issue: "API token not set"
**Solution**: Export `CLOUDFLARE_API_TOKEN` environment variable before deploying.

### Issue: "Worker script exceeds size limit"
**Solution**: `wrangler.toml` has no build step. wrangler bundles `worker/verum-rules.js` with
`worker/static-proxy.js` and `worker/site-assets.js` (about 228 KB of source; the embedded images
are in `site-assets.js`). Keep large files out of `worker/`: site files belong in the repo root,
where they ship as static assets rather than inside the script.

### Issue: "KV namespace not found"
**Solution**: Verify KV namespace ID in `wrangler.toml` matches Cloudflare dashboard.

### Issue: "Static assets returning 404" / a logo or page is wrong
**Solution**: open `https://verumglobal.foundation/api/v1/site/health` — or run the GitHub Actions
workflow **live-site-probe** (Actions → live-site-probe → Run workflow), which prints the DNS
answers for both hostnames. It then curls `verumglobal.foundation`, `www.verumglobal.foundation`
and `webdocsol.liamhigh78.workers.dev` for nine paths: home, seal page, logo, a photo, site
health, status, the rule manifest (shape only), the trainer's changelog, and a path that must not
exist. For each it prints status, content type, size, the `X-VO-Site-Source` and `x-vo-bridge`
headers and a snippet, with small HTML bodies printed whole. It runs only by hand, and the AI
sessions' sandbox cannot reach these hosts. `assetsBinding:false`
means the deploy did not carry its assets (check the Workers Builds log for the merge commit and
the wrangler version it used — the `[assets]` array form of `run_worker_first` needs wrangler ≥ 4.20);
`source:"repo"` means the site is being served from the main branch; `source:"pages"` means the
repo tier was unreachable and the Pages origin answered. Then check the zone's **Workers
Routes** page: both routes must name `webdocsol`, matching `wrangler.toml`.

## Monitoring & Observability

### Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/
2. **Workers & Pages** → **webdocsol** (an account page): metrics, builds, deployments and logs.
   `[observability] enabled = true` keeps Workers Logs.
3. The routes are on the zone: `verumglobal.foundation` → **Workers Routes**.

**Metrics**:
- Request count & latency
- Error rates
- CPU time usage
- Errors & exceptions

### Logs

Real-time logs via Wrangler (needs `CLOUDFLARE_API_TOKEN`):

```bash
npx wrangler tail --format pretty
```

## Future Improvements

- [x] Automated deployment on every merge to `main`: Cloudflare Workers Builds (not GitHub Actions)
- [ ] Staging environment: open with the founder (the repository keeps one environment, mirrored, on purpose)
- [ ] Automatic smoke test after each deploy (`live-site-probe` exists but runs only by hand)
- [ ] Automatic rollback on error spikes
- [ ] Cost monitoring (Workers billing)

## For Future AI Code Assistants

### Key Context
- This site is **live at Cloudflare** on **one Worker** (`webdocsol`) that is the origin of
  `verumglobal.foundation` and `www.verumglobal.foundation` (zone routes `verumglobal.foundation/*`
  and `www.verumglobal.foundation/*`, since 2026-09-27), and on `webdocsol.liamhigh78.workers.dev`
  — API and website alike
- **Deployment method**: Cloudflare Workers Builds runs `wrangler deploy` on every push to `main`;
  it also builds every push to any other branch (see the checks below)
- **API token required** only for a by-hand deploy: `CLOUDFLARE_API_TOKEN`
- **Static assets**: bundled with the Worker (`[assets]`, repo root), served through the chain
  above (assets → main branch → legacy Pages; the two site images: assets → main branch → KV →
  embedded copy, never Pages)
- **Worker code**: `worker/verum-rules.js` (router) · `worker/static-proxy.js` (site serving) ·
  `worker/site-assets.js` (embedded images)

### Merging to `main` IS the deploy

One deploy carries everything: Workers Builds builds the merge commit on `main` and ships the
Worker **with** the repo root as its static assets. There is no separate site deploy.

| What | Deployed by | Trigger |
|---|---|---|
| The Worker (`worker/`) and the site (`index.html`, `seal-document.html`, `verify.html`, `images/`, `vendor/`, …) | **Cloudflare Workers Builds** | push to `main` (it also builds every push to any other branch; whether those builds deploy is open, see below) |
| (legacy) the Cloudflare Pages project `verumglobal` | still connected to the repo, builds on every push, **not** the origin the site is served from | push |

**The checks, as they are since 2026-09-27.** Every push to any branch, with or without a pull
request, starts **Workers Builds: webdocsol** and **Cloudflare Pages**. Sourcery reviews the pull
request in a comment; its check run may be absent or `skipped`. Up to and including PR #209,
every Workers Builds run checked had failed, on branches and on `main` alike. (From 2026-09-07 to
2026-09-27 it failed at the triggers step, on the Custom Domain declaration; the comment at the
top of `wrangler.toml` records it.) The old advice that a red Workers Builds check is "not a
signal" dates from then. From PR #210 on, every run checked (last on 2026-10-03) has succeeded
and printed a `Version ID`, on branches as on `main`, and the Cloudflare bot comments "Deployment successful!"
on the pull request. A red Workers Builds check is now a real failure: read its log.

**Open with the founder (since 2026-10-03): does a branch build deploy?** On 2026-10-03 the
connector's `workers_list` gave `webdocsol.modified_on` = 2026-10-03T00:18:48Z. That was the
build of branch commit `72e391b`, and nothing had merged since 2026-10-02T10:22Z.
`workers_get_worker_code` returned code that exists only on that branch. Either branch builds
deploy to the live Worker, or they upload versions that the connector cannot tell apart from a
deploy. That choice is a Workers Builds setting in the Cloudflare dashboard, not something in
this repository. Until the founder confirms it, push to any branch only what could go live:
tests green, `npm run check` clean, inline copies re-spliced.

**Confirming that a merge deployed.** (1) `gh api
repos/Liamhigh/webdocsol/commits/<merge-sha>/check-runs`: "Workers Builds: webdocsol" is
`success`, with a `Version ID` in its summary. (2) The connector: `webdocsol.modified_on` is at
or after that build. On its own this proves nothing, because branch builds move it too.
(3) `/api/v1/site/health` through `live-site-probe`: JSON, `assetsBinding: true` and
`source: "assets"` throughout. This shows the Worker is answering with its assets bound. It names
no commit: `version` is the fixed `SERVICE_VERSION`. `wrangler deploy` by hand is the fallback
for when Workers Builds is unavailable, not the normal path.

**Because merge = publish:** run `node tests/run-all.js` (40 suites; 2839 assertions on
9 October 2026, per-suite counts in `ENGINE.md` §10) and `npm run check`, and re-splice the
inline copies into `seal-document.html` (`tests/inline-scripts.test.mjs` byte-compares them),
all **before** the PR, not after. A merged
regression is live within a minute.

### Before Making Changes
1. Review `wrangler.toml` for current routes & bindings
2. Check `DEPLOYMENT.md` (this file) for deployment process
3. For client-side changes (HTML/JS): edit the **root** files and re-splice the inline copies.
   `seal-module/web/` is the portable spec, **not** the live site — a change made only there
   ships nothing.
4. For API changes (`worker/verum-rules.js`): Workers Builds deploys on merge. To deploy by
   hand run `npx wrangler deploy` — with or without `--env production`: `wrangler.toml` carries the
   top level and a mirrored `[env.production]` on purpose (the KV and AI bindings once sat under
   `[env.production]` only, so an `--env`-less deploy shipped a Worker with no bindings; later the
   section was removed and an `--env production` deploy aborted instantly). Both now exist and
   `tests/wrangler-config.test.mjs` forbids them from diverging.
5. Routing and site serving live in this one Worker (`wrangler.toml` routes,
   `worker/static-proxy.js`). The retired `verum-rules` and `verumglobal-static` Workers were
   deleted from the dashboard on 2026-09-06 and the second Worker's source file was removed
   from the repo with them; exactly one Worker is built from this repository. The account holds
   others (15 Workers on 2026-10-03), among them `verum-omnis-verify-production`, whose apex
   route was re-pointed to `webdocsol` on 2026-09-27, and `verum-omnis-forensic-web`, the March
   mock-up. None is built from here; leave them to the founder.

### Testing Deployment Locally
See "Testing Locally" above.

### Questions?
- **Hosting**: See "Hosting & Infrastructure" section
- **Deployment process**: See "Deployment Process" section
- **Credentials**: `CLOUDFLARE_API_TOKEN` is the founder's. Never commit it, and never paste it
  into a chat; AI sessions work without it. The Worker's secrets (`ADMIN_TOKEN`,
  `RULE_PRIVATE_KEY`, `LLM_*`) live on the Worker, never in the repository.
- **Worker code**: See `worker/verum-rules.js`
- **Forensic debugging**: See `FORENSIC-DEBUG.md`

