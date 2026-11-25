import { createRequire } from 'node:module';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const E = require('../forensic-engine-page.js');
globalThis.PDFLib = require('pdf-lib');
let failures = 0;
function check(value, label) {
  if (!value) {
    failures++;
    console.error('FAIL ' + label);
  } else console.log('PASS ' + label);
}

async function scan(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([612, 792]);
    lines.forEach((line, i) => page.drawText(line, { x: 30, y: 750 - 20 * i, size: 9, font }));
  }
  const bytes = await doc.save({ useObjectStreams: false });
  return E.runForensicEngine(bytes, await PDFDocument.load(bytes), null, { referenceTime: '2026-11-25T00:00:00.000Z' });
}

const evidence = 'The prior bundle ends here. You saw the pattern before the AI did. Now you have the court records.';
const report = [
  'FORENSIC REPORT: EXAMPLE MATTER. Constitution: Verum Omnis v5.2.7.',
  '1. EXECUTIVE SUMMARY. This report analyzes a sealed evidence bundle.',
  '2. EVIDENCE MANIFEST & CHAIN OF CUSTODY. Primary Artifact: example.pdf. Artifact SHA-512 (Partial): abcdef0123456789.',
  'There were no sales. The deal happened.'
];
const ledgerPage = [
  '3. CONTRADICTION LEDGER (B1 - Contradiction Brain).',
  'The following primary contradictions were identified in the evidence.',
  '4. BRAIN OUTPUTS (B1-B9). B1 - Contradiction Brain: See Section 3.'
];
const brainsPage = [
  'B4 - Linguistics. The report analyzes the parties and their documents.',
  'B5 - Multi-Actor Mapping. B6 - Financial Brain. B7 - Legal Mapping Brain.',
  '5. TRIPLE VERIFICATION. Thesis: the evidence states a claim. Antithesis: the claim is disputed.'
];
const conclusionPage = [
  'Status: PASS. Synthesis: the evidence supports this analysis.',
  '6. RECOMMENDATIONS & NEXT STEPS. Review the documents and compare the claims.',
  'Court-Ready Declaration: This output is generated under Verum Omnis Constitution v5.2.7.'
];
const partyClaim = 'This affidavit records the chain of custody of the exhibit. Item received by the clerk.';
const footer = 'VERUM OMNIS SHA-512 (partial): 0123456789abcdef01234567 Sealed Evidence Source: example.pdf';
const record = 'Invoice dated 12 March 2025: rental payment received R100.00.';

const twoPages = [evidence, report.join(' '), ledgerPage.join(' '), partyClaim];
check(E.DETECTORS.D01C_DETECT_DENIAL_ADMISSION_PAIR([report.join(' ')]).length > 0,
  'the synthetic prior-analysis page would produce a finding if scanned');
const twoExcluded = E.voExcludeSecondaryReportPages(twoPages);
check(JSON.stringify(twoExcluded && twoExcluded.pages) === '[2,3]', 'exactly the two prior-analysis pages are excluded');
const singleReport = [report.join(' ')];
const singleExcluded = E.voExcludeSecondaryReportPages(singleReport);
check(JSON.stringify(singleExcluded && singleExcluded.pages) === '[1]', 'a single-page prior analysis is excluded and disclosed');
const quotedTemplateReport = [report.join(' ') + ' Every forensic report generated under this Constitution must follow this template.'];
check(E.voExcludeSecondaryReportPages(quotedTemplateReport)?.pages[0] === 1,
  'an independently identified analysis stays excluded when it quotes the report template');
const legacyMasthead = ['VERUM OMNIS FORENSIC REPORT. Report Reference: VO-TEST. Prepared by an independent tool.'];
const legacyExclusion = E.voExcludeSecondaryReportPages(legacyMasthead);
check(legacyExclusion && /Prior analysis report:/.test(legacyExclusion.note) && !/Prior Verum Omnis report:/.test(legacyExclusion.note),
  'an unauthenticated report masthead does not attribute analysis to the platform');
