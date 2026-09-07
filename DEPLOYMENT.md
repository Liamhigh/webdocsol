# Deployment Guide — Verum Omnis Document Sealing & Forensic Analysis

## Hosting & Infrastructure

**Current Host**: [Cloudflare Workers](https://workers.cloudflare.com/)  
**Production Domain**: `verumglobal.foundation`  
**Infrastructure Type**: Serverless (Cloudflare Workers)  
**Configuration**: `wrangler.toml`

## Deployment Architecture

One Worker serves `verumglobal.foundation`, and one deploy carries everything:
Cloudflare Workers Builds builds the merge commit on `main` and ships the Worker
**with the repository root as its static assets**. There is no separate site deploy
any more — "I changed the page but the site looks the same" now means the merge
build has not run yet, or the browser cached the page.

```
                    verumglobal.foundation
                             │
                   Worker: webdocsol
      origin of verumglobal.foundation and www through the
      Custom Domains declared in wrangler.toml; deployed by
          Workers Builds on every push to main
             ┌───────────────┴────────────────┐
             │                                │
        API traffic                   website (everything else)
         (/api/*)                              │
             │                    1. bundled static assets ([assets] = repo root)
    the router in                 2. the main branch on raw.githubusercontent.com
    worker/verum-rules.js         3. the legacy Pages origin (verumglobal.pages.dev)
                                  (the two site images also: KV, then embedded copies)
                                  X-VO-Site-Source names the tier on every answer
```

**Routing reality on 2026-09-07 (read before trusting the diagram above).** The
`live-site-probe` workflow showed the zone routes this file used to declare were not in effect:
the apex is answered by the assets-only Worker `verum-omnis-forensic-web` (the March Kimi
mock-up shell, holding the apex as a Workers Custom Domain) and `www` by the Cloudflare Pages
project `verumglobal` (a Pages custom domain, i.e. a CNAME); nothing reached this Worker on
either host. Cloudflare's own rules explain it: a zone route only runs in front of a proxied
DNS record it does not create, and a route on a hostname that is another Worker's Custom
Domain runs *before* that Worker — so a route that had bound would have answered; it never
bound. Since 2026-09-07 `wrangler.toml` therefore declares both hostnames as **Custom Domains**
(`custom_domain = true`), the documented replacement for a `/*` route: Cloudflare creates the
DNS records and certificates and every deploy re-asserts the binding. Two things must happen in
the dashboard first, once, by the founder: the apex must be released by
`verum-omnis-forensic-web` (remove its Custom Domain or delete that Worker) and `www` by the
Pages project (remove the custom domain, then delete the leftover `www` CNAME under DNS →
Records) — a Custom Domain cannot be created over an existing CNAME. Until then every deploy
uploads the code and then fails its triggers step, which is expected and harmless. The founder
can also add the two Custom Domains by hand (`webdocsol` → Settings → Domains & Routes → Add →
Custom Domain), which is immediate; the next deploy finds them in place. Re-run
`live-site-probe` afterwards: a correct state shows `X-VO-Site-Source` on every answer and JSON
at `/api/v1/site/health`.

**Routing history:** until 2026-09-06 a stale dashboard route pointed `/api/*`
at the retired `verum-rules` Worker (frozen 2026-07-20) and site traffic ran
through the retired `verumglobal-static` Worker, with `wrangler.toml`
reclaiming first the transcribe path and then `/api/v1/ai/*` via the
most-specific-route rule. On 2026-09-06 both retired Workers were deleted in
the dashboard — and their routes, including the site's, vanished with them.
Since then `webdocsol` was meant to own the whole domain through declared zone
routes — `verumglobal.foundation/*` and, from 2026-09-07, `www.verumglobal.foundation/*`
— but the probe showed they never bound (see "Routing reality" above), so the same
day the file switched to Custom Domains for both hostnames; the site moved into the
Worker as static assets on 2026-09-06 (PR #186), and the serving chain above was
added after the deploy still showed a broken logo (PR #189). The Cloudflare Pages project `verumglobal`
is still connected to the repository and builds every push, but its production
deployment is stale and it is only the last tier of the chain.

### Third-party scripts

The pages load pdf-lib, qrcodejs and pdf.js from `/vendor/`, committed to this
repo. They were previously loaded from unpkg, cdnjs and jsdelivr. Do not move
them back: when one of those CDNs was slow or blocked, `pdf-lib` was undefined,
and `const { PDFDocument } = PDFLib || {}` threw a ReferenceError that aborted
the entire inline script — so every button on the sealing page silently stopped
working. `tests/page-boot.test.mjs` guards against both regressions.

### Why Cloudflare Workers?

- **Global Edge Network**: Low-latency response from 300+ data centers
- **Serverless**: No server management, auto-scaling
- **Workers AI Integration**: On-device AI processing (Cloudflare Workers AI)
- **KV Storage**: Fast key-value store for state and cache
- **Built-in Security**: DDoS protection, WAF, rate limiting

## Deployment Process

### Prerequisites

1. **Cloudflare Account**: Access to the verumglobal.foundation zone
2. **Cloudflare API Token**: Personal access token with Worker deployment permissions
3. **Node.js & npm**: Already installed in deployment environment
4. **wrangler CLI**: Already installed globally

### Step 1: Prepare Commits

All changes must be committed to the `main` branch:

```bash
git checkout main
git pull origin main
git merge <feature-branch>  # if merging from a feature branch
git push origin main
```

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
wrangler deploy
```

**Output**: Should show:
```
✔ Deployed to production
  https://verumglobal.foundation/
```

### Step 4: Verify Deployment

```bash
# Check the website is live
curl -I https://verumglobal.foundation/seal-document.html

# Verify forensic report functionality
# (manual test: upload a document, seal with Forensic Analysis mode)
```

## Configuration Files

### `wrangler.toml`

Main configuration for Cloudflare Workers deployment:

- **name**: `webdocsol` — the Worker that Workers Builds redeploys on every
  push to `main`
- **main**: `worker/verum-rules.js` — Entry point (API router plus the
  static-site proxy fallback)
- Bindings are declared twice — at the top level and under
  `[env.production]`, byte-identical (locked by
  `tests/wrangler-config.test.mjs`) — so `wrangler deploy` with and without
  `--env production` builds the same Worker:
  - **kv_namespaces**: KV storage bindings (RULES_KV)
  - **ai**: Workers AI binding (classify / assess / narrate / human-report / transcribe)
  - **vars**: Environment variables (SERVICE_VERSION, ENVIRONMENT, HUMAN_REPORT_MODEL)
  - **assets**: the site itself (see Static Assets)
  - optional secrets via `wrangler secret put`: `ADMIN_TOKEN`; `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL` for an external narrator provider

**Domains**: `wrangler.toml` declares two Custom Domains —
`verumglobal.foundation` and `www.verumglobal.foundation` — with this Worker
as their origin, and that is permanent: the Worker serves site pages via the
serving chain and `/api/*` via the router (see "Routing reality" above).
`tests/wrangler-config.test.mjs` pins the list so it can neither narrow,
multiply, nor revert to zone routes without a deliberate, reviewed change.

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
| `pages` | the legacy Cloudflare Pages project (`verumglobal.pages.dev`, `serveStatic`) | repo unreachable; this origin proved stale (it 200-serves its old home page for any missing file), so it is last |
| `kv`, `embedded` | the two site images only (`/images/logo-full.png`, `/images/watermark_portrait.png`): legacy KV keys, then the copies embedded in `worker/site-assets.js` | nothing upstream had the file — a broken logo cannot ship |

Source, config, docs and fixtures are never site files on any tier
(`SITE_DENY_RE` mirrors `.assetsignore`; `tests/site-serving.test.mjs` locks
the two lists together and checks that every local reference in every page
resolves to a served file). **`GET /api/v1/site/health`** reports which tier
answers for the home page, the seal page and both images — open it first
when a page or a logo is wrong; it turns the next outage into a one-URL
diagnosis. HTML is served `no-store` on every tier; other files are cacheable
for five minutes; failures are never cached.

Extensionless URLs (`/verify` → `verify.html`) are handled by the assets
layer's default `auto-trailing-slash` behaviour, so a page added to the repo
is reachable at its extensionless URL on the next deploy with no list to
update. `.assetsignore` keeps source (`worker/`, `tests/`), config, docs and
the test-fixture PDFs out of the public upload.

## API Endpoints

API routes are handled by `worker/verum-rules.js`:

```
GET  /api/v1/status          — service status + current rule-package version
GET  /api/v1/site/health     — which tier serves the site (assets / repo / kv / embedded / pages)
GET  /api/v1/rules/manifest  — signed rule package (hard-coded by the Android app and the firewall)
POST /api/v1/admin/publish   — publish a signed rule package (ADMIN_TOKEN)
POST /api/v1/ai/narrate      — Generate AI narrative (optional)
POST /api/v1/ai/human-report — Court-ready narrative, one gated section per call (opt-in)
POST /api/v1/ai/assess       — AI review findings (optional)
POST /api/v1/ai/classify     — Document classification (optional)
POST /api/v1/feedback/patterns — Anonymous pattern feedback
POST /api/v1/ai/transcribe   — Opt-in voice-note transcription (machine reading aid, never evidence)
```

## Environment Variables

Set in `wrangler.toml` under `[env.production.vars]`:

| Variable | Purpose | Example |
|----------|---------|---------|
| `ENVIRONMENT` | Deployment environment | `production` |
| `SERVICE_VERSION` | Release version | `1.5.1-20260721-mistral-enhanced` |

## KV Namespace

**Binding**: `RULES_KV`  
**ID**: `3ecf5dc4e00c45b89f3e2d7c1b4a2e9f`

Used for:
- Caching forensic engine rules
- Storing serial pattern definitions
- Rate limiting state

## Workers AI

**Binding**: `AI`  
**Models**:
- Narrative generation: Mistral (via Cloudflare Workers AI)
- Classification: Available via `/api/v1/ai/classify`

## Debugging Deployments

### Check Deployment Status

```bash
wrangler deployments list
```

### View Logs

```bash
wrangler tail
```

### Rollback to Previous Version

```bash
wrangler deployments rollback
```

(Select from list of previous deployments)

## Testing Locally (Before Deploying)

```bash
# Start Wrangler dev server
wrangler dev

# Navigate to http://localhost:8787
# Upload a document and test sealing flow
```

## Common Issues & Solutions

### Issue: "API token not set"
**Solution**: Export `CLOUDFLARE_API_TOKEN` environment variable before deploying.

### Issue: "Worker script exceeds size limit"
**Solution**: Check `wrangler.toml` build step; ensure no unnecessary bundles are included.

### Issue: "KV namespace not found"
**Solution**: Verify KV namespace ID in `wrangler.toml` matches Cloudflare dashboard.

### Issue: "Static assets returning 404" / a logo or page is wrong
**Solution**: open `https://verumglobal.foundation/api/v1/site/health` — or run the GitHub Actions
workflow **live-site-probe** (Actions → live-site-probe → Run workflow), which curls both hosts from
outside and prints status, content type, the `X-VO-Site-Source` tier and a snippet for every key path. `assetsBinding:false`
means the deploy did not carry its assets (check the Workers Builds log for the merge commit and
the wrangler version it used — the `[assets]` array form of `run_worker_first` needs wrangler ≥ 4.20);
`source:"repo"` means the site is being served from the main branch; `source:"pages"` means the
repo tier was unreachable and the stale Pages origin answered. Then check routes in `wrangler.toml`
and that the `verumglobal.foundation` zone is configured.

## Monitoring & Observability

### Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/
2. Select `verumglobal.foundation` zone
3. Navigate to **Workers & Pages** → **webdocsol**

**Metrics**:
- Request count & latency
- Error rates
- CPU time usage
- Errors & exceptions

### Logs

Real-time logs via Wrangler:

```bash
wrangler tail --format pretty
```

## Future Improvements

- [ ] Automated CI/CD deployment on main branch commits (GitHub Actions)
- [ ] Staging environment (`wrangler.toml` env.staging)
- [ ] Smoke tests post-deployment
- [ ] Automatic rollback on error spikes
- [ ] Cost monitoring (Workers billing)

## For Future AI Code Assistants

### Key Context
- This site is **live at Cloudflare** on **one Worker** (`webdocsol`) that is the origin of
  `verumglobal.foundation` and `www.verumglobal.foundation` (Custom Domains) — API and website alike
- **Deployment method**: Cloudflare Workers Builds runs `wrangler deploy` on every push to `main`
- **API token required** only for a by-hand deploy: `CLOUDFLARE_API_TOKEN`
- **Static assets**: bundled with the Worker (`[assets]`, repo root), served through the chain
  above (assets → main branch → legacy Pages; images fall back to embedded copies)
- **Worker code**: `worker/verum-rules.js` (router) · `worker/static-proxy.js` (site serving) ·
  `worker/site-assets.js` (embedded images)

### Merging to `main` IS the deploy

One deploy carries everything: Workers Builds builds the merge commit on `main` and ships the
Worker **with** the repo root as its static assets. There is no separate site deploy.

| What | Deployed by | Trigger |
|---|---|---|
| The Worker (`worker/`) and the site (`index.html`, `seal-document.html`, `verify.html`, `images/`, `vendor/`, …) | **Cloudflare Workers Builds** | push to `main` |
| (legacy) the Cloudflare Pages project `verumglobal` | still connected to the repo, builds on every push, **not** the origin the site is served from | push |

A pull request shows three checks — **Sourcery review**, **Workers Builds: webdocsol**, and
**Cloudflare Pages**. Read them honestly: the **Workers Builds check fails instantly on every
pull-request branch** (a non-production-branch build the dashboard does not configure), so red
there is not a signal about the change; the build that matters runs on the merge commit on
`main`. After merging, confirm the deploy with the Cloudflare connector (`workers_list` →
`webdocsol.modified_on` later than the merge) and open `/api/v1/site/health`. Sourcery is the
one PR check whose red means something. `wrangler deploy` by hand is the fallback for when
Workers Builds is unavailable, not the normal path.

**Because merge = publish:** run `node tests/run-all.js` (30 suites, 1726 assertions) and
re-splice the inline copies into `seal-document.html` **before** the PR, not after. A merged
regression is live within a minute.

### Before Making Changes
1. Review `wrangler.toml` for current routes & bindings
2. Check `DEPLOYMENT.md` (this file) for deployment process
3. For client-side changes (HTML/JS): edit the **root** files and re-splice the inline copies.
   `seal-module/web/` is the portable spec, **not** the live site — a change made only there
   ships nothing.
4. For API changes (`worker/verum-rules.js`): Workers Builds deploys on merge. To deploy by
   hand run `wrangler deploy` — with or without `--env production`: `wrangler.toml` carries the
   top level and a byte-equal `[env.production]` on purpose (the KV and AI bindings once sat under
   `[env.production]` only, so an `--env`-less deploy shipped a Worker with no bindings; later the
   section was removed and an `--env production` deploy aborted instantly). Both now exist and
   `tests/wrangler-config.test.mjs` forbids them from diverging.
5. Routing and site serving live in this one Worker (`wrangler.toml` routes,
   `worker/static-proxy.js`). The retired `verum-rules` and `verumglobal-static` Workers were
   deleted from the dashboard on 2026-09-06 and the second Worker's source file was removed
   from the repo with them; there is exactly one Worker.

### Testing Deployment Locally
```bash
wrangler dev
# Opens http://localhost:8787 with live reload
```

### Questions?
- **Hosting**: See "Hosting & Infrastructure" section
- **Deployment process**: See "Deployment Process" section
- **Credentials**: Ask Liam for CLOUDFLARE_API_TOKEN (never commit it)
- **Worker code**: See `worker/verum-rules.js`
- **Forensic debugging**: See `FORENSIC-DEBUG.md`

