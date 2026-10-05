/**
 * "Combine 06 April 2026" regression guard (5 October 2026).
 *
 * The founder sealed a 684-page bundle on the live site the day the
 * evidence-bundle-7 changes went live, and had two AI reviews written of the
 * findings JSON. Reading the sealed report against the engine showed what was
 * wrong underneath: findings first located as "Same passage" or "Full
 * document" were pinned to their page only after the secondary-source pass,
 * so a CT01 on a markdown analysis page (p. 192) and a CT45 inside a Verum
 * Omnis analysis (p. 12) were sealed as findings; no finding on the 203
 * OCR-recovered pages was held; two invoices' "invoice date" (p. 49, p. 680)
 * and two documents' date conventions were called one document's
 * contradiction; an expiry in a page of notes was linked to an invoice 48
 * pages away; scanned pages OCR could barely read were "format anomalies";
 * an identity number in the complainant's field was a finding; "the
 * Premises" of two different sites, one definition read twice by OCR and the
 * tail of "Value of the Franchised Business" were "defined differently"; a
 * conditional clause ("In the event that the Franchisee is the owner") was
 * read as a record of ownership; and a no-compensation clause and a purchase
 * right 176 pages apart were one "trap". Each case below uses the bundle's
 * own wording in a synthetic page; no real matter document is committed.
 * Every guard has a positive control beside it.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const g = globalThis; g.window = g; g.self = g;
new Function('window', 'self', 'globalThis', fs.readFileSync(path.join(process.cwd(), 'vendor/pdf-lib.min.js'), 'utf8'))(g, g, g);
const PDFLib = g.PDFLib;
const E = require('../forensic-engine-page.js');
const DET = E.DETECTORS;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };
const of = (fn, blocks, type) => (fn(blocks) || []).filter(f => f.type === type && !f.contextOnly);

console.log('======================================================');
console.log('RUN  combine-06-april-regression.test.mjs');
console.log('======================================================\n');

const filler = ' The parties record the terms below and each party signs every page of this instrument in the presence of witnesses at the offices.';
const buildPdf = async (pages, blankIdx) => {
  const d = await PDFLib.PDFDocument.create();
  const font = await d.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 0; i < pages.length; i++) {
    const pg = d.addPage([612, 792]);
    if (blankIdx && blankIdx.includes(i)) continue;
    let line = '', y = 760;
    for (const w of pages[i].split(' ')) { const n = line ? line + ' ' + w : w; if (font.widthOfTextAtSize(n, 9) > 560) { pg.drawText(line, { x: 24, y, size: 9, font }); y -= 12; line = w; } else line = n; }
    if (line) pg.drawText(line, { x: 24, y, size: 9, font });
  }
  return await d.save({ useObjectStreams: false });
};
const runEngine = async (bytes) => {
  const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  const q = console.log; console.log = () => {};
  try { return await E.runForensicEngine(bytes, doc, null, { referenceTime: '2026-10-05T22:01:06.043Z' }); } finally { console.log = q; }
};
const MD = 'Page 72 (franchise agreement):** signed by franchisee. **Franchisor signature:** none on record. They demand payment based on contracts they never signed. This constitutes **unlawful enrichment** of the oil company.';

// ===== 1. A finding located later still meets the secondary-source rule =====
{
  const r = await runEngine(await buildPdf(['Letter of demand to the franchisor regarding the supply agreement and the outstanding account.' + filler, MD, 'Statement of account for the station. Diesel 5000 litres at the stated price per litre.' + filler]));
  ok(!r.findings.some(f => f.type === 'CT01'), 'a CT01 first located as "Same passage" on a markdown analysis page is a lead, not a finding (' + JSON.stringify(r.findings.map(f => f.type + ' ' + f.location)) + ')');
  ok(/Secondary-source lead, not a finding: The document both affirms and negates "signed"/.test(r.extractionNotes) && /Located later: 1 further observation/.test(r.extractionNotes), 'the lead is in the engine notes and the late pass is disclosed');
  const r2 = await runEngine(await buildPdf(['Letter of demand to the franchisor regarding the supply agreement and the outstanding account.' + filler, 'The supplier signed the delivery note at the depot. The dealer states the supplier never signed the delivery note at the depot that day.' + filler, 'Statement of account for the station.' + filler]));
  ok(r2.findings.some(f => f.type === 'CT01' && /Page 2/.test(f.location)), 'positive control: the same CT01 on a page of the record is still a finding (' + JSON.stringify(r2.findings.map(f => f.type)) + ')');
}

// ===== 2. OCR pages are known from the text itself ===========================
{
  // The host hands back OCR text but no page list: the "[OCR]" prefix decides.
  g.voOcrRescuePages = async (bytes, tb) => ({ textBlocks: tb.map((t, i) => i === 1 ? '[OCR] The supplier signed the delivery note at the depot. The dealer states the supplier never signed the delivery note at the depot that day.' : t), note: 'OCR rescue: recovered text for 1 page: 2.' });
  const r = await runEngine(await buildPdf(['Letter of demand to the franchisor regarding the supply agreement and the outstanding account.' + filler, '', 'Statement of account for the station.' + filler], [1]));
  const c = r.findings.find(f => f.type === 'CT01');
  ok(c && c.ocrAnchored === true && c.severity <= 3 && (r.ocrPages || []).includes(2), 'a contradiction on a page whose text came through OCR is held below serious even when the host names no OCR pages (' + JSON.stringify(c && [c.severity, c.ocrAnchored]) + ')');
  delete g.voOcrRescuePages;
}

// ===== 3. Rule (a) judges each page of a set-aside analysis ==================
{
  const ph = 'prior verum omnis report page excluded. '.repeat(10);
  const foot = (n, N) => ' VERUM OMNIS SEALED ORIGINAL | Seal: VO-553451FF1282 | SHA-512: 553451ff128275a1... | 04/10/2026 23:33:00 Africa/Johannesburg | ' + n + '/' + N;
  const blocks = [ph + foot(1, 4), 'Clause 4.5.2 provides that after the thirteenth year the full value of the business is protected.' + foot(2, 4), 'The operator\'s goodwill is effectively trapped - they cannot realise its value without the oil company\'s consent. Verum Omnis records this as a contradiction.' + foot(3, 4), 'Annexure B: the head lease.' + foot(4, 4), 'Letter Page 1 of 3', 'Letter Page 2 of 3', 'Letter Page 3 of 3'];
  // As in the engine: the document map is read with the seal footers, then the footers are stripped.
  const map = E.voDetectDocuments(blocks);
  const stripped = blocks.slice(); E.voStripSealFurnitureBlocks(stripped);
  const segs = E.voSecondarySegments(map, stripped);
  const pages = []; segs.forEach(s => { for (let p = s.start; p <= s.end; p++) pages.push(p); });
  ok(pages.includes(3) && !pages.includes(2), 'a continuation page carrying its own mark ("Verum Omnis") is secondary even after a page without one; the unmarked page stays the record (' + JSON.stringify(segs) + ')');
}

// ===== 4. Dates are compared within one instrument ==========================
{
  const invA = 'TAX INVOICE No. 1001 Invoice date: 2026-01-20 Diesel 5000 litres.' + filler, invB = 'TAX INVOICE No. 2002 Invoice date: 2026-03-31 Petrol 3000 litres.' + filler;
  ok(of(DET.D03_DETECT_DATE_INCONSISTENCY, [invA, 'Correspondence.' + filler, invB], 'CT03').length === 0, 'two invoices, each with its own "invoice date", are not one date restated (p. 49 vs p. 680)');
  ok(of(DET.D03_DETECT_DATE_INCONSISTENCY, ['The termination date is 2026-01-20 as notified.' + filler, 'The termination date is 2026-03-31 as notified.' + filler], 'CT03').length === 1, 'positive control: an event label ("termination date") restated at two values in one document still fires');
  const mixed = ['Agreement Page 1 of 3 signed 31/07/2016.' + filler, 'Agreement Page 2 of 3' + filler, 'Agreement Page 3 of 3' + filler, 'Report Page 1 of 3 dated 12/30/2020.' + filler, 'Report Page 2 of 3' + filler, 'Report Page 3 of 3' + filler];
  ok(of(DET.D03_DETECT_DATE_INCONSISTENCY, mixed, 'CT03').length === 0, 'two documents in two date conventions are not one document mixing them (p. 110 vs p. 147)');
  ok(of(DET.D03_DETECT_DATE_INCONSISTENCY, ['Signed 31/07/2016 and countersigned 12/30/2020 in this letter.' + filler], 'CT03').length === 1, 'positive control: one document mixing the conventions is still noted');
}

// ===== 5. An unnumbered run links pages only by a shared company =============
{
  const docA = n => 'Supply agreement Page ' + n + ' of 3.' + filler, docB = n => 'Lease agreement Page ' + n + ' of 3.' + filler;
  const run = (exp, inv) => [docA(1), docA(2), docA(3), exp, 'Notes continue.' + filler, 'More notes.' + filler, inv, docB(1), docB(2), docB(3)];
  ok((DET.D04_DETECT_TEMPORAL_IMPOSSIBILITY(run('Timeline of the matter: lease expires – never renewed 11 Dec 2018.' + filler, 'Statement of account. Invoice date: 31 March 2026. Diesel 5000 litres.' + filler)) || []).filter(f => f.type === 'CT04').length === 0,
    'an expiry in a page of notes and an invoice three pages on, in an unnumbered run, are not linked by default (p. 97 vs p. 49)');
  ok((DET.D04_DETECT_TEMPORAL_IMPOSSIBILITY(run('Alpha Fuels (Pty) Ltd: the lease expired on 11 December 2018 and was not renewed.' + filler, 'Alpha Fuels (Pty) Ltd statement of account. Invoice date: 31 March 2026.' + filler)) || []).filter(f => f.type === 'CT04').length === 1,
    'positive control: the same pages naming the same company are linked');
}

// ===== 6. A scanned page OCR could barely read is a reading limit ===========
{
  // D17 itself still measures the page (a native file keeps the check):
  const blanks = DET.D17_DETECT_FORMAT_ANOMALY(['x'.repeat(1200), '', 'y'.repeat(1200), 'z'.repeat(1200), 'w'.repeat(1200)]);
  ok(blanks.length === 1, 'positive control: D17 still measures an isolated near-empty page');
  // The engine hands a near-empty finding on scanned image pages to the notes.
  const io = E.voImageOnlyCt26ToNotes([{ type: 'CT26', severity: 2, location: 'Page 676', evidence: 'Page 676 is nearly empty (9 chars)' }, { type: 'CT26', severity: 2, location: 'Page 12', evidence: 'Page 12 is nearly empty' }, { type: 'CT01', severity: 4, location: 'Page 676', evidence: 'x' }], [664, 676]);
  ok(io.kept.length === 2 && !io.kept.some(f => f.type === 'CT26' && /676/.test(f.location)) && io.kept.some(f => /Page 12/.test(f.location)) && io.notes.length === 1 && /Page 676 is a scanned image with no text layer of its own/.test(io.notes[0].text),
    'a near-empty finding on a scanned page with no text layer is an engine note (p. 676); one on a text page stays a finding; other kinds are untouched');
  const src = fs.readFileSync(path.join(process.cwd(), 'forensic-engine-page.js'), 'utf8');
  ok(/if \(_ocrRan && _imageOnlyPages\.length\) \{\s*var _io = voImageOnlyCt26ToNotes\(allFindings, _imageOnlyPages\);/.test(src), 'the engine applies it only when an OCR pass ran over the file');
}

// ===== 7. Definitions: two sites, one definition read twice, a longer term ==
{
  const ct08 = b => of(DET.D30_DETECT_TERM_DEFINITION_CONFLICT, b, 'CT08');
  ok(ct08(['[OCR] "the Premises" means Remainder of Lot 967, Port Edward commonly known 4s Port Edward Garage', '[OCR] "the Premises" means the iminovable property known as Sub 10 (of 9) of Lot 26 Bluft No. 268']).length === 0, '"the Premises" of two different properties belongs to two agreements (pp. 641, 644)');
  ok(ct08(['[OCR] "Personal Data" means auy information thai car be wed directly : or indireatly, alone or In combination', '[OCR] "Personal Data" means avy Information fiat cor 03 used directiy Bg Hato Destin A VEE, Lt xt']).length === 0, 'one definition read twice by OCR is one definition (pp. 649, 652)');
  ok(ct08(['"Franchised Business" means the conduct of a Astron Motor Fuel Franchise for the sale and/or provision of goods', 'the Value of the "Franchised Business" means the price a willing independent arm\'s-length purchaser is prepared to pay']).length === 0, 'the tail of "Value of the Franchised Business" is not a second definition of "Franchised Business" (p. 317)');
  ok(ct08(['[OCR] "Goods" means petrol and diesel delivered by road tanker to the site and stored', '[OCR] "Goods" means the movable furniture, fittings and equipment listed in the inventory schedule']).length === 1, 'positive control: two different definitions of one term on OCR pages still fire');
  ok(ct08(['"the Premises" means Erf 12 Margate and the buildings on it', '"the Premises" means Erf 12 Margate together with the fuel tanks and pumps only']).length === 1, 'positive control: one property defined two ways still fires');
}

// ===== 8. A condition is not a record of ownership; one agreement per trap ==
{
  const lessee = 'The Franchisee is not the owner of the Premises, but is the lessee in terms of a Lease with Palmbili Properties. Should the head lease terminate, this Agreement shall terminate.';
  ok(of(DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED, [lessee, 'In the event that the Franchisee is the owner of the Premises and at any time during the Term wishes to sell, the Franchisor has a right of first refusal.'], 'CT44').length === 0, '"In the event that the Franchisee is the owner of the Premises" provides for a case; it does not record one (p. 327)');
  ok(of(DET.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED, [lessee, 'On 3 March 2015 the Franchisee became the owner of the Premises by deed of transfer T1234/2015.'], 'CT44').length === 1, 'positive control: a recorded transfer still pairs with the lessee clause');
  const noComp = 'The Franchisee agrees that it shall not be entitled to any compensation or repayment of any kind in respect of any structural additions, alterations or improvements to the Premises.';
  const acq = 'The Franchisor shall be entitled to purchase the property at its fair market value on termination.';
  const pad = []; for (let i = 0; i < 40; i++) pad.push('Schedule page ' + (i + 1) + '.' + filler);
  const far = pad.slice(); far[0] = noComp; far[30] = acq;
  const near = pad.slice(); near[0] = noComp; near[4] = acq;
  ok(of(DET.D39_DETECT_ASSET_VALUE_DENIAL, far, 'CT45').length === 0, 'a no-compensation clause and a purchase right thirty pages apart, with no stated document, are not one agreement\'s trap (p. 246 vs p. 422)');
  ok(of(DET.D39_DETECT_ASSET_VALUE_DENIAL, near, 'CT45').length === 1, 'positive control: the two halves within one passage still fire');
}

console.log(`\n[combine-06-april] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[combine-06-april] FAILURES'); process.exit(1); }
console.log('[combine-06-april] ALL GREEN');
