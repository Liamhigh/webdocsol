// ============================================================================
// pdf-encrypt.js — Standard PDF password encryption (RC4-128, revision 3)
// ----------------------------------------------------------------------------
// pdf-lib cannot write encrypted PDFs, so this wraps a finished (sealed) PDF in
// the PDF Standard Security Handler. The result is an ordinary .pdf that opens
// in any reader (Adobe, Preview, Chrome, phones) with a password prompt — no
// second file, no website step. RC4-128/R3 is chosen for maximum reader
// compatibility; the threat model here is a read-receipt gate (the recipient
// must ask the sender for the password), not protection of high-value secrets.
//
// The document is fully re-serialised: every indirect object is parsed, its
// strings and stream re-emitted RC4-encrypted, and a fresh xref + /Encrypt
// dictionary written. RC4 is length-preserving, so stream /Length values stay
// valid. Correctness is proven in tests/pdf-encrypt.test.mjs, which opens the
// output with pdf.js — a strict, independent PDF engine.
//
// Exposed as window.VOEncryptPDF(pdfBytes, userPassword[, ownerPassword]).
// ============================================================================
(function (root) {
  'use strict';

  var PAD = new Uint8Array([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56,
    0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A]);

  // ---- RC4 ----
  function rc4(key, data) {
    var s = new Uint8Array(256), i, j = 0, t;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length]) & 0xff;
      t = s[i]; s[i] = s[j]; s[j] = t;
    }
    var out = new Uint8Array(data.length);
    i = 0; j = 0;
    for (var k = 0; k < data.length; k++) {
      i = (i + 1) & 0xff;
      j = (j + s[i]) & 0xff;
      t = s[i]; s[i] = s[j]; s[j] = t;
      out[k] = data[k] ^ s[(s[i] + s[j]) & 0xff];
    }
    return out;
  }

  // ---- MD5 (Web Crypto has no MD5; the security handler requires it) ----
  // Compact implementation after RFC 1321 / Paul Johnston, operating on bytes.
  function md5(bytes) {
    function add(x, y) { var l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
    function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cmn(q, a, b, x, s, t) { return add(rol(add(add(a, q), add(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

    // Bytes -> little-endian 32-bit words with padding.
    var origLen = bytes.length;
    var nBlocks = (((origLen + 8) >> 6) + 1);
    var words = new Array(nBlocks * 16);
    for (var w = 0; w < words.length; w++) words[w] = 0;
    for (var i = 0; i < origLen; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    words[origLen >> 2] |= 0x80 << ((origLen % 4) * 8);
    words[nBlocks * 16 - 2] = origLen * 8;

    var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (var k = 0; k < words.length; k += 16) {
      var oa = a, ob = b, oc = c, od = d;
      a = ff(a, b, c, d, words[k + 0], 7, -680876936); d = ff(d, a, b, c, words[k + 1], 12, -389564586);
      c = ff(c, d, a, b, words[k + 2], 17, 606105819); b = ff(b, c, d, a, words[k + 3], 22, -1044525330);
      a = ff(a, b, c, d, words[k + 4], 7, -176418897); d = ff(d, a, b, c, words[k + 5], 12, 1200080426);
      c = ff(c, d, a, b, words[k + 6], 17, -1473231341); b = ff(b, c, d, a, words[k + 7], 22, -45705983);
      a = ff(a, b, c, d, words[k + 8], 7, 1770035416); d = ff(d, a, b, c, words[k + 9], 12, -1958414417);
      c = ff(c, d, a, b, words[k + 10], 17, -42063); b = ff(b, c, d, a, words[k + 11], 22, -1990404162);
      a = ff(a, b, c, d, words[k + 12], 7, 1804603682); d = ff(d, a, b, c, words[k + 13], 12, -40341101);
      c = ff(c, d, a, b, words[k + 14], 17, -1502002290); b = ff(b, c, d, a, words[k + 15], 22, 1236535329);
      a = gg(a, b, c, d, words[k + 1], 5, -165796510); d = gg(d, a, b, c, words[k + 6], 9, -1069501632);
      c = gg(c, d, a, b, words[k + 11], 14, 643717713); b = gg(b, c, d, a, words[k + 0], 20, -373897302);
      a = gg(a, b, c, d, words[k + 5], 5, -701558691); d = gg(d, a, b, c, words[k + 10], 9, 38016083);
      c = gg(c, d, a, b, words[k + 15], 14, -660478335); b = gg(b, c, d, a, words[k + 4], 20, -405537848);
      a = gg(a, b, c, d, words[k + 9], 5, 568446438); d = gg(d, a, b, c, words[k + 14], 9, -1019803690);
      c = gg(c, d, a, b, words[k + 3], 14, -187363961); b = gg(b, c, d, a, words[k + 8], 20, 1163531501);
      a = gg(a, b, c, d, words[k + 13], 5, -1444681467); d = gg(d, a, b, c, words[k + 2], 9, -51403784);
      c = gg(c, d, a, b, words[k + 7], 14, 1735328473); b = gg(b, c, d, a, words[k + 12], 20, -1926607734);
      a = hh(a, b, c, d, words[k + 5], 4, -378558); d = hh(d, a, b, c, words[k + 8], 11, -2022574463);
      c = hh(c, d, a, b, words[k + 11], 16, 1839030562); b = hh(b, c, d, a, words[k + 14], 23, -35309556);
      a = hh(a, b, c, d, words[k + 1], 4, -1530992060); d = hh(d, a, b, c, words[k + 4], 11, 1272893353);
      c = hh(c, d, a, b, words[k + 7], 16, -155497632); b = hh(b, c, d, a, words[k + 10], 23, -1094730640);
      a = hh(a, b, c, d, words[k + 13], 4, 681279174); d = hh(d, a, b, c, words[k + 0], 11, -358537222);
      c = hh(c, d, a, b, words[k + 3], 16, -722521979); b = hh(b, c, d, a, words[k + 6], 23, 76029189);
      a = hh(a, b, c, d, words[k + 9], 4, -640364487); d = hh(d, a, b, c, words[k + 12], 11, -421815835);
      c = hh(c, d, a, b, words[k + 15], 16, 530742520); b = hh(b, c, d, a, words[k + 2], 23, -995338651);
      a = ii(a, b, c, d, words[k + 0], 6, -198630844); d = ii(d, a, b, c, words[k + 7], 10, 1126891415);
      c = ii(c, d, a, b, words[k + 14], 15, -1416354905); b = ii(b, c, d, a, words[k + 5], 21, -57434055);
      a = ii(a, b, c, d, words[k + 12], 6, 1700485571); d = ii(d, a, b, c, words[k + 3], 10, -1894986606);
      c = ii(c, d, a, b, words[k + 10], 15, -1051523); b = ii(b, c, d, a, words[k + 1], 21, -2054922799);
      a = ii(a, b, c, d, words[k + 8], 6, 1873313359); d = ii(d, a, b, c, words[k + 15], 10, -30611744);
      c = ii(c, d, a, b, words[k + 6], 15, -1560198380); b = ii(b, c, d, a, words[k + 13], 21, 1309151649);
      a = ii(a, b, c, d, words[k + 4], 6, -145523070); d = ii(d, a, b, c, words[k + 11], 10, -1120210379);
      c = ii(c, d, a, b, words[k + 2], 15, 718787259); b = ii(b, c, d, a, words[k + 9], 21, -343485551);
      a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
    }
    var out = new Uint8Array(16), words4 = [a, b, c, d];
    for (var wi = 0; wi < 4; wi++)
      for (var bi = 0; bi < 4; bi++) out[wi * 4 + bi] = (words4[wi] >>> (8 * bi)) & 0xff;
    return out;
  }

  function padPassword(pw) {
    var enc = [];
    for (var i = 0; i < pw.length && enc.length < 32; i++) enc.push(pw.charCodeAt(i) & 0xff);
    var out = new Uint8Array(32);
    for (var j = 0; j < 32; j++) out[j] = j < enc.length ? enc[j] : PAD[j - enc.length];
    return out;
  }

  function concatBytes(arrays) {
    var len = 0, i;
    for (i = 0; i < arrays.length; i++) len += arrays[i].length;
    var out = new Uint8Array(len), off = 0;
    for (i = 0; i < arrays.length; i++) { out.set(arrays[i], off); off += arrays[i].length; }
    return out;
  }

  var KEYLEN = 16; // 128-bit

  function computeOwnerEntry(userPw, ownerPw) {
    var pw = padPassword(ownerPw && ownerPw.length ? ownerPw : userPw);
    var hash = md5(pw);
    for (var i = 0; i < 50; i++) hash = md5(hash.slice(0, KEYLEN));
    var rc4key = hash.slice(0, KEYLEN);
    var out = rc4(rc4key, padPassword(userPw));
    for (var r = 1; r <= 19; r++) {
      var k = new Uint8Array(KEYLEN);
      for (var b = 0; b < KEYLEN; b++) k[b] = rc4key[b] ^ r;
      out = rc4(k, out);
    }
    return out; // 32 bytes
  }

  function computeKey(userPw, O, P, idBytes) {
    var pw = padPassword(userPw);
    var pbytes = new Uint8Array(4);
    pbytes[0] = P & 0xff; pbytes[1] = (P >>> 8) & 0xff;
    pbytes[2] = (P >>> 16) & 0xff; pbytes[3] = (P >>> 24) & 0xff;
    var hash = md5(concatBytes([pw, O, pbytes, idBytes]));
    for (var i = 0; i < 50; i++) hash = md5(hash.slice(0, KEYLEN));
    return hash.slice(0, KEYLEN);
  }

  function computeUserEntry(key, idBytes) {
    var hash = md5(concatBytes([PAD, idBytes]));
    var out = rc4(key, hash);
    for (var r = 1; r <= 19; r++) {
      var k = new Uint8Array(KEYLEN);
      for (var b = 0; b < KEYLEN; b++) k[b] = key[b] ^ r;
      out = rc4(k, out);
    }
    var full = new Uint8Array(32);
    full.set(out.slice(0, 16));
    full.set(PAD.slice(0, 16), 16); // arbitrary padding to 32
    return full;
  }

  // Per-object RC4 key: MD5(key + objLow3 + genLow2), first min(keylen+5,16).
  function objectKey(key, num, gen) {
    var ext = new Uint8Array(KEYLEN + 5);
    ext.set(key);
    ext[KEYLEN] = num & 0xff; ext[KEYLEN + 1] = (num >>> 8) & 0xff; ext[KEYLEN + 2] = (num >>> 16) & 0xff;
    ext[KEYLEN + 3] = gen & 0xff; ext[KEYLEN + 4] = (gen >>> 8) & 0xff;
    var h = md5(ext);
    return h.slice(0, Math.min(KEYLEN + 5, 16));
  }

  function byteStr(s) {
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }
  function latin1(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
  function toHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) { var h = bytes[i].toString(16); s += h.length === 1 ? '0' + h : h; }
    return s;
  }

  // Encrypt the string/hex tokens within an object body (dict + scalar values),
  // re-emitting every string as a hex string to avoid literal-string escaping.
  function encryptBody(body, key, num, gen) {
    var okey = objectKey(key, num, gen);
    var out = '';
    var i = 0, n = body.length;
    while (i < n) {
      var c = body[i];
      if (c === '<' && body[i + 1] === '<') { out += '<<'; i += 2; continue; }
      if (c === '>' && body[i + 1] === '>') { out += '>>'; i += 2; continue; }
      if (c === '<') { // hex string
        var j = body.indexOf('>', i + 1);
        if (j < 0) { out += body.slice(i); break; }
        var hex = body.slice(i + 1, j).replace(/\s+/g, '');
        if (hex.length % 2) hex += '0';
        var raw = new Uint8Array(hex.length / 2);
        for (var h = 0; h < raw.length; h++) raw[h] = parseInt(hex.substr(h * 2, 2), 16);
        out += '<' + toHex(rc4(okey, raw)) + '>';
        i = j + 1; continue;
      }
      if (c === '(') { // literal string with balanced parens + escapes
        var depth = 1, k = i + 1, buf = [];
        while (k < n && depth > 0) {
          var ch = body[k];
          if (ch === '\\') {
            var nx = body[k + 1];
            if (nx === 'n') { buf.push(10); k += 2; }
            else if (nx === 'r') { buf.push(13); k += 2; }
            else if (nx === 't') { buf.push(9); k += 2; }
            else if (nx === 'b') { buf.push(8); k += 2; }
            else if (nx === 'f') { buf.push(12); k += 2; }
            else if (nx === '(') { buf.push(40); k += 2; }
            else if (nx === ')') { buf.push(41); k += 2; }
            else if (nx === '\\') { buf.push(92); k += 2; }
            else if (nx >= '0' && nx <= '7') {
              var oct = nx; k += 2;
              for (var o = 0; o < 2 && body[k] >= '0' && body[k] <= '7'; o++) { oct += body[k]; k++; }
              buf.push(parseInt(oct, 8) & 0xff);
            } else { buf.push(nx.charCodeAt(0) & 0xff); k += 2; }
          } else if (ch === '(') { depth++; buf.push(40); k++; }
          else if (ch === ')') { depth--; if (depth > 0) buf.push(41); k++; }
          else { buf.push(ch.charCodeAt(0) & 0xff); k++; }
        }
        out += '<' + toHex(rc4(okey, new Uint8Array(buf))) + '>';
        i = k; continue;
      }
      out += c; i++;
    }
    return out;
  }

  /**
   * Encrypt a finished PDF with a user password. `pdfBytes` MUST come from a
   * pdf-lib save with { useObjectStreams: false } — a flat, traditional-xref
   * document. Returns a new Uint8Array: an ordinary password-protected PDF.
   */
  function encryptPdfStandard(pdfBytes, userPassword, ownerPassword, idSeedHex) {
    var text = latin1(pdfBytes);

    // Parse indirect objects: "N G obj ... endobj".
    var objRe = /(\d+)\s+(\d+)\s+obj\b/g;
    var objs = [], m;
    while ((m = objRe.exec(text)) !== null) {
      var start = m.index;
      var end = text.indexOf('endobj', objRe.lastIndex);
      if (end < 0) continue;
      objs.push({ num: +m[1], gen: +m[2], headerEnd: objRe.lastIndex, start: start, end: end });
      objRe.lastIndex = end + 6;
    }
    if (!objs.length) throw new Error('No indirect objects found; not a flat PDF');

    var root = (text.match(/\/Root\s+(\d+)\s+(\d+)\s+R/) || [])[1];
    var info = (text.match(/\/Info\s+(\d+)\s+(\d+)\s+R/) || [])[1];
    if (!root) throw new Error('No /Root found in trailer');

    // Deterministic 16-byte file ID from a seed (the sealed-file hash).
    var seed = (idSeedHex || '').replace(/[^0-9a-f]/gi, '');
    var idBytes = new Uint8Array(16);
    for (var d = 0; d < 16; d++) idBytes[d] = seed.length >= (d + 1) * 2 ? parseInt(seed.substr(d * 2, 2), 16) : (d * 37 + 11) & 0xff;

    var P = -3904; // allow print/copy; disallow nothing meaningful for a receipt gate
    var O = computeOwnerEntry(userPassword, ownerPassword);
    var key = computeKey(userPassword, O, P, idBytes);
    var U = computeUserEntry(key, idBytes);

    var maxNum = 0;
    for (var oi = 0; oi < objs.length; oi++) if (objs[oi].num > maxNum) maxNum = objs[oi].num;
    var encNum = maxNum + 1;

    // Re-serialise every object, encrypting strings and stream data.
    var pieces = ['%PDF-1.7\n%\xE2\xE3\xCF\xD3\n'];
    var offsets = {};
    var cursor = pieces[0].length;

    for (var p = 0; p < objs.length; p++) {
      var ob = objs[p];
      var raw = text.slice(ob.headerEnd, ob.end);
      var streamIdx = raw.indexOf('stream');
      var bodyText, streamBytes = null;
      if (streamIdx >= 0) {
        var afterKw = streamIdx + 6;
        if (raw[afterKw] === '\r') afterKw++;
        if (raw[afterKw] === '\n') afterKw++;
        var dictText = raw.slice(0, streamIdx);
        var lenMatch = dictText.match(/\/Length\s+(\d+)/);
        var slen;
        if (lenMatch) slen = +lenMatch[1];
        else { var se = raw.indexOf('endstream', afterKw); slen = se - afterKw; }
        var streamRaw = byteStr(raw.slice(afterKw, afterKw + slen));
        streamBytes = rc4(objectKey(key, ob.num, ob.gen), streamRaw);
        bodyText = dictText;
      } else {
        bodyText = raw;
      }

      var encBody = encryptBody(bodyText.replace(/^\s+/, ''), key, ob.num, ob.gen);
      offsets[ob.num] = cursor;
      var head = ob.num + ' ' + ob.gen + ' obj\n';
      pieces.push(head); cursor += head.length;
      if (streamBytes) {
        var dictOut = encBody.replace(/\s*$/, '');
        pieces.push(dictOut); cursor += dictOut.length;
        var pre = '\nstream\n';
        pieces.push(pre); cursor += pre.length;
        pieces.push(streamBytes); cursor += streamBytes.length;
        var post = '\nendstream\nendobj\n';
        pieces.push(post); cursor += post.length;
      } else {
        var b = encBody.replace(/\s*$/, '') + '\nendobj\n';
        pieces.push(b); cursor += b.length;
      }
    }

    // /Encrypt dictionary — its /O and /U are NOT encrypted (added after).
    offsets[encNum] = cursor;
    var encDict = encNum + ' 0 obj\n<< /Filter /Standard /V 2 /R 3 /Length 128 /P ' + P +
      ' /O <' + toHex(O) + '> /U <' + toHex(U) + '> >>\nendobj\n';
    pieces.push(encDict); cursor += encDict.length;

    // xref
    var size = encNum + 1;
    var nums = Object.keys(offsets).map(Number).sort(function (a, b2) { return a - b2; });
    var xrefStart = cursor;
    var xref = 'xref\n0 ' + size + '\n0000000000 65535 f \n';
    for (var s2 = 1; s2 < size; s2++) {
      var offv = offsets[s2] != null ? offsets[s2] : 0;
      var pad = ('0000000000' + offv).slice(-10);
      xref += pad + ' 00000 n \n';
    }
    var idHex = toHex(idBytes);
    var trailer = 'trailer\n<< /Size ' + size + ' /Root ' + root + ' 0 R' +
      (info ? ' /Info ' + info + ' 0 R' : '') +
      ' /Encrypt ' + encNum + ' 0 R /ID [<' + idHex + '><' + idHex + '>] >>\n' +
      'startxref\n' + xrefStart + '\n%%EOF\n';
    pieces.push(xref + trailer);

    return concatBytes(pieces.map(function (x) { return typeof x === 'string' ? byteStr(x) : x; }));
  }

  root.VOEncryptPDF = encryptPdfStandard;
  if (typeof module !== 'undefined' && module.exports) module.exports = { encryptPdfStandard: encryptPdfStandard, _md5: md5, _rc4: rc4 };
})(typeof window !== 'undefined' ? window : this);
