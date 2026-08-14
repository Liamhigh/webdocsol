/**
 * Legal Analysis layer (report template v5.1.1): party extraction and the
 * finding -> legal-subject / dishonesty-lens maps. Loaded with a minimal PDFLib
 * stub so the module gets past its load-time guard without needing pdf-lib.
 */
'use strict';
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error('  FAIL: ' + n); } };

console.log('======================================================');
console.log('RUN  legal-analysis.test.js');
console.log('======================================================\n');

// Minimal stub: the module only needs PDFLib.rgb() at load time.
global.PDFLib = { rgb: (r, g, b) => ({ r, g, b }), StandardFonts: {}, PDFDocument: {} };
const R = require('../forensic-report.js');

// ---- party extraction ----
const parties = R._extractParties('Complainant: L. Highcock | Respondents: Marius Nortje, Kevin Lappeman');
ok(parties.some(p => /Highcock/.test(p)), 'extractParties finds the complainant');
ok(parties.some(p => /Marius Nortje/.test(p)), 'extractParties finds Marius Nortje');
ok(parties.some(p => /Kevin Lappeman/.test(p)), 'extractParties finds Kevin Lappeman');
ok(!parties.some(p => /Complainant|Respondent/i.test(p)), 'role labels are stripped, not treated as names');
ok(R._extractParties('').length === 0, 'no parties from empty input');
ok(R._extractParties('vs and & /').length === 0, 'no phantom names from separators only');

// ---- legal-subject mapping (one subject per CT) ----
ok(R._legalSubjectOf.CT18 === 'FINANCIAL', 'bank-detail CT18 -> Financial Irregularities');
ok(R._legalSubjectOf.CT14 === 'MISREP', 'entity-status CT14 -> Misrepresentation & Identity');
ok(R._legalSubjectOf.CT02 === 'CONTRADICTION', 'numerical CT02 -> Contradictory Statements');
ok(R._legalSubjectOf.CT27 === 'TAMPERING', 'layout CT27 -> Document Integrity & Tampering');

// ---- dishonesty-lens mapping ----
ok(R._dishonestyOf.CT02 === 'CONTRADICTIONS', 'CT02 -> Contradictions lens');
ok(R._dishonestyOf.CT18 === 'FINANCIAL', 'CT18 -> Financial Irregularities lens');
ok(R._dishonestyOf.CT27 === 'CONCEALMENT', 'CT27 -> Patterns of Concealment lens');
ok(R._dishonestyOf.CT31 === 'OMISSIONS', 'CT31 (cross-ref failure) -> Selective Omissions lens');

// ---- cleanQuote still stable (regression) ----
ok(!/verum omnis seal/i.test(R._cleanQuote('text verum omnis seal case-ab12cd34 more')), 'cleanQuote still strips seal debris');

// ---- plain-language narrative helpers ----
ok(R._listPhrase(['A']) === 'A', 'listPhrase: single');
ok(R._listPhrase(['A', 'B']) === 'A and B', 'listPhrase: pair uses "and"');
ok(R._listPhrase(['A', 'B', 'C']) === 'A, B and C', 'listPhrase: oxford-style with final "and"');
ok(R._listPhrase([]) === '', 'listPhrase: empty');
// Curated meanings for the high-value families read as lay clauses.
ok(/Lessee\/Owner trap/i.test(R._narrativeMeaning({ type: 'CT44' })), 'narrativeMeaning: CT44 clause-precondition trap');
ok(/goodwill/i.test(R._narrativeMeaning({ type: 'CT45' })), 'narrativeMeaning: CT45 goodwill denial');
ok(/two different numbers/i.test(R._narrativeMeaning({ type: 'CT02' })), 'narrativeMeaning: CT02 numeric');
// Unmapped type falls back to the category explainer, not an empty string.
ok(R._narrativeMeaning({ type: 'CT36' }).length > 0, 'narrativeMeaning: falls back to category explainer');
// Fully unknown type still yields a safe generic clause (never throws/empty).
ok(R._narrativeMeaning({ type: 'ZZ99' }).length > 0, 'narrativeMeaning: generic fallback for unknown type');

