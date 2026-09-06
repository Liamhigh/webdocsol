# Deployment Guide — Verum Omnis Document Sealing & Forensic Analysis

## Hosting & Infrastructure

**Current Host**: [Cloudflare Workers](https://workers.cloudflare.com/)  
**Production Domain**: `verumglobal.foundation`  
**Infrastructure Type**: Serverless (Cloudflare Workers)  
**Configuration**: `wrangler.toml`

## Deployment Architecture

Two independent pieces serve `verumglobal.foundation`, and they are deployed
in two different ways. Confusing them is the most common cause of "I changed
the page but the site looks the same".

```
                    verumglobal.foundation
                             │
                   Worker: webdocsol
          owns verumglobal.foundation/* via the route
          declared in wrangler.toml; deployed by
          Workers Builds on every push to main
             ┌───────────────┴────────────────┐
             │                                │
        API traffic                   website HTML pages
         (/api/*)                     (everything else)
             │                                │
    the router in                      reverse-proxied to
    worker/verum-rules.js                    ↓
                                    https://verumglobal.pages.dev
                                    (Cloudflare Pages project)
```

**Routing history:** until 2026-09-06 a stale dashboard route pointed `/api/*`
at the retired `verum-rules` Worker (frozen 2026-07-20) and site traffic ran
through the retired `verumglobal-static` Worker, with `wrangler.toml`
reclaiming first the transcribe path and then `/api/v1/ai/*` via the
most-specific-route rule. On 2026-09-06 both retired Workers were deleted in
the dashboard — and their routes, including the site's, vanished with them.
Since then `webdocsol` owns the whole domain through the single route
declared in `wrangler.toml` (`verumglobal.foundation/*`), which every deploy
re-asserts, so dashboard state can no longer orphan the site.

**The website's HTML is deployed by Cloudflare Pages, not by `wrangler`.** The
Pages project is named `verumglobal`; it is connected to this repository
through Cloudflare's Git integration (configured in the Cloudflare dashboard,
which is why there is no workflow file in `.github/`). Pushes build there and
are served at `verumglobal.pages.dev`, which the static-proxy fallback built
into `worker/verum-rules.js` proxies onto the live domain.

So `wrangler deploy` never updates a single HTML page — that path only ships
`worker/verum-rules.js`. Conversely, a push that fails to build in Pages leaves
the old HTML live with no error anywhere in this repo. Check the Pages project,
not the Worker, when a page change does not appear.

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

**Routes**: the ONE route declared in `wrangler.toml` —
`verumglobal.foundation/*` — is the whole domain, and it is permanent: the
Worker serves site pages via the Pages proxy and `/api/*` via the router
(see "Routing history" above). `tests/wrangler-config.test.mjs` pins the
route list so it can neither narrow nor multiply without a deliberate,
reviewed change.

## Static Assets

Since 2026-09-06 the website ships **inside the Worker deploy** as Workers
Static Assets (`[assets] directory = "./"` in `wrangler.toml`, mirrored under
`[env.production]` and drift-locked by `tests/wrangler-config.test.mjs`).
Every file in the repo root that `.assetsignore` does not exclude is served
directly — `seal-document.html`, `verify.html`, `constitution.html`,
`images/`, `vendor/` and the rest — so what is merged to `main` *is* the live
site. `/api/*` always runs the Worker first (`run_worker_first`). A request
matching no asset falls through to the Worker's `serveStatic` proxy of the
Cloudflare Pages project (`verumglobal.pages.dev`) as a last resort only;
that Pages origin proved stale (it 200-serves its old home page for any
missing file), which is why the site moved into the Worker.

Extensionless URLs (`/verify` → `verify.html`) are handled by the assets
layer's default `auto-trailing-slash` behaviour, so a page added to the repo
is reachable at its extensionless URL on the next deploy with no list to
update. `.assetsignore` keeps source (`worker/`, `tests/`), config, docs and
the test-fixture PDFs out of the public upload.

## API Endpoints

API routes are handled by `worker/verum-rules.js`:

```
POST /api/v1/seal            — Seal a document (VO-DSS)
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

### Issue: "Static assets returning 404"
**Solution**: Check routes in `wrangler.toml`; ensure `verumglobal.foundation` zone is configured.

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
- This site is **live at Cloudflare** using **Cloudflare Workers**
- **Deployment method**: `wrangler deploy`
- **API token required**: Set `CLOUDFLARE_API_TOKEN` environment variable
- **Static assets**: Served by Cloudflare CDN (no build step)
- **Worker code**: `worker/verum-rules.js` (routes API requests)

### Merging to `main` IS the deploy

Both halves of the site now deploy automatically on push to `main`:

| What | Deployed by | Trigger |
|---|---|---|
| Static pages (`index.html`, `seal-document.html`, `verify.html`, …) | **Cloudflare Pages** | push to `main` |
| The Worker (`worker/verum-rules.js`) | **Cloudflare Workers Builds** | push to `main` |

A pull request runs three checks — **Sourcery review**, **Workers Builds: webdocsol**, and
**Cloudflare Pages**. Wait for them before merging (`pull_request_read` →
`get_check_runs`); merging red ships red. `wrangler deploy` by hand is the fallback for when
Workers Builds is unavailable, not the normal path.

**Because merge = publish:** run `node tests/run-all.js` (27 suites, 1441 assertions) and
re-splice the inline copies into `seal-document.html` **before** the PR, not after. A merged
regression is live within a minute.

### Before Making Changes
1. Review `wrangler.toml` for current routes & bindings
2. Check `DEPLOYMENT.md` (this file) for deployment process
3. For client-side changes (HTML/JS): edit the **root** files and re-splice the inline copies.
   `seal-module/web/` is the portable spec, **not** the live site — a change made only there
   ships nothing.
4. For API changes (`worker/verum-rules.js`): Workers Builds deploys on merge. To deploy by
   hand you **must** run
   `wrangler deploy` — with NO `--env` flag. `wrangler.toml` defines a single
   top-level environment on purpose (the KV and AI bindings used to sit under
   `[env.production]`, which meant an `--env`-less deploy shipped a Worker with
   no bindings at all). Passing `--env production` now FAILS immediately with
   "No environment found in configuration with name production", because no such
   section exists. Cloudflare Workers Builds deploys without `--env`, so the
   dashboard build/deploy command must not add one either.
5. For proxy/routing changes (`worker/verumglobal-static.js`): must be
   deployed to the `verumglobal-static` Worker.

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

