/*
 * ots-proof.js — Verum Omnis shared OpenTimestamps proof utilities.
 *
 * Plain script, no build step. Exposes window.VoOts (globalThis.VoOts in Node
 * for testing). Implements the OpenTimestamps binary format exactly as
 * specified and as served by the live calendar network; cross-validated
 * against python-opentimestamps 0.4.5 and the opentimestamps npm package:
 *
 *   DetachedTimestampFile:
 *     HEADER_MAGIC  31 bytes: 00 "OpenTimestamps" 00 00 "Proof" 00 bf89e2e884e89294
 *                   (hex: 004f70656e54696d657374616d70730000 50726f6f6600 bf89e2e884e89294)
 *     version       varuint(1)  -> 0x01
 *     file_hash_op  0x08 (sha256)
 *     digest        32 bytes
 *     timestamp     recursive Timestamp serialization
 *
 *   Timestamp:
 *     items are attestations + operation continuations. All items but the last
 *     are prefixed 0xff; the last item is unprefixed. An attestation item is
 *     0x00 + attestation; an op item is op-tag (+ varbytes arg for binary ops)
 *     followed by the recursive sub-timestamp. Canonical form sorts
 *     attestations by (tag, payload) and ops by tag.
 *
 *   Attestation: TAG(8 bytes) + varbytes(payload)
 *     PendingAttestation  TAG 83dfe30d2ef90c8e, payload varbytes(UTF-8 uri)
 *     BitcoinBlockHeader  TAG 0588960d73d71901, payload varuint(height)
 *     LitecoinBlockHeader TAG 06869a0d73d71b45, payload varuint(height)
 *
 *   varuint: unsigned LEB128 (7 bits per byte, little-endian groups, high bit
 *   set on every byte except the last).
 *
 *   Op tags: 0xf0 append, 0xf1 prepend (both followed by varbytes arg — note
 *   the counter-intuitive assignment, matching both reference
 *   implementations); 0x08 sha256, 0x02 sha1, 0x03 ripemd160, 0x67 keccak256,
 *   0xf2 reverse, 0xf3 hexlify (unary: tag only).
 */