// ---- cross-border jurisdiction detection ----
{
  const cb = R._detectJurisdictions({ identity: { jurisdiction: 'South Africa / UAE' }, findings: { findings: [] } });
  ok(cb.isCrossBorder === true, 'detectJurisdictions: SA + UAE is cross-border');
  ok(cb.foreign.indexOf('AE') !== -1, 'detectJurisdictions: UAE detected as foreign leg');

  // Founder ruling: GPS fixes the HOME jurisdiction; documents fix the
  // cross-border legs (the Greensky MOU named the UAE while sealing happened
  // in South Africa; sealing in Dubai must flip the home leg, not lose SA).
  const gDxb = R._detectJurisdictions({ identity: {}, gps: { lat: 25.2, lng: 55.3 },
    findings: { findings: [{ evidence: 'High Court of South Africa, Gauteng' }] } });
  ok(gDxb.home === 'AE', 'GPS in Dubai sets the home jurisdiction to the UAE');
  ok(gDxb.foreign.indexOf('ZA') !== -1 && gDxb.isCrossBorder === true,
    'South Africa named in the documents stays as the cross-border leg');
  const gZa = R._detectJurisdictions({ identity: {}, gps: { lat: -29.8, lng: 31.0 },
    findings: { findings: [{ evidence: 'MOU signed in Ras Al Khaimah, AED 500,000' }] } });
  ok(gZa.home === 'ZA' && gZa.foreign.indexOf('AE') !== -1,
    'GPS in Durban keeps home ZA while the documents make the UAE leg active');
  const gNone = R._detectJurisdictions({ identity: {}, gps: { lat: 48.8, lng: 2.35 },
    findings: { findings: [] } });
  ok(gNone.home === 'ZA', 'GPS outside all supported regions leaves the default home');
  const statAe = R._statutesForSubject('CONTRADICTION', { home: 'AE', foreign: ['ZA'] });
  ok(statAe.length >= 1 && statAe[0].jur === 'AE',
    'statutory anchoring lists the GPS home jurisdiction first');
  const home = R._detectJurisdictions({ identity: { jurisdiction: 'South Africa' }, findings: { findings: [] } });
  ok(home.isCrossBorder === false, 'detectJurisdictions: SA only is not cross-border');
  // Currency corroboration: AED in evidence pulls in the UAE leg even if the field is blank.
  const byCurrency = R._detectJurisdictions({ identity: {}, findings: { findings: [{ evidence: 'paid AED 1,200,000 to the account' }] } });
  ok(byCurrency.isCrossBorder === true && byCurrency.foreign.indexOf('AE') !== -1, 'detectJurisdictions: AED currency signals UAE');
  // Jurisdiction read from the DOCUMENT TEXT even when the field is blank
  // (Des/AllFuels: KwaZulu-Natal + Companies Act 71 of 2008 place it in ZA).
  const byText = R._detectJurisdictions({ identity: {}, findings: { findings: [
    { evidence: 'Premises at Umtentweni, KwaZulu-Natal; the FRANCHISOR is a company under the Companies Act 71 of 2008.' }
  ] } });
  ok(byText.home === 'ZA' && byText.isCrossBorder === false, 'detectJurisdictions: SA cues in the document text place the matter in ZA with the field blank');
  // A UAE nexus named only in the document makes it cross-border on its own.
  const dubaiText = R._detectJurisdictions({ identity: {}, findings: { findings: [
    { evidence: 'the RAKEZ free-zone entity in Dubai, DIFC courts nexus' }
  ] } });
  ok(dubaiText.foreign.indexOf('AE') !== -1, 'detectJurisdictions: a Dubai/DIFC/RAKEZ nexus in the text is detected as a foreign leg');
}

// ---- subject mapping incl. franchise/lease ----
ok(R._subjectOf({ type: 'CT44' }) === 'CONTRACT', 'subjectOf: CT44 -> CONTRACT');
ok(R._subjectOf({ type: 'CT45' }) === 'CONTRACT', 'subjectOf: CT45 -> CONTRACT');
ok(R._subjectOf({ type: 'CT18' }) === 'FINANCIAL', 'subjectOf: CT18 -> FINANCIAL');

// ---- statute mapping across jurisdictions ----
{
  const jur = { home: 'ZA', foreign: ['AE'], isCrossBorder: true };
  const fin = R._statutesForSubject('FINANCIAL', jur);
  ok(fin.length === 2, 'statutesForSubject: FINANCIAL returns ZA + AE');
  ok(fin[0].jur === 'ZA' && /Organised Crime Act 121 of 1998/.test(fin[0].provisions.join(' ')), 'statutesForSubject: ZA cites POCA');
  ok(fin[1].jur === 'AE' && /Anti-Money Laundering Law \(Federal Decree-Law 20 of 2018\)/.test(fin[1].provisions.join(' ')), 'statutesForSubject: AE cites AML Law 20/2018');
  const homeOnly = R._statutesForSubject('TAMPERING', { home: 'ZA', foreign: [], isCrossBorder: false });
  ok(homeOnly.length === 1 && homeOnly[0].jur === 'ZA', 'statutesForSubject: home-only when not cross-border');
}

// ---- party attribution ----
{
  const parties = ['Marius Nortje', 'Kevin Lappeman'];
  ok(R._attributeParty({ evidence: 'Nortje signed the amended clause' }, parties) === 'Marius Nortje', 'attributeParty: matches by surname/first token');
  ok(R._attributeParty({ evidence: 'no party named here' }, parties) === null, 'attributeParty: null when unattributed');
}