check(twoPages[0] === evidence && twoPages[3] === partyClaim, 'preceding and subsequent record pages remain unchanged');
const fourPages = [evidence, report.join(' '), ledgerPage.join(' '), brainsPage.join(' '), conclusionPage.join(' '), partyClaim];
const fourExcluded = E.voExcludeSecondaryReportPages(fourPages);
check(JSON.stringify(fourExcluded && fourExcluded.pages) === '[2,3,4,5]', 'four differently signalled report pages are excluded, not adjacent evidence');
const primary = [
  'Letter: Please review the FORENSIC REPORT: EXAMPLE MATTER. The chain of custody is discussed in the attached report.',
  'Letter: Please read the FORENSIC REPORT: EXAMPLE MATTER, prepared under Verum Omnis Constitution v5.2.7. Its executive summary is attached.',
  'Primary evidence: the document refers to B4 linguistics and a financial brain without producing an analysis.'
];
check(E.voExcludeSecondaryReportPages(primary) === null, 'report references and isolated analytical terms do not exclude evidence');
const blocks = [record + ' ' + footer];
E.voStripSealFurnitureBlocks(blocks);
const ledger = E.voExtractConductLedger(blocks);
check(ledger.events.length === 1 && !/SHA-512|Sealed Evidence Source/i.test(ledger.events[0].snippet), 'post-strip ledger snippet excludes seal footer');
const footerScan = await scan([[record + ' ' + footer], [evidence]]);
check(/Seal furniture:.*removed from 1 page/i.test(footerScan.extractionNotes), 'seal-furniture exclusion is disclosed in the full scan');
check(footerScan.conductLedger.events.length === 1 && !/SHA-512|Sealed Evidence Source/i.test(footerScan.conductLedger.events[0].snippet),
  'the full engine ledger is built from post-strip text');
const innerFooter = [record + ' Verum Omnis Sealed Evidence Source: example.pdf Page 1 of 1 A genuine statement follows.'];
E.voStripSealFurnitureBlocks(innerFooter);
check(/Verum Omnis Sealed Evidence Source: example\.pdf Page 1 of 1/.test(innerFooter[0]) && /A genuine statement follows/.test(innerFooter[0]),
  'an inner sealed-bundle source and page marker remain record content');
const result = await scan([[evidence], report, ledgerPage, [partyClaim]]);
check(/2 page\(s\) \(2, 3\)/.test(result.extractionNotes), 'extraction note discloses exactly the two excluded pages');
check(/Prior analysis excluded: page 2\./.test(result.extractionNotes) && /Prior analysis excluded: page 3\./.test(result.extractionNotes), 'each excluded page has its own disclosure');
check(!/Prior Verum Omnis report:/.test(result.extractionNotes), 'third-party analysis is not attributed to the platform');
check(!result.findings.some(f => (f.anchor && f.anchor.where || []).some(p => Number(p) === 2 || Number(p) === 3)), 'no finding cites the prior-analysis pages');
check(result.findings.some(f => f.type === 'CT39' && /This affidavit records/.test(f.evidence)), 'scan retains party-authored custody claim');
const wf3 = result.wellFormedness.checks.find(c => c.id === 'WF3');
check(!wf3.pass && /2, 3/.test(wf3.note) && /exclud/i.test(wf3.note), 'WF3 reports the found-and-excluded analysis pages');
const singleReportScan = await scan([report]);
check(/Prior analysis excluded: page 1\./.test(singleReportScan.extractionNotes) &&
  !singleReportScan.wellFormedness.checks.find(c => c.id === 'WF3').pass,
  'a single excluded report page is disclosed and reported by WF3');

const goodwill = E.DETECTORS.D39_DETECT_ASSET_VALUE_DENIAL;
const question = 'If goodwill had no value, why did Example Holdings include a clause specifically referring to goodwill?';
check(goodwill([question]).length === 0, 'a rhetorical question cannot supply both horns');
check(goodwill(['If the agreement states "goodwill has no value", why was it included?', 'Goodwill is recognised as a valuable asset.']).length === 0,
  'a quoted denial in an interrogative sentence cannot supply a denial horn');
