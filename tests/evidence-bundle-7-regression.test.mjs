/**
 * evidence-bundle-7-docs regression guard (5 October 2026).
 *
 * The founder sealed a 65-page bundle — his email to the Public Protector,
 * the Protector's referral letters, a 49-page sealed exhibit of his own
 * analysis (a "Verum Omnis Forensic Narrative", a report and a Google Drive
 * index), printed emails and a sealed timeline — and had DeepSeek review the
 * reports against Constitution v8.0. Of the four sealed findings, one was real
 * (his email went to thomas@protect.org; the Protector's investigator is
 * thomasm@pprotect.org) and three rested on his own analysis pages: a CIPC
 * enterprise number in the portal's own form (K2016392549) called "not a
 * valid SA registration format", a reference to his affidavit "recording …
 * the chain of custody (VO-…)" called a custody gap, and his own sentence
 * "The MOU was never countersigned" sealed as a signature finding. The AI
 * review had silently dropped two more; the founder ruled that the AI may
 * never delete or change an engine finding, and the report was brought to
 * the Constitution's §15.4 template, with no severity, score or "verified"
 * word, the Thesis / Antithesis / Synthesis table, and every finding under
 * its brain.
 *
 * The engine section runs the real engine on a synthetic bundle of the same
 * shape built here (no real matter document is committed): the strings are
 * the bundle's own, the false findings must stay silent, and the real one
 * must still fire. The report section renders the technical report and reads
 * it back.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const g = globalThis; g.window = g; g.self = g;
new Function('window', 'self', 'globalThis', fs.readFileSync(path.join(process.cwd(), 'vendor/pdf-lib.min.js'), 'utf8'))(g, g, g);
const PDFLib = g.PDFLib;
const E = require('../forensic-engine-page.js');
const R = require('../forensic-report.js');
const DET = E.DETECTORS;

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };
const of = (fn, blocks, type) => (fn(blocks) || []).filter(f => f.type === type);

console.log('======================================================');
console.log('RUN  evidence-bundle-7-regression.test.mjs');
console.log('======================================================\n');

// ===== 1. Registration numbers (D11 / CT20) ==================================
{
  const cipc = 'One growing compilation under a single seal: the Cipc file is the first 31 pages. Contents: CIPC portal screenshots for Sanarth Fuels (K2016392549) and its annual return; an email "LA Highcock CIPC Search 20260907" from Port Edward Garage.';
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, [cipc], 'CT20').length === 0, 'the CIPC portal\'s own enterprise-number form (K2016392549) and a YYYYMMDD search date are not false registration numbers');
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, ['CB13 CIPC searches conducted 7 September 2026 Cipc compilation (VO35E910616402, 31 pp; shared with allfuelsfinal)'], 'CT20').length === 0, 'a seal id forty characters after a bare "CIPC" is not a registration number');
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, ['The enterprise number is K2016/392549/07 on the certificate. Registration number: K2016392549 per the CIPC portal.'], 'CT20').length === 0, 'the K-form with or without slashes is a valid CIPC form');
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, ['Company registration number: 1999/12345/0 issued to the respondent.'], 'CT20').length === 1, 'positive control: a malformed number under a registration label still fires');
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, ['CIPC: 2016/39254/07 per the search result.'], 'CT20').length === 1, 'positive control: a number right after a bare "CIPC" is still checked');
  // The review of these guards (5 October 2026): each skip stays as narrow as its case.
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, ['CIPC enterprise number: 2016/39254/07 per the search.'], 'CT20').length === 1 && of(DET.D11_DETECT_REGISTRATION_FAKE, ['The company is listed with CIPC under the number 2016/39254/07 per the search.'], 'CT20').length === 1,
    'positive control: "enterprise number" is a registration label, and "CIPC under the number …" still names the number');
  ok(of(DET.D11_DETECT_REGISTRATION_FAKE, ['Company registration number: 20120526 issued.'], 'CT20').length === 1 && of(DET.D11_DETECT_REGISTRATION_FAKE, ['Registration No: 19991231 on the form.'], 'CT20').length === 1,
    'positive control: an eight-digit value under a registration label is checked; only a search date after "CIPC" is skipped');
}

// ===== 2. Chain of custody (D27 / CT39) ======================================
{
  const ref = 'The rescission application was filed with the Registrar on the night of 2 October 2026, with the founding affidavit of Mr Bester (VO-E543924CB79B), my supporting affidavit recording the forensic collection and the chain of custody (VO-0D93BB2C1B46), and the Notice of Motion.';
  ok(of(DET.D27_DETECT_CUSTODY_GAP, [ref], 'CT39').length === 0, 'a reference to another document that records the chain of custody is not a custody gap in this document');
  ok(of(DET.D27_DETECT_CUSTODY_GAP, ['Annexure CB12 sets out the chain of custody for each exhibit.'], 'CT39').length === 0, 'an annexure said to set out the custody is a reference too');
  ok(of(DET.D27_DETECT_CUSTODY_GAP, ['This affidavit records the chain of custody of the exhibits. Item 1 received by Sgt Mokoena.'], 'CT39').length === 1 && of(DET.D27_DETECT_CUSTODY_GAP, ['In this statement I set out the chain of custody of the phone.'], 'CT39').length === 1,
    'positive control: a document that sets out its own custody ("This affidavit records …", "In this statement I set out …") is still checked');
  ok(of(DET.D27_DETECT_CUSTODY_GAP, ['The chain of custody of the exhibits is recorded below. Item 1 received by Sgt Mokoena.'], 'CT39').length === 1, 'positive control: a document claiming its own custody record with missing steps still fires');
}

// ===== 3. Set-aside pages are not "near-empty" (D17 / CT26) ==================
{
  const prose = 'The franchisee operated the site for thirteen years under a written agreement, paid every invoice when due, and the parties exchanged correspondence about renewal, goodwill, rental escalation, licensing and the transfer of the business to a new operator before the termination letter arrived. Afterwards counsel reviewed municipal zoning approvals, insurance schedules, payroll ledgers, inventory valuations, banking mandates, supplier rebates, environmental permits, wholesale pricing, delivery logistics and customer complaints recorded during each quarter.';
  const ph = 'prior verum omnis report page excluded. '.repeat(10);
  const P = n => prose + ' Page note ' + n + '.';
  const blocks = [P(1), P(2), P(3), P(4), ph, ph, ph, ph, ph, P(5), P(6), P(7), P(8)];
  ok(of(DET.D17_DETECT_FORMAT_ANOMALY, blocks, 'CT26').length === 0, 'pages the engine set aside as a prior Verum Omnis report are not "near-empty pages … OCR did not capture" (it once sealed "35 near-empty pages (9-55)")');
  const real = [P(1), P(2), P(3), P(4), ' ', ' ', P(5), P(6), P(7), P(8)];
  ok(of(DET.D17_DETECT_FORMAT_ANOMALY, real, 'CT26').length === 1, 'positive control: a real run of near-empty pages is still disclosed');
}

// ===== 3b. A document ends at its own last page ==============================
{
  const foot = (n, N) => ' VERUM OMNIS SEALED ORIGINAL | Seal: VO-553451FF1282 | SHA-512: 553451ff128275a1... | 04/10/2026 23:33:00 Africa/Johannesburg | ' + n + '/' + N;
  const blocks = ['Letter Page 1 of 3', 'Letter Page 2 of 3', 'Letter Page 3 of 3', 'Exhibit text one' + foot(1, 5), 'two' + foot(2, 5), 'three' + foot(3, 5), 'four' + foot(4, 5), 'five' + foot(5, 5), 'A printed email with no numbering', 'Another printed email', 'Timeline Page 1 of 3', 'Timeline Page 2 of 3', 'Timeline Page 3 of 3'];
  const segs = E.voDetectDocuments(blocks);
  const ex = segs.find(x => x.statedTotal === 5);
  ok(ex && ex.start === 4 && ex.end === 8 && ex.pages === 5, 'unnumbered pages after an exhibit\'s stated last page ("5/5") are not counted into it (it once read "p. 9 – 60, 52 pages" for a 49-page exhibit) (' + JSON.stringify(segs) + ')');
  const ph = 'prior verum omnis report page excluded. '.repeat(10);
  const blocks2 = blocks.slice(); blocks2[3] = ph;
  ok(E.voDetectDocuments(blocks2).find(x => x.statedTotal === 5).title === 'Verum Omnis analysis (set aside from scanning)', 'a document whose first page was set aside is named for what it is, never by the placeholder');
  // The pages no stated document covers are not one shared document: each
  // contiguous run is its own (the review of this fix found an annexure after
  // one agreement compared with a schedule after another).
  const key = E.voDocKeyOf([{ start: 1, end: 3 }, { start: 5, end: 7 }], 9);
  ok(key(0) === key(2) && key(3) !== key(7) && key(3) !== key(0) && key(7) === key(8) && key(4) !== key(0),
    'an unnumbered run after one document and another after the next are different documents; a run stays one document');
  const filler = ' The parties record the terms below and each party signs every page of this instrument in the presence of witnesses.';
  const defs = ['Supply agreement between Alpha Fuels and the dealer.' + filler + ' Page 1 of 3', 'Clause two sets out pricing and delivery obligations.' + filler + ' Page 2 of 3', 'Clause three sets out termination and notices.' + filler + ' Page 3 of 3',
    'Annexure to the supply agreement. "Goods" means petrol and diesel delivered by road tanker to the site.' + filler,
    'Lease agreement between Beta Properties and the tenant.' + filler + ' Page 1 of 3', 'Clause two sets out rental and escalation.' + filler + ' Page 2 of 3', 'Clause three sets out breach and cancellation.' + filler + ' Page 3 of 3',
    'Schedule to the lease. "Goods" means the movable furniture, fittings and equipment listed in the inventory.' + filler];
  ok(of(DET.D30_DETECT_TERM_DEFINITION_CONFLICT, defs, 'CT08').length === 0, 'two instruments\' definitions of "Goods", each on an unnumbered page after its own document, are not one document\'s conflict (D30)');
  const tl = defs.slice(); tl[3] = 'Addendum to the depot lease. The lease expired on 28 February 2018 and was not renewed.' + filler; tl[7] = 'Statement of account for the new station. Invoice date: 3 March 2025. Diesel 5000 litres.' + filler;
  ok((DET.D04_DETECT_TEMPORAL_IMPOSSIBILITY(tl) || []).length === 0, 'an expiry after one document and an invoice after another are not linked as one instrument (D04)');
}

// ===== 4. Names ==============================================================
{
  const t = n => E.voTrimPersonName(n);
  ok(t('Liam Highcock E-mail') === 'Liam Highcock' && t('Andy Mothibi National') === 'Andy Mothibi' && t('Brian Denny’s') === 'Brian Denny' && t('Highcock MOU') === '' && t('Part IV') === '' && t('Gary Highcock') === 'Gary Highcock',
    'a header label, a title word, a defined term, a heading and a possessive are not part of a name');
}

// ===== 5. The summary sentence ===============================================
ok(E.generateSummary([{}, {}, {}, {}], 15) === E.generateSummary([{}, {}, {}, {}], 85) && !/minor|largely consistent|systematic fraud|serious/i.test(E.generateSummary([{}, {}, {}, {}], 15)),
  'the engine summary is the same count sentence at every internal score');

// ===== 6. A Verum Omnis analysis is secondary wherever it sits ===============
ok(E.voIsVerumAnalysisPage('Part B — Large sealed bundles … Verum Omnis — CCT 19/20 Google Drive Index • Page 4 of 9') && !E.voIsVerumAnalysisPage('VERUM OMNIS SEALED ORIGINAL | Seal: VO-3C28D1DEA47F | 4/65 The lease agreement'),
  'a page whose running title names a Verum Omnis analysis is recognised; the seal footer on evidence is not');

// ===== 6b. Evidence sealed after a report page is still the record ===========
// The first version of rule (a) read every page after a set-aside Verum Omnis
// report page as analysis, up to the next record heading: a chat, a letter and
// a bank statement sealed with the report became "analysis", and a real
// lookalike domain on them became a lead (the review of 5 October 2026). A
// continuation page must carry its own mark (a cited seal, "Verum Omnis", an
// exhibit label such as CB9, or a bundle-page citation).
{
  const foot2 = (id, n, N) => ' VERUM OMNIS SEALED ORIGINAL | Seal: ' + id + ' | SHA-512: 3c28d1dea47fec22... | 05/10/2026 00:59:25 Africa/Johannesburg | ' + n + '/' + N;
  const P2 = [
    'VERUM OMNIS FORENSIC REPORT. Report Reference: VO-AF-2026-0523-SUPP. Prepared for the complainant. This report reads the annexed correspondence.' + foot2('VO-AAAAAAAAAAAA', 1, 4),
    'WhatsApp chat export, 3 October 2026. Dean: please send the referral to the investigator at thomas@protect.org today so the matter is handled before Friday, the stations are running dry.' + foot2('VO-AAAAAAAAAAAA', 2, 4),
    'Public Protector South Africa. Please quote this reference in your reply: CMS-88494/2026 Enquiries: Thomas Mogoba Email: thomasm@pprotect.org Tel: (012) 366 7210 Dear Mr Highcock, the complaint has been received and referred.' + foot2('VO-AAAAAAAAAAAA', 3, 4),
    'Bank statement extract for the station account showing fuel purchases for September 2026, opening balance and closing balance, with the supplier rebate credited at month end.' + foot2('VO-AAAAAAAAAAAA', 4, 4),
    'Letter of demand from the attorneys to the supplier regarding the interruption of fuel supply and the terms of the franchise agreement.' + foot2('VO-BBBBBBBBBBBB', 1, 3),
    'The supplier is requested to restore supply within seven days of this letter failing which the client will approach the court for urgent relief.' + foot2('VO-BBBBBBBBBBBB', 2, 3),
    'Yours faithfully, the attorneys for the franchisee, with copies to the regional manager and the franchisee directly by registered post.' + foot2('VO-BBBBBBBBBBBB', 3, 3)
  ];
  const d = await PDFLib.PDFDocument.create();
  const font = await d.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 0; i < P2.length; i++) {
    const pg = d.addPage([612, 882]);
    let line = '', y = 840;
    for (const w of (P2[i] + ' Clean Bundle Page ' + (i + 1) + ' of ' + P2.length).split(' ')) {
      const next = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(next, 9) > 560) { pg.drawText(line, { x: 24, y, size: 9, font }); y -= 12; line = w; } else line = next;
    }
    if (line) pg.drawText(line, { x: 24, y, size: 9, font });
  }
  const bytes2 = await d.save({ useObjectStreams: false });
  const doc2 = await PDFLib.PDFDocument.load(bytes2, { ignoreEncryption: true });
  const quiet2 = console.log; console.log = () => {};
  let res2;
  try { res2 = await E.runForensicEngine(bytes2, doc2, null, { referenceTime: '2026-10-04T23:00:13.390Z' }); }
  finally { console.log = quiet2; }
  ok(res2.findings.some(f => f.type === 'CT37' && /Page 2, 3/.test(f.location)) && !/Secondary-source lead[^.]*pprotect/.test(res2.extractionNotes || ''),
    'a lookalike domain on a chat and a letter sealed after a report page is a finding, not a lead (' + JSON.stringify(res2.findings.map(f => f.type + ' ' + f.location)) + ')');
}

// ===== 7. End to end on a bundle of the same shape ===========================
const outer = (n, N) => ' VERUM OMNIS SEALED ORIGINAL | Seal: VO-3C28D1DEA47F | SHA-512: 3c28d1dea47fec22... | 05/10/2026 00:59:25 Africa/Johannesburg | ' + n + '/' + N;
const inner = (n, N) => ' VERUM OMNIS SEALED ORIGINAL | Seal: VO-553451FF1282 | SHA-512: 553451ff128275a1... | 04/10/2026 23:33:00 Africa/Johannesburg | ' + n + '/' + N;
const PAGES = [
  'URGENT Referral CMS-88494/2026 From: Liam Highcock <liam@verumglobal.foundation> To: thomas@protect.org , ndpp@npa.gov.za Date: 2026/10/04 23:57 Dear Advocate Mothibi, I refer to the notice dated 30 September 2026 in which my complaint was referred to your office for further handling. The matter is now urgent and the stations depend on supply.',
  'Public Protector South Africa. Please quote this reference in your reply: CMS-88494/2026 Enquiries: Thomas Mogoba Email: thomasm@pprotect.org Tel: (012) 366 7210 Dear Mr Highcock NOTICE IN TERMS OF SECTION 6(4)(b)(ii) OF THE PUBLIC PROTECTOR ACT. Page 1 of 3',
  'The Public Protector has considered the complaint and the documents submitted with it, and refers the matter as set out below for further handling by the appropriate office. Page 2 of 3',
  'For any further enquiries you are at liberty to approach the Lead Investigator, Mr Thomas Mogoba, at 012 366 7210 alternatively at thomasm@pprotect.org. Yours sincerely. Page 3 of 3',
  'VERUM OMNIS FORENSIC NARRATIVE — FROM DES SMITH TO THE PRESENT. Prepared by Liam Anthony Highcock, read with the Verum Omnis Forensic Report (Ninth Edition). In the Constitutional Court, Case No CCT 19/20.' + inner(1, 5),
  'Goodwill does not terminate: the respondent was selling it, buying it back, and forfeiting it under any circumstances (CB6). The MOU was never countersigned by All Fuels. He signed it, and paid under it, before the Constitutional Court heard the matter.' + inner(2, 5),
  'The rescission application was filed with the Registrar on the night of 2 October 2026, with the founding affidavit of Mr Bester (VO-E543924CB79B), my supporting affidavit recording the forensic collection and the chain of custody (VO-0D93BB2C1B46), and the Notice of Motion.' + inner(3, 5),
  'GOOGLE DRIVE EVIDENCE INDEX CCT 19/20. Contents: CIPC portal screenshots for Sanarth Fuels (K2016392549) and its annual return; an email "LA Highcock CIPC Search 20260907" from Port Edward Garage. Verum Omnis — CCT 19/20 Google Drive Index • Page 1 of 2' + inner(4, 5),
  'CB13 CIPC searches conducted 7 September 2026. Cipc compilation (VO35E910616402, 31 pp; shared with allfuelsfinal). The MOU was never countersigned. Verum Omnis — CCT 19/20 Google Drive Index • Page 2 of 2' + inner(5, 5),
  'Reply chaos2captain@gmail.com To Astron Energy Re: Chat Bot created for Calling request (#48999006547) Hi Dean, many residents here rely on fuel from the two stations on the R61 and ask when supply resumes.'
];
const buildBundle = async () => {
  const d = await PDFLib.PDFDocument.create();
  const font = await d.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 0; i < PAGES.length; i++) {
    const pg = d.addPage([612, 882]);
    const text = PAGES[i] + outer(i + 1, PAGES.length);
    const words = text.split(' ');
    let line = '', y = 840;
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(next, 9) > 560) { pg.drawText(line, { x: 24, y, size: 9, font }); y -= 12; line = w; }
      else line = next;
    }
    if (line) pg.drawText(line, { x: 24, y, size: 9, font });
  }
  return await d.save({ useObjectStreams: false });
};
const pageText = async (bytes) => {
  const loaded = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  const parts = [];
  for (let i = 0; i < loaded.getPageCount(); i++) parts.push((await E.extractPageText(bytes, i, loaded)).join(' '));
  return parts.join(' \n ').replace(/[ \t]+/g, ' ');
};
const run = async () => {
  const bytes = await buildBundle();
  const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  const quiet = console.log; console.log = () => {};
  let res;
  try { res = await E.runForensicEngine(bytes, doc, null, { referenceTime: '2026-10-04T23:00:13.390Z' }); }
  finally { console.log = quiet; }
  const types = res.findings.map(f => f.type);
  ok(types.includes('CT37') && res.findings.find(f => f.type === 'CT37').evidence.indexOf('"pprotect.org"') !== -1 && /"protect\.org"/.test(res.findings.find(f => f.type === 'CT37').evidence),
    'the real finding stands: the email went to protect.org, the Protector\'s investigator is at pprotect.org (' + JSON.stringify(types) + ')');
  ok(!types.includes('CT20') && !types.includes('CT39') && !types.includes('CT26') && !types.includes('CT23'),
    'no registration, custody, near-empty or signature finding rests on the founder\'s own analysis pages (' + JSON.stringify(res.findings.map(f => f.type + ' ' + f.location)) + ')');
  ok(/Secondary-source lead, not a finding: The record states a signature is missing \("never countersigned"\)/.test(res.extractionNotes) && /a Verum Omnis analysis/.test(res.extractionNotes),
    'the narrative\'s "never countersigned" is a lead to verify against the primary record, and the disclosure names a Verum Omnis analysis');
  const dm = res.documentMap || [];
  const ex = dm.find(x => x.statedTotal === 5);
  ok(ex && ex.start === 5 && ex.end <= 9 && ex.title === 'Verum Omnis analysis (set aside from scanning)', 'the exhibit never takes in the printed email after it, and is named for what it is, never by a placeholder (' + JSON.stringify(dm) + ')');
  ok(!/prior verum omnis report page excluded/i.test(JSON.stringify(dm)), 'no document is named "prior verum omnis report page excluded"');

  // ---- the technical report, read back --------------------------------------
  const extra = [
    { type: 'CT20', severity: 4, location: 'Page 3', evidence: 'A number labelled as a registration is not a valid SA registration format (expected YYYY/NNNNNN/NN or CK…): "Company registration number: 1999/12345/0"', aiReviewNote: 'a CIPC number written without its slashes', aiAssessed: true },
    { type: 'CT39', severity: 2, location: 'Page 3', evidence: 'Chain-of-custody documentation is claimed ("…The chain of custody of the exhibits is recorded below…", page 3) but only 1 of 5 expected hand-over steps (received by / handed to / transferred to / logged by / signed for) appear in the document', aiAssessed: true },
    { type: 'CT23', severity: 2, location: 'Page 4', evidence: 'The record states a signature is missing ("never countersigned"): "The MOU was never countersigned by the franchisor." — verify execution against the signature pages of the original', aiAssessed: true }
  ];
  const fr = Object.assign({}, res, { findings: res.findings.concat(extra), contradictionTypesUsed: 4 });
  const opts = {
    documents: [{ name: 'evidence-bundle-7-docs.pdf', pageCount: 10, sha512: '3c'.repeat(64), sealId: 'VO-3C28D1DEA47F' }],
    findings: fr, aiReview: { applied: true, assessed: 4, attempted: 4, original: 4, noted: 1, added: 0, duplicates: 1 },
    extractionNotes: res.extractionNotes, ots: { submitted: true }, ocrPages: [], images: {}, generatedAt: '2026-10-04T23:00:43.844Z'
  };
  let T;
  console.log = () => {};
  try { T = await pageText(await R.build(opts)); } finally { console.log = quiet; }
  const t = T.replace(/\s+/g, ' ');
  const at = s => t.lastIndexOf(s);
  ok(at('1. CRITICAL LEGAL SUBJECTS') > 0 && at('1. CRITICAL LEGAL SUBJECTS') < at('7. CERTIFICATION') && at('7. CERTIFICATION') < at('ANNEXES') && at('ANNEXES') < at('EXECUTIVE SUMMARY') && at('EXECUTIVE SUMMARY') < at('THE STORY IN PLAIN LANGUAGE'),
    'the §15.4 sections 1-7 come first; the one-page summary and the story follow as annexes (PD19)');
  ok(/Timestamp: 2026-10-04T23:00:43\.844Z/.test(t) && /Jurisdiction\(s\): South Africa \(default home jurisdiction\)/.test(t) && !/detected: South Africa/.test(t) && /Case Reference: none entered/.test(t) && /Report Type: Combined/.test(t), 'the cover carries the §15.4 header: timestamp, jurisdictions, case reference and report type');
  ok(!/HOW ANY CHANGE TO THIS RECORD IS DETECTED/.test(t) && /The seal check alone cannot show that a copy was not altered and re-sealed with its own hash/.test(t), 'no user-manual explainer (PD20); Section 7 keeps the re-seal limit');
  ok(!/\bserious\b|\bminor\b|largely consistent|by severity|Score calibration|scoring weight|\/ 46\b|Contradiction types triggered|\bverified findings?\b|AI REVIEW NOT RUN/i.test(t), 'no severity word, score, ratio, calibration, "verified" count or AI-review cover warning anywhere in the report (PD1, §15.2)');
  ok(/contains 4 findings\. The following are established\./.test(t), 'the count is the Constitution\'s own §15.3 sentence, without "verified"');
  const tv = t.slice(at('4. TRIPLE VERIFICATION SUMMARY'), at('5. SEALED FINDINGS'));
  ok(/Thesis/.test(tv) && /Antithesis/.test(tv) && /Synthesis/.test(tv) && /PASS — quoted text on p\. 1/.test(tv) && /ACCEPTED/.test(tv) && /requires three independent verifiers; this report does not have them/.test(tv) && !/RETAINED|NOT REVIEWED/.test(tv),
    'the Triple Verification table is Thesis / Antithesis / Synthesis with reasons, says PD13\'s independence is not met, and carries no AI leg (' + tv.slice(0, 300) + ')');
  ok((tv.match(/ACCEPTED/g) || []).length === 4, 'every engine finding is in the table: none was removed by the AI (four rows)');
  const nb = t.slice(at('3. NINE-BRAIN EXTRACTION FINDINGS'), at('4. TRIPLE VERIFICATION SUMMARY'));
  ok(/B3 — Communications Brain FINDING RECORDED: - Type: Lookalike Email Domain \(CT37\)/.test(nb) && /B2 — Document Brain FINDING RECORDED: - Type: Chain-of-Custody Steps Not Documented \(CT39\)/.test(nb) && /B2 — Document Brain[^]*FINDING RECORDED: - Type: Unsigned Agreement Stated \(CT23\)/.test(nb) && /B6 — Financial Brain FINANCIAL IRREGULARITY FOUND: - Type: Registration Number Format Invalid \(CT20\)/.test(nb) && !/Not rendered under a brain/.test(nb),
    'every finding renders under its brain, with the measured label (' + nb.slice(0, 500) + ')');
  ok(!/Registration Number Fake|Chain of Custody Break|Signature Mismatch/.test(t.slice(0, at('METHODOLOGY & AUTHENTICATION'))), 'no section prints a taxonomy name that says more than the detector measured');
  ok(/AI Review Notes on Engine Findings/.test(t) && /a CIPC number written without its slashes/.test(t) && /it removed and changed none/.test(t) && /1 further item it raised restated an engine finding/.test(t),
    'the AI\'s doubt is an advisory note beside the unchanged finding, the trailer says it removed and changed nothing, and a candidate repeating an engine finding is counted, not listed');
  const law = t.slice(at('STATUTORY ANCHORING'), at('RECOMMENDED ACTIONS'));
  ok(/Law of Evidence Amendment Act/.test(law) && !/perj[u]ry/i.test(law.slice(law.indexOf('Chain-of-Custody'), law.indexOf('Chain-of-Custody') + 260)), 'a custody-steps finding carries evidential law, never perjury, in its own row and in the offence matrix');
};
await run();

// ===== 8. The review of this change (5 October 2026), pinned ==================
{
  const quiet = console.log;
  // A record with no finding still prints §15.4 sections 1-7 in order.
  const empty = { documents: [{ name: 'clean.pdf', pageCount: 2, sha512: 'ab'.repeat(64), sealId: 'VO-ABABABABABAB' }],
    findings: { findings: [], contradictionTypesUsed: 0, clean: true }, ots: { submitted: true }, ocrPages: [], images: {}, generatedAt: '2026-10-04T23:00:43.844Z' };
  let T0; console.log = () => {};
  try { T0 = (await pageText(await R.build(empty))).replace(/\s+/g, ' '); } finally { console.log = quiet; }
  const pos = ['1. CRITICAL LEGAL SUBJECTS', '2. DISHONESTY DETECTION MATRIX', '3. NINE-BRAIN EXTRACTION FINDINGS', '4. TRIPLE VERIFICATION SUMMARY', '5. SEALED FINDINGS', '6. VERDICT RESERVATION', '7. CERTIFICATION'].map(h => T0.lastIndexOf(h));
  ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])) && /No contradictions were detected\. Every detector ran; none triggered\./.test(T0),
    'a record with no finding prints sections 1-7 in order, section 5 in the Constitution\'s clean sentence (' + JSON.stringify(pos) + ')');
  ok(/Jurisdiction\(s\): South Africa \(default home jurisdiction\)/.test(T0), 'the cover says the home jurisdiction is the default when nothing names one');
  // Single-source kinds carry their own sentence, never "both positions".
  ok(['CT33', 'CT35', 'CT31', 'CT32', 'CT05', 'CT07', 'CT40', 'CT25'].every(ty => !/both positions/.test(R._establishesOf({ type: ty, evidence: 'Suspiciously high section number: Section 600 of Companies Act' }))),
    'a section-number check, a procedure check and the other single-source kinds never print "The record states both positions"');
  ok(/both positions/.test(R._establishesOf({ type: 'CT43', evidence: 'x' })) === false && /both positions/.test(R._establishesOf({ type: 'CT06', evidence: 'x' })), 'the two-positions sentence stays for two-statement kinds only');
  ok(R._brainOf({ type: 'CT31' }) === 'B2' && R._brainOf({ type: 'CT32' }) === 'B2' && R._brainBlockLabel({ type: 'CT31' }) === 'FINDING RECORDED' && R._brainBlockLabel({ type: 'CT07' }) === 'FINDING RECORDED',
    'a missing referenced document and an unsourced citation are document measurements (B2), never "CONTRADICTION FOUND"');
  // The AI note table lists every noted engine row, and a note in banned words is withheld.
  const fn = [
    { type: 'CT02', severity: 4, location: 'Page 2 vs Page 3', evidence: 'R10,000 (p. 2) vs R12,000 (p. 3)', aiReviewNote: 'the two figures appear to be different invoices' },
    { type: 'SERIAL', severity: 3, location: 'Pages 1-3', evidence: 'Multi-stage pattern', serialPattern: 'Advance-fee sequence', aiReviewNote: 'generic wording only' },
    { type: 'CT37', severity: 3, location: 'Page 1, 3', evidence: 'Lookalike email domain: "pprotect.org" (p. 3) beside "protect.org" (p. 1)' }
  ];
  let T1; console.log = () => {};
  try { T1 = (await pageText(await R.build({ documents: [{ name: 'n.pdf', pageCount: 3, sha512: 'cd'.repeat(64), sealId: 'VO-CDCDCDCDCDCD' }], findings: { findings: fn, contradictionTypesUsed: 2 },
    aiReview: { applied: true, assessed: 3, attempted: 3, original: 3, noted: 2, added: 0 }, ots: { submitted: true }, ocrPages: [], images: {}, generatedAt: '2026-10-04T23:00:43.844Z' }))).replace(/\s+/g, ' '); } finally { console.log = quiet; }
  const notes = T1.slice(T1.lastIndexOf('AI Review Notes on Engine Findings'));
  ok(/AI Review Notes on Engine Findings \(2\)/.test(T1) && /generic wording only/.test(notes) && !/appear to be different invoices/.test(T1) && /did not pass the report's language rule/.test(notes),
    'the note table lists every noted engine row (a serial pattern too), and a note in hedged words is withheld, not printed');
  ok(/it noted 2 as unsupported \(advisory notes, printed under AI Review Notes on Engine Findings/.test(T1) && /it raised no candidate/.test(T1), 'the trailer points to where the notes are, and section 7 says no candidate was raised');
  // The on-device summary: engine findings only, and nothing the render gate drops.
  const html = fs.readFileSync(path.join(process.cwd(), 'seal-document.html'), 'utf8');
  const fnSrc = html.match(/function buildLocalNarrative\(findings, score, verdict\) \{[\s\S]*?\n\}/)[0];
  const buildLocal = new Function('window', 'voCaseDetails', fnSrc + '; return buildLocalNarrative;')(g, undefined);
  const local = buildLocal(fn.concat([{ type: 'CT09', severity: 5, source: 'ai', category: 'AI_IDENTIFIED', evidence: 'an AI reading', rationale: 'AI says so', location: 'Page 3' }, { type: 'CT20', severity: 3, location: 'Page 3', evidence: 'Registration 1999/1234/0 is not a valid format' }]), 40, 'MODERATE');
  const keySec = local.slice(local.indexOf('KEY FINDINGS'), local.indexOf('WHAT THE EVIDENCE SHOWS'));
  ok(!/an AI reading/.test(keySec) && !/The first finding in the engine's order is an identity contradiction/.test(local), 'an AI candidate never leads the on-device summary or its key findings');
  const scl = R._scrubNarrative(local);
  ok(scl.dropped === 0, 'the on-device summary passes the render-time gate whole (' + scl.dropped + ' dropped)');
}

console.log(`\n[evidence-bundle-7] PASS=${pass} FAIL=${fail}`);
if (fail > 0) { console.log('[evidence-bundle-7] FAILURES'); process.exit(1); }
console.log('[evidence-bundle-7] ALL GREEN');