// ---- monetary figure extraction (extraction only, de-duplicated) ----
{
  const m = R._extractMoney('paid AED 1,200,000 then only AED 1,020,000; also R 250 000 demanded');
  ok(m.some((x) => /AED 1,200,000/.test(x)), 'extractMoney: finds AED amount');
  ok(m.some((x) => /R 250 000/.test(x)), 'extractMoney: finds ZAR "R" amount with spaces');
  ok(R._extractMoney('$11,000 deal').some((x) => /\$11,000/.test(x)), 'extractMoney: finds USD $ amount');
  const dup = R._extractMoney('USD 500 and USD 500 again');
  ok(dup.filter((x) => /USD 500/.test(x)).length === 1, 'extractMoney: de-duplicates identical figures');
  ok(R._extractMoney('no money here, just words').length === 0, 'extractMoney: empty when no figures');
  // The R token must not match inside a word: "7 Mar 2025" produced "r 2025"
  // in a real Greensky report's Monetary Figures table.
  ok(R._extractMoney('stated as 7 Mar 2025 and as 13 Mar 2025').length === 0, 'extractMoney: does not read "Mar 2025" as an R amount');
  ok(R._extractMoney('a fee of R 2025 was charged').some((x) => /R 2025/.test(x)), 'extractMoney: still finds a genuine standalone R amount');
  ok(R._extractMoney('at the Bár 2025 gathering').length === 0, 'extractMoney: accented word ending in r does not leak an R amount');
  ok(R._extractMoney('var VAR_R 2025 in the code sample').length === 0, 'extractMoney: underscore identifier does not leak an R amount');
}

// ---- plain-language: EVERY finding type must carry everyday wording ----
// The website report's "In plain terms, ..." line is what an ordinary reader
// relies on. If a CT type has no lay clause it silently drops to a generic
// category sentence — understandable, but not specific. This guard makes plain
// wording a shipping requirement: add a CT type, add its plain sentence.
{
  const names = R._ctNames;
  const meaning = R._narrativeMeaningMap;
  const missing = Object.keys(names).filter((ct) => !meaning[ct] || !String(meaning[ct]).trim());
  ok(missing.length === 0, 'every CT type in CT_NAMES has a plain-language NARRATIVE_MEANING (missing: ' + (missing.join(', ') || 'none') + ')');
  // The plain wording must actually be plain: no CT codes, no "shall", no latin.
  const jargon = Object.keys(meaning).filter((ct) => /\bCT\d|\bshall\b|\bprima facie\b|\binter alia\b/i.test(meaning[ct]));
  ok(jargon.length === 0, 'plain-language clauses contain no codes or legalese (offenders: ' + (jargon.join(', ') || 'none') + ')');
  // narrativeMeaning() returns the specific clause, not the generic fallback.
  ok(R._narrativeMeaning({ type: 'CT20' }) === meaning.CT20 && !/inconsistent on this point/.test(R._narrativeMeaning({ type: 'CT20' })),
    'narrativeMeaning() returns the finding-specific plain clause (CT20), not the generic fallback');
}

// ---- plain-language "bottom line" opens the report and NAMES the serious ones ----
{
  const data = { docName: 'Wallers Agreement', pageCount: 20 };
  const fr = {
    overallScore: 62,
    findings: [
      { type: 'CT45', severity: 5, location: 'Page 11', evidence: 'goodwill recognised then denied' },
      { type: 'CT03', severity: 4, location: 'Page 3', evidence: 'Impossible date: 31/02/2021' },
      { type: 'CT26', severity: 1, location: 'Page 2', evidence: 'near-empty pages' },
      { type: 'CT31', severity: 2, evidence: 'annexure not found [bundle context: repeated page]' }
    ]
  };
  const lines = R._plainLeadLines(fr, data);
  const joined = lines.join('\n');
  ok(lines.length > 0, 'plain lead is produced when there are findings');
  ok(/sealed record of "Wallers Agreement" \(20 pages\) contains 4 verified findings\. The following are established\./.test(joined),
    'plain lead opens with the sealed record, document name, page count and verified finding count stated as fact');
  // An AI-raised item is candidate tier — it must never inflate the verified
  // count, never appear among the established serious findings, and must be
  // disclosed as advisory (PD16).
  const frAi = { overallScore: 62, findings: fr.findings.concat([
    { source: 'ai', type: 'INCONSISTENT_ENTITLEMENT', severity: 4, rationale: 'franchisor vs franchisee' }
  ]) };
  const joinedAi = R._plainLeadLines(frAi, data).join('\n');
  ok(/contains 4 verified findings\./.test(joinedAi), 'AI candidate does NOT inflate the verified findings count');
  ok(/raised 1 further candidate item/.test(joinedAi) && /advisory only/.test(joinedAi),
    'AI candidate is disclosed as advisory, outside the established findings');
  ok(/The serious ones, in plain words:/.test(joined), 'plain lead announces the serious findings');
  ok(/On p\. 11, .*goodwill/i.test(joined), 'plain lead NAMES the CT45 serious finding in plain words, anchored to its page');
  ok(/date does not add up/.test(joined), 'plain lead NAMES the CT03 serious finding in plain words');
  ok(!/CT45|CT03/.test(joined), 'plain lead contains no CT codes (everyday language only)');
  ok(/sealed under SHA-512/.test(joined) && /cannot be changed, altered, or deleted/.test(joined) && /verdict on any named person is for the court/.test(joined),
    'plain lead states the seal certainty and reserves the verdict for the court (PD16) - no score language');
  ok(!/\/100/.test(joined) && !/[Cc]onfidence band/.test(joined),
    'plain lead carries NO 0-100 score and NO confidence band (Ordinal Confidence: never percentages)');
  // Unreadable / failed scans must NOT produce a plain "all clear".
  ok(R._plainLeadLines({ unreadable: true, findings: [{ type: 'CT01', severity: 5 }] }, data).length === 0,
    'plain lead is empty on an unreadable document (no false all-clear)');
  ok(R._plainLeadLines({ scanFailed: true, findings: [{ type: 'CT01', severity: 5 }] }, data).length === 0,
    'plain lead is empty when the scan failed');
}