check(goodwill(['Is MOU Clause 7 (Page 4) "goodwill has no value"?', 'Goodwill is recognised as a valuable asset.']).length === 0,
  'an interrogative citation cannot turn a quoted denial into a declaration');
check(goodwill(['If goodwill had no value, why include the clause? Example Holdings states goodwill is recognised as an asset.', 'Example Holdings stated goodwill has no value.']).length === 1,
  'an earlier rhetorical question does not hide a later real pair');
check(goodwill(['Goodwill has no value but goodwill is recognised as an asset.', 'Goodwill has no value.']).length === 1,
  'an earlier same-sentence candidate does not hide a later real pair');
check(goodwill(['Goodwill has no value but goodwill is recognised as an asset.', 'Goodwill is recognised as an asset.']).length === 1,
  'an earlier same-sentence candidate does not hide a later recognition');
check(goodwill(['Goodwill has no value if the clause applies.', 'Goodwill is recognised as a valuable asset.']).length === 0,
  'a conditional denial is not an unconditional denial horn');
const defined = goodwill([
  'Example Holdings: "Goodwill" means the goodwill of the business, a quantifiable asset.',
  'Example Holdings stated that goodwill has no value.'
]);
check(defined.length === 1 && defined[0].severity <= 3, 'definition and genuine later denial survive with narrative severity capped');
const narrativePage = 'MOU Clause 7 (Page 4) "The Operator shall not be entitled to goodwill under any circumstances" Court Cases Example Holdings demanded a fee for renewal. If goodwill had no value, why did Example Holdings include a clause specifically taking it away?';
const definitionPage = '1.1.50 "Goodwill\' means the established reputation of a business regarded as a quantifiable asset and calculated as part of its value when it is sold by the Franchisor.';
const narrativePair = goodwill([narrativePage, definitionPage]).filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(narrativePair.length === 1 && narrativePair[0].severity <= 3 && /narrative/i.test(narrativePair[0].evidence) && !/Court Cases/.test(narrativePair[0].evidence), 'narrative quotation is capped, identified and excludes following table row');
const curlyNarrative = 'MOU Clause 7 (Page 4) “The Operator shall not be entitled to goodwill under any circumstances” Court Cases Example Holdings requested a fee.';
const curlyPair = goodwill([curlyNarrative, definitionPage]).filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(curlyPair.length === 1 && /narrative/i.test(curlyPair[0].evidence) && !/Court Cases/.test(curlyPair[0].evidence),
  'curly-quoted narrative clauses retain provenance and exclude following text');
const originalClause = 'MOU clause 7. The Operator shall not be entitled to goodwill under any circumstances, at the end of the Contract Period. Page 4 of 4';
const resolvedPair = goodwill([narrativePage, definitionPage, 'Unrelated record page.', originalClause]).filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(resolvedPair.length === 1 && /Page 4/.test(resolvedPair[0].location) && !/Court Cases/.test(resolvedPair[0].evidence), 'narrative quote resolves to matching original instrument and excludes table row');
const shiftedInstrument = goodwill([narrativePage, definitionPage, 'Unrelated record page.', 'Other evidence.', 'More evidence.', originalClause]).filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(shiftedInstrument.length === 1 && /Page 6/.test(shiftedInstrument[0].location) && !/narrative/i.test(shiftedInstrument[0].evidence), 'an instrument with its own page numbering resolves on its actual bundle page');
const spacedInstrument = originalClause.replace('shall not be entitled', 'shall  not be entitled');
const whitespacePair = goodwill([narrativePage, definitionPage, 'Unrelated record page.', spacedInstrument]).filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(whitespacePair.length === 1 && /Page 4/.test(whitespacePair[0].location) && !/narrative/i.test(whitespacePair[0].evidence), 'source resolution tolerates extraction whitespace differences');
const pairResult = await scan([[narrativePage], [definitionPage]]);
const pairFinding = pairResult.findings.find(f => f.type === 'CT45' && /defined as a quantifiable asset/.test(f.evidence));
check(pairFinding && pairFinding.anchor.quote.some(q => /shall not be entitled to goodwill under any circumstances/i.test(q)) && pairFinding.anchor.quote.every(q => !/Court Cases/.test(q)), 'full scan anchors the actual forfeiture clause rather than the following table row');
const flattenedLetter = 'MOU Clause 7 (Page 4) "The Operator shall not be entitled to goodwill under any circumstances" ' +
  'Court Cases Example Holdings demanded a fee for renewal. ' +
  'If goodwill had no value, why did Example Holdings include a clause specifically taking it away? ' +
  'The clause describes goodwill as valuable. Example Holdings would not have included a forfeiture if goodwill was worthless.';
