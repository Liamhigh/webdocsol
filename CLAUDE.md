# webdocsol — read AGENTS.md first

This repository is the Verum Omnis website, the forensic engine that runs in the visitor's
browser (the reference implementation for every Verum Omnis surface), and the Cloudflare Worker
`webdocsol` that serves the site and the `/api/v1/*` API. The repository is public. The
Worker's static assets are the whole repository (`wrangler.toml` `[assets] directory = "./"`),
so every file that `.assetsignore` does not exclude is published on the site.

The orientation for any AI agent is **[`AGENTS.md`](./AGENTS.md)** — its "Start here" section is
the two-minute state of the platform (what runs where, how a change ships, which other
repositories depend on this one, the dated known state, what must never be done). Then, by area:

- Engine or report code → `ENGINE.md` (the bible; every guard has the evidence bundle that caused it)
- Shipping, routing, static assets, the serving chain → `DEPLOYMENT.md`
- Every file, page and endpoint → `REFERENCE.md`
- Diagnosing a failed seal or a missing narrative → `FORENSIC-DEBUG.md`
- Where this repository sits among the surfaces, and the system's hard constraints → `ARCHITECTURE.md`
- The look of any page → `VERUM_UI_TOKENS.md` (binding) and `DESIGN_LOCK.md`
- The signed rule-package manifest, a contract (6 below) → `worker/rule-format.md`
- The constitutional rules the prompts and gates enforce → `CONSTITUTION-v8.md` (the v8.0
  governance charter; the engine's operating instrument is v6.1, compacted in
  `worker/verum-rules.js` as `VO_CONSTITUTION_V6`) and `VERUM_OMNIS_SYSTEM_PROMPT.md` (how the
  surfaces fit together). Never edit the Constitution: it is a sealed instrument whose site
  copies (`constitution.json`, `constitution.html`) `tests/constitution-lock.test.mjs` locks.
  Never edit the system prompt here without mirroring the change in `Liamhigh/1verum` and
  `Liamhigh/firebase`: it is meant to be identical in all three repositories (today it is not;
  the reconciliation is open with the founder, `AGENTS.md` "Open today").

What is open, and who holds it: the "Open today" list under "Known state right now" in
`AGENTS.md` (it carries the founder's items from `ENGINE.md` §12.14 "Open, with the founder").
What changed last: the last entry of that section's "History, oldest first", and the last
`ENGINE.md` §12 entries (newest last).

Non-negotiables, in one place:

1. `node tests/run-all.js` green and `npm run check` clean before any push. No GitHub
   workflow runs them (the only one is the manual `live-site-probe`), and the Workers Builds
   build command is dashboard state, not in this repository: assume nothing runs them for you.
   A test file runs only once it is listed in `tests/run-all.js`. Suite counts: `ENGINE.md` §10.
2. The five forensic scripts (`forensic-engine-page.js`, `forensic-report.js`, `seal-guard.js`,
   `ots-proof.js`, `pdf-encrypt.js`) are inlined into `seal-document.html` between
   `/* VO-INLINE:<file>:START/END */` markers: edit the root source file, then re-splice the
   inline copy (snippet in `ENGINE.md` §9; `tests/inline-scripts.test.mjs` byte-compares them).
   The same test compares the page's hand-kept `CTNAME`, `CTCAT`, `CATLAB` and `CATORD` with
   `CT_NAMES`, `CT_CATEGORY`, `CATEGORY_LABEL` and `CATEGORY_ORDER` in `forensic-report.js`:
   change both by hand. The inlined scripts are closures, so page code calls page helpers only.
   `seal-module/` (the portable sealing spec) is not served, and `seal-module/web/` holds older
   page snapshots that do not match the live pages; a change made only there ships nothing.
3. Never loosen a gate to get better prose: the §15.2 language gate (in the Worker and at render
   time), PD2 anchoring, the four-pillars gate, the court-language ban, the seal guard.
4. Never commit a secret or a real matter's documents. `ADMIN_TOKEN`, `RULE_PRIVATE_KEY` and the
   optional `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL` are set on the Worker in the Cloudflare
   dashboard only.
5. Determinism: the engine never reads the clock or a random source. No `Date.now()`,
   argument-less `new Date()` or `Math.random()` in an analysis path; the analysis instant is
   passed in (`referenceTime`, recorded as `analysis_reference_utc`). No regex lookbehind in new
   code: Safari before 16.4 cannot parse it and the scan dies (three older ones are known debt,
   `ENGINE.md` §4.16).
6. `/api/v1/rules/manifest` (with its shape, `worker/rule-format.md`, and the key id
   `vo-master-1`) and `https://verumglobal.foundation/verify.html?h=<first 32 hex of the
   SHA-512>&m=<metadata>` are contracts with the Android app (`Liamhigh/1verum`) and the
   fraud-firewall (`Liamhigh/firebase`); they never move.
7. Merge to `main` is the deploy: Cloudflare Workers Builds builds the merge commit. The Workers
   Builds check on a pull-request branch is not the deploy. It failed on every build, branch and
   merge commit alike, until #209, and has passed on every PR head and merge commit since #210
   (27 September 2026; last checked through the GitHub API on 3 October 2026), so a red check
   is now a real signal. Confirm a deploy with the Workers Builds check on the merge commit and
   with `/api/v1/site/health`, read from outside by the `live-site-probe` workflow (run by hand;
   `workflow_dispatch` only): the AI sandbox cannot reach the site. The Cloudflare connector's
   `webdocsol` `modified_on` is not proof on its own: a branch build moves it too (`AGENTS.md`,
   "How a change ships").
8. Institutional honesty: no court has adopted, endorsed, accepted, validated, recognised or
   ruled on the merits of Verum Omnis, its engine or its methodology; write it that way
   (`AGENTS.md`, "How the Constitution's standing may be described"). A seal is tamper-evident,
   never immutable, and the VO-SEAL2 check alone cannot show that a copy was not altered and
   re-sealed with its own hash (open with the founder, `ENGINE.md` §12.14 (a)). An
   OpenTimestamps anchor proves the hash existed no later than the confirming Bitcoin block.
   The Constitution's own text is quoted as it stands, never edited.
