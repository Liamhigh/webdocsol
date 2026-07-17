/* ========================================================================
   VERUM OMNIS FORENSIC REPORT BUILDER v1.0
   window.VerumReport.build(opts) -> Promise<Uint8Array>
   window.VerumReport.seal(reportBytes, sealOpts) -> Promise<Uint8Array>
   Dependency: pdf-lib (already loaded by seal-document.html via unpkg CDN).
   Deterministic: renders only real engine output; no invented analysis.
   ======================================================================== */
(function (global) {
'use strict';

var PDFLibRef = global.PDFLib || (typeof require === 'function' ? require('pdf-lib') : null);
if (!PDFLibRef) throw new Error('VerumReport: pdf-lib (PDFLib) is required');

// ---------------- palette / geometry ----------------
var RGB = PDFLibRef.rgb;
var NAVY = RGB(0x0e / 255, 0x1a / 255, 0x2b / 255);
var NAVY2 = RGB(0x14 / 255, 0x21 / 255, 0x3d / 255);
var GOLD = RGB(0xc9 / 255, 0xa2 / 255, 0x27 / 255);
var RED = RGB(0xb9 / 255, 0x1c / 255, 0x1c / 255);
var INK = RGB(0.08, 0.08, 0.08);
var GRAY = RGB(0.32, 0.34, 0.38);
var LGRAY = RGB(0.55, 0.58, 0.62);
var LIGHT = RGB(0.985, 0.975, 0.94);   // light gold tint for table headers
var BOXBG = RGB(0.988, 0.984, 0.965);
var TBORDER = RGB(0.78, 0.76, 0.68);
var WHITE = RGB(1, 1, 1);
var FOOT_TXT = RGB(0.58, 0.71, 0.78);
var FOOT_DIM = RGB(0.36, 0.42, 0.48);
var COVER_TXT = RGB(0.8, 0.82, 0.85);
var COVER_SUB = RGB(0.87, 0.89, 0.92);
var ROW_ALT = RGB(0.97, 0.965, 0.945);

var PW = 612, PH = 792;           // US Letter
var LM = 54, RM = 54;             // side margins
var CW = PW - LM - RM;            // 504 content width
var BODY_TOP = 686;               // first baseline area under header band
var BODY_BOTTOM = 70;             // above seal footer zone

var ENGINE_VERSION = '2.0';
var CONSTITUTION_VERSION = '5.2.7';
var DETECTOR_COUNT = 37, CT_COUNT = 43, SP_COUNT = 17;

// ---------------- static engine maps (from forensic-engine.js v2.0) ----------------
var CT_NAMES = {
  CT01: 'Direct Statement Contradiction', CT02: 'Numerical Discrepancy', CT03: 'Date Inconsistency',
  CT04: 'Temporal Sequence Break', CT05: 'Causal Impossibility', CT06: 'Logical Impossibility',
  CT07: 'Scope Creep Indicator', CT08: 'Term Definition Contradiction', CT09: 'Identity Contradiction',
  CT10: 'Role Contradiction', CT11: 'Authority Contradiction', CT12: 'Name Spelling Variation',
  CT13: 'Title Inconsistency', CT14: 'Entity Status Contradiction', CT15: 'Amount Discrepancy',
  CT16: 'Currency Mismatch', CT17: 'Account Number Invalidity', CT18: 'Bank Detail Mismatch',
  CT19: 'VAT Number Invalid', CT20: 'Registration Number Fake', CT21: 'Quotation Mismatch',
  CT22: 'Financial Calculation Error', CT23: 'Signature Mismatch', CT24: 'Metadata Contradiction',
  CT25: 'Font Inconsistency', CT26: 'Format Anomaly', CT27: 'Layout Manipulation',
  CT28: 'Image Integrity Failure', CT29: 'Timestamp Manipulation', CT30: 'Version Control Anomaly',
  CT31: 'Cross-Reference Failure', CT32: 'Source Attribution Failure', CT33: 'Legal Reference Invalid',
  CT34: 'Precedent Violation', CT35: 'Procedure Breach', CT36: 'Address Contradiction',
  CT37: 'Contact Detail Mismatch', CT38: 'Jurisdictional Impossibility', CT39: 'Chain of Custody Break',
  CT40: 'Witness Statement Conflict', CT41: 'Evidence Tampering Indicator', CT42: 'Digital Footprint Mismatch',
  CT43: 'Document Internal Conflict'
};
var CT_CATEGORY = {
  CT01: 'STATEMENTAL', CT02: 'STATEMENTAL', CT03: 'STATEMENTAL', CT04: 'STATEMENTAL',
  CT05: 'STATEMENTAL', CT06: 'STATEMENTAL', CT07: 'STATEMENTAL', CT08: 'STATEMENTAL',
  CT09: 'IDENTITY', CT10: 'IDENTITY', CT11: 'IDENTITY', CT12: 'IDENTITY', CT13: 'IDENTITY', CT14: 'IDENTITY',
  CT15: 'FINANCIAL', CT16: 'FINANCIAL', CT17: 'FINANCIAL', CT18: 'FINANCIAL', CT19: 'FINANCIAL',
  CT20: 'FINANCIAL', CT21: 'FINANCIAL', CT22: 'FINANCIAL',
  CT23: 'INTEGRITY', CT24: 'INTEGRITY', CT25: 'INTEGRITY', CT26: 'INTEGRITY', CT27: 'INTEGRITY',
  CT28: 'INTEGRITY', CT29: 'INTEGRITY', CT30: 'INTEGRITY',
  CT31: 'CROSS_REF', CT32: 'CROSS_REF', CT33: 'CROSS_REF', CT34: 'CROSS_REF', CT35: 'CROSS_REF',
  CT36: 'CONTACT', CT37: 'CONTACT', CT38: 'CONTACT',
  CT39: 'EVIDENCE', CT40: 'EVIDENCE', CT41: 'EVIDENCE',
  CT42: 'DIGITAL', CT43: 'DIGITAL'
};
// detector id responsible for each CT type (derived from forensic-engine.js source)
var CT_DETECTOR = {
  CT01: 'D01', CT02: 'D02', CT03: 'D03', CT04: 'D04', CT05: 'D31', CT06: 'D05', CT07: 'D29', CT08: 'D30',
  CT09: 'D06', CT10: 'D07', CT11: 'D08', CT14: 'D09', CT19: 'D10', CT20: 'D11', CT18: 'D12',
  CT22: 'D13', CT15: 'D13/D14', CT24: 'D15', CT29: 'D15', CT25: 'D16', CT26: 'D17', CT27: 'D18',
  CT41: 'D19', CT42: 'D20', CT31: 'D21', CT33: 'D22', CT35: 'D23', CT36: 'D24', CT37: 'D25',
  CT38: 'D26', CT39: 'D27', CT40: 'D28', CT23: 'D32', CT28: 'D33', CT16: 'D34', CT30: 'D35',
  CT32: 'D36', CT43: 'D37'
};
var CATEGORY_ORDER = ['STATEMENTAL', 'IDENTITY', 'FINANCIAL', 'INTEGRITY', 'CROSS_REF', 'CONTACT', 'EVIDENCE', 'DIGITAL'];
var CATEGORY_LABEL = {
  STATEMENTAL: 'Statemental Contradictions',
  IDENTITY: 'Identity Contradictions',
  FINANCIAL: 'Financial Contradictions',
  INTEGRITY: 'Document Integrity Contradictions',
  CROSS_REF: 'Cross-Reference Contradictions',
  CONTACT: 'Contact & Location Contradictions',
  EVIDENCE: 'Evidence & Witness Contradictions',
  DIGITAL: 'Digital Contradictions'
};

// ---------------- text utils ----------------
// pdf-lib standard fonts use WinAnsi (CP1252). Anything outside must be replaced
// or drawText throws. Keep CP1252 extras, normalize the rest.
var WINANSI_EXTRA = {};
'20AC 201A 0192 201E 2026 2020 2021 02C6 2030 0160 2039 0152 017D 2018 2019 201C 201D 2022 2013 2014 02DC 2122 0161 203A 0153 017E 0178'.split(' ').forEach(function (h) { WINANSI_EXTRA[parseInt(h, 16)] = true; });
var REPLACE = {
  0x2011: '-', 0x2012: '-', 0x2015: '-', 0xFEFF: '', 0x00AD: '',
  0x2192: '->', 0x2190: '<-', 0x2194: '<->', 0x2260: '!=', 0x2264: '<=', 0x2265: '>=',
  0x00D7: 'x', 0x00F7: '/', 0x2212: '-', 0x202F: ' ', 0x2009: ' ', 0x2002: ' ', 0x2003: ' ', 0x200B: '',
  0x25CF: '*', 0x25A0: '*', 0x25CB: 'o', 0x2713: '[x]', 0x2715: '[x]', 0x26A0: '[!]'
};
function san(s) {
  if (s === null || s === undefined) return '';
  s = String(s);
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 32 && c <= 126) { out += s[i]; continue; }
    if (c >= 160 && c <= 255) { out += s[i]; continue; }
    if (WINANSI_EXTRA[c]) { out += s[i]; continue; }
    if (c === 10 || c === 13 || c === 9) { out += ' '; continue; }
    if (REPLACE[c] !== undefined) { out += REPLACE[c]; continue; }
    if (c >= 0x0300 && c <= 0x036F) { continue; } // combining marks
    out += '?';
  }
  return out;
}
function asciiOnly(s) { return san(s).replace(/[^\x20-\x7E]/g, function (ch) { return ch === '\t' ? ' ' : '?'; }); }

