// Regression controls for the 368-page scan reviewed on 14 November 2026.
// Sealed artifacts remain immutable; these synthetic passages pin the engine repairs.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'forensic-engine-page.js'));
const R = require(path.join(__dirname, '..', 'forensic-report.js'));
const t = require('./_assert');
const D = E.DETECTORS;

// One event in one matter; an unrelated agreement's expiry is not counter-evidence.
const datePages = ['The franchise for the Alpha service station expires by the effluxion of time on 31 July 2016, as the covering letter records.'];
for (let i = 0; i < 23; i++) datePages.push('Unrelated filler page ' + i + '.');
datePages.push('It is common cause that the Beta franchise agreement terminated by the effluxion of time on 28 February 2018, as recorded in this affidavit.');
datePages.push('Moreover, the Beta franchise agreement terminated by the effluxion of time on 28 February 2019, which is the other stated date.');
const dates = D.D03B_DETECT_EVENT_DATE_CONFLICT(datePages);
t.ok(dates.length === 1 && /Page 25/.test(dates[0].location) && /Page 26/.test(dates[0].location) && !/Page 1/.test(dates[0].location),
  'cross-matter expiry dates stay apart while the genuine same-event 2018/2019 conflict remains');

// Authority to litigate and capacity to depose are not ownable assets.
t.ok(D.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT([
  'The respondent disputes my authority to act on behalf of the applicant in this application.',
  'I apply in my personal capacity and the authority of another deponent is disputed.'
]).length === 0, 'authority and capacity disputes are not ownership contradictions');
t.ok(D.D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT([
  'This is my camera, valued at R7,000.',
  'The Greensky Ornamentals camera appears on the company invoice.'
]).length === 1, 'genuine camera ownership remains detectable');

// Compensation language for structural work is not recognition of goodwill.
t.ok(D.D39_DETECT_ASSET_VALUE_DENIAL([
  'The franchisee shall not be entitled to any compensation or repayment in respect of any structural additions, alterations or improvements to the premises. The franchisor shall be entitled to purchase the property itself at fair market value and the products at cost.'
]).length === 0, 'structural-improvement compensation and a purchase right are not a goodwill contradiction');
t.ok(D.D39_DETECT_ASSET_VALUE_DENIAL([
  'The goodwill shall inure to the benefit of the franchisee as a quantifiable asset.',
  'The respondent submitted that goodwill has no compensable value.'
]).length === 1, 'express goodwill recognition followed by denial remains detectable');
t.ok(D.D39_DETECT_ASSET_VALUE_DENIAL([
  'On termination of the franchise agreement goodwill terminates and can never be argued to remain on the locality.',
  'The operator sought to sell the remaining six months of tenure in the franchise agreement for R16.5 million.'
]).length === 0, 'selling the remaining term before expiry is compatible with goodwill ending at expiry');
t.ok(D.D39_DETECT_ASSET_VALUE_DENIAL([
  'On termination of the franchise agreement goodwill terminates and can never be argued to remain on the locality.',
  'Before the agreement expired, the operator sold the franchise business for R16.5 million.'
]).length === 0, 'an ordinary pre-expiry business sale is compatible with goodwill ending at expiry');
t.ok(D.D39_DETECT_ASSET_VALUE_DENIAL([
  'On termination of the franchise agreement goodwill terminates and can never be argued to remain on the locality.',
  'After the agreement expired, the operator sold the goodwill of the terminated franchise for over 2 million.'
]).length === 0, 'the word over is not a Rand currency marker');
t.ok(D.D39_DETECT_ASSET_VALUE_DENIAL([
  'On termination of the franchise agreement goodwill terminates and can never be argued to remain on the locality.',
  'After the agreement expired, the operator sold the goodwill of the terminated franchise for R16.5 million.'
]).length === 1, 'pricing goodwill after its claimed extinction remains detectable');

// Standard-form contracts and shared vocabulary are not coordinated drafting.
const clause = '4.8 The FRANCHISEE acknowledges that neither it nor any employees have any prior knowledge of the Business System or any aspect of the Know-how or the Trade Secrets. 4.9 The FRANCHISEE shall not divulge or permit to be divulged to any person any aspect of the Business System except as required for the operation of the Franchised Business under this Agreement at the Premises.';
t.ok(D.D09A_DETECT_COORDINATION_NEAR_DUP([
  'First Agreement. ' + clause + ' Signed for First Franchisor by A. Smith.',
  'Second Agreement. ' + clause + ' Signed for Second Franchisor by B. Jones.'
]).length === 0, 'the same standard-form franchise clauses under different parties are not coordination evidence');
const words = 'the particular equipment delivery schedule inventory price customer supplier premises payment invoice receipt order transport warranty inspection insurance storage installation maintenance commission royalty turnover declaration records statements accounts premises vehicles stock staff training marketing advertising sales service repairs parts products goods'.split(' ');
const sequenceA = words.join(' ') + ' Further distinct substantive wording makes this a long page of ordinary record text for comparison.';
const sequenceB = words.slice().reverse().join(' ') + ' A different closing and reordered vocabulary appear on this lengthy comparison page.';
t.ok(D.D09A_DETECT_COORDINATION_NEAR_DUP([sequenceA, sequenceB]).length === 0,
  'shared or reordered vocabulary without near-identical word sequences cannot support coordination');