// ---- narrative reads as a story, not a data dump (source lock) ----
// Every external review of the narrative made the same complaint: one numbered
// entry per finding restates the same pattern until the story is unreadable.
// The narrative walk groups instances of a pattern into one telling: meaning
// once, strongest quote once, every page listed once, check-hint and law once.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  ok(/groups\.slice\(0,\s*CAP\)/.test(src), 'narrative walks pattern GROUPS, not raw findings');
  ok(src.indexOf("head += ' The record shows this ' + g.length + ' times.'") !== -1,
    'a repeated pattern is told once with its instance count');
  ok(src.indexOf("'Where it happens: '") !== -1, 'a repeated pattern lists every page it touches, once');
  ok(src.indexOf("'The strongest instance: '") !== -1, 'a repeated pattern quotes its strongest instance');
  ok(src.indexOf("'At its core: '") !== -1, 'the narrative opens with a factual thesis of the top patterns');
  ok(!/A moderate issue|A lesser issue/.test(src),
    'per-finding severity adjectives are gone - pattern order carries the weight');

  // Founder ruling 5 (AGENTS.md): the story leads, and provenance is on the
  // first pages. The narrative must be wired BEFORE §15.4 section 1 in
  // build(), and the software-not-AI statement must appear on the cover, in
  // the narrative intro, and on the sealed plain-language twin's first page.
  const buildBody = src.slice(src.indexOf('async function build('), src.indexOf('async function buildNarrative('));
  const narrAt = buildBody.indexOf("secNarrative(ctx, data, { label: 'THE STORY IN PLAIN LANGUAGE' })");
  const sec1At = buildBody.indexOf('secCriticalSubjects(ctx, data)');
  ok(narrAt !== -1 && sec1At !== -1 && narrAt < sec1At,
    'plain-language narrative renders on the first pages, before §15.4 section 1');
  // Story first, evidence second: page 2 is IN ONE PAGE, then the story, then
  // unread pages, then the seal explainer — and the TOC placeholder comes
  // AFTER the whole human part, so a lay reader meets the story before a
  // 25-entry wall of section names.
  const onePageAt = buildBody.indexOf('secExecutiveSummary(ctx, data)');
  const sealExplAt = buildBody.indexOf('secSealExplainer(ctx, data');
  const tocAt = buildBody.indexOf('var tocPage = doc.addPage');
  ok(onePageAt !== -1 && onePageAt < narrAt, 'the executive summary is the front page, before the story');
  ok(sealExplAt !== -1 && narrAt < sealExplAt && sealExplAt < tocAt,
    'the seal explainer joins Part 1, and the TOC only comes after the human part');
  ok(tocAt < sec1At, 'the §15.4 sections follow the TOC as Part 2');
  ok((src.match(/not the opinion of a generative AI|not by a generative AI/g) || []).length >= 3,
    'cover, narrative intro and narrative twin all state findings are software output, not generative AI');
  ok(/produced by forensic software/.test(src) && /deterministic detection rules/.test(src),
    'the provenance statement names the mechanism: deterministic software rules');
}

