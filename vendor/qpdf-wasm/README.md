# QPDF-WASM browser assets

These assets are pinned to `@neslinesli93/qpdf-wasm` 0.3.1. The npm package
provides QPDF 12.2.0 compiled for WebAssembly. `LICENSE` covers the wrapper;
`QPDF-LICENSE.txt` covers QPDF under Apache-2.0.

`qpdf.wasm` is modified from the published binary by
`scripts/limit-qpdf-wasm-memory.mjs`: the maximum linear memory is reduced from
32,768 to 4,096 64-KiB pages (256 MiB). The test suite verifies that the
vendored file is exactly reproducible from the pinned package plus this
transformation.

The 1.33-MB WebAssembly asset is fetched only by `pdf-graph-worker.js` after a
caller explicitly enables `modules.pdfGraph`. The worker omits stream data,
caps input/output/graph traversal and is terminated after 15 seconds. The
adapter returns only counts and PDF version; it does not return object values,
metadata, or findings. It describes the active graph only, not incremental
revision history.

After updating the package, review its license and build provenance, recopy
`qpdf.js` and `LICENSE`, regenerate `qpdf.wasm` with the memory-cap script, and
rerun `npm run test:pdf-graph`.
