/*!
 * Verum Omnis Seal Guard (VO-SG) — the enforced exit.
 *
 * Invariant:
 *   "The only genuine Verum output is a sealed output.
 *    No seal = Verum Omnis never issued it."
 *
 * Every PDF that LEAVES the system — a download link, a Web Share payload, an
 * email attachment — must carry a Verum seal marker. This module refuses to
 * release an unsealed PDF, closing the gap where build() and seal() are
 * separate calls, or a seal fallback silently produced an unmarked file. It is
 * the single sanctioned exit; route deliveries through it.
 *
 * Detection is byte-identical to the verify.html scanner: it recognises the
 * seal Subject in both plain-ASCII Info dicts and pdf-lib's UTF-16BE-hex form,
 * across the VO-SEAL2 (self-verifying original), VO-SEAL (legacy) and SEAL-CERT
 * (detached certificate) schemes.
 *
 * Note on encryption: an AES-encrypted sealed PDF is still a sealed document —
 * its plaintext was sealed before encryption, but the marker is (correctly) no
 * longer readable in the ciphertext. Guard the PLAINTEXT sealed bytes at the
 * point of sealing; never run isSealed() against ciphertext.
 *
 * Browser + Node (CommonJS). Zero dependencies.
 */
(function (global) {
  'use strict';

  // UTF-16BE hex, 4-digit uppercase — matches how pdf-lib stores Info-dict
  // strings and how the verify page scans for them (see voUtf16Hex there).
  function utf16Hex(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var h = str.charCodeAt(i).toString(16).toUpperCase();
      while (h.length < 4) h = '0' + h;
      out += h;
    }
    return out;
  }

  // Build a scannable latin1 string from raw bytes without a call-stack blowout
  // on large files (String.fromCharCode.apply has an argument-count ceiling).
  function bytesToStr(bytes) {
    if (typeof bytes === 'string') return bytes;
    var CHUNK = 0x8000, parts = [];
    for (var i = 0; i < bytes.length; i += CHUNK) {
      var slice = bytes.subarray ? bytes.subarray(i, i + CHUNK) : bytes.slice(i, i + CHUNK);
      parts.push(String.fromCharCode.apply(null, slice));
    }
    return parts.join('');
  }

  // Seal Subject prefixes that constitute a genuine Verum seal.
  var SEAL_SCHEMES = ['VO-SEAL2|', 'VO-SEAL|', 'SEAL-CERT|'];

  /**
   * True iff the bytes/string carry a recognised Verum seal marker.
   * @param {Uint8Array|string} bytesOrStr
   * @returns {boolean}
   */
  function isSealed(bytesOrStr) {
    if (!bytesOrStr || !bytesOrStr.length) return false;
    var text = bytesToStr(bytesOrStr);
    var upper = text.toUpperCase();
    for (var i = 0; i < SEAL_SCHEMES.length; i++) {
      var prefix = SEAL_SCHEMES[i];
      // plain-ASCII Info dict, e.g. "/Subject (VO-SEAL2|<hash>|VO-XXXX)"
      if (text.indexOf(prefix) !== -1) return true;
      // pdf-lib UTF-16BE-hex Info dict (hex may be written upper- or lower-case)
      if (upper.indexOf(utf16Hex(prefix)) !== -1) return true;
    }
    return false;
  }

  /**
   * True iff the bytes look like a PDF ("%PDF-" magic).
   * @param {Uint8Array|string} bytes
   * @returns {boolean}
   */
  function isPdf(bytes) {
    if (!bytes) return false;
    if (typeof bytes === 'string') return bytes.indexOf('%PDF-') === 0;
    return bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
      bytes[3] === 0x46 && bytes[4] === 0x2D;
  }

  /**
   * Throw unless the bytes are a sealed Verum PDF. Returns true on success.
   * @param {Uint8Array|string} bytes
   * @param {string} [context] label included in the error for diagnostics
   */
  function assertSealed(bytes, context) {
    if (!isSealed(bytes)) {
      var err = new Error(
        'VerumSealGuard: refusing to release an UNSEALED document' +
        (context ? ' [' + context + ']' : '') +
        '. No seal = Verum Omnis never issued it.');
      err.code = 'VO_UNSEALED';
      throw err;
    }
    return true;
  }

  /**
   * The single sanctioned exit for browser delivery. Creates an object URL for
   * the bytes only after confirming a PDF is sealed. Non-PDF artefacts (e.g.
   * .ots receipts) pass through unchecked. Ciphertext should be delivered by
   * passing opts.preSealed=true (the plaintext was already asserted at sealing).
   *
   * @param {Uint8Array} bytes
   * @param {{filename?:string, mime?:string, preSealed?:boolean}} [opts]
   * @returns {{url:string, revoke:function}}
   */
  function sealedObjectURL(bytes, opts) {
    opts = opts || {};
    var looksPdf = isPdf(bytes) || /\.pdf$/i.test(opts.filename || '');
    if (looksPdf && !opts.preSealed) assertSealed(bytes, opts.filename || 'download');
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      throw new Error('VerumSealGuard.sealedObjectURL requires a browser environment.');
    }
    var blob = new Blob([bytes], {
      type: opts.mime || (looksPdf ? 'application/pdf' : 'application/octet-stream')
    });
    var url = URL.createObjectURL(blob);
    return { url: url, revoke: function () { try { URL.revokeObjectURL(url); } catch (e) {} } };
  }

  var api = {
    isSealed: isSealed,
    isPdf: isPdf,
    assertSealed: assertSealed,
    sealedObjectURL: sealedObjectURL,
    SEAL_SCHEMES: SEAL_SCHEMES,
    _utf16Hex: utf16Hex
  };

  global.VoSealGuard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