function wrapText(text, font, size, maxWidth) {
  var words = san(text).split(/\s+/).filter(function (w) { return w.length > 0; });
  var lines = [];
  var cur = '';
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var trial = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) { cur = trial; continue; }
    if (cur) lines.push(cur);
    // hard-split over-long words (hashes, URLs)
    while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
      var cut = w.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(w.substring(0, cut), size) > maxWidth) cut--;
      lines.push(w.substring(0, cut));
      w = w.substring(cut);
    }
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function truncHash(h, pre, suf) {
  if (!h) return 'n/a';
  h = String(h);
  if (h.length <= pre + suf + 3) return h;
  return h.substring(0, pre) + '…' + h.substring(h.length - suf);
}
function fmtBytes(n) {
  if (!n && n !== 0) return 'n/a';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
function fmtDate(d) {
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmtDateStamp(d) { return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
function sevLabel(s) {
  return s >= 5 ? 'CRITICAL' : s >= 4 ? 'HIGH' : s >= 3 ? 'MEDIUM' : s >= 2 ? 'LOW' : 'INFO';
}
function centerX(text, font, size) { return (PW - font.widthOfTextAtSize(text, size)) / 2; }

// extract first page anchor from an engine location string
function pageAnchor(location) {
  if (!location) return '—';
  var m = String(location).match(/Page\s+(\d+)(\s+vs\s+Page\s+(\d+))?/i);
  if (m) return m[3] ? m[1] + ' vs ' + m[3] : m[1];
  if (/full document/i.test(String(location))) return 'Full doc';
  return '—';
}
// all individual page numbers referenced by a location string
function pageNumbers(location) {
  if (!location) return [];
  var out = [];
  var re = /Page\s+(\d+)/gi, m;
  while ((m = re.exec(String(location))) !== null) out.push(parseInt(m[1], 10));
  return out;
}
// wrap engine evidence in quotes unless it already carries its own quotes
function quoteEvidence(ev) {
  ev = ev || '';
  if (ev.indexOf('"') !== -1) return ev;
  return '"' + ev + '"';
}

// fetch an image; validate it is actually a PNG before returning bytes (site hosts
// return an HTML fallback page for missing assets, which would crash embedPng)
async function fetchPng(url) {
  try {
    if (typeof fetch !== 'function') return null;
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    var ct = (res.headers.get('content-type') || '').toLowerCase();
    var buf = await res.arrayBuffer();
    var b = new Uint8Array(buf);
    // PNG magic: 89 50 4E 47
    if (b.length < 8 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4E || b[3] !== 0x47) {
      if (ct.indexOf('image/png') === -1) return null;
    }
    if (b.length < 8 || b[0] !== 0x89 || b[1] !== 0x50) return null;
    return buf;
  } catch (e) { return null; }
}

// ================= layout context =================
function makeCtx(doc, fonts, images, sourceName) {
  var ctx = {
    doc: doc,
    f: fonts,
    logoImg: images.logo || null,
    wmImg: images.watermark || null,
    sourceName: sourceName || 'document.pdf',
    page: null,
    y: BODY_TOP,
    tocEntries: [],   // {title, pageNum, level}
    sectionNo: 0
  };

  ctx.drawWatermark = function (pg) {
    if (!ctx.wmImg) return;
    var scale = Math.min((PW * 0.72) / ctx.wmImg.width, (PH * 0.72) / ctx.wmImg.height);
    var w = ctx.wmImg.width * scale, h = ctx.wmImg.height * scale;
    pg.drawImage(ctx.wmImg, { x: (PW - w) / 2, y: (PH - h) / 2 - 10, width: w, height: h, opacity: 0.15 });
  };

  // header band on body pages: leaves right 92pt for the seal QR (added by seal())
  ctx.drawHeader = function (pg) {
    var rgb = PDFLibRef.rgb;
    var boxX = 40, boxW = 436, boxTop = PH - 28, boxH = 52;
    pg.drawRectangle({
      x: boxX, y: boxTop - boxH, width: boxW, height: boxH,
      borderColor: NAVY2, borderWidth: 0.8, color: WHITE, opacity: 1
    });
    pg.drawText(san('Verum Omnis Forensic Report'), {
      x: boxX + 10, y: boxTop - 20, size: 13, font: ctx.f.timesBold, color: NAVY2
    });
    var src = 'Source: ' + ctx.sourceName;
    src = wrapText(src, ctx.f.times, 9, boxW - 20)[0];
    pg.drawText(san(src), { x: boxX + 10, y: boxTop - 36, size: 9, font: ctx.f.times, color: GRAY });
    pg.drawLine({
      start: { x: boxX, y: boxTop - boxH - 6 }, end: { x: boxX + boxW, y: boxTop - boxH - 6 },
      thickness: 1, color: GOLD
    });
  };

  ctx.newBodyPage = function () {
    var pg = ctx.doc.addPage([PW, PH]);
    ctx.drawWatermark(pg);
    ctx.drawHeader(pg);
    ctx.page = pg;
    ctx.y = BODY_TOP;
    return pg;
  };

  ctx.pageNum = function () { return ctx.doc.getPageCount(); };

  ctx.ensure = function (h) {
    if (ctx.y - h < BODY_BOTTOM) ctx.newBodyPage();
  };

  ctx.gap = function (h) { ctx.y -= h; };

  // gold serif section heading with thin gold rule; records TOC entry
  ctx.heading = function (title, opts2) {
    opts2 = opts2 || {};
    var h = 34;
    ctx.ensure(h + (opts2.keepWith || 0));
    ctx.sectionNo++;
    var label = opts2.label || (ctx.sectionNo + '. ' + title);
    ctx.y -= 8;
    ctx.page.drawText(san(label), { x: LM, y: ctx.y - 12, size: 13.5, font: ctx.f.timesBold, color: GOLD });
    ctx.y -= 18;
    ctx.page.drawLine({ start: { x: LM, y: ctx.y }, end: { x: PW - RM, y: ctx.y }, thickness: 0.9, color: GOLD });
    ctx.y -= 14;
    if (!opts2.noToc) ctx.tocEntries.push({ title: label, pageNum: ctx.pageNum(), level: 0 });
    return label;
  };

  ctx.subHeading = function (title, opts2) {
    opts2 = opts2 || {};
    ctx.ensure(26 + (opts2.keepWith || 0));
    ctx.page.drawText(san(title), { x: LM, y: ctx.y - 10, size: 11, font: ctx.f.timesBold, color: NAVY2 });
    ctx.y -= 16;
    if (opts2.toc) ctx.tocEntries.push({ title: title, pageNum: ctx.pageNum(), level: 1 });
  };

  ctx.para = function (text, o) {
    o = o || {};
    var size = o.size || 10, font = o.font || ctx.f.times, color = o.color || INK;
    var indent = o.indent || 0, leading = o.leading || size * 1.38;
    var lines = wrapText(text, font, size, CW - indent);
    ctx.ensure(lines.length * leading + 4);
    for (var i = 0; i < lines.length; i++) {
      ctx.y -= leading;
      ctx.page.drawText(lines[i], { x: LM + indent, y: ctx.y, size: size, font: font, color: color });
    }
    ctx.y -= (o.after !== undefined ? o.after : 6);
  };

  // bullet line: gold dash + wrapped text
  ctx.bullet = function (text, o) {
    o = o || {};
    var size = o.size || 9.5, font = o.font || ctx.f.times;
    var lines = wrapText(text, font, size, CW - 16);
    ctx.ensure(lines.length * (size * 1.35) + 4);
    for (var i = 0; i < lines.length; i++) {
      ctx.y -= size * 1.35;
      if (i === 0) ctx.page.drawText('–', { x: LM + 2, y: ctx.y, size: size, font: ctx.f.timesBold, color: GOLD });
      ctx.page.drawText(lines[i], { x: LM + 16, y: ctx.y, size: size, font: font, color: o.color || INK });
    }
    ctx.y -= (o.after !== undefined ? o.after : 3);
  };

  // bordered info box with wrapped body text (declaration / score boxes)
  ctx.box = function (title, bodyLines, o) {
    o = o || {};
    var size = o.size || 10;
    var titleH = title ? 20 : 8;
    var wrapped = [];
    for (var i = 0; i < bodyLines.length; i++) {
      var ls = wrapText(bodyLines[i], ctx.f.times, size, CW - 28);
      for (var j = 0; j < ls.length; j++) wrapped.push(ls[j]);
    }
    var boxH = titleH + wrapped.length * (size * 1.4) + 14;
    ctx.ensure(boxH + 8);
    var top = ctx.y;
    ctx.page.drawRectangle({ x: LM, y: top - boxH, width: CW, height: boxH, color: o.bg || BOXBG, borderColor: o.border || GOLD, borderWidth: 1 });
    var ty = top - 14;
    if (title) {
      ctx.page.drawText(san(title), { x: LM + 12, y: ty, size: 10, font: ctx.f.timesBold, color: o.titleColor || RED });
      ty -= 16;
    }
    for (var k = 0; k < wrapped.length; k++) {
      ctx.page.drawText(wrapped[k], { x: LM + 12, y: ty, size: size, font: ctx.f.times, color: INK });
      ty -= size * 1.4;
    }
    ctx.y = top - boxH - 10;
  };

  /* table renderer.
     cols: [{key, title, w, align}] widths sum to CW.
     rows: array of objects; cell values wrapped; header repeats on page breaks. */
  ctx.table = function (cols, rows, o) {
    o = o || {};
    var size = o.size || 8.5, pad = 4, leading = size * 1.28;
    var headerH = 16;
    function drawHeaderRow() {
      ctx.page.drawRectangle({ x: LM, y: ctx.y - headerH, width: CW, height: headerH, color: LIGHT, borderColor: TBORDER, borderWidth: 0.6 });
      var x = LM;
      for (var c = 0; c < cols.length; c++) {
        ctx.page.drawText(san(cols[c].title), { x: x + pad, y: ctx.y - headerH + 5, size: size, font: ctx.f.timesBold, color: NAVY2 });
        x += cols[c].w;
      }
      ctx.y -= headerH;
    }
    ctx.ensure(headerH + 22);
    drawHeaderRow();
    for (var r = 0; r < rows.length; r++) {
      // compute row height from wrapped cells
      var cellLines = [], maxLines = 1, c2;
      for (c2 = 0; c2 < cols.length; c2++) {
        var font = cols[c2].font || ctx.f.times;
        var ls = wrapText(rows[r][cols[c2].key] === undefined ? '' : rows[r][cols[c2].key], font, size, cols[c2].w - pad * 2);
        cellLines.push(ls);
        if (ls.length > maxLines) maxLines = ls.length;
      }
      var rowH = maxLines * leading + pad * 2 - 1;
      if (ctx.y - rowH < BODY_BOTTOM) { ctx.newBodyPage(); drawHeaderRow(); }
      if (r % 2 === 1) ctx.page.drawRectangle({ x: LM, y: ctx.y - rowH, width: CW, height: rowH, color: ROW_ALT });
      ctx.page.drawRectangle({ x: LM, y: ctx.y - rowH, width: CW, height: rowH, borderColor: TBORDER, borderWidth: 0.4 });
      var x2 = LM;
      for (c2 = 0; c2 < cols.length; c2++) {
        var f2 = cols[c2].font || ctx.f.times;
        var col = cols[c2].color || INK;
        for (var li = 0; li < cellLines[c2].length; li++) {
          var tx = cellLines[c2][li];
          var txX = x2 + pad;
          if (cols[c2].align === 'right') txX = x2 + cols[c2].w - pad - f2.widthOfTextAtSize(tx, size);
          if (cols[c2].align === 'center') txX = x2 + (cols[c2].w - f2.widthOfTextAtSize(tx, size)) / 2;
          ctx.page.drawText(tx, { x: txX, y: ctx.y - pad - size - li * leading, size: size, font: f2, color: col });
        }
        x2 += cols[c2].w;
      }
      ctx.y -= rowH;
    }
    ctx.y -= 10;
  };

  return ctx;
}

// ================= COVER =================
function drawCover(ctx, data) {
  var pg = ctx.doc.addPage([PW, PH]);
  // navy full bleed
  pg.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: NAVY });
  pg.drawRectangle({ x: 0, y: 0, width: PW, height: 6, color: GOLD });
  pg.drawRectangle({ x: 0, y: PH - 6, width: PW, height: 6, color: GOLD });

  // confidential banner
  var banner = 'CONFIDENTIAL — LAW ENFORCEMENT SENSITIVE';
  pg.drawText(banner, { x: centerX(banner, ctx.f.helvBold, 8.5), y: PH - 42, size: 8.5, font: ctx.f.helvBold, color: RED });

  // logo (fallback: wordmark text)
  var y = PH - 100;
  if (ctx.logoImg) {
    var lw = 210, lh = lw * (ctx.logoImg.height / ctx.logoImg.width);
    // logo art sits on navy; draw slightly light navy card behind for contrast
    pg.drawImage(ctx.logoImg, { x: (PW - lw) / 2, y: y - lh, width: lw, height: lh });
    y -= lh + 26;
  } else {
    pg.drawText('VERUM OMNIS', { x: centerX('VERUM OMNIS', ctx.f.timesBold, 30), y: y - 30, size: 30, font: ctx.f.timesBold, color: WHITE });
    var tag = 'A I   F O R E N S I C S   F O R   T R U T H';
    pg.drawText(tag, { x: centerX(tag, ctx.f.times, 9), y: y - 50, size: 9, font: ctx.f.times, color: GOLD });
    y -= 76;
  }

  // title
  var title = 'FORENSIC EVIDENCE REPORT';
  pg.drawText(title, { x: centerX(title, ctx.f.timesBold, 25), y: y - 10, size: 25, font: ctx.f.timesBold, color: WHITE });
  y -= 34;

  // case / document name + investigation subtitle
  var caseName = data.identity.caseName || data.docName.replace(/\.pdf$/i, '');
  caseName = wrapText(caseName, ctx.f.times, 14, 460)[0];
  pg.drawText(san(caseName), { x: centerX(caseName, ctx.f.times, 14), y: y, size: 14, font: ctx.f.times, color: COVER_SUB });
  y -= 22;
  var sub = data.identity.subtitle || 'Deterministic Forensic Contradiction Investigation';
  pg.drawText(san(sub), { x: centerX(sub, ctx.f.timesItalic, 10.5), y: y, size: 10.5, font: ctx.f.timesItalic, color: GOLD });
  y -= 14;

  // gold rules
  pg.drawLine({ start: { x: PW / 2 - 130, y: y }, end: { x: PW / 2 + 130, y: y }, thickness: 0.8, color: GOLD });
  y -= 26;

  // reference / date / source lines
  function cLine(txt, font, size, color, dy) {
    pg.drawText(san(txt), { x: centerX(san(txt), font, size), y: y, size: size, font: font, color: color });
    y -= dy;
  }
  cLine('Report Reference: ' + data.reference, ctx.f.courier, 9, LGRAY, 16);
  cLine('Date: ' + fmtDate(data.generatedAt), ctx.f.times, 10, COVER_TXT, 16);
  cLine('Source Document: ' + data.docName + '  (' + data.pageCount + ' page' + (data.pageCount === 1 ? '' : 's') + ')', ctx.f.times, 10, COVER_TXT, 16);
  cLine('Source SHA-512: ' + truncHash(data.sha512, 24, 12), ctx.f.courier, 7.5, LGRAY, 20);

  // optional identity rows (only if user supplied)
  if (data.identity.fullName) cLine('Prepared for: ' + data.identity.fullName, ctx.f.times, 9.5, COVER_TXT, 15);
  if (data.identity.parties) cLine('Parties: ' + data.identity.parties, ctx.f.times, 9.5, COVER_TXT, 15);
  if (data.identity.jurisdiction) cLine('Jurisdiction: ' + data.identity.jurisdiction, ctx.f.timesBold, 9.5, GOLD, 15);

  // bottom block
  pg.drawText('CONSTITUTIONAL FORENSIC AI V ' + CONSTITUTION_VERSION, { x: centerX('CONSTITUTIONAL FORENSIC AI V ' + CONSTITUTION_VERSION, ctx.f.helvBold, 7), y: 58, size: 7, font: ctx.f.helvBold, color: LGRAY });
  pg.drawText('VERUM OMNIS  |  AI FORENSICS FOR TRUTH', { x: centerX('VERUM OMNIS  |  AI FORENSICS FOR TRUTH', ctx.f.helv, 7), y: 44, size: 7, font: ctx.f.helv, color: LGRAY });
}

// ================= TABLE OF CONTENTS (drawn last, placed page 2) =================
function drawToc(ctx, tocPage) {
  var y = PH - 120;
  tocPage.drawText('TABLE OF CONTENTS', { x: LM, y: y, size: 15, font: ctx.f.timesBold, color: NAVY2 });
  y -= 8;
  tocPage.drawLine({ start: { x: LM, y: y }, end: { x: PW - RM, y: y }, thickness: 0.9, color: GOLD });
  y -= 26;
  for (var i = 0; i < ctx.tocEntries.length; i++) {
    var e = ctx.tocEntries[i];
    var size = e.level === 0 ? 10.5 : 9.5;
    var font = e.level === 0 ? ctx.f.timesBold : ctx.f.times;
    var indent = e.level === 0 ? 0 : 18;
    var title = san(e.title);
    var pageStr = String(e.pageNum);
    var pageW = ctx.f.times.widthOfTextAtSize(pageStr, size);
    var titleW = font.widthOfTextAtSize(title, size);
    var dotsX = LM + indent + titleW + 4;
    var dotsEnd = PW - RM - pageW - 6;
    if (dotsEnd > dotsX) {
      var dotW = ctx.f.times.widthOfTextAtSize('.', size);
      var nDots = Math.floor((dotsEnd - dotsX) / (dotW * 2));
      var dots = '';
      for (var d = 0; d < nDots; d++) dots += '. ';
      tocPage.drawText(dots, { x: dotsX, y: y, size: size, font: ctx.f.times, color: LGRAY });
    }
    tocPage.drawText(title, { x: LM + indent, y: y, size: size, font: font, color: e.level === 0 ? NAVY2 : INK });
    tocPage.drawText(pageStr, { x: PW - RM - pageW, y: y, size: size, font: ctx.f.times, color: INK });
    y -= e.level === 0 ? 20 : 15;
    if (y < BODY_BOTTOM + 20) break; // TOC is one page; entries are few
  }
}

// ================= SECTION: EXECUTIVE SUMMARY =================
function secExecSummary(ctx, data) {
  ctx.newBodyPage();
  ctx.heading('EXECUTIVE SUMMARY');

  var fr = data.findings;
  var score = fr.overallScore || 0;
  var band = fr.confidence || 'CLEAN';
  var bandLabel = { CLEAN: 'CLEAN', LOW: 'LOW', MODERATE: 'MODERATE', HIGH: 'HIGH', VERY_HIGH: 'VERY HIGH' }[band] || band;

  // score box
  var boxH = 86;
  ctx.ensure(boxH + 8);
  ctx.page.drawRectangle({ x: LM, y: ctx.y - boxH, width: CW, height: boxH, color: BOXBG, borderColor: GOLD, borderWidth: 1 });
  var scoreStr = score + ' / 100';
  ctx.page.drawText(scoreStr, { x: LM + 18, y: ctx.y - 44, size: 26, font: ctx.f.timesBold, color: score >= 40 ? RED : NAVY2 });
  ctx.page.drawText('Overall forensic score', { x: LM + 18, y: ctx.y - 60, size: 9, font: ctx.f.times, color: GRAY });
  ctx.page.drawText('Confidence band: ' + bandLabel, { x: LM + 200, y: ctx.y - 34, size: 11, font: ctx.f.timesBold, color: NAVY2 });
  ctx.page.drawText('Total findings: ' + (fr.totalFindings || 0), { x: LM + 200, y: ctx.y - 50, size: 10, font: ctx.f.times, color: INK });
  ctx.page.drawText('Contradiction types triggered: ' + (fr.contradictionTypesUsed || 0) + ' / ' + CT_COUNT, { x: LM + 200, y: ctx.y - 64, size: 10, font: ctx.f.times, color: INK });
  ctx.y -= boxH + 12;

  // engine's own summary sentence (honest, engine-generated)
  if (fr.scanFailed) ctx.para('NOTE: the deterministic scan could not complete on this file. Scores shown are not meaningful; the seal itself is unaffected.', { size: 9.5, font: ctx.f.timesBold, color: RED, after: 8 });
  if (fr.summary) ctx.para(fr.summary, { size: 10, after: 10 });
  if (!fr.clean) {
    ctx.para('Score language: indicators detected — see findings. Keyword and pattern hits are investigative indicators, not determinations of fraud or guilt.', { size: 9, font: ctx.f.timesItalic, color: GRAY, after: 12 });
  }

  // findings by severity
  var sevCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  var all = fr.findings || [];
  for (var i = 0; i < all.length; i++) {
    var s = Math.max(1, Math.min(5, all[i].severity || 1));
    sevCounts[s]++;
  }
  ctx.subHeading('Findings by severity');
  ctx.table(
    [
      { key: 'sev', title: 'Severity', w: 130 },
      { key: 'meaning', title: 'Band', w: 220 },
      { key: 'count', title: 'Count', w: 154, align: 'right' }
    ],
    [
      { sev: '5 — Critical', meaning: 'Strongest contradiction indicators', count: String(sevCounts[5]) },
      { sev: '4 — High', meaning: 'Significant indicators', count: String(sevCounts[4]) },
      { sev: '3 — Medium', meaning: 'Moderate indicators', count: String(sevCounts[3]) },
      { sev: '2 — Low', meaning: 'Minor anomalies', count: String(sevCounts[2]) },
      { sev: '1 — Info', meaning: 'Informational only', count: String(sevCounts[1]) }
    ],
    { size: 9 }
  );

  // top 5 findings
  ctx.subHeading('Top findings (by severity)');
  if (all.length === 0) {
    ctx.para('No findings were produced by the deterministic engine for this document.', { size: 10 });
  } else {
    var sorted = all.slice().sort(function (a, b) { return (b.severity || 0) - (a.severity || 0); });
    var top = sorted.slice(0, 5);
    for (var t = 0; t < top.length; t++) {
      var fnd = top[t];
      var label = (fnd.type === 'SERIAL' ? (fnd.serialName || 'Serial pattern') : (fnd.type + ' ' + (CT_NAMES[fnd.type] || '')));
      ctx.bullet(label + ' — p. ' + pageAnchor(fnd.location) + ' — ' + quoteEvidence(fnd.evidence), { size: 9.5, after: 5 });
    }
  }

  // evidence stats
  ctx.subHeading('Evidence statistics');
  var doc0 = data.documents[0] || {};
  ctx.table(
    [
      { key: 'k', title: 'Measure', w: 180 },
      { key: 'v', title: 'Value', w: 324 }
    ],
    [
      { k: 'Documents analysed', v: String(data.documents.length) },
      { k: 'Pages', v: String(doc0.pageCount || data.pageCount || 'n/a') },
      { k: 'Size', v: fmtBytes(doc0.bytes) },
      { k: 'SHA-512', v: doc0.sha512 || 'n/a' }
    ],
    { size: 8.5 }
  );
}

// ================= SECTION: DOCUMENT & EVIDENCE INDEX =================
function secEvidenceIndex(ctx, data) {
  ctx.newBodyPage();
  ctx.heading('DOCUMENT & EVIDENCE INDEX');
  ctx.para('Each source document below was sealed under VO-DSS. The SHA-512 fingerprint and seal identifier bind this report to the exact bytes analysed.', { size: 9.5, after: 10 });

  var rows = [];
  for (var i = 0; i < data.documents.length; i++) {
    var d = data.documents[i];
    rows.push({
      name: d.name || 'document.pdf',
      pages: String(d.pageCount || 'n/a'),
      hash: truncHash(d.sha512, 20, 10),
      seal: d.sealId || 'n/a'
    });
  }
  ctx.table(
    [
      { key: 'name', title: 'Document', w: 190 },
      { key: 'pages', title: 'Pages', w: 44, align: 'center' },
      { key: 'hash', title: 'SHA-512 (truncated)', w: 170, font: ctx.f.courier },
      { key: 'seal', title: 'Seal ID', w: 100, font: ctx.f.courier }
    ],
    rows,
    { size: 8 }
  );

  ctx.subHeading('Full SHA-512 fingerprints');
  for (var j = 0; j < data.documents.length; j++) {
    var d2 = data.documents[j];
    ctx.para((d2.name || 'document') + ':', { size: 9, font: ctx.f.timesBold, after: 2 });
    ctx.para(d2.sha512 || 'n/a', { size: 7.5, font: ctx.f.courier, color: GRAY, after: 8 });
  }
}

// ================= SECTION: FINDINGS & CONTRADICTION MATRIX =================
function secMatrix(ctx, data) {
  ctx.newBodyPage();
  ctx.heading('FINDINGS & CONTRADICTION MATRIX');
  var all = (data.findings && data.findings.findings) || [];
  var MAX_ROWS = 40;

  if (data.findings && data.findings.scanFailed) {
    ctx.para('The forensic scan could not complete on this document' + (data.findings.extractionNotes ? ': ' + data.findings.extractionNotes : '.'), { size: 10 });
    ctx.para('No findings are available. The document seal (hash, timestamp, QR) is unaffected, but this report contains no contradiction analysis. Re-submit or retry on a desktop computer if analysis is required.', { size: 9, font: ctx.f.timesItalic, color: GRAY });
    return;
  }

  if (all.length === 0) {
    ctx.para('No contradictions or forensic indicators were detected by the deterministic engine in this document. All ' + DETECTOR_COUNT + ' detectors and ' + SP_COUNT + ' serial patterns ran; none triggered.', { size: 10 });
    ctx.para('This is not a certification of truthfulness — it means no internal inconsistencies were found by deterministic methods.', { size: 9, font: ctx.f.timesItalic, color: GRAY });
    return;
  }

  ctx.para('Every finding below was produced by the deterministic engine and is anchored to the quoted text and page reference shown. Grouped by engine category; sorted by severity within each category.', { size: 9.5, after: 10 });

  // group by category
  var byCat = {};
  for (var i = 0; i < all.length; i++) {
    var f = all[i];
    if (f.type === 'SERIAL') continue; // serial patterns get their own section
    var cat = CT_CATEGORY[f.type] || f.category || 'DIGITAL';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(f);
  }

  var subNo = 0;
  for (var c = 0; c < CATEGORY_ORDER.length; c++) {
    var cat2 = CATEGORY_ORDER[c];
    var list = byCat[cat2];
    if (!list || list.length === 0) continue;
    subNo++;
    list.sort(function (a, b) { return (b.severity || 0) - (a.severity || 0); });
    ctx.subHeading('3.' + subNo + ' ' + (CATEGORY_LABEL[cat2] || cat2) + '  (' + list.length + ' finding' + (list.length === 1 ? '' : 's') + ')', { toc: true });

    var shown = list.slice(0, MAX_ROWS);
    var rows = [];
    for (var r2 = 0; r2 < shown.length; r2++) {
      var g = shown[r2];
      var det = CT_DETECTOR[g.type] || '—';
      rows.push({
        n: String(r2 + 1),
        det: det + ' · ' + g.type + ' ' + (CT_NAMES[g.type] || g.type),
        claim: quoteEvidence(g.evidence),
        page: pageAnchor(g.location),
        sev: (g.severity || '') + ' ' + sevLabel(g.severity || 0)
      });
    }
    ctx.table(
      [
        { key: 'n', title: '#', w: 24, align: 'center' },
        { key: 'det', title: 'Detector / Type', w: 118 },
        { key: 'claim', title: 'Claim (anchor quote)', w: 262 },
        { key: 'page', title: 'Page', w: 52, align: 'center' },
        { key: 'sev', title: 'Severity', w: 48 }
      ],
      rows,
      { size: 7.5 }
    );
    if (list.length > shown.length) {
      ctx.para('Showing ' + shown.length + ' of ' + list.length + ' findings in this category (highest severity first). All ' + list.length + ' findings were included in the deterministic scoring and counts; the print layout is truncated for readability.', { size: 8.5, font: ctx.f.timesItalic, color: GRAY, after: 10 });
    }
  }

  // offence-style summary
  ctx.subHeading('Finding type summary', { toc: true });
  var byType = {};
  for (var q = 0; q < all.length; q++) {
    var h = all[q];
    var key = h.type === 'SERIAL' ? 'SERIAL' : h.type;
    if (!byType[key]) byType[key] = { count: 0, maxSev: 0, pages: {} };
    byType[key].count++;
    if ((h.severity || 0) > byType[key].maxSev) byType[key].maxSev = h.severity || 0;
    var pnums = pageNumbers(h.location);
    for (var pn = 0; pn < pnums.length; pn++) byType[key].pages[pnums[pn]] = true;
  }
  var typeRows = [];
  var idx = 1;
  for (var tkey in byType) {
    var bt = byType[tkey];
    typeRows.push({
      n: String(idx++),
      type: tkey === 'SERIAL' ? 'Serial patterns' : (tkey + ' ' + (CT_NAMES[tkey] || '')),
      count: String(bt.count),
      maxsev: bt.maxSev + ' ' + sevLabel(bt.maxSev),
      pages: Object.keys(bt.pages).map(Number).sort(function (a, b) { return a - b; }).slice(0, 8).join(', ') || '—'
    });
  }
  typeRows.sort(function (a, b) { return parseInt(b.count, 10) - parseInt(a.count, 10); });
  for (var rr = 0; rr < typeRows.length; rr++) typeRows[rr].n = String(rr + 1);
  ctx.table(
    [
      { key: 'n', title: '#', w: 24, align: 'center' },
      { key: 'type', title: 'Finding type', w: 230 },
      { key: 'count', title: 'Count', w: 60, align: 'right' },
      { key: 'maxsev', title: 'Highest severity', w: 100 },
      { key: 'pages', title: 'Pages', w: 90 }
    ],
    typeRows,
    { size: 8 }
  );
}

// ================= SECTION: SERIAL PATTERN ANALYSIS =================
function secSerial(ctx, data) {
  ctx.newBodyPage();
  ctx.heading('SERIAL PATTERN ANALYSIS');
  var all = (data.findings && data.findings.findings) || [];
  var serial = [];
  for (var i = 0; i < all.length; i++) if (all[i].type === 'SERIAL') serial.push(all[i]);

  if (serial.length === 0) {
    ctx.para('No serial patterns detected.', { size: 10.5, after: 6 });
    ctx.para('The engine evaluated ' + SP_COUNT + ' known multi-stage fraud patterns against the document text. None matched the required stage threshold.', { size: 9, font: ctx.f.timesItalic, color: GRAY });
    return;
  }
  ctx.para(serial.length + ' serial pattern' + (serial.length === 1 ? '' : 's') + ' detected. Serial patterns are multi-stage fraud schemes; a match means several stages of a known pattern were found in the document text.', { size: 9.5, after: 10 });
  var rows = [];
  for (var s = 0; s < serial.length; s++) {
    rows.push({
      n: String(s + 1),
      name: serial[s].serialName || serial[s].serialPattern || 'Serial pattern',
      evidence: quoteEvidence(serial[s].evidence),
      sev: (serial[s].severity || '') + ' ' + sevLabel(serial[s].severity || 0)
    });
  }
  ctx.table(
    [
      { key: 'n', title: '#', w: 24, align: 'center' },
      { key: 'name', title: 'Pattern', w: 130 },
      { key: 'evidence', title: 'Matched stages (engine evidence)', w: 302 },
      { key: 'sev', title: 'Severity', w: 48 }
    ],
    rows,
    { size: 8 }
  );
}

// ================= SECTION: TIMELINE ANALYSIS =================
function secTimeline(ctx, data) {
  ctx.newBodyPage();
  ctx.heading('TIMELINE ANALYSIS');
  var all = (data.findings && data.findings.findings) || [];
  var dateFindings = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].type === 'CT03' || all[i].type === 'CT04' || all[i].type === 'CT29') dateFindings.push(all[i]);
  }
  ctx.para('The deterministic engine (v' + ENGINE_VERSION + ') does not emit a structured event timeline. Date- and sequence-related findings are reproduced below from the contradiction matrix.', { size: 9.5, after: 8 });
  if (dateFindings.length === 0) {
    ctx.para('No date, sequence, or timestamp inconsistencies were detected.', { size: 10, after: 6 });
  } else {
    var rows = [];
    for (var d = 0; d < dateFindings.length; d++) {
      rows.push({
        n: String(d + 1),
        type: dateFindings[d].type + ' ' + (CT_NAMES[dateFindings[d].type] || ''),
        evidence: quoteEvidence(dateFindings[d].evidence),
        page: pageAnchor(dateFindings[d].location)
      });
    }
    ctx.table(
      [
        { key: 'n', title: '#', w: 24, align: 'center' },
        { key: 'type', title: 'Type', w: 130 },
        { key: 'evidence', title: 'Engine evidence', w: 298 },
        { key: 'page', title: 'Page', w: 52, align: 'center' }
      ],
      rows,
      { size: 8 }
    );
  }
  ctx.para('Full timeline reconstruction and event ordering require AI consensus review — pending.', { size: 9, font: ctx.f.timesItalic, color: GRAY });
}

