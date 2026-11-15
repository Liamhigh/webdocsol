# Findings extension contract proposal

These files are **synthetic, redistributable test fixtures**, not an authoritative schema and not production findings. The authoritative cross-client schema remains outside this repository, as documented in `ARCHITECTURE.md`.

`findings-extension-proposal.json` proposes an optional namespaced `analysis_extensions` object for deterministic module envelopes. It does not approve a version after findings JSON 1.11.0. Production `buildFindingsJson` remains unchanged until `1verum`, `firebase`, and relevant Android reference-client behavior have been reviewed together.

The versioned fixtures cover:

- exact PDF text with UTF-16 code-unit offsets, including a surrogate pair and combining character;
- a non-text structural observation with byte, object, revision, and operator anchors;
- OCR text with optional geometry absent;
- a two-anchor finding with an explicit incompatibility explanation.

`tests/analysis-contracts.test.mjs` also exercises old-producer/new-reader, new-producer/old-reader, unknown-extension preservation, duplicate retention, stable ordering, fresh-process replay, and time-zone independence. No fixture contains evidence from a real matter.

Unknown extensions must not make an older reader reject the base package. A writer that round-trips a package must preserve extension names and values. These compatibility rules are proposed test behavior, not a claim that the external clients have already approved them.
