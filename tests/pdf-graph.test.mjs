import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getQpdfWasmMemoryLimits,
  limitQpdfWasmMemory,
  QPDF_WASM_MAX_MEMORY_PAGES
} from '../scripts/limit-qpdf-wasm-memory.mjs';

const require = createRequire(import.meta.url);
const { ok, throws, done } = require('./_assert.js');
const Contracts = require('../analysis-contracts.js');
const Config = require('../analysis-config.js');
const Graph = require('../pdf-graph.js');
const Engine = require('../forensic-engine-page.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('======================================================');
console.log('RUN  pdf-graph.test.mjs');
console.log('======================================================\n');

const qpdfJson = {
  version: 2,
  pages: [{}],
  private_metadata: { title: 'must not escape the worker' },
  qpdf: [
    { jsonversion: 2, pdfversion: '1.7' },
    {
      'obj:1 0 R': { value: { '/Type': '/Catalog', '/Pages': '2 0 R' } },
      'obj:2 0 R': { value: { '/Type': '/Pages', '/Kids': ['3 0 R'] } },
      'obj:3 0 R': { value: { '/Type': '/Page', '/Contents': '4 0 R', '/Resources': { '/Font': '5 0 R' } } },
      'obj:4 0 R': { stream: { dict: { '/Length': 12 } } },
      'obj:5 0 R': { value: { '/Type': '/Font', '/BaseFont': '/Helvetica' } },
      trailer: { value: { '/Root': '1 0 R' } }
    }
  ]
};

const summary = Graph.summarizeQpdfJson(qpdfJson);
ok(summary.pdf_version === '1.7' && summary.page_count === 1, 'active graph summary carries only bounded PDF version and page count');
ok(summary.object_count === 5 && summary.reference_count === 4, 'active graph counts objects and references, excluding the trailer');
ok(summary.objects_by_type.some((entry) => entry.type === 'untyped' && entry.count === 1),
  'stream objects without a PDF type use the stable untyped bucket');
ok(!Contracts.stableStringify(summary).includes('must not escape'), 'graph summary never returns source metadata');
ok(throws(() => Graph.summarizeQpdfJson({ ...qpdfJson, qpdf: [{ jsonversion: 1 }, qpdfJson.qpdf[1]] })),
  'unsupported QPDF JSON versions fail closed');

const tooManyObjects = {};
for (let index = 1; index <= Graph.LIMITS.objects + 1; index++) {
  tooManyObjects[`obj:${index} 0 R`] = { value: {} };
}
let objectLimit = false;
try {
  Graph.summarizeQpdfJson({ pages: [], qpdf: [{ jsonversion: 2 }, tooManyObjects] });
} catch (error) {
  objectLimit = error.code === 'pdf_graph_object_limit';
}
ok(objectLimit, 'object counts beyond the configured cap return a budget error');

let referenceLimit = false;
try {
  Graph.summarizeQpdfJson({
    pages: [],
    qpdf: [{ jsonversion: 2 }, {
      'obj:1 0 R': { value: { '/Refs': new Array(Graph.LIMITS.references + 1).fill('1 0 R') } }
    }]
  });
} catch (error) {
  referenceLimit = error.code === 'pdf_graph_reference_limit';
}
ok(referenceLimit, 'reference counts beyond the configured cap return a budget error');

let valueLimit = false;
try {
  Graph.summarizeQpdfJson({
    pages: [],
    qpdf: [{ jsonversion: 2 }, {
      'obj:1 0 R': { value: { '/Values': new Array(Graph.LIMITS.graph_values + 1).fill(null) } }
    }]
  });
} catch (error) {
  valueLimit = error.code === 'pdf_graph_value_limit';
}
ok(valueLimit, 'nested graph values beyond the traversal cap return a budget error');

const upstreamWasm = readFileSync(require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'));
const vendorWasm = readFileSync(path.join(root, 'vendor/qpdf-wasm/qpdf.wasm'));
const packageJs = readFileSync(require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.js'));
const vendorJs = readFileSync(path.join(root, 'vendor/qpdf-wasm/qpdf.js'));
const limitedWasm = limitQpdfWasmMemory(upstreamWasm);
ok(Buffer.compare(vendorWasm, Buffer.from(limitedWasm)) === 0, 'vendored Wasm is reproducibly memory-capped from pinned qpdf-wasm 0.3.1');
ok(Buffer.compare(vendorJs, packageJs) === 0, 'vendored QPDF loader matches the pinned npm package');
const memoryLimits = getQpdfWasmMemoryLimits(vendorWasm);
ok(memoryLimits.minimumPages === 263 && memoryLimits.maximumPages === QPDF_WASM_MAX_MEMORY_PAGES,
  'QPDF-WASM linear memory has a hard 256 MiB maximum');

const fixture = new Uint8Array(readFileSync(path.join(root, 'forensic_test_document.pdf')));
const qpdfFactory = require(path.join(root, 'vendor/qpdf-wasm/qpdf.js'));
const stdoutChunks = [];
const originalStdoutWrite = process.stdout.write;
process.stdout.write = function (chunk) {
  stdoutChunks.push(Buffer.from(chunk));
  return true;
};
let qpdfExitCode;
try {
  const qpdf = await qpdfFactory({
    locateFile: () => path.join(root, 'vendor/qpdf-wasm/qpdf.wasm')
  });
  qpdf.FS.writeFile('/input.pdf', fixture);
  qpdfExitCode = qpdf.callMain(['--json', '--json-stream-data=none', '/input.pdf']);
} finally {
  process.stdout.write = originalStdoutWrite;
}
const capturedJson = Buffer.concat(stdoutChunks).toString('utf8');
const realSummary = Graph.summarizeQpdfJson(JSON.parse(capturedJson));
ok(qpdfExitCode === 0 && Buffer.byteLength(capturedJson) <= Graph.LIMITS.output_bytes,
  'pinned QPDF-WASM parses within the output cap with stream data omitted');
ok(realSummary.page_count === 10 && realSummary.object_count === 26,
  'real QPDF-WASM output yields the fixture active-graph summary');

const previous = {
  extractPdfText: globalThis.extractPdfText,
  location: globalThis.location,
  Worker: globalThis.Worker
};
const fakeSummary = {
  kind: 'active_graph_summary',
  pdf_version: '1.4',
  page_count: 1,
  object_count: 1,
  reference_count: 0,
  objects_by_type: [{ type: 'Catalog', count: 1 }]
};
let workerCount = 0;
let workerTerminated = false;
class FakeWorker {
  constructor(url) {
    workerCount++;
    ok(String(url).includes('pdf-graph-worker.js'), 'enabled analysis targets the same-origin QPDF worker');
  }
  postMessage(message, transfer) {
    ok(message.type === 'scan' && message.bytes instanceof ArrayBuffer && transfer.length === 1,
      'PDF bytes are copied into a transferable worker buffer');
    queueMicrotask(() => this.onmessage({ data: { status: 'completed', summary: fakeSummary } }));
  }
  terminate() { workerTerminated = true; }
}
globalThis.extractPdfText = async () => ['Synthetic agreement. A total of R100.00 was recorded.'];
globalThis.location = { href: 'https://example.test/seal-document.html' };
globalThis.Worker = FakeWorker;
try {
  const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
  const pdfDoc = { getPages() { throw new Error('synthetic raw-text fallback'); } };
  let digestCount = 0;
  const subtle = globalThis.crypto.subtle;
  const originalDigest = subtle.digest;
  subtle.digest = function () {
    digestCount++;
    return originalDigest.apply(this, arguments);
  };
  let oversized;
  try {
    oversized = await Graph.run(new Uint8Array(Graph.LIMITS.input_bytes + 1));
  } finally {
    subtle.digest = originalDigest;
  }
  ok(oversized.status === 'budget_exceeded' && oversized.failure.code === 'pdf_graph_input_limit',
    'input beyond the byte cap returns the input-limit budget failure');
  ok(digestCount === 0 && workerCount === 0,
    'input beyond the byte cap is rejected before digesting or creating a worker');
  ok(Contracts.validateModuleEnvelope(oversized).valid &&
     oversized.coverage.units_total === 1 && oversized.coverage.units_processed === 0 &&
     oversized.coverage.units_failed.length === 1 && oversized.coverage.units_failed[0] === 'active_graph',
    'pre-analysis input-limit rejection has valid failed-unit coverage');
  ok(oversized.input_sha512 === '0'.repeat(128) &&
     oversized.failure.details.input_identity === 'not_computed_input_over_limit' &&
     oversized.failure.details.input_bytes === Graph.LIMITS.input_bytes + 1,
    'pre-analysis input-limit rejection identifies the non-digest sentinel and exact byte count');
  const off = await Engine.runForensicEngine(pdfBytes, pdfDoc, null, {});
  ok(!('moduleResults' in off) && workerCount === 0, 'default-off configuration does not start the QPDF worker');
  const on = await Engine.runForensicEngine(pdfBytes, pdfDoc, null, { modules: { pdfGraph: true } });
  const envelope = on.moduleResults && on.moduleResults.pdfGraph;
  ok(envelope && Contracts.validateModuleEnvelope(envelope).valid && envelope.status === 'completed',
    'explicit opt-in returns a valid active-graph module envelope');
  ok(envelope.input_sha512 === require('node:crypto').createHash('sha512').update(pdfBytes).digest('hex'),
    'in-bounds active-graph envelopes retain the actual input SHA-512');
  ok(envelope.findings.length === 0 && envelope.observations[0].kind === 'active_graph_summary',
    'the QPDF adapter returns observations only and never findings');
  ok(Contracts.stableStringify(off.findings) === Contracts.stableStringify(on.findings),
    'enabling active-graph analysis does not alter detector findings');
  ok(workerCount === 1 && workerTerminated, 'the disposable worker is terminated after returning the summary');

  class ErrorWorker {
    constructor() {}
    postMessage() { queueMicrotask(() => this.onerror(new Error('worker failure'))); }
    terminate() { workerTerminated = true; }
  }
  const failed = await Graph.run(pdfBytes, { Worker: ErrorWorker });
  ok(failed.status === 'failed' && failed.failure.code === 'pdf_graph_worker_error',
    'worker failures are returned as explicit failed module envelopes');

  const originalSetTimeout = globalThis.setTimeout;
  class StalledWorker {
    constructor() {}
    postMessage() {}
    terminate() { workerTerminated = true; }
  }
  globalThis.setTimeout = (callback) => originalSetTimeout(callback, 0);
  try {
    const timedOut = await Graph.run(pdfBytes, { Worker: StalledWorker });
    ok(timedOut.status === 'budget_exceeded' && timedOut.failure.code === 'pdf_graph_timeout',
      'the worker deadline returns an explicit budget-exceeded envelope');
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
} finally {
  if (typeof previous.extractPdfText === 'undefined') delete globalThis.extractPdfText;
  else globalThis.extractPdfText = previous.extractPdfText;
  if (typeof previous.location === 'undefined') delete globalThis.location;
  else globalThis.location = previous.location;
  if (typeof previous.Worker === 'undefined') delete globalThis.Worker;
  else globalThis.Worker = previous.Worker;
}

ok(Config.DEFAULT_MODULES.pdfGraph === false && Config.IMPLEMENTED_MODULES.pdfGraph === true,
  'active-graph capability is implemented but remains explicitly off by default');
done('pdf-graph');