const flattenedDefinition = 'c· 1.1.50 "Goodwill\' means an established business reputation regarded as a quantifiable asset and calculated as part of its value when sold; ' +
  '1.1.51 "Investment Margin\' means a different term. C IS M N O M R U VE';
const flattenedPair = goodwill([flattenedLetter, flattenedDefinition]);
check(flattenedPair.length === 1 && /defined as a quantifiable asset/.test(flattenedPair[0].evidence) &&
  /narrative/i.test(flattenedPair[0].evidence) && !/Court Cases|Investment Margin|worthless/i.test(flattenedPair[0].evidence),
  'flattened narrative quotation survives without the following table row, conditional gloss or next definition');
const uninterruptedLetter = flattenedLetter.replace('renewal. If', 'renewal If');
check(goodwill([uninterruptedLetter, flattenedDefinition]).some(f => /defined as a quantifiable asset/.test(f.evidence) && /narrative/i.test(f.evidence)),
  'a cited declarative instrument quote survives a later question in flattened text');
const flattenedScan = await scan([[uninterruptedLetter], [flattenedDefinition]]);
const flattenedFinding = flattenedScan.findings.find(f => f.type === 'CT45' && /defined as a quantifiable asset/.test(f.evidence));
check(flattenedFinding && flattenedFinding.anchor.quote.some(q => /shall not be entitled to goodwill under any circumstances/i.test(q)) &&
  flattenedFinding.anchor.quote.every(q => !/Court Cases|Investment Margin/i.test(q)),
  'the full scan retains the flattened instrument quote without capturing an adjacent table or definition');
const continuationPair = goodwill([
  flattenedLetter + ' Page 1 of 3',
  flattenedDefinition + ' Page 2 of 3',
  'Other correspondence. Page 3 of 3',
  'Verum Omnis Sealed Evidence Source: example.pdf Page 1 of 4 MOU. Terms agreed between the parties.',
  'Further terms. Page 2 of 4',
  'More terms. Page 3 of 4',
  'Clause 7. The Operator shall not be entitled to goodwill under any circumstances. Page 4 of 4'
]).filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(continuationPair.length === 1 && /Page 7/.test(continuationPair[0].location) && !/narrative/i.test(continuationPair[0].evidence),
  'a uniquely identified instrument continuation resolves to its original clause page');
const wrongInstrument = goodwill([narrativePage, definitionPage,
  'AGREEMENT clause 7. The Operator shall not be entitled to goodwill under any circumstances.'])
  .filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(wrongInstrument.length === 1 && /narrative/i.test(wrongInstrument[0].evidence) && /Page 1/.test(wrongInstrument[0].location),
  'matching wording in a differently identified instrument does not replace the cited source');
const wrongInstrumentPage = goodwill([narrativePage, definitionPage,
  'MOU clause 7. The Operator shall not be entitled to goodwill under any circumstances. Page 2 of 4'])
  .filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(wrongInstrumentPage.length === 1 && /narrative/i.test(wrongInstrumentPage[0].evidence),
  'a same-kind instrument with a different stated page does not replace the cited source');
const ambiguousInstrument = goodwill([narrativePage, definitionPage, originalClause, originalClause])
  .filter(f => /defined as a quantifiable asset/.test(f.evidence));
check(ambiguousInstrument.length === 1 && /narrative/i.test(ambiguousInstrument[0].evidence),
  'ambiguous matching instruments remain identified as narrative provenance');
