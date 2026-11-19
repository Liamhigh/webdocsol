/*
 * Bounded, opt-in summary of the active PDF object graph. The raw QPDF JSON
 * remains inside a disposable worker; this module exposes counts only.
 */
(function (root) {
  'use strict';

  var Contracts = root && root.VOAnalysisContracts
    ? root.VOAnalysisContracts
    : (typeof require === 'function' ? require('./analysis-contracts.js') : null);
  if (!Contracts) throw new Error('pdf-graph.js requires analysis-contracts.js to load first');

  var MODULE_ID = 'pdf-active-graph';
  var MODULE_VERSION = '0.1.0';
  var QPDF_WASM_VERSION = '0.3.1';
  var NOT_COMPUTED_INPUT_SHA512 = '0'.repeat(128);
  var LIMITS = Object.freeze({
    input_bytes: 8 * 1024 * 1024,
    output_bytes: 2 * 1024 * 1024,
    objects: 20000,
    graph_values: 250000,
    references: 50000,
    type_buckets: 64,
    worker_timeout_ms: 15000,
    wasm_memory_bytes: 256 * 1024 * 1024
  });
  var WARNING = Object.freeze({
    code: 'active_graph_only',
    message: 'This describes the active PDF object graph; incremental revision history is not analyzed.'
  });
  var FAILURE_MESSAGES = Object.freeze({
    pdf_graph_input_limit: 'The PDF exceeds the active-graph input limit.',
    pdf_graph_output_limit: 'The active-graph JSON exceeded its output limit.',
    pdf_graph_object_limit: 'The active graph exceeded its object limit.',
    pdf_graph_value_limit: 'The active graph exceeded its traversal limit.',
    pdf_graph_reference_limit: 'The active graph exceeded its reference limit.',
    pdf_graph_timeout: 'Active-graph analysis exceeded its time limit.',
    pdf_graph_worker_unavailable: 'A Web Worker is required for active-graph analysis.',
    pdf_graph_worker_error: 'The active-graph worker failed.',
    pdf_graph_qpdf_error: 'QPDF could not parse this PDF.',
    pdf_graph_invalid_output: 'QPDF returned an unsupported active-graph representation.'
  });
  var IMPLEMENTATION_DIGEST = Contracts.sha512Hex(Contracts.stableStringify({
    module: MODULE_ID,
    version: MODULE_VERSION,
    qpdf_wasm: QPDF_WASM_VERSION,
    limits: LIMITS
  }));
  var REFERENCE_RE = /^\d+ \d+ R$/;
  var PDF_NAME_RE = /^\/?([A-Za-z0-9._+-]{1,48})$/;

  function toBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    throw new TypeError('PDF graph input must be PDF bytes');
  }

  async function inputDigest(bytes) {
    var cryptoApi = root && root.crypto;
    if (cryptoApi && cryptoApi.subtle) {
      var digest = await cryptoApi.subtle.digest('SHA-512', bytes);
      return Array.prototype.map.call(new Uint8Array(digest), function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    }
    if (typeof require === 'function') {
      return require('node:crypto').createHash('sha512').update(bytes).digest('hex');
    }
    throw new Error('SHA-512 is unavailable for active-graph input identity');
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function budgetError(code) {
    var error = new Error(code);
    error.code = code;
    return error;
  }

  function summarizeQpdfJson(json) {
    if (!isPlainRecord(json) || !Array.isArray(json.qpdf) || json.qpdf.length !== 2 ||
        !isPlainRecord(json.qpdf[0]) || json.qpdf[0].jsonversion !== 2 ||
        !isPlainRecord(json.qpdf[1]) || !Array.isArray(json.pages)) {
      throw budgetError('pdf_graph_invalid_output');
    }
    var metadata = json.qpdf[0];
    var objectTable = json.qpdf[1];
    var allObjectKeys = Object.keys(objectTable);
    for (var tableIndex = 0; tableIndex < allObjectKeys.length; tableIndex++) {
      if (allObjectKeys[tableIndex] !== 'trailer' && !/^obj:\d+ \d+ R$/.test(allObjectKeys[tableIndex])) {
        throw budgetError('pdf_graph_invalid_output');
      }
    }
    var objectKeys = allObjectKeys.filter(function (key) { return key !== 'trailer'; }).sort();
    if (objectKeys.length > LIMITS.objects || json.pages.length > LIMITS.objects) {
      throw budgetError('pdf_graph_object_limit');
    }
    var typeCounts = Object.create(null);
    var referenceCount = 0;
    var visited = 0;
    for (var objectIndex = 0; objectIndex < objectKeys.length; objectIndex++) {
      var object = objectTable[objectKeys[objectIndex]];
      if (!isPlainRecord(object)) throw budgetError('pdf_graph_invalid_output');
      var dictionary = isPlainRecord(object.value) ? object.value :
        (isPlainRecord(object.stream) && isPlainRecord(object.stream.dict) ? object.stream.dict : {});
      var typeValue = typeof dictionary['/Type'] === 'string' ? dictionary['/Type'] : dictionary['/Subtype'];
      var typeMatch = typeof typeValue === 'string' ? PDF_NAME_RE.exec(typeValue) : null;
      var typeName = typeMatch ? typeMatch[1] : 'untyped';
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
      var stack = [dictionary];
      while (stack.length) {
        var value = stack.pop();
        visited++;
        if (visited > LIMITS.graph_values) throw budgetError('pdf_graph_value_limit');
        if (typeof value === 'string') {
          if (REFERENCE_RE.test(value)) {
            referenceCount++;
            if (referenceCount > LIMITS.references) throw budgetError('pdf_graph_reference_limit');
          }
        } else if (Array.isArray(value)) {
          for (var arrayIndex = value.length - 1; arrayIndex >= 0; arrayIndex--) stack.push(value[arrayIndex]);
        } else if (isPlainRecord(value)) {
          var keys = Object.keys(value);
          for (var keyIndex = keys.length - 1; keyIndex >= 0; keyIndex--) stack.push(value[keys[keyIndex]]);
        }
      }
    }
    var types = Object.keys(typeCounts).sort();
    if (types.length > LIMITS.type_buckets) throw budgetError('pdf_graph_object_limit');
    var pdfVersion = typeof metadata.pdfversion === 'string' && /^\d{1,2}\.\d{1,2}$/.test(metadata.pdfversion)
      ? metadata.pdfversion
      : null;
    return Object.freeze({
      kind: 'active_graph_summary',
      pdf_version: pdfVersion,
      page_count: json.pages.length,
      object_count: objectKeys.length,
      reference_count: referenceCount,
      objects_by_type: Object.freeze(types.map(function (type) {
        return Object.freeze({ type: type, count: typeCounts[type] });
      }))
    });
  }

  function makeEnvelope(inputHash, status, result) {
    var completed = status === 'completed';
    var failure = result && result.failure
      ? Contracts.createFailure(result.failure.code, FAILURE_MESSAGES[result.failure.code] || FAILURE_MESSAGES.pdf_graph_worker_error,
        result.failure.details)
      : null;
    if (!completed && status !== 'budget_exceeded') status = 'failed';
    if (!completed && !failure) {
      failure = Contracts.createFailure('pdf_graph_worker_error', FAILURE_MESSAGES.pdf_graph_worker_error);
    }
    return Contracts.createModuleEnvelope({
      module_id: MODULE_ID,
      module_version: MODULE_VERSION,
      implementation_digest: IMPLEMENTATION_DIGEST,
      status: status,
      input_sha512: inputHash,
      reference_time: null,
      configuration: LIMITS,
      dependencies: [{ name: '@neslinesli93/qpdf-wasm', version: QPDF_WASM_VERSION }],
      coverage: {
        units_total: 1,
        units_processed: completed ? 1 : 0,
        units_skipped: [],
        units_failed: completed ? [] : ['active_graph']
      },
      observations: completed ? [result.summary] : [],
      findings: [],
      warnings: [WARNING],
      failure: failure
    });
  }

  function validateSummary(summary) {
    if (!isPlainRecord(summary) || summary.kind !== 'active_graph_summary' ||
        !(summary.pdf_version === null || (typeof summary.pdf_version === 'string' && /^\d{1,2}\.\d{1,2}$/.test(summary.pdf_version))) ||
        !Number.isSafeInteger(summary.page_count) || summary.page_count < 0 ||
        !Number.isSafeInteger(summary.object_count) || summary.object_count < 0 || summary.object_count > LIMITS.objects ||
        !Number.isSafeInteger(summary.reference_count) || summary.reference_count < 0 || summary.reference_count > LIMITS.references ||
        !Array.isArray(summary.objects_by_type) || summary.objects_by_type.length > LIMITS.type_buckets) return false;
    var previous = '';
    var typeTotal = 0;
    for (var index = 0; index < summary.objects_by_type.length; index++) {
      var entry = summary.objects_by_type[index];
      if (!isPlainRecord(entry) || typeof entry.type !== 'string' || !/^[A-Za-z0-9._+-]{1,48}$/.test(entry.type) ||
          entry.type <= previous || !Number.isSafeInteger(entry.count) || entry.count < 1) return false;
      previous = entry.type;
      typeTotal += entry.count;
    }
    return typeTotal === summary.object_count;
  }

  async function run(input, options) {
    options = options || {};
    var bytes = toBytes(input);
    if (bytes.byteLength > LIMITS.input_bytes) {
      return makeEnvelope(NOT_COMPUTED_INPUT_SHA512, 'budget_exceeded', {
        failure: {
          code: 'pdf_graph_input_limit',
          details: {
            input_identity: 'not_computed_input_over_limit',
            input_bytes: bytes.byteLength
          }
        }
      });
    }
    var inputHash = await inputDigest(bytes);
    var WorkerCtor = options.Worker || (root && root.Worker);
    if (typeof WorkerCtor !== 'function' || !root || !root.location || typeof root.location.href !== 'string') {
      return makeEnvelope(inputHash, 'failed', {
        failure: { code: 'pdf_graph_worker_unavailable' }
      });
    }
    return new Promise(function (resolve) {
      var worker = null;
      var timeout = null;
      var settled = false;
      function finish(status, result) {
        if (settled) return;
        settled = true;
        if (timeout !== null) root.clearTimeout(timeout);
        if (worker) worker.terminate();
        if (status === 'completed' && validateSummary(result && result.summary)) {
          resolve(makeEnvelope(inputHash, status, result));
        } else if (status === 'budget_exceeded') {
          resolve(makeEnvelope(inputHash, status, result));
        } else {
          resolve(makeEnvelope(inputHash, 'failed', {
            failure: { code: status === 'completed' ? 'pdf_graph_invalid_output' :
              (result && result.failure && result.failure.code) }
          }));
        }
      }
      try {
        var workerUrl = new URL('pdf-graph-worker.js', root.location.href);
        worker = new WorkerCtor(workerUrl, { name: 'vo-pdf-active-graph' });
        worker.onmessage = function (event) {
          var data = event && event.data;
          if (!isPlainRecord(data)) {
            finish('failed', null);
          } else {
            finish(data.status, data);
          }
        };
        worker.onerror = function () {
          finish('failed', { failure: { code: 'pdf_graph_worker_error' } });
        };
        worker.onmessageerror = function () {
          finish('failed', { failure: { code: 'pdf_graph_worker_error' } });
        };
        timeout = root.setTimeout(function () {
          finish('budget_exceeded', { failure: { code: 'pdf_graph_timeout' } });
        }, LIMITS.worker_timeout_ms);
        var transferable = new Uint8Array(bytes);
        worker.postMessage({ type: 'scan', bytes: transferable.buffer }, [transferable.buffer]);
      } catch (_error) {
        finish('failed', { failure: { code: 'pdf_graph_worker_error' } });
      }
    });
  }

  var api = {
    MODULE_ID: MODULE_ID,
    MODULE_VERSION: MODULE_VERSION,
    LIMITS: LIMITS,
    isKnownFailureCode: function (code) {
      return Object.prototype.hasOwnProperty.call(FAILURE_MESSAGES, code);
    },
    summarizeQpdfJson: summarizeQpdfJson,
    run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VOPdfGraph = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