// ================= SECTION: DECLARATION =================
function secDeclaration(ctx, data) {
  ctx.newBodyPage();
  ctx.heading('DECLARATION');
  ctx.box(null, [
    'This report was generated by the Verum Omnis Constitutional Forensic AI v' + CONSTITUTION_VERSION + ' deterministic engine (' + CT_COUNT + ' contradiction types, ' + DETECTOR_COUNT + ' detectors). All findings are anchored to quoted text at the page references shown. AI consensus review (multi-model) has NOT been applied to this report. Findings are indicators for investigation, not determinations of guilt. Sealed under VO-DSS-1.2; SHA-512 fingerprint and OpenTimestamps status overleaf.'
  ], { size: 10.5 });
  ctx.gap(6);
  ctx.para('Generated: ' + data.generatedAt.toISOString(), { size: 9, font: ctx.f.courier, color: GRAY, after: 2 });
  ctx.para('Report reference: ' + data.reference, { size: 9, font: ctx.f.courier, color: GRAY, after: 2 });
  ctx.para('Engine: Forensic Contradiction Engine v' + ENGINE_VERSION + ' — deterministic mode', { size: 9, font: ctx.f.courier, color: GRAY, after: 2 });
}

// ================= SECTION: METHODOLOGY & AUTHENTICATION =================
function secMethodology(ctx, data) {
  ctx.newBodyPage();
  ctx.heading('METHODOLOGY & AUTHENTICATION');

  ctx.subHeading('What ran');
  ctx.bullet('Engine: Verum Omnis Forensic Contradiction Engine v' + ENGINE_VERSION + ' (Constitutional Forensic AI v' + CONSTITUTION_VERSION + ').', { size: 9.5 });
  ctx.bullet('Detectors run: ' + DETECTOR_COUNT + ' deterministic detectors across ' + CT_COUNT + ' contradiction types, plus ' + SP_COUNT + ' serial-pattern definitions.', { size: 9.5 });
  ctx.bullet('Mode: deterministic — keyword, pattern, numeric and structural heuristics over extracted page text. No generative AI was used to produce findings.', { size: 9.5 });
  ctx.bullet('AI consensus review (multi-model, Gemma): NOT applied — pending.', { size: 9.5 });
  ctx.bullet('Text extraction: ' + (data.extractionNotes || 'per-page PDF content-stream decoding with ToUnicode CMaps.'), { size: 9.5 });
  ctx.gap(4);

  ctx.subHeading('Scoring');
  ctx.para('Each finding carries a severity weight of 1–5. The overall score is severity-weighted and normalised to 0–100: sum(severity) / (5 × findings) × 100. Confidence bands: <20 CLEAN, 20–39 LOW, 40–59 MODERATE, 60–79 HIGH, ≥80 VERY HIGH. The band reflects the density and severity of internal inconsistencies, not a probability of fraud.', { size: 9.5, after: 10 });

  ctx.subHeading('Authentication');
  var rows = [];
  for (var i = 0; i < data.documents.length; i++) {
    var d = data.documents[i];
    rows.push({
      name: d.name || 'document.pdf',
      pages: String(d.pageCount || 'n/a'),
      hash: truncHash(d.sha512, 16, 8),
      seal: d.sealId || 'n/a'
    });
  }
  ctx.table(
    [
      { key: 'name', title: 'Document', w: 180 },
      { key: 'pages', title: 'Pages', w: 44, align: 'center' },
      { key: 'hash', title: 'SHA-512 (truncated)', w: 170, font: ctx.f.courier },
      { key: 'seal', title: 'Seal ID', w: 110, font: ctx.f.courier }
    ],
    rows,
    { size: 8 }
  );
  for (var j = 0; j < data.documents.length; j++) {
    ctx.para('SHA-512 (' + (data.documents[j].name || 'document') + '):', { size: 8.5, font: ctx.f.timesBold, after: 1 });
    ctx.para(data.documents[j].sha512 || 'n/a', { size: 7.5, font: ctx.f.courier, color: GRAY, after: 6 });
  }

  ctx.subHeading('OpenTimestamps status');
  if (data.ots && data.ots.submitted) {
    ctx.bullet('Source document digest: submitted to OpenTimestamps calendar (' + (data.ots.calendar || 'public calendar') + ') — Bitcoin confirmation PENDING. Not yet anchored.', { size: 9.5 });
  } else {
    ctx.bullet('Source document digest: OpenTimestamps submission OFFLINE — calendar unreachable; the SHA-256 digest was recorded for retry.', { size: 9.5 });
  }
  ctx.bullet('This report is itself sealed under VO-DSS after generation: per-page seal footer, verification QR, and PDF Subject metadata VO-SEAL|SHA-512|SEAL_ID. The report seal fingerprint appears in the page footer below.', { size: 9.5 });
  ctx.gap(6);

  ctx.para('Verum Omnis  |  verumglobal.foundation  |  Verify this report at verumglobal.foundation/verify.html', { size: 8.5, color: GRAY });
}