const ct44 = E.DETECTORS.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED([
  'In the event that the FRANCHISOR is not the owner of the Premises but is the Lessee in terms of a head lease agreement with a third party and such head lease terminates, then this Contract shall be deemed to have terminated or expired.',
  'This Franchise Agreement expires by the effluxion of time on 31 July 2016.',
  'By 2014 Example Holdings (Pty) Ltd purchased the property and became the registered owner of the premises.'
]);
check(ct44.some(f => f.type === 'CT44' && f.severity >= 4), 'independent conflicting instrument clauses survive');
const ct44Scan = await scan([
  ['In the event that the FRANCHISOR is not the owner of the Premises but is the Lessee in terms of a head lease agreement with a third party and such head lease terminates, then this Contract shall be deemed to have terminated or expired. This Franchise Agreement expires by the effluxion of time on 31 July 2016.'],
  ['By 2014 Example Holdings (Pty) Ltd purchased the property and became the registered owner of the premises.']
]);
check(ct44Scan.findings.some(f => f.type === 'CT44' && f.findingClass === 'CONTRADICTION' && f.severity === 4), 'independent instrument conflict remains a high-ranked contradiction in the full scan');
const transactionPair = E.DETECTORS.D01C_DETECT_DENIAL_ADMISSION_PAIR;
check(!transactionPair(['What does "no sales were made" mean when the deal happened?']).length, 'transaction denial cannot be a rhetorical question');
check(!transactionPair(['There were no sales. The deal happened?']).length, 'an interrogative transaction is not an admission');
check(transactionPair(['There were no sales. Later, the deal happened.']).length === 1, 'separate transaction statements remain detectable');
check(transactionPair(['There were no sales and the deal happened. There were no sales. Later the deal happened.']).length === 1, 'later distinct statements survive an earlier same-sentence candidate');
const directPair = E.DETECTORS.D01_DETECT_DIRECT_CONTRADICTION;
check(!directPair(['Was the invoice paid or was the invoice not paid?']).some(f => /Opposing statements|both affirms and negates/.test(f.evidence)), 'direct contradiction does not use a rhetorical question');
check(!directPair(['Was the invoice paid?', 'The invoice was not paid.']).some(f => /Opposing statements|both affirms and negates/.test(f.evidence)),
  'an unanswered positive question is not an affirmative statement');
check(!directPair(['The invoice was paid and the invoice was not paid.']).some(f => /Opposing statements|both affirms and negates/.test(f.evidence)), 'direct contradiction does not pair a sentence with itself');
check(directPair(['The invoice was paid. The invoice was not paid.']).some(f => /Opposing statements|both affirms and negates/.test(f.evidence)), 'direct contradiction retains separate statements');
check(directPair(['The invoice was paid', 'The invoice was not paid']).some(f => /Opposing statements|both affirms and negates/.test(f.evidence)),
  'different pages delimit direct statements even without ending punctuation');
