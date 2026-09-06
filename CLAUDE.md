# webdocsol — read AGENTS.md first

This repository is the Verum Omnis website and its Cloudflare Worker. The orientation for any
AI agent is **[`AGENTS.md`](./AGENTS.md)** — its "Start here" section is the two-minute state
of the platform (what runs where, how a change ships, which other repositories depend on this
one, what is known-broken today, what must never be done). Then, by area:

- Engine or report code → `ENGINE.md` (the bible; every guard has the evidence bundle that caused it)
- Shipping, routing, static assets, the serving chain → `DEPLOYMENT.md`
- Every file, page and endpoint → `REFERENCE.md`
- Diagnosing a failed seal or a missing narrative → `FORENSIC-DEBUG.md`
- The constitutional rules the prompts and gates enforce → `CONSTITUTION-v8.md`, `VERUM_OMNIS_SYSTEM_PROMPT.md`

Non-negotiables, in one place:

1. `node tests/run-all.js` green and `npm run check` clean before any push.
2. The five forensic scripts are inlined into `seal-document.html`: edit the source file, then
   re-splice the inline copy (`tests/inline-scripts.test.mjs` byte-compares them).
3. Never loosen a gate (§15.2 language gate, PD2 anchoring, seal guard) to get better prose.
4. Never commit a secret; `ADMIN_TOKEN`, `RULE_PRIVATE_KEY`, `LLM_*` live in the Cloudflare dashboard.
5. Determinism: no `Date.now()` / `Math.random()` in analysis paths; no regex lookbehind.
6. `/api/v1/rules/manifest` and `verify.html?h=&m=` are contracts with the Android app and the
   fraud-firewall repositories; they never move.
7. Merge to `main` is the deploy. The Workers Builds PR check is always red on PR branches;
   confirm deploys through the Cloudflare connector and `/api/v1/site/health`.
8. Institutional honesty: no court has adopted, endorsed or validated anything; write it that way.