// ================= BUILD =================
async function build(opts) {
  opts = opts || {};
  var fr = opts.findings || { clean: true, overallScore: 0, confidence: 'CLEAN', totalFindings: 0, findings: [], summary: '' };
  var docs = opts.documents && opts.documents.length ? opts.documents : [{ name: 'document.pdf', pageCount: 'n/a', sha512: '', sealId: '' }];
  var identity = opts.identity || {};
  var generatedAt = opts.generatedAt ? new Date(opts.generatedAt) : new Date();
  var doc0 = docs[0];
  var reference = identity.reference ||
    ('VO-WEB-' + fmtDateStamp(generatedAt) + '-' + (doc0.sealId ? String(doc0.sealId).replace(/^VO-/, '').substring(8, 12) : Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, '0')));

  var PDFDocument = PDFLibRef.PDFDocument, StandardFonts = PDFLibRef.StandardFonts;
  var doc = await PDFDocument.create();
  var fonts = {
    times: await doc.embedFont(StandardFonts.TimesRoman),
    timesBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    timesItalic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    courier: await doc.embedFont(StandardFonts.Courier),
    courierBold: await doc.embedFont(StandardFonts.CourierBold),
    helv: await doc.embedFont(StandardFonts.Helvetica),
    helvBold: await doc.embedFont(StandardFonts.HelveticaBold)
  };

  // images: explicit bytes in opts.images, else try same-origin fetch (browser only)
  var images = { logo: null, watermark: null };
  var logoBytes = opts.images && opts.images.logo;
  var wmBytes = opts.images && opts.images.watermark;
  if (!logoBytes) logoBytes = await fetchPng('/images/logo-full.png');
  if (!wmBytes) wmBytes = await fetchPng('/images/watermark_portrait.png');
  if (logoBytes) { try { images.logo = await doc.embedPng(logoBytes); } catch (e) { images.logo = null; } }
  if (wmBytes) { try { images.watermark = await doc.embedPng(wmBytes); } catch (e) { images.watermark = null; } }

  var ctx = makeCtx(doc, fonts, images, doc0.name || 'document.pdf');

  var data = {
    findings: fr,
    documents: docs,
    identity: identity,
    generatedAt: generatedAt,
    reference: reference,
    docName: doc0.name || 'document.pdf',
    pageCount: doc0.pageCount || 'n/a',
    sha512: doc0.sha512 || '',
    ots: opts.ots || null,
    extractionNotes: opts.extractionNotes || null
  };

  // 1. cover
  drawCover(ctx, data);
  // 2. TOC placeholder page (drawn last with real page numbers)
  var tocPage = doc.addPage([PW, PH]);
  ctx.drawWatermark(tocPage);
  ctx.drawHeader(tocPage);
  // 3-9. sections
  secExecSummary(ctx, data);
  secEvidenceIndex(ctx, data);
  secMatrix(ctx, data);
  secSerial(ctx, data);
  secTimeline(ctx, data);
  secDeclaration(ctx, data);
  secMethodology(ctx, data);
  // draw TOC now that section page numbers are known
  drawToc(ctx, tocPage);

  try { doc.setTitle('Verum Omnis Forensic Report — ' + (doc0.name || 'document')); } catch (e) {}
  try { doc.setAuthor('Verum Omnis Constitutional Forensic AI'); } catch (e) {}
  try { doc.setProducer('Verum Omnis Forensic Report Builder v1.0 (pdf-lib)'); } catch (e) {}
  try { doc.setCreationDate(generatedAt); } catch (e) {}

  return await doc.save();
}

