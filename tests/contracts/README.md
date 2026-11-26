# Findings extension contract proposal

These files are **synthetic, redistributable test fixtures**, not an authoritative schema and not production findings. The authoritative cross-client schema remains outside this repository, as documented in `ARCHITECTURE.md`.

`findings-extension-proposal.json` proposes an optional namespaced `analysis_extensions` object; it remains draft v0.1.0 and is not production-schema approval. The owner-directed verifier-adjudication correction keeps production Findings JSON at v1.11.0, adds no fields to finding records, and carries verifier provenance only in the printed report and the optional draft `analysis_extensions` object. The shared Findings JSON schema in `1verum` and `firebase` has not been changed in this repository; cross-client schema validation and compatibility remain a coordinated follow-up.

The versioned fixtures cover:

- exact PDF text with UTF-16 code-unit offsets, including a surrogate pair and combining character;
- a non-text structural observation with byte, object, revision, and operator anchors;
- OCR text with optional geometry absent;
- a two-anchor finding with an explicit incompatibility explanation and both complete source pages.

Text anchors validate only against the complete source page text: the exact quote, UTF-16 offsets, and complete preceding and following context must all match. Pair findings require both complete source page texts and two distinct source locations; altered extraction or context metadata cannot make one location count as both sides of a contradiction.

`tests/analysis-contracts.test.mjs` also exercises old-producer/new-reader, new-producer/old-reader, unknown-extension preservation, duplicate retention, stable ordering, fresh-process replay, and time-zone independence. No fixture contains evidence from a real matter.

Unknown extensions must not make an older reader reject the base package. A writer that round-trips a package must preserve extension names and values. These compatibility rules are proposed test behavior, not a claim that the external clients have already approved them.
