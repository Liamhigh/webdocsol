# GitHub Copilot repository instructions

## Read these first

1. [`AGENTS.md`](../AGENTS.md) — binding repository orientation, architecture and safety rules.
2. [`ENHANCEMENT-IMPLEMENTATION-PLAN.md`](../ENHANCEMENT-IMPLEMENTATION-PLAN.md) — the complete forensic enhancement design, work packages and acceptance gates.
3. [`ENHANCEMENT-PLAN.md`](../ENHANCEMENT-PLAN.md) — the living implementation status. Check current source and PR state as well; never infer that a designed option has shipped.
4. [`LEGAL-VALIDATION.md`](../LEGAL-VALIDATION.md) — binding court-record, public-access and legal-status wording.
5. For engine or report changes, [`ENGINE.md`](../ENGINE.md) is the detector and false-positive-guard reference.

## Current planning baseline

The detailed plan reviews commit `48836bc7c2f245b00e181d66b539c199d6fcaf2d`: engine `5.7.2-web`, production Findings JSON `1.11.0`, exactly nine analytical brains and eight default-off enhancement flags. Only `citations` and the bounded `pdfGraph` active-graph prototype are listed as implemented. Redaction has synthetic fixtures only. Revisions, Allen temporal algebra, image metadata, C2PA and spatial OCR are not implemented here. Signed authority packs and the ECTA note remain externally blocked.

The extension contract is proposal `0.1.0`, not production-approved, with no assigned next production version. Do not assume Findings JSON `1.12.0` or enable a flag merely because the plan describes it.

## Implementation discipline

- Implement one independently flag-gated slice at a time after reading the detailed plan’s shared gates and the relevant acceptance matrix. Do not create a monolithic enhancement rewrite or a tenth brain.
- Keep new modules default-off and observations-only until separately reviewed. Do not allocate contradiction types, alter report language or change Findings JSON without an approved taxonomy/schema change.
- Preserve deterministic findings, UTF-16 offsets, complete evidence anchors, stable IDs and ordering. No wall clock, randomness, locale-dependent canonical result, neural/top-k corpus prefilter, hidden network state or telemetry in pure analysis.
- Advisory AI may explain or recommend; it must never create, remove, truncate, reorder, suppress or overrule sealed deterministic findings. Evaluation output is not a sealed finding or production confidence score.
- Never rewrite original evidence bytes with QPDF, OCR, metadata or C2PA tooling. Active-graph inspection is not revision history. Rollback changes future behaviour only and never rewrites historical seals.
- Use the existing classic-script/namespaced-IIFE browser style and CommonJS test exports. No regex lookbehind in new production parsers. Register new production JavaScript with `npm run check` and new Node suites in `tests/run-all.js`.
- Edit root production sources, then re-splice inlined copies byte-for-byte. Do not treat obsolete `seal-module/web/` snapshots as live sources.
- Run `node tests/run-all.js`, `npm run check` and `git diff --check`, plus focused positive, negative, malformed, unsupported, replay, resource-limit and rollback tests for the slice.
- Never commit secrets or real-matter documents. Keep confidential narrative, personal court-document details and real evidence out of public fixtures, tests, issues and examples.
- Opening or pushing a branch is not deployment. Merge to `main` deploys through Cloudflare Workers Builds; do not merge or deploy unless the user explicitly authorises that separate action.

## Court and legal language

Filing is not admission or validation. Receipt is not adjudication. A procedural order is not a merits ruling. Non-exclusion without an admissibility challenge is not an admissibility judgment. A favourable party outcome is not judicial endorsement of a forensic platform.

The supplied Court Online copy supports a High Court filing of Constitution v8.0 as Annexure 02 in case 2026-179949 on 21 August 2026. In Port Shepstone H208/25, a Verum Omnis-prepared case file was submitted as part of the respondent’s evidence and the judgment records that he relied on his opposing affidavit; the supplied narrative reports that it was not excluded, struck out or challenged on admissibility. This supports practical evidentiary use, not a separate admissibility or scientific-reliability ruling. The application was dismissed and the interim order discharged; paragraph 18’s “good faith” wording belongs to the respondent’s affidavit, not the Court. Constitutional Court filing and procedural history must not be described as adoption of the sealed record or methodology. See `LEGAL-VALIDATION.md` for source and registry-verification limits.

Never write that a court adopted, endorsed, validated, accredited or ruled on the merits of Verum Omnis, or that the platform is “court-recognised” or “judicially validated”. Constitution v8.0 is a private governance instrument, not legislation or binding jurisdiction over courts, governments or unrelated AI systems. “Court of record” and “public record” do not certify every filed assertion or guarantee unrestricted online access.

A seal is tamper-evident, never immutable. Hashes and timestamps do not establish authorship, truth, admissibility or judicial acceptance.