// ================= SEAL (report through the VO-DSS sealing path) =================
// Adds verification QR panel (top-right), per-page navy seal footer, and
// Subject metadata VO-SEAL|sha512|sealId. OTS is submitted by the caller.
async function seal(reportBytes, sealOpts) {
  sealOpts = sealOpts || {};
  var PDFDocument = PDFLibRef.PDFDocument, StandardFonts = PDFLibRef.StandardFonts, rgb = PDFLibRef.rgb;
  var sealId = sealOpts.sealId || 'VO-UNKNOWN';
  var sha512 = sealOpts.sha512 || '';
  var now = sealOpts.timestamp ? new Date(sealOpts.timestamp) : new Date();
  var ts = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  var pdf = await PDFDocument.load(reportBytes);
  var helv = await pdf.embedFont(StandardFonts.Helvetica);
  var helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  var courier = await pdf.embedFont(StandardFonts.Courier);

  var qrImg = null;
  if (sealOpts.qrDataURL) {
    try {
      var base64 = String(sealOpts.qrDataURL).split(',')[1];
      var binary = (typeof atob === 'function') ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
      var qrBytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) qrBytes[i] = binary.charCodeAt(i);
      qrImg = await pdf.embedPng(qrBytes);
    } catch (e) { qrImg = null; }
  }

  var pages = pdf.getPages();
  var short = sha512 ? sha512.substring(0, 16) + '…' + sha512.substring(sha512.length - 8) : 'n/a';

  for (var p = 0; p < pages.length; p++) {
    var pg = pages[p];
    var sz = pg.getSize();
    var pageW = sz.width, pageH = sz.height;

    // QR panel top-right (aligns with report header band on body pages)
    var panel = 64, px = pageW - 40 - panel + 8, py = pageH - 28 - panel + 6;
    pg.drawRectangle({ x: px, y: py, width: panel, height: panel + 12, color: rgb(1, 1, 1), borderColor: rgb(0.08, 0.13, 0.24), borderWidth: 0.8 });
    if (qrImg) {
      pg.drawImage(qrImg, { x: px + 4, y: py + 12, width: panel - 8, height: panel - 8 });
    } else {
      pg.drawText(sealId.substring(0, 10), { x: px + 4, y: py + panel / 2, size: 6, font: courier, color: rgb(0.3, 0.3, 0.3) });
    }
    var vs = 'VERIFY SEAL';
    pg.drawText(vs, { x: px + (panel - helvBold.widthOfTextAtSize(vs, 5.5)) / 2, y: py + 4, size: 5.5, font: helvBold, color: rgb(0.08, 0.13, 0.24) });

    // navy seal footer on every page
    var fh = 34;
    pg.drawRectangle({ x: 0, y: 0, width: pageW, height: fh, color: NAVY, opacity: 0.97 });
    var line1 = 'VERUM OMNIS SEAL  |  ' + sealId + '  |  ' + short + '  |  ' + (p + 1) + '/' + pages.length;
    pg.drawText(line1, { x: 16, y: fh - 14, size: 6.8, font: courier, color: GOLD });
    var line2 = ts + '  |  verumglobal.foundation  |  OpenTimestamps  |  Patent Pending';
    pg.drawText(line2, { x: 16, y: fh - 25, size: 6.2, font: helv, color: FOOT_TXT });
    pg.drawText('FORENSIC REPORT', { x: pageW - 16 - helvBold.widthOfTextAtSize('FORENSIC REPORT', 6.2), y: fh - 25, size: 6.2, font: helvBold, color: FOOT_TXT });
  }

  try { pdf.setTitle((sealOpts.sourceName || 'document') + ' — Sealed Forensic Report'); } catch (e) {}
  try { pdf.setAuthor('Verum Omnis'); } catch (e) {}
  try { pdf.setSubject('VO-SEAL|' + sha512 + '|' + sealId); } catch (e) {}
  try { pdf.setKeywords(['verum', 'seal', 'forensic-report', sha512.substring(0, 16)]); } catch (e) {}
  try { pdf.setProducer('Verum Omnis Document Sealing Service v1.2.8'); } catch (e) {}
  try { pdf.setCreationDate(now); } catch (e) {}

  return await pdf.save();
}

// ================= exports =================
var api = { build: build, seal: seal, _sanitize: san };
global.VerumReport = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : globalThis);