// ---- AI narrative renders structured, never a text dump ----
// The Workers-AI narrative arrives as free text; narrativeBlocks() must turn
// ANY shape of reply into typed blocks (heading / bullet / para) with long
// blocks split at sentence boundaries, so the PDF never shows a wall of text.
{
  const nb = R._narrativeBlocks;
  ok(Array.isArray(nb('')) && nb('').length === 0, 'narrativeBlocks: empty input yields no blocks');

  const structured = nb('SUMMARY\n\nFirst point of the story. Second sentence.\n\n' + '='.repeat(80) + '\n\nKEY EVIDENCE AND NEXT STEPS\n\n- request the original lease\n- trace the July payment\nClosing remark here.');
  ok(structured.filter(b => b.kind === 'heading').length === 2, 'ALL-CAPS section titles become headings');
  ok(!structured.some(b => /^=+$/.test(b.text)), 'separator rows are dropped');
  ok(structured.filter(b => b.kind === 'bullet').length === 2 &&
     structured.some(b => b.kind === 'bullet' && /original lease/.test(b.text)),
    'single-newline "- " lines become bullets');
  ok(structured.some(b => b.kind === 'para' && /Closing remark/.test(b.text)), 'text after a list still renders as a paragraph');

  const numbered = nb('1. first item checked\n2) second item checked');
  ok(numbered.length === 2 && numbered.every(b => b.kind === 'bullet'), 'numbered lines render as bullets');

  // A single unbroken 12-sentence block must come out as several paragraphs.
  const wall = nb(Array.from({ length: 12 }, (_, i) => 'Sentence number ' + (i + 1) + ' of the model reply keeps going on and on without a single break anywhere in sight.').join(' '));
  ok(wall.length >= 3 && wall.every(b => b.kind === 'para' && b.text.length <= 700),
    'a wall of text is split into readable paragraphs (' + wall.length + ' blocks)');
  ok(wall.map(b => b.text).join(' ').includes('Sentence number 12'), 'no text is lost in the split');
}

// ---- page anchoring: plural, list and duplicate locations ----
// From the sealed Greensky run of 14 Aug 2026: the identity finding printed
// with NO page ("the same party is identified inconsistently.") because its
// engine location is the PLURAL "Pages 11" and the matcher only understood
// the singular "Page N"; and the date finding printed "p. 89 vs 89" because
// both sides of the contrast were the same page. A report whose claim is
// "every finding anchored to its page" cannot drop anchors it already has.
{
  ok(R._fmtLocation('Pages 11') === 'p. 11', 'plural "Pages 11" anchors (was "—")');
  ok(R._fmtLocation('Pages 11, 12') === 'p. 11, 12', 'plural page list keeps every page');
  ok(R._fmtLocation('Page 12, 324') === 'p. 12, 324', 'comma list after a singular label keeps both pages');
  ok(R._fmtLocation('Page 89 vs Page 89') === 'p. 89', 'same page on both sides is deduped, not "89 vs 89"');
  ok(R._fmtLocation('Page 11 vs Page 12') === 'p. 11 vs 12', 'a genuine two-page contrast keeps "vs"');
  ok(R._fmtLocation('Full document') === 'Full document', 'non-numeric locations still pass through');
  ok(R._fmtLocation('') === '—' && R._fmtLocation('Same passage') === '—', 'unanchored locations still read "—"');
  ok(R._pageNumbers('Pages 11, 12').join(',') === '11,12', 'pageNumbers reads plural lists');
  ok(R._pageNumbers('Page 89 vs Page 89').join(',') === '89', 'pageNumbers dedupes a repeated page');
}