const factive = E.DETECTORS.D10B_DETECT_FACTIVE_COMMITMENT_DENIAL;
const polarity = E.DETECTORS.D10C_DETECT_FRAME_POLARITY_CONFLICT;
const factiveClaim = 'We confirmed that the vessel was delivered to the owner on Monday.';
const positiveClaim = 'The vessel was delivered to the owner on Monday.';
const denialQuestion = 'The vessel was not delivered to the owner on Monday?';
const denialStatement = 'The vessel was not delivered to the owner on Monday.';
check(!factive([factiveClaim, denialQuestion]).length, 'factive denial does not use a question');
check(factive([factiveClaim, denialStatement]).length > 0, 'factive denial retains a declarative denial');
check(!polarity([positiveClaim, denialQuestion]).length, 'polarity conflict does not use a question');
check(!polarity([positiveClaim.replace(/\.$/, '?'), denialStatement]).length, 'a positive-polarity question is not an affirmation');
check(polarity([positiveClaim, denialStatement]).length > 0, 'polarity conflict retains a declarative denial');
check(polarity([positiveClaim, denialQuestion, denialStatement]).some(f => /Page 3/.test(f.location)), 'an earlier question does not hide a later declarative denial');
const sameSentenceClass = [{
  type: 'CT01', severity: 4, evidence: 'Two quotes from one sentence',
  anchor: { where: [1], quote: ['the invoice was paid', 'the invoice was not paid'] }
}];
E.voApplyFindingClasses(sameSentenceClass, ['The invoice was paid and the invoice was not paid.']);
check(sameSentenceClass[0].findingClass !== 'CONTRADICTION', 'two fragments of one sentence are not a contradiction');
const distinctSentenceClass = [{
  type: 'CT01', severity: 4, evidence: 'Two quotes from distinct statements',
  anchor: { where: [1], quote: ['the invoice was paid', 'the invoice was not paid'] }
}];
E.voApplyFindingClasses(distinctSentenceClass, ['The invoice was paid. The invoice was not paid.']);
check(distinctSentenceClass[0].findingClass === 'CONTRADICTION', 'two distinct anchored sentences remain a contradiction');
const wrappedClass = [{
  type: 'CT01', severity: 4, evidence: 'Two conflicting statements.', location: 'Page 1 vs Page 2',
  anchor: { where: [1, 2], quote: ['Example Holdings says payment was made', 'Example Holdings says payment was not made'] }
}];
E.voApplyFindingClasses(wrappedClass, ['Example Holdings says payment\nwas made.', 'Example Holdings says payment   was not made.']);
check(wrappedClass[0].findingClass === 'CONTRADICTION', 'whitespace variations do not hide distinct quoted statements');
const overlappingClass = [{
  type: 'CT01', severity: 4, evidence: 'Overlapping quote windows',
  anchor: { where: [1], quote: ['The invoice was paid. The invoice was not paid', 'The invoice was not paid'] }
}];
E.voApplyFindingClasses(overlappingClass, ['The invoice was paid. The invoice was not paid.']);
check(overlappingClass[0].findingClass !== 'CONTRADICTION', 'overlapping quote windows do not count as two independent horns');
const singleSourceClass = [{
  type: 'CT20', severity: 3, evidence: 'Registration number ABC123 fails validation',
  anchor: { where: [1], quote: ['Registration number ABC123'] }
}];
E.voApplyFindingClasses(singleSourceClass, ['Registration number ABC123 fails validation.']);
check(singleSourceClass[0].findingClass !== 'CONTRADICTION', 'a single-statement validation result is reclassified rather than called a contradiction');
const unsigned = await scan([
  ['Example Holdings never countersigned the agreements and demanded payment under those agreements.'],
  ['Other primary correspondence follows on a separate page.']
]);
check(/\[CT35\].*never countersigned/i.test(unsigned.extractionNotes), 'unsigned statement also appears as an unanchored CT35 observation');
check(!unsigned.findings.some(f => f.type === 'CT23' && f.severity >= 3), 'unanchored observation prevents a higher-severity CT23 finding');
check(/CT23.*(?:suppressed|observation)|(?:suppressed|observation).*CT23/i.test(unsigned.extractionNotes), 'suppression is disclosed');
const different = await scan([
  ['The document was not witnessed. Example Holdings did not countersign the agreement and demanded payment.'],
  ['Other primary correspondence follows on a separate page.']
]);
check(different.findings.some(f => f.type === 'CT23' && f.severity >= 3), 'an unrelated unanchored observation does not suppress CT23');
const differentClause = await scan([
  ['The document was not witnessed; Example Holdings did not countersign the agreement and demanded payment.'],
  ['Other primary correspondence follows on a separate page.']
]);
check(differentClause.findings.some(f => f.type === 'CT23' && f.severity >= 3),
  'an unrelated observation in a separate clause does not suppress CT23');