(function (global) {
  'use strict';

  var HEADER_MAGIC = [
    0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d,
    0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00,
    0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
    0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94
  ];
  var MAJOR_VERSION = 1;

  var OP = {
    // NB: 0xf0 is APPEND and 0xf1 is PREPEND in the OTS spec — swapped relative
    // to what most people guess; verified against python-opentimestamps
    // (OpAppend.TAG = b'\xf0'), the npm package, and live calendar responses.
    PREPEND: 0xf1,
    APPEND: 0xf0,
    REVERSE: 0xf2,
    HEXLIFY: 0xf3,
    SHA1: 0x02,
    RIPEMD160: 0x03,
    SHA256: 0x08,
    KECCAK256: 0x67
  };
  var OP_NAMES = {};
  OP_NAMES[OP.PREPEND] = 'prepend';
  OP_NAMES[OP.APPEND] = 'append';
  OP_NAMES[OP.REVERSE] = 'reverse';
  OP_NAMES[OP.HEXLIFY] = 'hexlify';
  OP_NAMES[OP.SHA1] = 'sha1';
  OP_NAMES[OP.RIPEMD160] = 'ripemd160';
  OP_NAMES[OP.SHA256] = 'sha256';
  OP_NAMES[OP.KECCAK256] = 'keccak256';
  var BINARY_OPS = {};
  BINARY_OPS[OP.PREPEND] = true;
  BINARY_OPS[OP.APPEND] = true;

  var TAG_PENDING = [0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e];
  var TAG_BITCOIN = [0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01];
  var TAG_LITECOIN = [0x06, 0x86, 0x9a, 0x0d, 0x73, 0xd7, 0x1b, 0x45];

  var MAX_URI_LENGTH = 1000;
  // Characters the reference implementations accept in a PendingAttestation URI.
  var ALLOWED_URI_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._/:';

  // ------------------------------ byte helpers ------------------------------

  function utf8Encode(str) {
    return new TextEncoder().encode(str);
  }

  function hexToBytes(hex) {
    if (typeof hex !== 'string') throw new Error('digest hex must be a string');
    var h = hex.trim().toLowerCase();
    if (!/^[0-9a-f]+$/.test(h) || h.length % 2 !== 0) {
      throw new Error('invalid hex string');
    }
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < h.length; i += 2) out[i / 2] = parseInt(h.substr(i, 2), 16);
    return out;
  }

  function bytesToHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  function concatArrays(list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].length;
    var out = new Uint8Array(total), off = 0;
    for (i = 0; i < list.length; i++) { out.set(list[i], off); off += list[i].length; }
    return out;
  }

  // varuint: unsigned LEB128, exactly as python-opentimestamps write_varuint.
  function writeVaruint(value) {
    if (!isFinite(value) || value < 0 || Math.floor(value) !== value) {
      throw new Error('varuint value must be a non-negative integer');
    }
    var out = [];
    if (value === 0) {
      out.push(0);
    } else {
      while (value !== 0) {
        var b = value & 0x7f;
        if (value > 0x7f) b |= 0x80;
        out.push(b);
        if (value <= 0x7f) break;
        value = Math.floor(value / 128);
      }
    }
    return Uint8Array.from(out);
  }

  function writeVarbytes(bytes) {
    return concatArrays([writeVaruint(bytes.length), bytes]);
  }

  function tagEquals(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Accepts either a calendar base URL (https://host) or the submission
  // endpoint (.../digest); returns the base URL that /timestamp/<digest>
  // lookups and PendingAttestation URIs are built from.
  function normalizeCalendarUrl(url) {
    var u = String(url === undefined || url === null ? '' : url).trim();
    while (u.length > 0 && u.charAt(u.length - 1) === '/') u = u.slice(0, -1);
    if (u.slice(-7) === '/digest') u = u.slice(0, -7);
    return u;
  }

  function validateAttestationUri(uri) {
    if (!uri || uri.length > MAX_URI_LENGTH) {
      throw new Error('PendingAttestation URI missing or longer than ' + MAX_URI_LENGTH + ' chars: ' + uri);
    }
    for (var i = 0; i < uri.length; i++) {
      if (ALLOWED_URI_CHARS.indexOf(uri.charAt(i)) < 0) {
        throw new Error('PendingAttestation URI contains a character the OTS spec forbids: ' + uri);
      }
    }
  }

  function serializePendingAttestation(uri) {
    validateAttestationUri(uri);
    var payload = writeVarbytes(utf8Encode(uri));
    return concatArrays([Uint8Array.from(TAG_PENDING), writeVarbytes(payload)]);
  }

  // ------------------------------ public API --------------------------------

  /**
   * Build a valid, self-contained OpenTimestamps detached-timestamp file whose
   * timestamp carries one PendingAttestation per calendar URL. This is the
   * "receipt" a user keeps while the Bitcoin anchor is being confirmed; any
   * OTS client can upgrade it later by polling the calendars named in the
   * attestations (GET <calendar>/timestamp/<digestHex>).
   *
   * @param {string} digestHex 64-char hex of the 32-byte stamped digest
   *        (the exact value submitted to the calendars' POST /digest).
   * @param {string[]} calendarUrls calendar base URLs (a trailing "/digest" is
   *        tolerated and stripped).
   * @return {Uint8Array} the .ots file bytes.
   */
  function buildPendingReceipt(digestHex, calendarUrls) {
    var digest = hexToBytes(digestHex);
    if (digest.length !== 32) {
      throw new Error('OTS receipt digest must be 32 bytes (sha256); got ' + digest.length);
    }
    var uris = [], seen = {};
    var list = Array.isArray(calendarUrls) ? calendarUrls : [calendarUrls];
    for (var i = 0; i < list.length; i++) {
      var u = normalizeCalendarUrl(list[i]);
      if (!u || seen[u]) continue;
      validateAttestationUri(u);
      seen[u] = true;
      uris.push(u);
    }
    if (uris.length === 0) throw new Error('buildPendingReceipt needs at least one calendar URL');
    // Canonical ordering: reference serializers sort attestations by (tag,
    // payload); all tags here are identical, so sort by URI bytes.
    uris.sort();

    var atts = [];
    for (i = 0; i < uris.length; i++) atts.push(serializePendingAttestation(uris[i]));

    var parts = [Uint8Array.from(HEADER_MAGIC), writeVaruint(MAJOR_VERSION), Uint8Array.from([OP.SHA256]), digest];
    // Timestamp framing: N-1 items prefixed ff 00, last item prefixed 00
    // (attestations only, no operation continuations).
    for (i = 0; i < atts.length; i++) {
      if (atts.length > 1 && i < atts.length - 1) parts.push(Uint8Array.from([0xff, 0x00]));
      else parts.push(Uint8Array.from([0x00]));
      parts.push(atts[i]);
    }
    return concatArrays(parts);
  }

  /**
   * Assemble a complete detached-timestamp file from a digest and a calendar
   * Timestamp fragment (the body returned by POST /digest or GET /timestamp).
   * @param {string} digestHex
   * @param {Uint8Array} fragmentBytes serialized Timestamp for that digest
   * @return {Uint8Array}
   */
  function buildFileFromFragment(digestHex, fragmentBytes) {
    var digest = hexToBytes(digestHex);
    if (digest.length !== 32) throw new Error('digest must be 32 bytes');
    if (!fragmentBytes || fragmentBytes.length === 0) throw new Error('empty timestamp fragment');
    return concatArrays([
      Uint8Array.from(HEADER_MAGIC), writeVaruint(MAJOR_VERSION),
      Uint8Array.from([OP.SHA256]), digest, fragmentBytes
    ]);
  }

  /**
   * Best-effort structural parse of a detached-timestamp (.ots) file. Walks
   * the timestamp tree without applying any hash operations; extracts every
   * attestation with the op chain leading to it. Unknown op codes or
   * attestation tags are recorded honestly rather than guessed.
   *
   * @param {Uint8Array} otsBytes
   * @return {{valid:boolean, errors:string[], version:number, digestOp:string,
   *           digestHex:string, attestations:Array, calendars:string[],
   *           bitcoin:Array, complete:boolean}}
   */
  function parseSummary(otsBytes) {
    var errors = [];
    var attestations = [];
    var result = {
      valid: false, errors: errors, version: 0, digestOp: '',
      digestHex: '', attestations: attestations, calendars: [],
      bitcoin: [], complete: false
    };
    if (!otsBytes || otsBytes.length === 0) { errors.push('empty input'); return result; }
    var bytes = otsBytes instanceof Uint8Array ? otsBytes : new Uint8Array(otsBytes);
    var pos = 0;

    function read(n) {
      if (pos + n > bytes.length) throw new Error('unexpected end of file at byte ' + pos);
      var out = bytes.slice(pos, pos + n);
      pos += n;
      return out;
    }
    function readVaruint() {
      var value = 0, shift = 1, b;
      do {
        b = read(1)[0];
        value += (b & 0x7f) * shift;
        shift *= 128;
      } while (b & 0x80);
      return value;
    }
    function readVarbytes(maxLen) {
      var l = readVaruint();
      if (maxLen && l > maxLen) throw new Error('varbytes length ' + l + ' exceeds limit ' + maxLen);
      return read(l);
    }

    try {
      var magic = read(HEADER_MAGIC.length);
      if (!tagEquals(magic, Uint8Array.from(HEADER_MAGIC))) {
        errors.push('bad magic: not an OpenTimestamps proof file');
        return result;
      }
      result.version = readVaruint();
      var opByte = read(1)[0];
      result.digestOp = OP_NAMES[opByte] || ('unknown-0x' + opByte.toString(16));
      var digestLen = opByte === OP.SHA256 ? 32 : readDigestLength(opByte);
      if (digestLen === 0) { errors.push('unsupported file hash op 0x' + opByte.toString(16)); return result; }
      result.digestHex = bytesToHex(read(digestLen));

      function readDigestLength(op) {
        // Only reached for known unary hash ops; sha256 handled by caller.
        if (op === OP.SHA1 || op === OP.RIPEMD160) return 20;
        return 0;
      }

      function handleItem(b, chain) {
        if (b === 0x00) {
          var tag = read(8);
          var payload = readVarbytes(8192);
          var att = { chain: chain.slice() };
          if (tagEquals(tag, Uint8Array.from(TAG_PENDING))) {
            att.type = 'pending';
            try {
              att.uri = new TextDecoder().decode(readPayloadVarbytes(payload));
            } catch (e) {
              att.type = 'unknown';
              att.note = 'pending attestation with unreadable URI';
            }
          } else if (tagEquals(tag, Uint8Array.from(TAG_BITCOIN))) {
            att.type = 'bitcoin';
            att.height = readPayloadVaruint(payload);
          } else if (tagEquals(tag, Uint8Array.from(TAG_LITECOIN))) {
            att.type = 'litecoin';
            att.height = readPayloadVaruint(payload);
          } else {
            att.type = 'unknown';
            att.tagHex = bytesToHex(tag);
          }
          attestations.push(att);
        } else if (OP_NAMES[b]) {
          var name = OP_NAMES[b];
          if (BINARY_OPS[b]) readVarbytes(8192); // arg bytes not needed for the summary
          var sub = chain.slice();
          sub.push(name);
          parseTimestamp(sub);
        } else {
          errors.push('unknown tag/op byte 0x' + b.toString(16) + ' at byte ' + (pos - 1) + '; branch not followed');
        }
      }
      function readPayloadVarbytes(payload) {
        // payload = varuint(len) + bytes
        var value = 0, shift = 1, p = 0, b;
        do {
          if (p >= payload.length) throw new Error('truncated payload');
          b = payload[p++];
          value += (b & 0x7f) * shift;
          shift *= 128;
        } while (b & 0x80);
        if (p + value > payload.length) throw new Error('truncated payload');
        return payload.slice(p, p + value);
      }
      function readPayloadVaruint(payload) {
        var value = 0, shift = 1, p = 0, b;
        do {
          if (p >= payload.length) throw new Error('truncated payload');
          b = payload[p++];
          value += (b & 0x7f) * shift;
          shift *= 128;
        } while (b & 0x80);
        return value;
      }
      function parseTimestamp(chain) {
        if (pos >= bytes.length) { errors.push('timestamp truncated'); return; }
        var b = read(1)[0];
        while (b === 0xff) {
          if (pos >= bytes.length) { errors.push('timestamp truncated after 0xff'); return; }
          handleItem(read(1)[0], chain);
          if (pos >= bytes.length) { errors.push('timestamp truncated'); return; }
          b = read(1)[0];
        }
        handleItem(b, chain);
      }

      parseTimestamp([]);
      if (pos < bytes.length) errors.push('trailing ' + (bytes.length - pos) + ' byte(s) after timestamp');
    } catch (e) {
      errors.push(e.message || String(e));
      return result;
    }

    var calendars = [], bitcoin = [], complete = false;
    for (var i = 0; i < attestations.length; i++) {
      var a = attestations[i];
      if (a.type === 'pending' && a.uri && calendars.indexOf(a.uri) < 0) calendars.push(a.uri);
      if (a.type === 'bitcoin') {
        complete = true;
        bitcoin.push({ height: a.height, chain: a.chain.slice() });
      }
    }
    result.calendars = calendars;
    result.bitcoin = bitcoin;
    result.complete = complete;
    result.valid = errors.length === 0;
    return result;
  }

  /**
   * Poll each calendar for the upgraded (Bitcoin-anchored) timestamp of a
   * previously submitted digest. Resolution:
   *   - first calendar returning an anchored proof -> {status:'confirmed', otsBytes, calendar}
   *     (the proof is verified to actually contain a block attestation before
   *     it is called confirmed — never faked)
   *   - every reachable calendar answering 404   -> {status:'pending'}
   *   - no calendar reachable / unexpected reply -> {status:'offline', error}
   * @param {string} digestHex
   * @param {string[]} calendarUrls
   */
  async function fetchUpgraded(digestHex, calendarUrls) {
    var digest = hexToBytes(digestHex); // validates
    var hex = bytesToHex(digest);
    var urls = [], seen = {};
    var list = Array.isArray(calendarUrls) ? calendarUrls : [calendarUrls];
    for (var i = 0; i < list.length; i++) {
      var u = normalizeCalendarUrl(list[i]);
      if (u && !seen[u]) { seen[u] = true; urls.push(u); }
    }
    if (urls.length === 0) return { status: 'offline', error: 'no calendar URLs to poll' };

    var saw404 = false;
    var lastError = null;
    for (i = 0; i < urls.length; i++) {
      var url = urls[i] + '/timestamp/' + hex;
      var res;
      try {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 15000);
        try {
          res = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/vnd.opentimestamps.v1' },
            signal: ctrl.signal
          });
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        lastError = (e && e.message) ? e.message : String(e);
        continue;
      }
      if (res.status === 404) { saw404 = true; continue; }
      if (!res.ok) { lastError = 'HTTP ' + res.status + ' from ' + urls[i]; continue; }
      var body;
      try {
        body = new Uint8Array(await res.arrayBuffer());
      } catch (e2) {
        lastError = (e2 && e2.message) ? e2.message : String(e2);
        continue;
      }
      if (body.length === 0) { lastError = 'empty timestamp body from ' + urls[i]; continue; }
      // Assemble the full file and require a real block attestation before
      // calling anything confirmed.
      var fileBytes;
      try {
        fileBytes = buildFileFromFragment(hex, body);
      } catch (e3) {
        lastError = (e3 && e3.message) ? e3.message : String(e3);
        continue;
      }
      var summary = parseSummary(fileBytes);
      if (summary.complete && summary.bitcoin.length > 0) {
        return { status: 'confirmed', otsBytes: fileBytes, calendar: urls[i], summary: summary };
      }
      // Calendar answered 200 but the proof is not anchored yet — honest pending.
      saw404 = true; // treat like "not ready yet" for classification purposes
    }
    if (saw404) return { status: 'pending' };
    return { status: 'offline', error: lastError || 'all calendars unreachable' };
  }

  /**
   * Trigger a browser download of raw bytes.
   * @param {string} filename
   * @param {Uint8Array} bytes
   * @param {string} [mime]
   */
  function download(filename, bytes, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  global.VoOts = {
    buildPendingReceipt: buildPendingReceipt,
    buildFileFromFragment: buildFileFromFragment,
    fetchUpgraded: fetchUpgraded,
    parseSummary: parseSummary,
    download: download,
    // exposed for harness/tests and the verify page
    normalizeCalendarUrl: normalizeCalendarUrl,
    hexToBytes: hexToBytes,
    bytesToHex: bytesToHex,
    constants: {
      HEADER_MAGIC: HEADER_MAGIC,
      MAJOR_VERSION: MAJOR_VERSION,
      OP: OP,
      TAG_PENDING: TAG_PENDING,
      TAG_BITCOIN: TAG_BITCOIN,
      TAG_LITECOIN: TAG_LITECOIN
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