// ---- §15.2 language gate on AI-written narrative ----
// The narrator prompt forbids hedging and "red flag"/"indicator"; the model
// ignored it on the Greensky run and produced "potential red flags", "may be
// image-only" and "suggest potential issues" — which then led page 3 of a
// sealed report. Prompts are instructions; this gate is the guarantee.
{
  const s = R._scrubNarrative;
  const real = 'The examination revealed inconsistencies and potential red flags. The termination date is stated as both 7 Mar 2025 and 13 Mar 2025 [F1]. The pages may be image-only or intentional dividers [F3].';
  const got = s(real);
  ok(got.dropped === 2 && got.kept === 1, 'hedged and "red flag" sentences are dropped (' + got.kept + ' kept, ' + got.dropped + ' dropped)');
  ok(/termination date is stated as both/.test(got.text) && !/red flag|may be/i.test(got.text),
    'the compliant sentence survives verbatim; prohibited ones do not');
  ok(!/appears to|indicator|credibility|guilty/i.test(s('It appears to be forged. This is an indicator. His credibility is poor. He is guilty.').text),
    'hedging, indicator, credibility and guilt sentences are all removed');
  ok(s('The invoice is dated 3 March 2026. The lease expired on 1 January 2026.').dropped === 0,
    'plain factual sentences are never touched');
  const heads = s('SUMMARY\n\nThe lease expired on 1 January 2026.');
  ok(/SUMMARY/.test(heads.text), 'headings pass through the gate untouched');
  // A draft that is mostly prohibited language must not lead the report.
  const src2 = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  ok(/function voGatePasses\(scrub\)/.test(src2) && /scrub\.kept >= VO_GATE_MIN_KEPT && scrub\.kept >= scrub\.dropped/.test(src2)
    && /var fBlocks = voGatePasses\(scrub\)/.test(src2),
    'a draft with more prohibited than compliant sentences never leads the story (named policy)');
  ok(/sentence' \+ \(scrub\.dropped === 1 \? '' : 's'\) \+ ' of the draft above/.test(src2),
    'the report discloses how many sentences the gate removed');
  ok(/var narr = \(narrScrub\.kept >= VO_GATE_MIN_KEPT\) \? narrScrub\.text : ''/.test(src2),
    'the annex path is gated too — no route prints prohibited language');

  // Sentence splitting must survive legal prose. A naive [.!?] split cut
  // "Mr. Nortje may have signed it." into "Mr." + the rest, so the gate left
  // a dangling "Mr." in a SEALED report, and split "R3 800 000.00" into
  // "R3 800 000. 00" — a corrupted amount in a forensic document.
  ok(s('Mr. Nortje may have signed it. The lease expired on 1 Jan 2026.').text === 'The lease expired on 1 Jan 2026.',
    'a title before a name never leaves a dangling fragment when the sentence is dropped');
  ok(/R3 800 000\.00/.test(s('The payment was R3 800 000.00 per cl. 3. It appears to be unsigned.').text),
    'monetary amounts survive the split intact');
  ok(s('Clause 6.2.1 applies. M. Nortje signed on p. 89.').dropped === 0
    && /6\.2\.1/.test(s('Clause 6.2.1 applies. M. Nortje signed on p. 89.').text),
    'clause numbering, initials and page citations are not sentence breaks');
  const sp = R._splitSentences('Mr. Nortje signed. The lease expired.');
  ok(sp.length === 2 && /^Mr\. Nortje signed\./.test(sp[0].trim()),
    'the shared splitter keeps "Mr." with its sentence (' + sp.length + ' parts)');
  ok(R._splitSentences('One sentence only').length === 1, 'a lone unterminated sentence still returns one part');
}

// ---- the analyst's telling leads the story; the backbone stays deterministic ----
// External review: the deterministic sections read templated ("robotic")
// because they ARE templated — same input, same words, testifiable. The
// flowing story is the AI narrator's job. When it ran, its synthesis renders
// at the TOP of THE STORY IN PLAIN LANGUAGE (labelled, advisory), the
// deterministic pattern walk follows as "the verifiable backbone", and the
// annex never prints the same narrative twice.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  const story = src.slice(src.indexOf('function secNarrative'), src.indexOf('// ================= SECTION: AI REVIEW'));
  ok(/The analyst's telling/.test(story) && /narrativeBlocks\(scrub\.text\)/.test(story),
    'the AI narrative renders inside the story section, gated then parsed into typed blocks');
  ok(/Written by the AI narrator from the sealed findings/.test(story),
    'the analyst telling is labelled as AI-written and advisory');
  ok(/The verifiable backbone: each pattern, anchored/.test(story),
    'the deterministic walk is introduced as the verifiable backbone');
  ok(story.indexOf("The analyst's telling") < story.indexOf('The story the dates tell'),
    'the flowing story leads; dates and pattern walk follow');
  ok(/data\._voFlowShown = true/.test(story) && /!data\._voFlowShown/.test(src),
    'the annex AI section skips the narrative when it already led the story');
  // Provenance guard: the on-device fallback narrative is deterministic
  // template text and must NEVER be presented as the AI narrator's writing.
  ok(/flowSrc !== 'local'/.test(story),
    'the on-device fallback narrative never leads as the analyst telling');
  ok(/flowSrc === 'ai'/.test(story) && /Written by the AI narrator/.test(story),
    'the "Written by the AI narrator" label is reserved for a genuine AI telling');
  ok(/aiNarrativeSource: opts\.aiNarrativeSource \|\| null/.test(src),
    'the narrative author flag flows from the caller into both builds');
}