const mixedUnsigned = await scan([
  ['Example Holdings never countersigned the first agreement and demanded payment.'],
  ['Other Holdings did not countersign the second agreement and demanded payment.'],
  ['Other primary correspondence follows on a separate page.']
]);
check(mixedUnsigned.findings.some(f => f.type === 'CT23' && /second agreement/i.test(f.evidence)), 'independent unsigned claim survives when another claim is unanchored');
const sameStatementObservation = await scan([
  ['The agreement was not witnessed and was never signed, and Example Holdings demanded payment.'],
  ['Other primary correspondence follows on a separate page.']
]);
check(/\[CT35\].*witness/i.test(sameStatementObservation.extractionNotes), 'procedure observation is disclosed');
check(!sameStatementObservation.findings.some(f => f.type === 'CT23' && f.severity >= 3), 'an unsigned claim in the same unanchored observation sentence is restrained');
const severityCases = [
  { type: 'CT01', severity: 5, findingClass: 'CONTRADICTION', anchor: { where: [1, 2], quote: ['Example Holdings says the lease ended', 'Example Holdings says the lease continued'] } },
  { type: 'CT54', severity: 4, findingClass: 'EXAMINATION_LIMIT', anchor: { where: [3], quote: [] } },
  { type: 'CT01', severity: 5, findingClass: 'CONTRADICTION', anchor: { where: [4, 5], quote: ['Example Holdings says the lease ended', 'Example Holdings says the lease continued'] } },
  { type: 'CT01', severity: 5, findingClass: 'CONTRADICTION', anchor: { where: [4], quote: ['Example Holdings says the lease ended', 'Example Holdings says the lease continued'] } },
  { type: 'CT01', severity: 5, findingClass: 'CONTRADICTION', anchor: { where: [4, 6], quote: ['Example Holdings says the lease ended', 'Example Holdings says the lease continued'] } }
];
const severityPages = [
  'COMMENTARY: Example Holdings says the lease ended. This opinion discusses the dispute.',
  'ANALYSIS: Example Holdings says the lease continued. This argument discusses the dispute.',
  'Sparse page.',
  'AGREEMENT: Example Holdings says the lease ended. Example Holdings says the lease continued.',
  'AFFIDAVIT: Example Holdings says the lease continued.',
  'AGREEMENT: Example Holdings says the lease continued.'
];
if (typeof E.voCalibrateFindingSeverity === 'function') E.voCalibrateFindingSeverity(severityCases, severityPages);
check(severityCases[0].severity <= 3, 'narrative-only anchors are capped at moderate');
check(severityCases[1].severity <= 2, 'single-page examination limits are capped at low');
check(severityCases[2].severity === 5, 'independent documentary statements by one party remain eligible for critical');
check(severityCases[3].severity < 5, 'two statements on one page do not qualify for critical');
check(severityCases[4].severity < 5, 'unproven independence of two agreement pages cannot qualify for critical');
const interiorSeverity = [{
  type: 'CT01', severity: 5, findingClass: 'CONTRADICTION',
  anchor: { where: [2, 5], quote: ['Example Holdings says payment was made', 'Example Holdings says payment was not made'] }
}];
E.voCalibrateFindingSeverity(interiorSeverity, [
  'AGREEMENT. Page 1 of 3', 'Example Holdings says payment was made. Page 2 of 3', 'End. Page 3 of 3',
  'AFFIDAVIT. Page 1 of 3', 'Example Holdings says payment was not made. Page 2 of 3', 'End. Page 3 of 3'
]);
check(interiorSeverity[0].severity === 5, 'statements on interior pages of separately identified instruments remain eligible for critical');
const headedNarrative = [{
  type: 'CT01', severity: 5, findingClass: 'CONTRADICTION',
  anchor: { where: [1, 2], quote: ['Example Holdings says payment was made', 'Example Holdings says payment was not made'] }
}];
E.voCalibrateFindingSeverity(headedNarrative, [
  'CASE OVERVIEW. ADVISORY LETTER. Example Holdings says payment was made.',
  'CASE OVERVIEW. ADVISORY LETTER. Example Holdings says payment was not made.'
]);
check(headedNarrative[0].severity <= 3, 'narrative-only pages remain capped when a heading precedes the advisory marker');
const narrativeSeverity = await scan([
  ['This article explains that there were no sales.'],
  ['In our view, the deal happened.']
]);
check(narrativeSeverity.findings.some(f => f.type === 'CT01') &&
  narrativeSeverity.findings.filter(f => f.type === 'CT01').every(f => f.severity <= 3), 'argumentative prose is capped in a full scan');
