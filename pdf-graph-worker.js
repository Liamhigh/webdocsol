(function () {
  'use strict';

  var outputLines = [];
  var outputBytes = 0;
  var captureOutput = false;
  var outputLimitExceeded = false;
  var stderrSeen = false;
  var workerConsoleLog = console.log;
  var workerConsoleError = console.error;

  importScripts(
    new URL('analysis-contracts.js', self.location.href).href,
    new URL('pdf-graph.js', self.location.href).href
  );

  function sendFailure(status, code) {
    self.postMessage({ status: status, failure: { code: code } });
  }

  function captureLine(args) {
    if (!captureOutput) return;
    var line = Array.prototype.map.call(args, String).join(' ');
    var bytes = new TextEncoder().encode(line).byteLength + 1;
    if (outputBytes + bytes > self.VOPdfGraph.LIMITS.output_bytes) {
      outputLimitExceeded = true;
      throw new Error('pdf_graph_output_limit');
    }
    outputBytes += bytes;
    outputLines.push(line);
  }

  self.addEventListener('message', async function (event) {
    var data = event && event.data;
    if (!data || data.type !== 'scan' || !(data.bytes instanceof ArrayBuffer)) {
      sendFailure('failed', 'pdf_graph_worker_error');
      return;
    }
    var bytes = new Uint8Array(data.bytes);
    if (bytes.byteLength > self.VOPdfGraph.LIMITS.input_bytes) {
      sendFailure('budget_exceeded', 'pdf_graph_input_limit');
      return;
    }
    console.log = function () { captureLine(arguments); };
    console.error = function () { if (captureOutput) stderrSeen = true; };
    try {
      var assetBase = new URL('vendor/qpdf-wasm/', self.location.href);
      importScripts(new URL('qpdf.js', assetBase).href);
      var qpdfFactory = self.Module;
      if (typeof qpdfFactory !== 'function') throw new Error('qpdf wasm factory is unavailable');
      var qpdf = await qpdfFactory({
        locateFile: function () { return new URL('qpdf.wasm', assetBase).href; }
      });
      qpdf.FS.writeFile('/input.pdf', bytes);
      captureOutput = true;
      var exitCode = qpdf.callMain(['--json', '--json-stream-data=none', '/input.pdf']);
      captureOutput = false;
      if (outputLimitExceeded) {
        sendFailure('budget_exceeded', 'pdf_graph_output_limit');
        return;
      }
      if (exitCode !== 0 || stderrSeen) {
        sendFailure('failed', 'pdf_graph_qpdf_error');
        return;
      }
      var json = JSON.parse(outputLines.join('\n'));
      var summary = self.VOPdfGraph.summarizeQpdfJson(json);
      self.postMessage({ status: 'completed', summary: summary });
    } catch (error) {
      var code = outputLimitExceeded || (error && error.message === 'pdf_graph_output_limit')
        ? 'pdf_graph_output_limit'
        : (error && self.VOPdfGraph.isKnownFailureCode(error.code) ? error.code :
          (error && error.code ? error.code : 'pdf_graph_qpdf_error'));
      var status = code.indexOf('limit') !== -1 ? 'budget_exceeded' : 'failed';
      sendFailure(status, code);
    } finally {
      captureOutput = false;
      console.log = workerConsoleLog;
      console.error = workerConsoleError;
    }
  });
})();