// ---- unread pages are disclosed, named, and routed to a human ----
// Founder ruling: 119 unread pages in the AllFuels bundle held a lease
// agreement the engine never saw. The report must name every unread page and
// the reason, on the first pages, with an explicit human-review instruction.
{
  ok(R._pageRanges([3, 5, 6, 7, 8, 12]) === '3, 5-8, 12', 'pageRanges compresses runs');
  ok(R._pageRanges([210]) === '210', 'pageRanges: single page');
  ok(R._pageRanges([]) === '', 'pageRanges: empty');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  ok(/function secUnreadPages/.test(src), 'unread-pages disclosure section exists');
  const mainBuild = src.slice(src.indexOf('async function build('), src.indexOf('async function buildNarrative('));
  const narrBuild = src.slice(src.indexOf('async function buildNarrative('));
  ok(/secUnreadPages\(ctx, data\)/.test(mainBuild) && /secUnreadPages\(ctx, data\)/.test(narrBuild),
    'the disclosure is wired into BOTH the main report and the narrative twin');
  const storyAt = mainBuild.indexOf("secNarrative(ctx, data, { label: 'THE STORY IN PLAIN LANGUAGE' })");
  const unreadAt = mainBuild.indexOf('secUnreadPages(ctx, data)');
  const sec1At2 = mainBuild.indexOf('secCriticalSubjects(ctx, data)');
  ok(storyAt !== -1 && storyAt < unreadAt && unreadAt < sec1At2,
    'unread pages are disclosed on the first pages, right after the story');
  ok(/These pages MUST be reviewed by a human\./.test(src),
    'the disclosure carries the explicit human-review instruction');
  ok(/absence of a finding on an unread page means nothing/.test(src),
    'the disclosure states that unread pages are missing evidence, not a clean bill');
  ok(/unreadPages: opts\.unreadPages \|\| null/.test(src),
    'structured unread-pages data flows from the caller into the report data');
}

