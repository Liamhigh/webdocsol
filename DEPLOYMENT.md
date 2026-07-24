# Deployment Guide — Verum Omnis Document Sealing & Forensic Analysis

## Hosting & Infrastructure

**Current Host**: [Cloudflare Workers](https://workers.cloudflare.com/)  
**Production Domain**: `verumglobal.foundation`  
**Infrastructure Type**: Serverless (Cloudflare Workers)  
**Configuration**: `wrangler.toml`

## Deployment Architecture

```
GitHub (liamhigh/webdocsol)
       ↓
   [main branch]
       ↓
  wrangler deploy          (Cloudflare Workers Builds runs
       ↓                    `npx wrangler versions upload`)
  Worker: verum-rules
       ↓
  verumglobal.foundation/api/*, /docs/*, /images/*, /constitution.pdf
```

> **This repo deploys the API Worker only.** `worker/verum-rules.js` answers the
> routes listed above and returns `404 not_found` for every other path. The
> static site (`/`, `seal-document.html`, `verify.html`, …) is served by a
> *different* Cloudflare project. Never point this repo's build at the Worker
> that serves the site — doing so replaces the site with a 404-only API.

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

Do **not** pass `--env production`. `wrangler.toml` deliberately defines a
single, top-level environment. It previously kept all bindings under an
`[env.production]` section while CI deployed without `--env`, which shipped a
Worker with no `RULES_KV` binding and turned every KV-backed route into an
HTTP 500. Verify before deploying — this must list the bindings, not
`No bindings found`:

```bash
wrangler deploy --dry-run
```

### Step 4: Verify Deployment

```bash
# The API must answer, not 500. A 500 "internal_error" here almost always
# means the deployed version is missing its RULES_KV binding.
curl -sS https://verumglobal.foundation/api/v1/status

# The static site must still be served by its own project, not by this Worker.
# A 404 "Unknown endpoint" here means this API Worker has taken over the site.
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://verumglobal.foundation/seal-document.html
```

## Configuration Files

### `wrangler.toml`

Main configuration for Cloudflare Workers deployment:

- **name**: `verum-rules` — Worker project name
- **main**: `worker/verum-rules.js` — Entry point
- **kv_namespaces**: KV storage binding (`RULES_KV` → `verum-rules-kv`)
- **ai**: Workers AI binding for narrative generation
- **vars**: Environment variables (SERVICE_VERSION, ENVIRONMENT)

**Production Routes** (managed in the Cloudflare dashboard, not in
`wrangler.toml`, so that a deploy from this repo can never silently re-point
live traffic):
```
verumglobal.foundation/api/*
verumglobal.foundation/constitution.pdf
verumglobal.foundation/docs/*
verumglobal.foundation/images/*
```

Every other path is served by a separate Cloudflare project, not by this repo.

## Static Assets

Static files (HTML, JS, CSS, images) are served directly by Cloudflare:

- `seal-document.html` — Main sealing interface
- `verify.html` — Document verification page
- `constitution.html` — Constitution document
- `forensic-report.js` — Forensic report PDF builder
- `forensic-engine-page.js` — Forensic engine (37 detectors)
- `images/` — Logos, watermarks, assets

**Caching**: Cloudflare CDN caches immutable assets; HTML pages bypass cache.

## API Endpoints

API routes are handled by `worker/verum-rules.js`:

```
POST /api/v1/seal            — Seal a document (VO-DSS)
POST /api/v1/ai/narrate      — Generate AI narrative (optional)
POST /api/v1/ai/assess       — AI review findings (optional)
POST /api/v1/ai/classify     — Document classification (optional)
POST /api/v1/feedback/patterns — Anonymous pattern feedback
```

## Environment Variables

Set in `wrangler.toml` under `[vars]`:

| Variable | Purpose | Example |
|----------|---------|---------|
| `ENVIRONMENT` | Deployment environment | `production` |
| `SERVICE_VERSION` | Release version | `1.5.1-20260721-mistral-enhanced` |

## KV Namespace

**Binding**: `RULES_KV`  
**ID**: `3e032b900b5344bd8785371cd1fd1810`

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
**Solution**: Verify the KV namespace ID in `wrangler.toml` against `wrangler kv namespace list`. `RULES_KV` must be `verum-rules-kv` (`3e032b900b5344bd8785371cd1fd1810`). The config previously carried an ID that existed in no account.

### Issue: Every API route returns HTTP 500 `internal_error`
**Solution**: The deployed version has no `RULES_KV` binding, so `env.RULES_KV.get()` throws and the catch-all in `worker/verum-rules.js` converts it to a generic 500. Run `wrangler deploy --dry-run` — if it prints `No bindings found`, the bindings are not reaching the deployed environment. Do not "fix" this by adding an `[env.*]` section; keep the config single-environment.

### Issue: The site returns 404 `Unknown endpoint` instead of HTML
**Solution**: This API Worker has been deployed onto the Worker that serves the static site. Roll that Worker back to its last pre-overwrite version in the Cloudflare dashboard, then re-point this repo's Workers Build at `verum-rules`.

## Monitoring & Observability

### Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/
2. Select `verumglobal.foundation` zone
3. Navigate to **Workers & Pages** → **verum-rules**

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
- **Deployment method**: `wrangler deploy` — never with `--env`
- **API token required**: Set `CLOUDFLARE_API_TOKEN` environment variable
- **Worker code**: `worker/verum-rules.js` — an **API-only** Worker. It handles
  `/api/v1/*`, `/constitution.pdf`, `/docs/*` and two `/images/*` paths, and
  returns `404 not_found` for everything else.
- **This repo does not deploy the static site.** The HTML at the top level of
  this repo is served by a separate Cloudflare project. Deploying this
  `wrangler.toml` onto that project takes the whole site down.

### Before Making Changes
1. Review `wrangler.toml` for current bindings; routes live in the dashboard
2. Check `DEPLOYMENT.md` (this file) for deployment process
3. For client-side changes (HTML/JS): no deployment needed (Cloudflare caches)
4. For API changes (worker/): **must** run `wrangler deploy`
5. Run `npm test` and `npm run check` before deploying
6. Never move bindings into an `[env.*]` section. CI deploys without `--env`,
   so anything under a named environment is silently dropped from the build.

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