const letter = 'We refer to the above matter and to your recent correspondence. Our client instructs that the application was duly processed by the office and that any suggestion to the contrary is denied. We are instructed to demand that you withdraw the allegations within twenty one days failing which our client will approach the court for relief including an order declaring you a vexatious litigant and seeking punitive costs on the attorney and client scale together with interest and such further relief as the court deems meet and appropriate in the circumstances of this disputed matter.';
t.ok(D.D09A_DETECT_COORDINATION_NEAR_DUP([
  'First Attorneys. ' + letter + ' Yours faithfully, A. Smith.',
  'Second Attorneys. ' + letter + ' Yours sincerely, B. Jones.'
]).length === 1, 'near-identical substantive non-boilerplate letters remain detectable');

// A conditional standard-form acknowledgement is not its own denial.
t.ok(D.D10B_DETECT_FACTIVE_COMMITMENT_DENIAL([clause, clause]).length === 0,
  'conditional franchise acknowledgements and confidentiality clauses do not manufacture factive denials');
t.ok(D.D10B_DETECT_FACTIVE_COMMITMENT_DENIAL([
  'The respondent confirms that it received the signed agreement and retained the original deposit.',
  'The respondent denies that it received the signed agreement and retained the original deposit.',
  'The respondent again denies that it received the signed agreement and retained the original deposit.'
]).length === 1, 'a direct denial remains detectable and repeated copies collapse to one finding');

// Annexure I and Annexure 1 are the same reference; substantive next-page form content resolves Annexure A.
t.ok(D.D21_DETECT_MISSING_APPENDIX([
  'The Advertising Fund Contribution is stipulated in Annexure I.',
  'The Franchise Fee is stipulated in the Base Schedule, being Annexure 1 hereto.',
  'BASE SCHEDULE. Applicable Advertising Fund Contribution Rates 0.5%.'
]).length === 0, 'Base Schedule / Annexure 1 resolves a reference to Annexure I');
t.ok(D.D21_DETECT_MISSING_APPENDIX([
  'Number of initial directors of the company as listed in Annexure A: 3.',
  'INITIAL DIRECTOR DETAILS. Full Name: Pat Ahmed; Full Name: Riaz Cachalia; Full Name: Mubeen Kolia.'
]).length === 0, 'substantive initial-director content on the next page resolves Annexure A');
t.ok(D.D21_DETECT_MISSING_APPENDIX([
  'The signed valuation is incomplete; see Annexure Z for the executed copy.',
  'This unrelated page contains ordinary correspondence and no annexure content.'
]).length === 1, 'a genuinely unresolved annexure remains detectable');

// A complaint and an institution's summary of it are not independent conduct evidence.
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'This complaint concerns fraud, perjury, coercion and the systematic deprivation of goodwill by the respondent.',
  'Institutional summary: the complainant reports coercion and deprivation of goodwill by the respondent.'
]).length === 0, 'naming coercion in a complaint or summary is not direct coercive conduct');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT([
  'Institutional summary: the complainant reports he was coerced into signing the agreement.'
]).length === 0, 'an institutional summary repeating direct coercion wording is still not independent corroboration');
t.ok(D.D41_DETECT_COERCIVE_CONDUCT(['This is my final offer: take it or leave it.']).length === 1,
  'a direct ultimatum remains detectable');

// Unreadable pages are examination limits, never forgery/perjury leads.
const nearEmpty = D.D17_DETECT_FORMAT_ANOMALY(['x'.repeat(1200), '', '', '', 'y'.repeat(1200)]);
t.ok(nearEmpty.length === 1 && nearEmpty[0].type === 'CT54' && nearEmpty[0].severity === 2,
  'near-empty page runs print only as examination limits');
const noLaw = R._statutesForFinding(nearEmpty[0], { home: 'ZA', foreign: [], isCrossBorder: false });
t.ok(Array.isArray(noLaw) && noLaw.length === 0, 'an unreadable-page limit carries no candidate criminal law');

// OCR debris and implausible documentary years never enter a chronology.
t.ok(E.voDateSortKey('2/2/1313') === null && E.voDateSortKey('25 October 2013') === 20131025,
  'implausible documentary years are quarantined while a real historical date remains sortable');
const timeline = E.voBuildTimeline([], [
  'D 0 0 0 D 8 8 8 ¢ ¦ { } = corrupted OCR debris 2/2/1313',
  'The company was incorporated on 25 October 2013.'
]);
t.ok(timeline.events.length === 1 && timeline.events[0].page === 2 && !/1313/.test(JSON.stringify(timeline)),
  'the chronology drops OCR garbage and the 1313 date but keeps the genuine 2013 event');

t.done('scan11-findings-repair');