// ---- parties are read from the RECORD, not from the user's form ----
// Founder ruling: the system must not depend on the user naming the parties.
// The Greensky report of 14 Aug 2026 printed "No parties were supplied in the
// case details, so findings could not be attributed to named individuals"
// three lines above a finding quoting Marius Nortje by name — the engine had
// already bound the names (anchor.who); the report was not reading them.
{
  const data = { identity: {}, findings: { findings: [
    { type: 'CT09', anchor: { who: [{ name: 'Marius Nortj' }, { name: 'Zone Authority' }, { name: 'Marius Nortje' }] } },
    { type: 'CT28', anchor: { who: [{ name: 'Kevin Lappeman' }, { name: 'Liam Highcock' }, { name: 'Marius Nortje' }] } }
  ] } };
  const found = R._documentParties(data);
  ok(found.length > 0, 'parties are discovered from the record with no case details entered');
  ok(found.indexOf('Marius Nortje') !== -1, 'the party named in the findings is discovered');
  ok(found.indexOf('Marius Nortj') === -1, 'the truncated spelling is merged away, not listed twice');
  ok(found[0] === 'Marius Nortje', 'the most-cited party leads the list');
  ok(found.every(n => n.indexOf(' ') !== -1), 'single-token fragments are never treated as parties');

  // Declared parties keep their roles; discovered ones are marked as such.
  const declared = { identity: { parties: 'Complainant: L. Highcock | Respondents: Marius Nortje' }, findings: data.findings };
  const merged = R._effectiveParties(declared);
  ok(merged.indexOf('L. Highcock') !== -1, 'declared parties are kept');
  ok(!merged.some(n => /^Liam Highcock$/.test(n)),
    '"Liam Highcock" from the record is recognised as the declared "L. Highcock", not a second party');
  ok(merged.filter(n => /Nortje/.test(n)).length === 1, 'a party declared AND found in the record appears once');

  const wr = R._effectivePartiesWithRoles(data);
  ok(wr.length > 0 && wr.every(p => p.fromRecord === true && p.role === 'named in the record'),
    'record-derived parties carry an honest role label, never an invented one');
  const wrDecl = R._effectivePartiesWithRoles(declared);
  ok(wrDecl.some(p => !p.fromRecord), 'declared parties keep their declared role');

  // The report must no longer tell the user attribution is impossible.
  const src3 = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  ok(!/No parties were supplied in the case details/.test(src3),
    'the "no parties were supplied" dead end is gone');
  ok(/var partiesWR = effectivePartiesWithRoles\(data\)/.test(src3),
    'the scorecard is built from record-derived parties');
  ok(!/extractParties\(idn\.parties/.test(src3) && !/var parties = extractParties\(data\.identity/.test(src3),
    'no attribution path reads the user form alone');
}

// ---- THE SHORT VERSION: a quick, accurate read for the decision-maker ----
// Founder ruling: the full findings set is what an EXPERT needs to audit, and
// it is too much for the person who has to DECIDE. The short version reduces
// each contradiction to the two things the record says that cannot both be
// true, side by side, with the pages — the record's own words, nothing new.
{
  const sides = R._contradictionSides;
  const trap = sides('Termination/expiry rests on a lessee-only clause (party not the owner): "chisee is not the owner of the Premises" — yet the record shows the party had become the owner of the premises: "fuel and the Owner/Lessor of the site"');
  ok(trap && /not the owner of the Premises/.test(trap.a) && /Owner\/Lessor/.test(trap.b),
    'an "A — yet B" finding splits into the two sides the record states');
  const affirm = sides('The document both affirms and negates "signed": "…yes he signed under pressure…" vs "…goodwill taken without any signed waiver…"');
  ok(affirm && /signed under pressure/.test(affirm.a) && /without any signed waiver/.test(affirm.b),
    'an "A vs B" finding splits on the contrast');
  ok(sides('Referenced "annexure 8" not found in document') === null,
    'a single-sided finding is not forced into a pair');
  ok(sides('') === null && sides(null) === null, 'empty evidence yields no pair');
  ok(sides('short — yet x') === null, 'a fragment too short to be a quoted side is rejected');

  const src4 = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  ok(/function secShortVersion/.test(src4), 'the short-version section exists');
  const b4 = src4.slice(src4.indexOf('async function build('), src4.indexOf('async function buildNarrative('));
  const shortAt = b4.indexOf('secShortVersion(ctx, data)');
  const onePageAt2 = b4.indexOf("ctx.box('IN ONE PAGE'");
  const storyAt2 = b4.indexOf("secNarrative(ctx, data, { label: 'THE STORY IN PLAIN LANGUAGE' })");
  ok(shortAt !== -1 && onePageAt2 < shortAt && shortAt < storyAt2,
    'it sits in Part 1: after IN ONE PAGE, before the story');
  ok(/secShortVersion\(ctx, data\)/.test(src4.slice(src4.indexOf('async function buildNarrative('))),
    'the plain-language twin carries it too');
  ok(/What cannot all be true at once/.test(src4) && /The record states/.test(src4) && /and also states/.test(src4),
    'the summary presents both sides of each contradiction side by side');
  ok(/Also established/.test(src4), 'single-sided findings still appear, in one line each');
  ok(/f\.source !== 'ai'/.test(src4.slice(src4.indexOf('function secShortVersion'), src4.indexOf('function secUnreadPages'))),
    'AI candidates are excluded from the summary — verified findings only');
  ok(/not legal conclusions/.test(src4) && /verdict on any named person is for the court/.test(src4),
    'the summary reserves the verdict and marks candidate law as starting points');
}

// ---- EXECUTIVE SUMMARY: the story on the front page ----
// Founder ruling: a reader must get the story before anything else — the core
// finding, the findings that matter most and WHAT EACH ESTABLISHES, the dates,
// and what to do next. The consequence is stated as fact; the inference from
// it to intent or liability stays with counsel and the court.
{
  const est = R._establishesOf;
  ok(/applies only to a lessee/.test(est({ type: 'CT44' })), 'CT44 states the consequence of the clause condition');
  ok(/forfeiture presupposes the asset/.test(est({ type: 'CT45' })), 'CT45 states why a forfeiture implicates the asset');
  ok(/cannot carry the obligation it is being used to enforce/.test(est({ type: 'CT23' })),
    'CT23 states what an unsigned counterpart cannot do');
  ok(est({ type: 'ZZ99' }).length > 0, 'an unmapped type still yields a safe factual consequence');
  const all = ['CT44', 'CT45', 'CT23', 'CT01', 'CT02', 'CT03', 'CT20', 'CT31', 'CT08', 'CT37', 'CT26', 'CT46', 'ZZ99']
    .map((t) => est({ type: t })).join(' ');
  ok(!/\b(guilty|fraud|theft|racketeering|stolen|criminal|dishonest|intended to)\b/i.test(all),
    'no consequence line asserts a crime, intent or a verdict');
  ok(!/\b(may|might|appears to|likely|probably|suggests)\b/i.test(all),
    'no consequence line hedges');

  const src5 = require('fs').readFileSync(require('path').join(__dirname, '..', 'forensic-report.js'), 'utf8');
  ok(/function secExecutiveSummary/.test(src5), 'the executive summary section exists');
  const es = src5.slice(src5.indexOf('function secExecutiveSummary'), src5.indexOf('function secShortVersion'));
  ok(/The findings that matter most/.test(es) && /What this establishes/.test(es),
    'it names the top findings and what each establishes');
  ok(/Key dates in the record/.test(es), 'it carries the dated sequence');
  ok(/What to do next/.test(es) && /Preserve the sealed originals/.test(es),
    'it closes with concrete next steps');
  ok(/This report does not determine guilt/.test(es) && /The verdict is for the court/.test(es),
    'it ends by reserving the verdict');
  ok(/f\.source !== 'ai'/.test(es), 'AI candidates are excluded from the executive summary');
  ok(/secExecutiveSummary\(ctx, data\)/.test(src5.slice(src5.indexOf('async function buildNarrative('))),
    'the plain-language twin opens with it too');
}

console.log(`\n[legal-analysis] PASS=${pass} FAIL=${fail}`);
console.log(`[legal-analysis] ${fail === 0 ? 'ALL GREEN' : 'FAILURES'}`);
process.exit(fail === 0 ? 0 : 1);
