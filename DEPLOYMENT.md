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
  wrangler deploy
       ↓
  Cloudflare Workers
       ↓
  verumglobal.foundation
```

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
wrangler deploy --env production
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

- **name**: `verum-omnis-rules` — Worker project name
- **main**: `worker/verum-rules.js` — Entry point
- **env.production**: Production environment settings
  - **routes**: URL patterns served by this worker
  - **kv_namespaces**: KV storage bindings (RULES_KV)
  - **ai**: Workers AI binding for narrative generation
  - **vars**: Environment variables (SERVICE_VERSION, ENVIRONMENT)

**Production Routes:**
```
verumglobal.foundation/api/*
verumglobal.foundation/constitution.pdf
verumglobal.foundation/docs/*
verumglobal.foundation/images/*
```

All other routes are served as static assets from Cloudflare's CDN.

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
wrangler deployments list --env production
```

### View Logs

```bash
wrangler tail --env production
```

### Rollback to Previous Version

```bash
wrangler deployments rollback --env production
```

(Select from list of previous deployments)

## Testing Locally (Before Deploying)

```bash
# Start Wrangler dev server
wrangler dev --env production

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
3. Navigate to **Workers & Pages** → **verum-omnis-rules-prod**

**Metrics**:
- Request count & latency
- Error rates
- CPU time usage
- Errors & exceptions

### Logs

Real-time logs via Wrangler:

```bash
wrangler tail --env production --format pretty
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
- **Deployment method**: `wrangler deploy --env production`
- **API token required**: Set `CLOUDFLARE_API_TOKEN` environment variable
- **Static assets**: Served by Cloudflare CDN (no build step)
- **Worker code**: `worker/verum-rules.js` (routes API requests)

### Before Making Changes
1. Review `wrangler.toml` for current routes & bindings
2. Check `DEPLOYMENT.md` (this file) for deployment process
3. For client-side changes (HTML/JS): no deployment needed (Cloudflare caches)
4. For API changes (worker/): **must** run `wrangler deploy --env production`

### Testing Deployment Locally
```bash
wrangler dev --env production
# Opens http://localhost:8787 with live reload
```

### Questions?
- **Hosting**: See "Hosting & Infrastructure" section
- **Deployment process**: See "Deployment Process" section
- **Credentials**: Ask Liam for CLOUDFLARE_API_TOKEN (never commit it)
- **Worker code**: See `worker/verum-rules.js`
- **Forensic debugging**: See `FORENSIC-DEBUG.md`