const densePage = Array.from({ length: 300 }, (_, i) =>
  'word' + String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + i % 26)).join(' ');
const coverage = await scan([[densePage], [densePage], ['apple table garden desk lamp'], [densePage], [densePage]]);
const pageCoverage = coverage.findings.filter(f => f.type === 'CT54' && /\bPage 3\b/i.test(f.location));
check(pageCoverage.length === 1 && /machine-readable/i.test(pageCoverage[0].evidence) && /29 chars/i.test(pageCoverage[0].evidence), 'one coverage finding combines both observations for the same page');
const rangeCoverage = await scan([[densePage], [densePage], ['apple table garden desk lamp'], ['chair glass river paper pen'], [densePage]]);
const rangeRows = rangeCoverage.findings.filter(f => f.type === 'CT54' && (f.anchor.where || []).some(p => Number(p) === 3 || Number(p) === 4));
check(rangeRows.length === 1 && [3, 4].every(p => rangeRows[0].anchor.where.map(Number).includes(p)), 'overlapping coverage ranges are combined without duplicating either page');
const R = require('../forensic-report.js');
const exclusionReportBytes = await R.build({
  documents: [{ name: 'synthetic.pdf', pageCount: 4, sha512: 'ab'.repeat(64), sealId: 'VO-1234567890' }],
  findings: { clean: true, findings: [], totalFindings: 0 },
  extractionNotes: result.extractionNotes, generatedAt: '2026-11-25T00:00:00.000Z'
});
const exclusionReportDoc = await PDFDocument.load(exclusionReportBytes);
const exclusionReportText = [];
for (let p = 0; p < exclusionReportDoc.getPageCount(); p++) exclusionReportText.push((await E.extractPageText(exclusionReportBytes, p, exclusionReportDoc)).join(' '));
check(/set aside before contradiction scanning/i.test(exclusionReportText.join(' ')) &&
  !/Every page of this bundle was read\./.test(exclusionReportText.join(' ')),
  'the technical report discloses excluded third-party analysis instead of claiming every page was read');
const gps = { lat: '-29.123456', lng: '30.234567', accuracy: 20 };
const narrativeBytes = await R.buildHumanReport({
  documents: [{ name: 'synthetic.pdf', pageCount: 1, sha512: 'ab'.repeat(64), sealId: 'VO-1234567890' }],
  findings: { clean: true, findings: [], totalFindings: 0 }, gps,
  generatedAt: '2026-11-25T00:00:00.000Z', humanSections: {}, humanProvenance: {}
});
const narrativeDoc = await PDFDocument.load(narrativeBytes);
const narrativeText = [];
for (let p = 0; p < narrativeDoc.getPageCount(); p++) narrativeText.push((await E.extractPageText(narrativeBytes, p, narrativeDoc)).join(' '));
check(!/-29\.123456|30\.234567/.test(narrativeText.join(' ')), 'court-ready narrative excludes GPS coordinates');
check(/South Africa \(sealing location\)/.test(narrativeText.join(' ')), 'narrative retains location-derived jurisdiction');
const html = readFileSync('seal-document.html', 'utf8');
const metaStart = html.indexOf('function collectSealMetadata()');
const metaEnd = html.indexOf('// ==================== QR PAYLOAD PRIVACY BOUNDARY', metaStart);
const collectMetadata = new Function('document', 'gpsCoords', 'deviceInfo', 'sealType',
  html.slice(metaStart, metaEnd) + '\nreturn collectSealMetadata;')({ getElementById: () => null }, gps, null, 'personal');
check(collectMetadata().gps === '-29.123456,30.234567', 'seal metadata retains GPS coordinates');

console.log('detection-credibility FAIL=' + failures);
if (failures) process.exitCode = 1;
