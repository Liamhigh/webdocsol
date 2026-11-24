// ============== FORENSIC CONTRADICTION ENGINE v5.7.3-web ================
// 61 Contradiction Types | 63 Detectors | 17 Serial Patterns
// ========================================================================


// ========================================================================
// VERUM OMNIS FORENSIC CONTRADICTION ENGINE v5.7.3-web
// 61 Contradiction Types | 63 Detectors | 17 Serial Patterns
// + signed rule packages, applied additively (see SIGNED RULE PACKAGES below)
// ========================================================================
// This engine analyzes documents for internal contradictions, fraudulent
// patterns, and forensic anomalies. It is designed to detect perjury,
// forgery, document tampering, and systemic fraud across any document.
//
// Lineage: port of the sealed Python engine v5.3.1c (Seal
// VO-CE-v531c-DIGSIM-20260713, Constitution v6.0 Final) — previously
// versioned "v2.0" here, which detached the web engine from its sealed
// lineage. v5.3.2-web adds the 1 Aug 2026 external-review fixes (CT14/CT38/
// CT05/CT39/CT43, template suppression, no-anchor-no-weight), subject
// alignment (v5.2.9 lineage) and per-detector confidence calibration.
// Every scan result stamps this version so a sealed report can always be
// traced to the exact engine that produced it. v5.3.3-web enforces the
// anchor rule in full (an unanchorable content finding is moved out of the
// findings into the disclosed engine notes — the Constitution's "if a
// sentence cannot cite anchors, it cannot exist", not merely demoted) and
// threads this version into the findings JSON and report stamps, which
// previously carried a hard-coded "v2.0".
// ========================================================================
var VO_ENGINE_VERSION = '5.7.3-web';

// Content mass: how much DISTINCT content a page carries, for page-emptiness
// statistics only (never for the detectors, which see the full text). Raw
// character counts are defeated by the engine's own seal footers: a bundle
// sealed N times carries N identical footer layers per page, so an image-only
// page in an 8x-sealed Greensky bundle measured 1,000+ chars, looked like a
// text page, silently skipped OCR, and lost the "unread pages" disclosure.
// Here: known Verum Omnis boilerplate, emails, phones, hashes and digits are
// stripped, then each distinct word counts ONCE — identical footer layers
// collapse to nothing while real prose keeps its mass.
// A page carrying less distinct-content mass than this is "near-empty" —
// CT26 reports such pages as most likely image-only and not captured by OCR.
// The OCR candidate threshold (VO_OCR_EMPTY_CHARS, page-native in
// seal-document.html) must stay >= this value, or the engine names a gap it
// never tried to close. Exported and drift-locked by tests/ocr-rescue.
var VO_NEAR_EMPTY_CHARS = 40;
var VO_SEAL_BOILERPLATE_RE = /VERUM\s+OMNIS\s+SEALED\s+ORIGINAL|PRIVATE\s+SEAL(?:\s*[-–—]+\s*FREE\s+TIER)?|VERIFY\s+SEAL|scan\s+the\s+code\s+or\s+verify\s+at|verumglobal\.foundation(?:\/verify\.html)?|OpenTimestamps|Patent\s+Pending|Africa\/Johannesburg|AI\s+FORENSICS\s+FOR\s+TRUTH|Founder,?\s+Verum\s+Omnis|\bVerum\s+Omnis\b|\bSeal:\s*|\bChain:\s*\d+\s*prev\b|\bUTC\b|\bFREE\s+TIER\b/gi;
function voContentMass(t) {
  var s = String(t || '').toLowerCase()
    .replace(VO_SEAL_BOILERPLATE_RE, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/\+?\d[\d\s()\/-]{6,}\d/g, ' ')
    .replace(/[0-9a-f]{10,}/g, ' ')
    .replace(/\d/g, ' ');
  var words = s.split(/[^a-z]+/);
  var seen = {}, mass = 0;
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (w.length > 2 && !seen[w]) { seen[w] = 1; mass += w.length + 1; }
  }
  return mass;
}

// ===================== 43 CONTRADICTION TYPES =====================
// Organized by forensic category. Each type has a detector function,
// severity weight, and evidentiary classification.

var CONTRADICTION_TYPES = {
  // === CATEGORY 1: STATEMENTAL CONTRADICTIONS (1-8) ===
  // Direct conflicts between statements, claims, or assertions

  CT01_DIRECT_STATEMENT: {
    id: 'CT01', name: 'Direct Statement Contradiction',
    desc: 'Two statements in the document directly oppose each other',
    severity: 5, category: 'STATEMENTAL', scope: ['self', 'pair'],
    example: '"Payment was made on 15 March" vs "No payment was ever made"'
  },
  CT02_NUMERICAL_DISCREPANCY: {
    id: 'CT02', name: 'Numerical Discrepancy',
    desc: 'Numbers, amounts, or quantities do not match across the document',
    severity: 4, category: 'STATEMENTAL', scope: ['self', 'pair'],
    example: 'Invoice total R50,000 but supporting docs show R45,000'
  },
  CT03_DATE_INCONSISTENCY: {
    id: 'CT03', name: 'Date Inconsistency',
    desc: 'Dates, timestamps, or chronological references conflict',
    severity: 5, category: 'STATEMENTAL', scope: ['self', 'pair'],
    example: 'Contract dated 2024-01-15 references an event from 2024-03-20'
  },
  CT04_TEMPORAL_SEQUENCE_BREAK: {
    id: 'CT04', name: 'Temporal Sequence Break',
    desc: 'Events are described in an impossible chronological order',
    severity: 4, category: 'STATEMENTAL', scope: ['self'],
    example: 'Document claims discovery happened before the incident occurred'
  },
  CT05_CAUSAL_IMPOSSIBILITY: {
    id: 'CT05', name: 'Causal Impossibility',
    desc: 'A claimed cause could not have produced the stated effect',
    severity: 3, category: 'STATEMENTAL', scope: ['self'],
    example: 'Email claims response was sent before the original was received'
  },
  CT06_LOGICAL_IMPOSSIBILITY: {
    id: 'CT06', name: 'Logical Impossibility',
    desc: 'The document asserts something that is logically impossible',
    severity: 5, category: 'STATEMENTAL', scope: ['self'],
    example: 'Entity claims to be both registered and deregistered simultaneously'
  },
  CT07_SCOPE_CREEP: {
    id: 'CT07', name: 'Scope Creep Indicator',
    desc: 'Document scope expands beyond original stated boundaries',
    severity: 2, category: 'STATEMENTAL', scope: ['pair'],
    example: 'Quote for kitchen renovation includes pool construction'
  },
  CT08_TERM_DEFINITION_CONFLICT: {
    id: 'CT08', name: 'Term Definition Contradiction',
    desc: 'Key terms are defined differently in different sections',
    severity: 3, category: 'STATEMENTAL', scope: ['self'],
    example: '"Net profit" defined one way in section 2, another in section 8'
  },

  // === CATEGORY 2: IDENTITY CONTRADICTIONS (9-14) ===
  // Conflicts involving people, entities, roles, or identities

  CT09_IDENTITY_CONTRADICTION: {
    id: 'CT09', name: 'Identity Contradiction',
    desc: 'The same person/entity is described with conflicting attributes',
    severity: 5, category: 'IDENTITY', scope: ['self', 'pair'],
    example: 'Director listed as John Smith (ID 760101) and John Smit (ID 850202)'
  },
  CT10_ROLE_CONTRADICTION: {
    id: 'CT10', name: 'Role Contradiction',
    desc: 'Person acts in a capacity they do not hold',
    severity: 4, category: 'IDENTITY', scope: ['self', 'pair'],
    example: 'Person signs as "Managing Director" but company records show different MD'
  },
  CT11_AUTHORITY_CONTRADICTION: {
    id: 'CT11', name: 'Authority Contradiction',
    desc: 'Action taken exceeds stated authority or delegation',
    severity: 5, category: 'IDENTITY', scope: ['self', 'pair'],
    example: 'Junior employee approves R5 million expenditure without authorization'
  },
  CT12_NAME_SPELLING_VARIATION: {
    id: 'CT12', name: 'Name Spelling Variation',
    desc: 'Same entity/person spelled differently across document',
    severity: 2, category: 'IDENTITY', scope: ['self', 'pair'],
    example: '"Johannes van der Merwe" vs "Johannes van der Merve"'
  },
  CT13_TITLE_INCONSISTENCY: {
    id: 'CT13', name: 'Title Inconsistency',
    desc: 'Professional titles, ranks, or designations do not match',
    severity: 2, category: 'IDENTITY', scope: ['self', 'pair'],
    example: 'Signatory titled "Dr" in one section, "Mr" in another'
  },
  CT14_ENTITY_STATUS_CONFLICT: {
    id: 'CT14', name: 'Entity Status Contradiction',
    desc: 'Organization claimed status does not match reality',
    severity: 5, category: 'IDENTITY', scope: ['self', 'pair'],
    example: 'Company claims "registered and active" but CIPC shows deregistered'
  },

  // === CATEGORY 3: FINANCIAL CONTRADICTIONS (15-22) ===
  // Monetary, accounting, and financial inconsistencies

  CT15_AMOUNT_DISCREPANCY: {
    id: 'CT15', name: 'Amount Discrepancy',
    desc: 'Financial amounts do not reconcile across the document',
    severity: 5, category: 'FINANCIAL', scope: ['self', 'pair'],
    example: 'Subtotal R100,000 + VAT R15,000 = Total R120,000 (should be R115,000)'
  },
  CT16_CURRENCY_MISMATCH: {
    id: 'CT16', name: 'Currency Mismatch',
    desc: 'Currency conversions or references are inconsistent',
    severity: 4, category: 'FINANCIAL', scope: ['self', 'pair'],
    example: 'Contract in USD but invoice in ZAR without conversion rate'
  },
  CT17_ACCOUNT_NUMBER_INVALID: {
    id: 'CT17', name: 'Account Number Invalidity',
    desc: 'Bank account numbers fail validation or are inconsistent',
    severity: 5, category: 'FINANCIAL', scope: ['self'],
    example: 'Bank account number changes between pages of same document'
  },
  CT18_BANK_DETAIL_MISMATCH: {
    id: 'CT18', name: 'Bank Detail Mismatch',
    desc: 'Banking details conflict with known or stated information',
    severity: 5, category: 'FINANCIAL', scope: ['pair'],
    example: 'Payment instruction to Bank A but company normally uses Bank B'
  },
  CT19_VAT_NUMBER_INVALID: {
    id: 'CT19', name: 'VAT Number Invalid',
    desc: 'VAT number is not in the valid South African form or is inconsistent',
    severity: 4, category: 'FINANCIAL', scope: ['self'],
    example: 'a stated VAT number is not a 10-digit number beginning with 4'
  },
  CT20_REGISTRATION_NUMBER_FAKE: {
    id: 'CT20', name: 'Registration Number Fake',
    desc: 'Company or entity registration number is invalid or fabricated',
    severity: 5, category: 'FINANCIAL', scope: ['self'],
    example: 'CIPC registration number does not match entity name'
  },
  CT21_QUOTATION_MISMATCH: {
    id: 'CT21', name: 'Quotation Mismatch',
    desc: 'Quoted terms, prices, or conditions differ from final document',
    severity: 3, category: 'FINANCIAL', scope: ['pair'],
    example: 'Quote states 30-day payment but invoice demands immediate payment'
  },
  CT22_FINANCIAL_CALCULATION_ERROR: {
    id: 'CT22', name: 'Financial Calculation Error',
    desc: 'Mathematical calculations in financial sections are incorrect',
    severity: 4, category: 'FINANCIAL', scope: ['self'],
    example: 'VAT calculated at 20% when standard rate is 15%'
  },

  // === CATEGORY 4: DOCUMENT INTEGRITY CONTRADICTIONS (23-30) ===
  // Physical and digital document manipulation indicators

  CT23_SIGNATURE_MISMATCH: {
    id: 'CT23', name: 'Signature Mismatch',
    desc: 'Signature does not match known specimen or appears forged',
    severity: 5, category: 'INTEGRITY', scope: ['self'],
    example: 'Signature on page 1 visibly different from signature on page 5'
  },
  CT24_METADATA_CONTRADICTION: {
    id: 'CT24', name: 'Metadata Contradiction',
    desc: 'PDF metadata conflicts with document content or claims',
    severity: 4, category: 'INTEGRITY', scope: ['self'],
    example: 'Document claims created 2024-01-01 but metadata shows 2024-06-15'
  },
  CT25_FONT_INCONSISTENCY: {
    id: 'CT25', name: 'Font Inconsistency',
    desc: 'Different fonts used where consistency is expected',
    severity: 3, category: 'INTEGRITY', scope: ['self'],
    example: 'Body text uses Arial on some pages, Times New Roman on others'
  },
  CT26_FORMAT_ANOMALY: {
    id: 'CT26', name: 'Format Anomaly',
    desc: 'Document formatting shows signs of editing or manipulation',
    severity: 3, category: 'INTEGRITY', scope: ['self'],
    example: 'Margins, headers, or page numbering change mid-document'
  },
  CT27_LAYOUT_MANIPULATION: {
    id: 'CT27', name: 'Layout Manipulation',
    desc: 'Page layout shows content was added, removed, or rearranged',
    severity: 4, category: 'INTEGRITY', scope: ['self'],
    example: 'Page 3 has different header/footer suggesting inserted page'
  },
  CT28_IMAGE_INTEGRITY_FAILURE: {
    id: 'CT28', name: 'Image Integrity Failure',
    desc: 'Embedded images show signs of manipulation or replacement',
    severity: 4, category: 'INTEGRITY', scope: ['self'],
    example: 'Logo image has different compression than surrounding content'
  },
  CT29_TIMESTAMP_MANIPULATION: {
    id: 'CT29', name: 'Timestamp Manipulation',
    desc: 'Document timestamps are inconsistent or impossible',
    severity: 5, category: 'INTEGRITY', scope: ['self'],
    example: 'Document modification time precedes creation time'
  },
  CT30_VERSION_CONTROL_ANOMALY: {
    id: 'CT30', name: 'Version Control Anomaly',
    desc: 'Document version tracking is inconsistent or absent',
    severity: 2, category: 'INTEGRITY', scope: ['self', 'pair'],
    example: 'Page footer says "Version 3" but header says "Version 1"'
  },

  // === CATEGORY 5: CROSS-REFERENCE CONTRADICTIONS (31-35) ===
  // Failures in internal and external document references

  CT31_CROSS_REFERENCE_FAILURE: {
    id: 'CT31', name: 'Cross-Reference Failure',
    desc: 'Referenced sections, clauses, or documents do not exist or conflict',
    severity: 3, category: 'CROSS_REF', scope: ['self', 'pair'],
    example: '"See Appendix A" but no Appendix A exists in document'
  },
  CT32_SOURCE_ATTRIBUTION_FAILURE: {
    id: 'CT32', name: 'Source Attribution Failure',
    desc: 'Cited sources cannot be verified or do not support claims',
    severity: 4, category: 'CROSS_REF', scope: ['self', 'pair'],
    example: 'Cites "Case 123/2024" but court records show no such case'
  },
  CT33_LEGAL_REFERENCE_INVALID: {
    id: 'CT33', name: 'Legal Reference Invalid',
    desc: 'Referenced legislation, cases, or regulations are incorrect',
    severity: 4, category: 'CROSS_REF', scope: ['self'],
    example: 'References "Section 42 of the Companies Act" but Act has no Section 42'
  },
  CT34_PRECEDENT_VIOLATION: {
    id: 'CT34', name: 'Precedent Violation',
    desc: 'Document contradicts established legal or procedural precedent',
    severity: 3, category: 'CROSS_REF', scope: ['conditional'],
    example: 'Court order format deviates from standard High Court requirements'
  },
  CT35_PROCEDURE_BREACH: {
    id: 'CT35', name: 'Procedure Breach',
    desc: 'Required procedural steps were skipped or incorrectly followed',
    severity: 4, category: 'CROSS_REF', scope: ['conditional'],
    example: 'Contract signed without required witness signatures'
  },

  // === CATEGORY 6: CONTACT & LOCATION CONTRADICTIONS (36-38) ===
  // Physical address, contact details, and jurisdictional issues

  CT36_ADDRESS_CONTRADICTION: {
    id: 'CT36', name: 'Address Contradiction',
    desc: 'Physical addresses are inconsistent or non-existent',
    severity: 3, category: 'CONTACT', scope: ['self', 'pair'],
    example: 'Registered address on page 1 differs from address on page 10'
  },
  CT37_CONTACT_DETAIL_MISMATCH: {
    id: 'CT37', name: 'Contact Detail Mismatch',
    desc: 'Phone numbers, emails, or other contacts are inconsistent',
    severity: 2, category: 'CONTACT', scope: ['self', 'pair'],
    example: 'Email domain changes from @company.co.za to @company-gmail.com'
  },
  CT38_JURISDICTIONAL_IMPOSSIBILITY: {
    id: 'CT38', name: 'Jurisdictional Impossibility',
    desc: 'Legal jurisdiction claims are impossible or contradictory',
    severity: 4, category: 'CONTACT', scope: ['conditional'],
    example: 'South African court order claims jurisdiction over Dubai entity'
  },

  // === CATEGORY 7: EVIDENCE & WITNESS CONTRADICTIONS (39-41) ===
  // Issues with evidence handling and witness statements

  CT39_CHAIN_OF_CUSTODY_BREAK: {
    id: 'CT39', name: 'Chain of Custody Break',
    desc: 'Evidence handling chain has gaps or inconsistencies',
    severity: 5, category: 'EVIDENCE', scope: ['pair'],
    example: 'Evidence receipt shows transfer to Person A but next record shows Person B'
  },
  CT40_WITNESS_STATEMENT_CONFLICT: {
    id: 'CT40', name: 'Witness Statement Conflict',
    desc: 'Witness accounts contradict each other or physical evidence',
    severity: 4, category: 'EVIDENCE', scope: ['pair'],
    example: 'Two witness statements describe mutually exclusive events'
  },
  CT41_EVIDENCE_TAMPERING_INDICATOR: {
    id: 'CT41', name: 'Evidence Tampering Indicator',
    desc: 'Evidence shows signs of alteration, substitution, or manipulation',
    severity: 5, category: 'EVIDENCE', scope: ['self'],
    example: 'Page numbers are non-sequential suggesting page removal'
  },

  // === CATEGORY 8: DIGITAL FORENSIC CONTRADICTIONS (42-43) ===
  // Digital artifacts and technical inconsistencies

  CT42_DIGITAL_FOOTPRINT_MISMATCH: {
    id: 'CT42', name: 'Digital Footprint Mismatch',
    desc: 'Digital traces (hashes, creation tools) conflict with claims',
    severity: 4, category: 'DIGITAL', scope: ['pair'],
    example: 'Document claims scanned original but metadata shows created in Word'
  },
  CT43_DOCUMENT_INTERNAL_CONFLICT: {
    id: 'CT43', name: 'Document Internal Conflict',
    desc: 'Catch-all: any other internal contradiction not covered above',
    severity: 3, category: 'DIGITAL', scope: ['self'],
    example: 'Multiple anomalies detected that suggest systematic document fraud'
  },

  // === CATEGORY 9: FRANCHISE / LEASE CONTRADICTIONS (44-45) ===
  // Conditional-right and asset-value contradictions surfaced by the AllFuels
  // case, where the lease agreement had to be read against the ownership record.

  CT44_CONDITIONAL_CLAUSE_MISINVOKED: {
    id: 'CT44', name: 'Conditional Clause Misinvoked (Lessee/Owner Trap)',
    desc: 'A termination or expiry rests on a clause conditioned on the party being the lessee (not the owner) under a head lease, but the record shows that party had become the owner of the premises — the triggering event never occurred; whether the termination is void is for the court.',
    severity: 5, category: 'FRANCHISE_LEASE', scope: ['conditional'],
    example: 'Franchise deemed "expired by effluxion" under cl. 3.2.3 (lessee-only), but the franchisor had purchased the site and was the registered owner.'
  },
  CT45_ASSET_VALUE_DENIAL: {
    id: 'CT45', name: 'Asset Value Recognised Then Denied (Goodwill)',
    desc: 'Goodwill or value of the business is recognised or quantified in one document but denied or said to have no compensable value in another — a forfeiture or clawback is itself an admission that the asset exists.',
    severity: 5, category: 'FRANCHISE_LEASE', scope: ['self', 'pair'],
    example: 'The clawback table quantifies the Value of the Business, yet a later submission argues "goodwill has no compensable value".'
  },

  // === CATEGORY 10: ROLE / CAPACITY CONTRADICTION (46) ===
  // An actor asserts one capacity but the record shows conduct that capacity
  // cannot hold — surfaced by the Ritz/Moolla matter, where a corporate capacity
  // was claimed while money moved through a personal account.
  CT46_ROLE_CAPACITY_CONFLICT: {
    id: 'CT46', name: 'Role / Capacity Contradiction',
    desc: 'An actor asserts they act in a corporate or restricted capacity (e.g. on behalf of a company, or a role barred from certain dealings) but the same record shows conduct inconsistent with that capacity — money routed to a personal account, or a briefing accepted that the stated capacity prohibits.',
    severity: 4, category: 'IDENTITY', scope: ['self', 'pair'],
    example: 'A party states they act "on behalf of X (Pty) Ltd" yet directs payment to their personal trust account; or states they "may not accept briefs from the public" yet accepted one.'
  },

  // === CATEGORY 11: CONDUCT INDICATORS (47) ===
  // Coercion is conduct, not a contradiction — the contradiction detectors
  // are silent on it. CT47 surfaces the passages where threat, ultimatum or
  // pressure language appears, as indicators for human review; it never
  // determines that coercion occurred (a legal conclusion, for the court).
  CT47_COERCIVE_CONDUCT: {
    id: 'CT47', name: 'Coercive Conduct Indicators',
    desc: 'Passages carrying threat, ultimatum or pressure language (consequences for refusal, supply or access cut off, lockout, "under protest/under duress" accounts) — indicators for human review, not a determination that coercion occurred.',
    severity: 3, category: 'BEHAVIOUR', scope: ['self', 'pair'],
    example: '"Should you fail to sign the addendum, we will have no option but to stop all fuel deliveries."'
  },

  // Gaslighting is conduct, not a contradiction: a party denies a documented
  // reality or attacks the other's recollection of it. CT48 surfaces the
  // passages as indicators for human review; it never determines that
  // gaslighting occurred (a psychological conclusion, not the engine's).
  CT48_REALITY_DENIAL: {
    id: 'CT48', name: 'Gaslighting / Reality-Denial Indicators',
    desc: 'Passages denying a documented event or record, or attacking the other party\'s recollection ("that never happened", "we have no record of", "your recollection is wrong", "fabrication") — indicators for human review, not a determination of gaslighting.',
    severity: 3, category: 'BEHAVIOUR', scope: ['pair'],
    example: '"No such agreement was ever concluded; your recollection of events is simply wrong."'
  },

  // DARVO — Deny, Attack, Reverse Victim and Offender: a party accused of
  // wrongdoing responds by attacking the complainant and casting itself as
  // the victim. CT49 surfaces the passages as indicators for human review;
  // it never determines intent (for the court).
  CT49_BLAME_REVERSAL: {
    id: 'CT49', name: 'Blame-Reversal / DARVO Indicators',
    desc: 'Passages where a party, facing a claim, attacks the claimant or casts itself as the injured party ("we are the injured party", "if anyone has been defrauded", "your harassment of our staff", "vexatious", threats of defamation or counterclaim) — indicators for human review, not a determination of intent.',
    severity: 3, category: 'BEHAVIOUR', scope: ['pair'],
    example: '"Your client\'s harassment of our staff leaves us no option; if anyone has been defrauded here, it is us."'
  },

  // The signed-rule learning loop's behavioural entry point: a curated
  // behavioral_markers rule (keyword set) the package teaches the engine
  // between releases. CT50 is the generic label; a rule may name a more
  // specific behavioural type via `produces` (CT47/CT48/CT49).
  CT50_SIGNED_BEHAVIOURAL_MARKER: {
    id: 'CT50', name: 'Behavioural Pattern Indicator (Signed Rule)',
    desc: 'A behavioural keyword set from the signed rule package matched the record — an indicator for human review, not a determination.',
    severity: 3, category: 'BEHAVIOUR', scope: ['pair'],
    example: 'A curated marker {stonewalling: "we are unable to comment", "your query is noted", "in due course"} matches two or more of its keywords on one page.'
  },

  // === BATCH 5 (defamation-record patterns, case 2026-179949, Oct 2026) ===

  CT51_BILLING_AFTER_CLAIMED_END: {
    id: 'CT51', name: 'Billing After Claimed End',
    desc: 'A charge is raised for a period after the record says the relationship ended',
    severity: 4, category: 'STATEMENTAL', scope: ['pair'],
    example: 'Lease pleaded to have ended 31 July, yet an invoice charges rent for October'
  },
  CT52_UNEVIDENCED_AUTHORITY_CLAIM: {
    id: 'CT52', name: 'Unevidenced Authority Claim',
    desc: 'Authority to depose or litigate is claimed but no supporting instrument appears anywhere in the record',
    severity: 3, category: 'IDENTITY', scope: ['self'],
    example: '"I am duly authorised to depose" with no resolution cited or annexed anywhere in the filing'
  },
  CT53_BLANK_EXECUTION_BLOCK: {
    id: 'CT53', name: 'Blank Execution Block',
    desc: 'An instrument the record treats as operative carries unsigned signature blocks',
    severity: 3, category: 'INTEGRITY', scope: ['self'],
    example: 'Tripartite agreement with all three "SIGNED at ___" blocks blank while payment moved under it'
  },
  CT54_UNREADABLE_PAGE: {
    id: 'CT54', name: 'Unreadable Page',
    desc: 'Pages carry no machine-readable text and so went unchecked — a limit of the examination, not a defect found',
    severity: 2, category: 'INTEGRITY', scope: ['self'],
    example: 'Pages 340-360 are image-only scans inside an otherwise text-bearing bundle'
  },
  CT55_COORDINATED_DRAFTING_INDICATOR: {
    id: 'CT55', name: 'Coordinated Drafting Indicator',
    desc: 'Near-identical texts under different closing blocks — an indicator for human review, never a determination of collusion',
    severity: 3, category: 'EVIDENCE', scope: ['pair'],
    example: 'Two firms\u2019 letters two days apart are word-for-word identical bar the letterhead and signature'
  },
  // CT56 is RETAINED in the taxonomy (old sealed runs cite it) but no longer
  // dispatched: v6.1 §1 merges it into CT61 (horns-of-dilemma), implemented by
  // D63. CT56 and CT61 never both run.
  CT56_S12B_LICENCE_PREDICATE_CONFLICT: {
    id: 'CT56', name: 'Section 12B Predicate Conflict Indicator',
    desc: 'A party staffs the s 12B statutory arbitration track while asserting the counterparty’s licence is terminated/expired/inoperative — s 12B exists between licensed participants; an indicator for legal review, never a determination',
    severity: 3, category: 'EVIDENCE', scope: ['conditional'],
    example: 'Same letter nominates three arbitrators "strictly in compliance with section 12B" and asserts the retailer’s licence "has terminated and/or expired"'
  },
  CT57_FACTIVE_COMMITMENT_DENIAL: {
    id: 'CT57', name: 'Factive Commitment vs Denial Indicator',
    desc: 'A factive verb (confirmed/admitted/acknowledged/certified/declared) commits the author to the truth of a proposition which the record elsewhere denies — an indicator for legal review, never a determination',
    severity: 3, category: 'EVIDENCE', scope: ['self', 'pair'],
    example: 'p.3 "the Controller confirmed that the account held cleared funds" vs p.9 "the account never held sufficient funds"'
  },
  CT58_FRAME_POLARITY_CONFLICT: {
    id: 'CT58', name: 'Same-Statement Polarity Conflict',
    desc: 'Two statements share an identical frame of six or more content words and differ only in polarity (a negation particle or an antonym pole) — an indicator for legal review, never a determination',
    severity: 4, category: 'EVIDENCE', scope: ['self', 'pair'],
    example: '"the defendant is liable for the loss" vs "the defendant is not liable for the loss"'
  },
  // Batch 7a (engine instrument v6.1 §1): the conduct detectors. A pleading's
  // word against the record's own dated conduct (CT59), a benefit taken while
  // its burden is denied (CT60), and a statutory mechanism invoked across the
  // death of its own predicate (CT61).
  CT59_CONDUCT_VS_PLEADING: {
    id: 'CT59', name: 'Conduct vs Pleading Contradiction',
    desc: 'The record pleads that a performance never happened (no rental paid, no agreement existed, nothing owing) while the record’s own sealed conduct ledger — dated invoices, receipts, payments — records that performance sustained (six or more dated events, or a span of 24 months or more): the assertion and the conduct cannot both stand',
    severity: 4, category: 'STATEMENTAL', scope: ['pair'],
    example: 'p.4 "no rental was ever paid for the premises" vs the ledger: 14 dated rental invoices and payments, March 2023 to March 2026 (pp. 87-214)'
  },
  CT60_BENEFIT_BURDEN_ASYMMETRY: {
    id: 'CT60', name: 'Benefit Taken / Burden Denied Indicator',
    desc: 'A party accepts a benefit under an instrument (occupies the premises, retains the deposit, trades under the licence) while denying the burden of the same instrument (the rental, the agreement’s binding force) — approbate and reprobate, named as candidate law only: an indicator for legal review, never a determination',
    severity: 3, category: 'FRANCHISE_LEASE', scope: ['pair'],
    example: 'Occupies and trades from the premises under the lease (p. 12) while denying any obligation to pay rental under that lease (p. 40)'
  },
  CT61_HORNS_OF_DILEMMA: {
    id: 'CT61', name: 'Horns-of-Dilemma Indicator',
    desc: 'A statutory mechanism operates only while a relationship exists; the record invokes the mechanism while asserting the relationship is dead — if the relationship lives the assertion fails, if it is dead the mechanism has no subject: either horn is adverse to the party advancing both. An indicator for legal review, never a determination',
    severity: 3, category: 'EVIDENCE', scope: ['conditional'],
    example: 'The letter nominates arbitrators "strictly in compliance with section 12B" (a track between licensed participants) and asserts the retailer’s licence "has terminated and/or expired" (subsumes CT56)'
  }
};

// ===================== 63 DETECTOR FUNCTIONS =====================
// Each detector scans for a specific type of contradiction or fraud indicator.
// Detectors return an array of findings: [{ type, severity, evidence, location }]


// ---- DOCUMENT BOUNDARIES IN A COMPILED BUNDLE ------------------------------
// Once bundles hold several documents, a finding anchored to "p. 464" is
// opaque: nothing tells the reader that page 464 is the third document. The
// boundaries are recoverable from the documents' OWN internal page numbering
// — "Page N of M" markers share an M within one document, and N restarts at 1
// when the next begins. Deterministic, text-only, no guessing: a boundary is
// reported only where the record states its own numbering.
// Levenshtein distance for short strings (domains, names); deterministic.
function voEditDistance(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var prev = [], cur = [], i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (j = 1; j <= b.length; j++) {
      var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    var tmp = prev; prev = cur; cur = tmp;
  }
  return prev[b.length];
}

// Document boundaries are read from the seal footers (below), and the footers
// are removed from the text before the detectors run (voStripSealFurniture):
// the boundaries are therefore computed once, on the unstripped blocks, and
// returned from this cache for the same array afterwards.
var _voDocSegsCache = null;
function voCacheDocSegs(textBlocks) {
  _voDocSegsCache = null;
  var segs = voDetectDocuments(textBlocks);
  _voDocSegsCache = { blocks: textBlocks, segs: segs };
  return segs;
}
// Which document a page belongs to, as a key two pages can be compared by.
// A page no stated document covers (an unnumbered run after a document that
// reached its last page, or a run too short to count) is NOT "the same
// document" as every other such page: each contiguous run of them is its own
// document. One shared "-1" bucket once paired an annexure after one
// agreement with a schedule after another (definitions in D30, an expiry and
// an invoice in D04) — the evidence-bundle-7 review, 5 October 2026.
function voDocKeyOf(segs, pageCount) {
  var ids = [];
  for (var d = 0; d < (segs || []).length; d++) {
    for (var q = segs[d].start; q <= segs[d].end; q++) ids[q - 1] = 'd' + d;
  }
  var run = 0;
  for (var i = 0; i < pageCount; i++) {
    if (ids[i] !== undefined) continue;
    if (i === 0 || String(ids[i - 1]).charAt(0) !== 'u') run = i;
    ids[i] = 'u' + run;
  }
  return function (pageIdx) { return ids[pageIdx] !== undefined ? ids[pageIdx] : 'u' + pageIdx; };
}

function voDetectDocuments(textBlocks) {
  if (_voDocSegsCache && _voDocSegsCache.blocks === textBlocks) return _voDocSegsCache.segs;
  if (!textBlocks || textBlocks.length < 6) return [];
  var marks = [];
  for (var i = 0; i < textBlocks.length; i++) {
    var txt = String(textBlocks[i] || '');
    var best = null;
    var consider = function (n, tot) {
      if (!isFinite(n) || !isFinite(tot) || tot < 2 || n < 1 || n > tot) return;
      // The bundle's OWN running numbering ("Clean Bundle Page 326 of 528" on
      // every page of a 528-page bundle) states nothing about the documents
      // inside it; only an exhibit's own "Page 3 of 12" does. Annexure EB's
      // footer made the whole bundle one document and hid every boundary.
      if (tot === textBlocks.length && n === i + 1) return;
      // Nested numberings on one page (a two-page letter sealed on its own,
      // bound into a seven-page compilation, bound into the bundle): the
      // smallest stated total is the document the sealer treated as a unit.
      if (!best || tot < best.total) best = { n: n, total: tot };
    };
    var re = /\b(?:page|p\.?|pg)\s*(\d{1,4})\s*(?:of|\/)\s*(\d{1,4})\b/gi, m;
    while ((m = re.exec(txt)) !== null) consider(parseInt(m[1], 10), parseInt(m[2], 10));
    // This platform's own seal footer states each sealed exhibit's page count
    // ("VERUM OMNIS SEALED ORIGINAL | Seal: VO-65C44F59360E | SHA-512: … |
    // 04/08/2026 12:41:58 Africa/Johannesburg | 45/61"), so a bundle of
    // previously sealed exhibits states its boundaries even when the exhibits
    // print no "Page x of y" of their own. The n/N sits after the last pipe;
    // the date's "04/08" is followed by "/2026" and is never read as one.
    var sealRe = /\bVO-[0-9A-F]{6,}\b(?:\s*\|[^|]{0,90}){0,3}?\s*\|\s*(\d{1,4})\/(\d{1,4})(?![\/\d])/gi;
    while ((m = sealRe.exec(txt)) !== null) consider(parseInt(m[1], 10), parseInt(m[2], 10));
    marks.push(best);
  }
  // Walk the bundle, cutting where the stated total changes or the stated page
  // number restarts. Pages with no marker inherit the run they sit in.
  var segs = [], cur = null;
  for (var p = 0; p < marks.length; p++) {
    var mk = marks[p];
    // An unmarked page inherits the run it sits in, unless that document has
    // already reached its stated last page: three printed emails after the
    // 49-page exhibit VO-553451FF1282 ("… | 49/49") were counted into it as
    // "p. 9 – 60, 52 pages" (evidence-bundle-7-docs, 5 October 2026).
    if (!mk) { if (cur && cur.lastN < cur.total) cur.end = p; continue; }
    var isNew = !cur || mk.total !== cur.total || mk.n <= cur.lastN;
    if (isNew) {
      // The document starts at its own page 1, which sits (n-1) pages back.
      var startIdx = Math.max(cur ? cur.end + 1 : 0, p - (mk.n - 1));
      cur = { start: startIdx, end: p, total: mk.total, lastN: mk.n };
      segs.push(cur);
    } else {
      cur.end = p;
      cur.lastN = mk.n;
    }
  }
  if (segs.length < 2) return [];
  // A run must be substantial to count as a document, and the runs must cover
  // enough of the bundle to be worth stating at all.
  var out = [], covered = 0;
  for (var s = 0; s < segs.length; s++) {
    var len = segs[s].end - segs[s].start + 1;
    if (len < 3) continue;
    covered += len;
    out.push({ start: segs[s].start + 1, end: segs[s].end + 1, pages: len, statedTotal: segs[s].total });
  }
  if (out.length < 2 || covered < textBlocks.length * 0.5) return [];
  // Name each document from the first line of its own first page, so the
  // reader sees "Caltex Franchise Agreement", not just a page range.
  for (var d = 0; d < out.length; d++) {
    var head = String(textBlocks[out[d].start - 1] || '').replace(/\s+/g, ' ').trim();
    // A first page the engine set aside carries its placeholder, never a
    // title ("prior verum omnis report page excluded" was printed as a
    // document's name, evidence-bundle-7-docs).
    if (/^prior verum omnis report page excluded\./.test(head)) { out[d].title = 'Verum Omnis analysis (set aside from scanning)'; continue; }
    if (/^analysis template boilerplate excluded\./.test(head)) { out[d].title = 'Verum Omnis analysis template (set aside from scanning)'; continue; }
    // Drop the page marker and any seal furniture before reading a title. No
    // lookbehind here: Safari before 16.4 throws on it and the whole scan dies.
    head = head.replace(/\b(?:page|p\.?|pg)\s*\d+\s*(?:of|\/)\s*\d+\b/gi, ' ');
    head = head.replace(/^(?:verum omnis[^|]*\||[0-9a-f]{8,}\s*)/i, '').trim();
    var title = (head.split(/[.;:]/)[0] || '')
      .replace(/[^A-Za-z0-9 &'\/,()-]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (title.length > 58) title = title.substring(0, 58).replace(/\s+\S*$/, '') + '…';
    out[d].title = title.length >= 4 ? title : '';
  }
  return out;
}

// ===================== OATH-CONTEXT DETECTION =====================
// Which pages carry the language of a sworn instrument? A contradiction whose
// anchor page sits inside an affidavit is a materially different fact from one
// in correspondence — the reader (and counsel) must know, because a false
// statement under oath has its own legal character. The engine records ONLY
// the measurement: oath language appears on the page. It never classifies a
// statement as sworn testimony, and it never names the offence — "perjury" is
// a verdict-adjacent word that appears nowhere in engine output (§15.2; the
// report's candidate-law annex may cite statutes, which is PD16's one
// sanctioned exception).
//
// Guards (precision over recall, as everywhere in this engine):
//  - STRONG markers are execution formulae that essentially only occur inside
//    a sworn instrument ("commissioner of oaths", "make oath and say", "sworn
//    before me"). One suffices.
//  - WEAK markers ("affidavit", "deponent", "under oath") also occur in pages
//    that merely DISCUSS an affidavit — an index line reading "Supplementary
//    Affidavit, 9pp" is not an oath. Two DISTINCT weak markers are required.
//  - Body pages of a long affidavit may carry no markers at all and are not
//    tagged: under-tagging is a gap, mis-tagging is a false statement of fact.
var VO_OATH_STRONG = [
  /commissioner\s+of\s+oaths/i,
  /make[s]?\s+oath\s+and\s+(?:say|state)/i,
  /solemnly\s+(?:and\s+sincerely\s+)?(?:declare|affirm)/i,
  /depose[sd]?\s+and\s+(?:say|state)/i,
  /duly\s+sworn/i,
  /sworn\s+(?:to\s+)?before\s+me/i
];
var VO_OATH_WEAK = [
  /\baffidavit\b/i,
  /\bdeponent\b/i,
  /\bunder\s+oath\b/i,
  /\bi\s+make\s+oath\b/i
];
function voDetectSwornPages(textBlocks) {
  var pages = [];
  if (!textBlocks) return pages;
  for (var p = 0; p < textBlocks.length; p++) {
    var t = textBlocks[p] || '';
    if (!t) continue;
    var hit = false;
    for (var s = 0; s < VO_OATH_STRONG.length; s++) {
      if (VO_OATH_STRONG[s].test(t)) { hit = true; break; }
    }
    if (!hit) {
      var weak = 0;
      for (var w = 0; w < VO_OATH_WEAK.length; w++) {
        if (VO_OATH_WEAK[w].test(t)) weak++;
      }
      hit = weak >= 2;
    }
    if (hit) pages.push(p + 1);
  }
  return pages;
}

// Behavioural detectors record direct language, not a complainant's
// second-hand characterisation of what another person said. Express quotation
// marks keep a quoted passage available for review; narrative attribution alone
// does not establish independent opposing-party conduct.
function voBehaviouralSecondhand(sen) {
  var s = String(sen || '');
  var attributed = /\b(?:wrote|claimed|alleged|narrative|submit(?:s|ted|ting)?|argu(?:e|es|ed|ing)|according\s+to)\b/i.test(s);
  if (!attributed) {
    // Passive wording inside the denial itself ("that is not what was said")
    // is direct language, not a narrator attributing a position to someone else.
    var withoutPassiveSaid = s.replace(/\b(?:was|were|is|are|been|be)\s+said\b/ig, '');
    attributed = /\bsaid\b/i.test(withoutPassiveSaid);
  }
  if (!attributed) return false;
  return !/["“]/.test(s);
}
function voBehaviouralKey(sen) {
  return String(sen || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

var DETECTORS = {

  // D01-D05: Statemental detectors
  D01_DETECT_DIRECT_CONTRADICTION: function(textBlocks) {
    var findings = [];
    // Genuine same-subject action negations. The loose topic-word pairs that
    // used to be here (true/false, valid/invalid, agreed/disputed,
    // authorized/unauthorized) were removed: they co-occur in ordinary legal
    // and constitutional prose and flagged clean documents. Just as important,
    // the two terms must now appear TOGETHER (same passage), not merely both
    // somewhere in the document -- "paid" on page 1 and "not paid" on page 12
    // is not a contradiction.
    var negationPairs = [
      ['paid','not paid'],['received','not received'],['approved','rejected'],
      ['accepted','declined'],['completed','incomplete'],['submitted','not submitted'],
      ['confirmed','denied'],['registered','deregistered']
    ];
    var fullText = textBlocks.join(' ').toLowerCase();
    var WINDOW = 80; // ~one clause; both terms must sit this close to be a local contradiction
    function positions(term) {
      var re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      var m, out = [];
      while ((m = re.exec(fullText)) !== null) out.push(m.index);
      return out;
    }
    // Subject alignment (v5.2.9 lineage: opposing statements must be ABOUT THE
    // SAME THING). "The invoice was paid ... the deposit was not paid" is two
    // facts, not a contradiction. The last content word before each term is its
    // approximate subject; pronouns (it/same/such/...) refer back and align
    // with anything, and when no subject is visible we stay permissive.
    var SUBJ_STOP = /^(?:the|a|an|was|were|is|are|be|been|being|has|have|had|later|also|then|and|or|nor|of|to|in|on|by|for|with|that|which|as|at|from|shall|will|may|must|not|never|no|any|all|both|each|his|her|their|our|your|s)$/;
    var SUBJ_PRONOUN = /^(?:it|its|same|such|this|these|those|they|them|he|she|matter|latter|former|aforesaid|said)$/;
    function subjectBefore(pos) {
      var pre = fullText.slice(Math.max(0, pos - 48), pos);
      var words = pre.replace(/[^a-z' -]/g, ' ').split(/\s+/).filter(Boolean);
      for (var w = words.length - 1; w >= 0; w--) {
        if (SUBJ_PRONOUN.test(words[w])) return '*'; // refers back: aligns with anything
        if (!SUBJ_STOP.test(words[w]) && words[w].length > 2) return words[w];
      }
      return null; // no visible subject: stay permissive
    }
    function subjectsAligned(pa, pb) {
      var sa = subjectBefore(pa), sb = subjectBefore(pb);
      if (sa === null || sb === null || sa === '*' || sb === '*') return true;
      return sa === sb;
    }
    for (var i = 0; i < negationPairs.length; i++) {
      var a = negationPairs[i][0], b = negationPairs[i][1];
      // A positive assertion of `a` is one NOT already negated by "not ".
      var aPos = positions(a).filter(function(p) { return fullText.slice(Math.max(0, p - 4), p) !== 'not '; });
      var bPos = positions(b);
      var hit = null;
      for (var hp = 0; hp < aPos.length && !hit; hp++) {
        for (var hq = 0; hq < bPos.length; hq++) {
          if (Math.abs(aPos[hp] - bPos[hq]) <= WINDOW && subjectsAligned(aPos[hp], bPos[hq])) { hit = [aPos[hp], bPos[hq]]; break; }
        }
      }
      if (hit) {
        findings.push({ type: 'CT01', severity: 4,
          evidence: 'Opposing statements "' + a + '" and "' + b + '" appear in the same passage',
          location: 'Same passage' });
      }
    }

    // Generic same-token assertion-vs-negation. The fixed pairs above only know
    // a hard-coded vocabulary ("paid"/"not paid"), so "payment was made ... no
    // payment" or "the debt is owed ... denied ... debt" slipped through.
    //
    // It is restricted to a CURATED set of claim words. An earlier version keyed
    // on any 4+ letter word near a negator, which on a real 341-page bundle
    // over-fired (25 findings) and even grabbed PDF-extraction fragments -- "V
    // alue" split across a line break was reported as negating "alue". Keying on
    // whole known claim words kills both problems, and the finding now quotes
    // BOTH the affirming and the negating passage so it is self-explanatory.
    var CLAIM_WORDS = ['paid','payment','owed','signed','countersigned','witnessed','notarised','notarized','valid','agreed','consented','authorised','authorized','received','delivered','renewed','terminated','expired','entitled','breached','disclosed','refunded','cancelled','approved','accepted'];
    // The negator must attach to the claim word itself: at most three
    // intervening words, all from a closed set of auxiliaries and determiners
    // ("not been paid", "never duly signed", "without any signed waiver").
    // Under the old "any five words" rule the annexure EB lease's "without
    // notice claim immediate payment" was read as a negation of "payment" and
    // sealed as a Direct Statement Contradiction — "without" there qualifies
    // "notice", and the passage affirms payment twice.
    var NEG_FILLER = /^(?:been|be|being|is|are|was|were|has|have|had|yet|ever|any|a|an|the|duly|properly|fully|formally|validly|so|then|actually|in|fact|to|by|him|her|them|it|its|such|that|this|these|those|of|at|all|still|even|once|again|now|also|already|make|made|making|makes|effect|effected|render|rendered|give|given|gave|the|his|her|their|our|my|your)$/;
    var NEG_WORD = /\b(?:no longer|not|never|without|denied|denies|refused to|refuses to|failed to|no)\b/g;
    // The negator NEAREST the claim word decides ("It is not disputed that the
    // Lessor never received the notice" negates through "never", not "not");
    // "denied that the resolution was approved" keeps ONE content word (the
    // subject) between negator and claim; "without notice claim immediate
    // payment" keeps three, and is no negation of "payment". The word right
    // before the claim word is its modifier ("royalty payment") and is free.
    var NEG_BEFORE = { test: function (pre) {
      var m, lastM = null;
      NEG_WORD.lastIndex = 0;
      while ((m = NEG_WORD.exec(pre)) !== null) lastM = m;
      if (!lastM) return false;
      var between = pre.slice(lastM.index + lastM[0].length).trim().split(/\s+/).filter(Boolean);
      if (between.length > 5) return false;
      var content = 0;
      for (var w = 0; w < between.length; w++) {
        if (NEG_FILLER.test(between[w])) continue;
        if (w === between.length - 1) continue; // the claim word's own modifier
        content++;
      }
      return content <= 1;
    } };
    // Object alignment: the affirmed and the negated occurrence must be about
    // the same object when both name one. "entitled to effect repairs" and
    // "not entitled to any compensation" share a word, not a proposition (the
    // annexure EB lease, sealed as CT01). The first content word after the
    // claim word, inside the same sentence, is the object; when either side
    // ends its sentence there, the check stays permissive.
    var OBJ_SKIP = /^(?:to|of|for|the|a|an|any|all|such|its|his|her|their|be|been|in|on|under|with|was|were|is|are|has|have|had|ever|never|not|both|either|also|then|so|that|which|as|at|from|and|or|during|within|before|after|between|full|part|whole|parties|party|lessor|lessee|franchisor|franchisee|january|february|march|april|may|june|july|august|september|october|november|december)$/;
    function objectAfter(pos, word) {
      var seg = fullText.slice(pos + word.length, pos + word.length + 60).split(/[.;:!?]/)[0];
      var words = seg.replace(/[^a-z' -]/g, ' ').split(/\s+/).filter(Boolean);
      if (words.length && words[0] === 'by') return null; // "signed by X": an agent, not an object — stay permissive
      for (var w = 0; w < words.length && w < 6; w++) {
        if (OBJ_SKIP.test(words[w]) || words[w].length <= 2) continue;
        if (/ly$/.test(words[w])) continue; // adverb ("timeously")
        return words[w];
      }
      return null;
    }
    function objectsAligned(pa, pb, word) {
      var oa = objectAfter(pa, word), ob = objectAfter(pb, word);
      if (oa === null || ob === null) return true;
      return oa === ob;
    }
    // A negator whose path to the claim word passes through unless/until/
    // except/provided is a CONDITIONAL REQUIREMENT, not a negation: "shall not
    // be valid unless it is approved by X" states a rule about approval — it
    // neither affirms nor denies that anything WAS approved. The Greensky MOA
    // produced exactly this false CT01 ("approved by 75% majority" vs
    // "approved by ras al khaimah") from two requirement clauses.
    var REQ_BETWEEN = /\b(?:no longer|not|never|without|denied|denies|refused to|refuses to|failed to|no)\b(?:\s+\w+){0,4}?\s+(?:unless|until|except|save|provided)\b(?:\s+\w+){0,4}\s*$/;
    var mkSnip = function (idx) { return fullText.slice(Math.max(0, idx - 30), idx + 45).replace(/\s+/g, ' ').trim(); };
    for (var ci = 0; ci < CLAIM_WORDS.length; ci++) {
      var cw = CLAIM_WORDS[ci];
      var occRe = new RegExp('\\b' + cw + '\\b', 'g');
      var occ, asserts = [], negs = [];
      while ((occ = occRe.exec(fullText)) !== null) {
        var pre = fullText.slice(Math.max(0, occ.index - 45), occ.index);
        if (REQ_BETWEEN.test(pre)) continue; // requirement clause: neither an assertion nor a negation
        if (NEG_BEFORE.test(pre)) negs.push(occ.index); else asserts.push(occ.index);
      }
      if (!asserts.length || !negs.length) continue;
      // Require an affirmed and a negated occurrence of the SAME word inside one
      // passage (240 chars) -- a document-wide coincidence is not a contradiction.
      var pair = null;
      for (var ai = 0; ai < asserts.length && !pair; ai++) {
        for (var ni = 0; ni < negs.length; ni++) {
          if (Math.abs(asserts[ai] - negs[ni]) <= 240 && subjectsAligned(asserts[ai], negs[ni]) && objectsAligned(asserts[ai], negs[ni], cw)) { pair = [asserts[ai], negs[ni]]; break; }
        }
      }
      if (!pair) continue;
      findings.push({ type: 'CT01', severity: 4,
        evidence: 'The document both affirms and negates "' + cw + '": "…' + mkSnip(pair[0]) + '…" vs "…' + mkSnip(pair[1]) + '…"',
        location: 'Same passage' });
    }

    // Explicit admission statements. The Greensky review's central miss: a
    // written first-person admission ("I admit that…", "we concede…") is the
    // strongest statement a record can carry, and the engine had no detector
    // for admission LANGUAGE at all. Cite-or-stay-silent: only explicit
    // first-person admission phrasing fires — the engine quotes the sentence,
    // it does not judge what was admitted (narrative admissions that only
    // read as admissions in context belong to the AI review layer). One
    // aggregated finding, every stating page cited.
    var admissionCues = ['i admit', 'we admit', 'i concede', 'we concede',
      'i acknowledge that', 'we acknowledge that', 'i accept that', 'we accept that',
      'i was wrong', 'we were wrong', 'i misled', 'we misled',
      'admitted under oath', 'admission of guilt'];
    // A pleading admits paragraphs, not facts: "AD PARAGRAPH 13 … I admit the
    // contents of this paragraph" is the form of an answering affidavit, and
    // the evidence-bundle-4 run sealed eight pages of it as a contradiction.
    // The form test reads the cue's own sentence in the pleading grammar
    // ("admit the contents/allegations contained in/of this/sub-/paragraph
    // 13.2", "admit the correctness of the contents of this paragraph", "admit
    // the contents hereof", "admit paragraph 13"). An AD PARAGRAPH heading on
    // its own never suppresses a sentence — "AD PARAGRAPH 7: I admit that I
    // signed the deed of suretyship" is an admission of fact — and every
    // occurrence of a cue on a page is read, so a form sentence never hides a
    // later sentence of fact.
    var PLEADING_ADMISSION_RE = /\badmit(?:s|ted)?\s+(?:only\s+)?(?:the\s+)?(?:(?:contents?|allegations?|averments?|correctness|opening\s+sentence|first\s+sentence|remainder|balance|rest)\s+(?:of\s+the\s+(?:contents?|allegations?|averments?)\s+)?(?:contained\s+in\s+|set\s+out\s+in\s+|of\s+|in\s+)?(?:(?:this|the|these|that|said|each)\s+(?:said\s+|aforesaid\s+)?(?:sub-?)?para(?:graph)?s?\b|(?:sub-?)?para(?:graph)?s?\s+\d)|(?:contents?|allegations?|averments?)\s+(?:hereof|thereof|herein|therein)\b|(?:sub-?)?para(?:graph)?s?\s+\d)/i;
    // A sentence that CALLS another statement an admission is analysis, not an
    // admission: "Forensic Finding:** This is an explicit admission of guilt"
    // (an AI-written case summary bound into the Greensky bundle, pp. 5, 63,
    // 143, 272 of the 3 October 2026 run) was sealed as "The record carries an
    // explicit admission". The admission the engine quotes must be the
    // admitting party's own sentence, never a commentator's label for one.
    // The test anchors on the words immediately BEFORE the cue — an equative
    // verb reaching the cue ("is an explicit…", "constitutes a clear…",
    // "treated as an…") — so the subject can be anything ("Mr Nortje's
    // email", "that email", "his reply"), and it applies only to the
    // noun-shaped cue: a first-person "I admit…" is never a label and is
    // never guard-killed (the Greensky rerun review broke a closed subject
    // list both ways).
    var VO_ADM_CHARACTERISATION_RE = /\b(?:is|was|are|were|be|being|been|constitutes?|amount(?:s|ed)?\s+to|represent(?:s|ed)?|reads?\s+as|read\s+as|deem(?:s|ed)?|treat(?:s|ed)?\s+as|considered|regarded\s+as)\s+(?:an?\s+)?(?:\w+[-\s]+){0,3}?$/i;
    var VO_ADM_NOUN_CUES = { 'admission of guilt': 1 };
    var admPages = [], admQuote = null, admCue = null, admSeen = {};
    for (var ap = 0; ap < textBlocks.length; ap++) {
      var lowA = (textBlocks[ap] || '').toLowerCase();
      var admCounted = false;
      for (var ac = 0; ac < admissionCues.length && !admCounted; ac++) {
        var atA = lowA.indexOf(admissionCues[ac]);
        while (atA !== -1) {
          // The cue's own sentence: from the cue to the next sentence end (a
          // clause number's "13.2" has no space after its point).
          var sentA = lowA.slice(atA, atA + 200).split(/[.;!?]\s|\n/)[0];
          // ...and the words reaching the cue, so a label for an admission
          // ("this is an explicit admission of guilt") is read as the
          // characterisation it is. Only the cue's own sentence is read.
          if (VO_ADM_NOUN_CUES[admissionCues[ac]]) {
            var headA = lowA.slice(Math.max(0, atA - 120), atA);
            var headBreak = Math.max(headA.lastIndexOf('. '), headA.lastIndexOf('; '), headA.lastIndexOf('! '), headA.lastIndexOf('? '), headA.lastIndexOf('\n'));
            if (headBreak !== -1) headA = headA.slice(headBreak + 1);
            if (VO_ADM_CHARACTERISATION_RE.test(headA)) {
              atA = lowA.indexOf(admissionCues[ac], atA + admissionCues[ac].length);
              continue;
            }
          }
          // A prediction or hypothetical put into another person's mouth is
          // the writer's argument, not that person's admission ("perhaps later
          // you'll think … I was wrong" in Liam's Greensky letter).
          var beforeCueA = lowA.slice(Math.max(0, atA - 90), atA);
          if (/\b(?:you|he|she|they)\b[^.;!?]{0,80}\b(?:think|may|might|could|would|predict|expect)\b[^.;!?]{0,45}$/i.test(beforeCueA)) {
            atA = lowA.indexOf(admissionCues[ac], atA + admissionCues[ac].length);
            continue;
          }
          var admKey = sentA.replace(/[^a-z0-9]+/g, ' ').trim();
          if (!PLEADING_ADMISSION_RE.test(sentA) && !admSeen[admKey]) {
            admSeen[admKey] = true;
            admPages.push(ap + 1);
            if (!admQuote) {
              admCue = admissionCues[ac];
              admQuote = voSnapWindow(textBlocks[ap], atA - 40, atA + admissionCues[ac].length + 120);
            }
            admCounted = true; // one count per page
            break;
          }
          atA = lowA.indexOf(admissionCues[ac], atA + admissionCues[ac].length);
        }
      }
    }
    // CONDUCT ADMISSION — a party, in their own words, explaining WHY the
    // disputed transaction went ahead. The explicit cues above never fire on
    // real correspondence: nobody writes "I admit". The Greensky bundle
    // carries the shape that DOES appear, from Marius Nortje's email of
    // 6 April 2025 (pp. 53-54, requoted on 82, 86, 211, 215):
    //   "Because you refused to communicate with Kevin's Export and me,
    //    Kevin's Export proceeded with the deal, since Sealife Hong Kong was
    //    already his client."
    // Signature: a causal justification + the transaction proceeding + the
    // writer placing themselves in it. Precision guards: contract boilerplate
    // ("the parties shall proceed...") is excluded, and a bare first-person
    // account with NO justification ("we completed the sale in 2019") does
    // not fire — affidavits are full of those and would flood the report.
    var VO_CAUSE_RE = /\b(?:because|since|as a result|due to|owing to|given that|seeing that)\b/i;
    var VO_PROCEED_RE = /\b(?:proceeded|went\s+ahead|carried\s+on|continued|concluded|completed|finalised|finalized|executed)\b[^.]{0,80}\b(?:deal|transaction|sale|shipment|order|export|contract|agreement|payment|transfer)\b/i;
    var VO_SELF_RE = /\b(?:i|we|me|my|our|us)\b/i;
    var VO_BOILER_RE = /\b(?:shall|hereby|whereas|herein|the\s+parties\s+agree)\b/i;
    var condPages = [], condQuote = null, condSeen = {};
    for (var cp = 0; cp < textBlocks.length; cp++) {
      var sentsC = String(textBlocks[cp] || '').split(/[.!?]+\s+/);
      for (var sc = 0; sc < sentsC.length; sc++) {
        var senC = sentsC[sc];
        if (senC.length < 30 || senC.length > 600) continue;
        if (VO_BOILER_RE.test(senC)) continue;
        if (!VO_CAUSE_RE.test(senC) || !VO_PROCEED_RE.test(senC) || !VO_SELF_RE.test(senC)) continue;
        var condKey = senC.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (condSeen[condKey]) continue;
        condSeen[condKey] = true;
        condPages.push(cp + 1);
        if (!condQuote) {
          // Where the passage is requoted under the bundle's own heading
          // ("Marius Admission Email 6 April 2025 Quoted from ... :"), the
          // sentence begins with that furniture and the real admission gets
          // truncated away. Start the quote at the justification itself.
          var cutC = senC.search(VO_CAUSE_RE);
          condQuote = (cutC > 30 ? senC.slice(cutC) : senC).replace(/\s+/g, ' ').trim();
        }
        break; // one count per page
      }
    }
    if (condPages.length) {
      var cpList = condPages.length > 8
        ? condPages.slice(0, 8).join(', ') + ' and ' + (condPages.length - 8) + ' more'
        : condPages.join(', ');
      findings.push({ type: 'CT01', severity: 4, conductAdmission: true,
        evidence: 'A party gives their own account of why the disputed transaction went ahead: "' + condQuote + '"' +
          (condPages.length > 1 ? ' — the same account appears on ' + condPages.length + ' pages (' + cpList + ')' : '') +
          ' — the words are the writer\'s own; read the full passage in context and establish what it settles',
        location: 'Page ' + cpList, pages: condPages.slice() });
    }

    if (admPages.length) {
      var apList = admPages.length > 8
        ? admPages.slice(0, 8).join(', ') + ' and ' + (admPages.length - 8) + ' more'
        : admPages.join(', ');
      findings.push({ type: 'CT01', severity: 4, conductAdmission: true,
        evidence: 'The record carries an explicit admission ("' + admCue + '"): "' + admQuote + '"' +
          (admPages.length > 1 ? ' — admission language appears on ' + admPages.length + ' pages (' + apList + ')' : '') +
          ' — read the full passage in context; what is admitted, and by whom, is for the reviewer',
        location: 'Page ' + apList, pages: admPages.slice() });
    }
    return findings;
  },

  // Flags a *labelled* quantity that the document states at two different
  // values -- "Total: R450,000" on one page and "Total: R470,000" on another.
  //
  // This previously compared every amount in the document against every other
  // amount and reported any pair differing by >10%. That is not a
  // contradiction: a R150 line item and a R60,000 line item are simply
  // different line items. On the repo's 10-page test document it emitted 739
  // findings, drowning the 3 real ones, and being O(n^2) in amount count it
  // also scaled badly. Comparing like with like is the actual signal.
  D02_DETECT_NUMERICAL_DISCREPANCY: function(textBlocks) {
    var findings = [];
    var LABEL_RE = /\b(grand total|sub-?total|total|balance(?:\s+due)?|amount(?:\s+(?:due|payable|paid))?|invoice total|net(?:\s+amount)?|gross(?:\s+amount)?|vat|tax|deposit|purchase price|contract (?:value|price|sum))\b/gi;
    // Magnitude words are part of the amount: "R231.3 million" is
    // R231,300,000, not R231 (the AllFuels bundle's headline figure was read
    // with its decimal and magnitude stripped). One or two decimals allowed
    // when a magnitude word follows; bare amounts keep the strict two-decimal
    // rule so reference numbers are not misread as money.
    // Thousands may be grouped by a space as well as a comma ("R116 124.00"
    // in a bank's outcome letter); a space-grouped figure needs its currency
    // symbol so that two unrelated numbers are never joined into one amount.
    // The evidence-bundle-2-docs run read "R116 124.00" as R116.
    var AMOUNT_RE = /(?:[R$€£]\s*)\d+(?:[.,]\d{1,2})?\s*(?:million|billion|m|bn)\b|(?:[R$€£]\s*)\d{1,3}(?:[   ]\d{3})+(?:\.\d{2})?|(?:[R$€£]\s*)?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|(?:[R$€£]\s*)\d+(?:\.\d{2})?/i;
    // The amount must follow its label directly, through at most a short
    // connector ("Total: R…", "an amount of R…", "purchase price (excl. VAT)
    // R…"). A label followed by other words is not stating that figure: the
    // column header "Amount Merchant" above a table row "R 8000.00 Makro" was
    // read as "amount = R8000" and set against "an amount of R116 124.00" in
    // another letter.
    var CONNECTOR_RE = /^[\s.:=\-–—(]*(?:of|is|was|be|at|to|due|payable|paid|owing|outstanding|\([^)]{0,40}\))?[\s.:=\-–—]*(?:of\s*)?$/i;
    // A labelled figure is restated only inside ONE document. Where the bundle
    // states its own boundaries (an exhibit's "Page x of y", a sealed
    // exhibit's footer), entries from different documents are never compared:
    // "an amount of R116 124.00" in one customer's outcome letter and an
    // "Amount" in another customer's are two subjects, not one figure.
    var d02Segs = voDetectDocuments(textBlocks) || [];
    var d02DocOf = function (pageIdx) {
      for (var d = 0; d < d02Segs.length; d++) { if (pageIdx + 1 >= d02Segs[d].start && pageIdx + 1 <= d02Segs[d].end) return d; }
      return -1;
    };

    // How far after a label an amount may sit and still belong to it.
    var MAX_LOOKAHEAD = 40;

    var byLabel = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var block = textBlocks[i];

      // Collect every label position first so each one's search window can be
      // stopped at the next label. Scanning a fixed distance forward let a
      // label that states no amount of its own reach past the next label and
      // adopt its figure -- "Total: refer to annexure. Deposit R900,000" was
      // read as a Total of R900,000, manufacturing a discrepancy that is not
      // in the document. Inventing an allegation is the worst thing a forensic
      // detector can do, so a label's amount must lie strictly before the
      // next label, and a label with no amount of its own is skipped.
      var marks = [];
      LABEL_RE.lastIndex = 0;
      var m;
      while ((m = LABEL_RE.exec(block)) !== null) {
        marks.push({ text: m[0], start: m.index, end: m.index + m[0].length });
      }

      for (var k = 0; k < marks.length; k++) {
        var from = marks[k].end;
        var boundary = k + 1 < marks.length ? marks[k + 1].start : block.length;
        var to = Math.min(boundary, from + MAX_LOOKAHEAD);
        if (to <= from) continue;

        var am = block.slice(from, to).match(AMOUNT_RE);
        if (!am) continue;
        if (!CONNECTOR_RE.test(block.slice(from, from + am.index))) continue;
        var magM = am[0].match(/(million|billion|m|bn)\b\s*$/i);
        var numPart = magM ? am[0].slice(0, magM.index) : am[0];
        var value = parseFloat(numPart.replace(/[,   ](?=\d{3}\b)/g, '').replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (magM) value *= /^b/i.test(magM[1]) ? 1e9 : 1e6;
        if (isNaN(value) || value <= 100) continue;

        var label = marks[k].text.toLowerCase().replace(/\s+/g, ' ').replace(/^sub-total$/, 'subtotal');
        // Subject alignment (v5.2.9 lineage): "Invoice INV-001 Total" and
        // "Invoice INV-002 Total" are two subjects, not one figure restated.
        // Capture an explicit qualifying identifier just before the label;
        // entries with DIFFERENT qualifiers are never compared.
        var qual = null;
        var qm = block.slice(Math.max(0, marks[k].start - 40), marks[k].start)
          .match(/(?:invoice|annexure|exhibit|order|quote|erf|case|claim|account|matter)\s*(?:no\.?|number|#)?\s*([a-z0-9][a-z0-9\/-]*)\s*[:\s]*$/i);
        if (qm) qual = qm[1].toLowerCase();
        if (!byLabel[label]) byLabel[label] = [];
        byLabel[label].push({ value: value, raw: am[0].trim(), page: i, qual: qual });
      }
    }

    for (var label in byLabel) {
      if (!Object.prototype.hasOwnProperty.call(byLabel, label)) continue;
      var entries = byLabel[label];
      if (entries.length < 2) continue;

      // A generic label ("amount", "total") that carries MANY different values is
      // a line-item list -- e.g. a bill of costs where every row is an "amount",
      // or a 180-page bundle of separate invoices -- NOT one figure restated. On
      // the Louw v Moolla scan this produced 19 false "amount is R225 vs
      // R275,000" findings. A genuine restatement is one labelled total stated
      // at two (occasionally three) values; more distinct values than that means
      // it is a list, so we skip the whole group rather than compare a min
      // against everything.
      var distinct = {};
      for (var e = 0; e < entries.length; e++) distinct[entries[e].value] = true;
      if (Object.keys(distinct).length > 3) continue;

      // Compare each distinct stated value against the lowest one, rather than
      // every pair, so N statements yield at most N-1 findings.
      var sorted = entries.slice().sort(function(x, y) { return x.value - y.value; });
      var base = sorted[0];
      var seenVals = {};
      for (var k = 1; k < sorted.length; k++) {
        var cur = sorted[k];
        if (seenVals[cur.value]) continue; // a repeated value is one discrepancy
        seenVals[cur.value] = true;
        // Different explicit qualifiers = different subjects, never a restatement.
        if (base.qual && cur.qual && base.qual !== cur.qual) continue;
        // Different stated documents = different subjects (see d02Segs above).
        if (d02Segs.length && (d02DocOf(base.page) !== d02DocOf(cur.page) || d02DocOf(base.page) === -1)) continue;
        var diff = cur.value - base.value;
        var avg = (cur.value + base.value) / 2;
        // For the SAME label restated at two/three values, any material
        // difference is a genuine contradiction: >R1000 and >1% (the 1% floor
        // ignores rounding on very large sums).
        if (diff > 1000 && diff / avg > 0.01) {
          findings.push({ type: 'CT02', severity: 4,
            evidence: '"' + label + '" is stated as ' + base.raw + ' and as ' + cur.raw +
              ' (variance: ' + Math.round(diff / avg * 100) + '%)',
            location: 'Page ' + (base.page + 1) + ' vs Page ' + (cur.page + 1) });
        }
      }
    }

    // ---- Invoice-number-keyed totals ----
    // External review of the test fixture: "Invoice #2023-001" was totalled
    // at $125,000.00 on its own page and $128,500.00 in a supporting
    // reference, and the label pass above missed it because "TOTAL" and
    // "invoice total" key differently. An invoice number is a far stronger
    // key than a label word — the same invoice cannot have two totals.
    // Guards: only TOTAL-labelled amounts (or an amount immediately after
    // "INVOICE #X:") count — line items inside the invoice never do; amounts
    // are compared numerically so "$125,000" equals "$125,000.00"; one
    // finding per invoice number.
    var invTotals = {}; // invoice id -> [{val, raw, page}]
    var invRe = /\binvoice\s*#?\s*([A-Z0-9][\w-]{2,15})\b/gi;
    for (var ivp = 0; ivp < textBlocks.length; ivp++) {
      var ivt = textBlocks[ivp] || '', ivm;
      invRe.lastIndex = 0;
      var mentions = [];
      while ((ivm = invRe.exec(ivt)) !== null) {
        // "invoice date:", "invoice total", "invoice number" — label words, not
        // ids. Filter them HERE: if kept as mentions they would truncate the
        // real invoice's window and its second total would fall outside it.
        if (/^(date|no|number|total|amount)$/i.test(ivm[1])) continue;
        mentions.push({ id: ivm[1].toUpperCase(), start: ivm.index, end: ivm.index + ivm[0].length });
      }
      for (var mi = 0; mi < mentions.length; mi++) {
        var men = mentions[mi];
        var wEnd = mi + 1 < mentions.length ? mentions[mi + 1].start : Math.min(ivt.length, men.end + 700);
        var win2 = ivt.substring(men.end, wEnd);
        var amts = [];
        // TOTAL-labelled amount anywhere in this invoice's window
        var totRe = /total[^$\d\n]{0,20}\$\s?([\d,]+(?:\.\d{2})?)/gi, tm2;
        while ((tm2 = totRe.exec(win2)) !== null) amts.push(tm2[1]);
        // ...or an amount immediately after "INVOICE #X:" (summary-row form)
        var immediate = win2.match(/^\s*:?\s*\$\s?([\d,]+(?:\.\d{2})?)/);
        if (immediate) amts.push(immediate[1]);
        for (var ai = 0; ai < amts.length; ai++) {
          var v = parseFloat(amts[ai].replace(/,/g, ''));
          if (!isFinite(v) || v < 100) continue;
          (invTotals[men.id] = invTotals[men.id] || []).push({ val: v, raw: '$' + amts[ai], page: ivp + 1 });
        }
      }
    }
    for (var iid in invTotals) {
      var vs = invTotals[iid], uniq = [];
      for (var u = 0; u < vs.length; u++) {
        var dup = false;
        for (var q = 0; q < uniq.length; q++) if (Math.abs(uniq[q].val - vs[u].val) < 0.005) { dup = true; break; }
        if (!dup) uniq.push(vs[u]);
      }
      if (uniq.length >= 2) {
        uniq.sort(function (a, b) { return a.val - b.val; });
        var lo = uniq[0], hi = uniq[uniq.length - 1];
        findings.push({ type: 'CT02', severity: 4,
          evidence: 'Invoice ' + iid + ' is totalled at two different amounts in the record: ' +
            lo.raw + ' (p.' + lo.page + ') and ' + hi.raw + ' (p.' + hi.page + ') — verify which total governs',
          location: lo.page === hi.page ? 'Page ' + lo.page : 'Page ' + lo.page + ' vs Page ' + hi.page });
      }
    }
    return findings;
  },

  // D02B: one instrument, two invoice numbers. The Marius-folder schedule
  // (item 16): the same "Damages October 2026" charge for R199,405.63 is
  // cited as invoice INV98185 in FA8 and as INV69816 in FA11 — the same
  // amount, for the same thing, cannot bear two invoice numbers. Grouped by
  // exact amount; a shared context word ("damages") must sit near both
  // mentions so a deposit/balance pair on one account is not fused.
  D02B_DETECT_INVOICE_IDENTITY_CONFLICT: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var STOPW = { invoice: 1, amount: 1, payment: 1, refund: 1, refunded: 1, account: 1, dated: 1, total: 1, value: 1, being: 1, which: 1, their: 1, there: 1, shall: 1, would: 1, could: 1, should: 1, about: 1, above: 1 };
    var INV_G = /\bINV[-\s]?(\d{4,6})\b/gi;
    var AMT_G = /R\s?(\d[\d,]*\.\d{2})/g;
    var mentions = [];
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '');
      INV_G.lastIndex = 0;
      var m;
      while ((m = INV_G.exec(W)) !== null) {
        var winRaw = W.slice(Math.max(0, m.index - 250), m.index + 250);
        AMT_G.lastIndex = 0;
        var am, amt = null;
        while ((am = AMT_G.exec(winRaw)) !== null) { amt = am[1]; }
        if (!amt) continue;
        var ctx = {};
        var toks = winRaw.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
        for (var ti = 0; ti < toks.length; ti++) if (toks[ti].length >= 5 && !STOPW[toks[ti]]) ctx[toks[ti]] = 1;
        mentions.push({ inv: m[1], amt: amt, page: b + 1, ctx: ctx, quote: W.slice(Math.max(0, m.index - 80), m.index + 80).replace(/\s+/g, ' ').trim() });
      }
    }
    var byAmt = {};
    for (var i = 0; i < mentions.length; i++) (byAmt[mentions[i].amt] = byAmt[mentions[i].amt] || []).push(mentions[i]);
    var seen = {};
    for (var amt2 in byAmt) {
      if (!Object.prototype.hasOwnProperty.call(byAmt, amt2)) continue;
      var grp = byAmt[amt2];
      for (var a = 0; a < grp.length; a++) {
        for (var c = a + 1; c < grp.length; c++) {
          var A = grp[a], C = grp[c];
          if (A.inv === C.inv) continue;
          var shared = 0;
          for (var tk in A.ctx) if (Object.prototype.hasOwnProperty.call(A.ctx, tk) && C.ctx[tk]) { shared = 1; break; }
          if (!shared) continue;
          var key = amt2 + '|' + [A.inv, C.inv].sort().join('|');
          if (seen[key]) continue;
          seen[key] = 1;
          findings.push({ type: 'CT02', severity: 4,
            evidence: 'The same charge of R' + amt2 + ' is recorded under two invoice numbers: INV' + A.inv + ' ("' + A.quote + '", p. ' + A.page + ') and INV' + C.inv + ' ("' + C.quote + '", p. ' + C.page + '). One charge cannot bear two invoice numbers; which is the true instrument is for the record, not the engine.',
            location: A.page === C.page ? 'Page ' + A.page : 'Page ' + A.page + ' vs Page ' + C.page });
        }
      }
    }
    return findings;
  },

  // D02C: paid vs its own disclaimer. The schedule (items 14-15): an email
  // attaches "POP for refund for fuel in the amount of R 2 000 000" while
  // the attachment itself records a single unreleased R1,000,000 capture
  // and states it "IS NOT A PROOF OF PAYMENT". The disclaimer phrase is
  // rare in ordinary prose; a differing claimed amount near it is the trap.
  D02C_DETECT_PAYMENT_PROOF_MISMATCH: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    // Amounts tolerate spaced or comma'd thousands ("R 2 000 000" =
    // "R2,000,000.00") and compare NUMERICALLY — a string difference in
    // formatting is not a difference in money.
    var AMT_G = /R\s?(\d[\d, ]{0,14}\d(?:\.\d{2})?)/g;
    function amtVal(s) { return parseFloat(s.replace(/[,\s]/g, '')); }
    function amountsOf(W) {
      var out = [], m;
      AMT_G.lastIndex = 0;
      while ((m = AMT_G.exec(W)) !== null) out.push({ amt: m[1], val: amtVal(m[1]), idx: m.index });
      return out;
    }
    function snip(W, i) {
      var s = Math.max(0, i - 70), e = Math.min(W.length, i + 120);
      var t = W.slice(s, e).replace(/\s+/g, ' ').trim();
      return (s > 0 ? '…' : '') + t + (e < W.length ? '…' : '');
    }
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '');
      if (!/not\s+a\s+proof\s+of\s+payment/i.test(W)) continue;
      var disIdx = W.search(/not\s+a\s+proof\s+of\s+payment/i);
      var disAmts = amountsOf(W);
      if (!disAmts.length) continue;
      for (var w = Math.max(0, b - 2); w <= Math.min(blocks.length - 1, b + 2); w++) {
        var V = String(blocks[w] || '');
        var pm = /(?:\bPOP\b|proof\s+of\s+payment)[^.]{0,120}?(?:R\s?\d[\d, ]{0,14}\d(?:\.\d{2})?)|(?:paid|refund(?:ed)?)[^.]{0,80}?(?:R\s?\d[\d, ]{0,14}\d(?:\.\d{2})?)[^.]{0,60}(?:\bPOP\b|proof\s+of\s+payment)/i.exec(V);
        if (!pm) continue;
        var claimAmts = amountsOf(pm[0]);
        for (var ci = 0; ci < claimAmts.length; ci++) {
          for (var di = 0; di < disAmts.length; di++) {
            if (claimAmts[ci].val === disAmts[di].val) continue;
            findings.push({ type: 'CT02', severity: 4,
              evidence: 'An amount is presented as paid: "' + snip(V, pm.index) + '" (p. ' + (w + 1) + ') — yet the proof itself records R' + disAmts[di].amt + ' and states it is not a proof of payment: "' + snip(W, disIdx) + '" (p. ' + (b + 1) + '). A document that disclaims being proof cannot prove a different amount; what was actually paid is for the record, not the engine.',
              location: w === b ? 'Page ' + (b + 1) : 'Page ' + (w + 1) + ' vs Page ' + (b + 1) });
            ci = claimAmts.length; di = disAmts.length; // one finding per disclaimer page pair
          }
        }
      }
    }
    return findings;
  },

  D03_DETECT_DATE_INCONSISTENCY: function(textBlocks) {
    var findings = [];
    var dates = [];
    // Match various date formats
    var datePatterns = [
      /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,     // DD/MM/YYYY
      /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g,       // YYYY/MM/DD
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi
    ];
    for (var i = 0; i < textBlocks.length; i++) {
      for (var p = 0; p < datePatterns.length; p++) {
        var match;
        while ((match = datePatterns[p].exec(textBlocks[i])) !== null) {
          dates.push({ raw: match[0], page: i, idx: match.index, text: textBlocks[i].substring(Math.max(0, match.index-30), match.index+30),
            after: textBlocks[i].substring(match.index + match[0].length, match.index + match[0].length + 12) });
        }
      }
    }
    // A slash/dash/dot date is only "impossible" when it is invalid read BOTH
    // ways -- as day/month/year AND as month/day/year. A South African bundle
    // routinely mixes DD/MM (local) and MM/DD (US) conventions, so 10/18/2024
    // is a perfectly valid US date (18 October) even though it is not a valid
    // DD/MM date. Flagging it as an "invalid month" was a false positive: the
    // engine must not manufacture an impossibility out of an ambiguous format.
    // 31/02/2021 stays flagged because NEITHER reading is a real calendar date.
    var months31 = [1,3,5,7,8,10,12];
    function voDaysInMonth(m, y) {
      if (m === 2) return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28;
      return months31.indexOf(m) !== -1 ? 31 : (m >= 1 && m <= 12 ? 30 : 0);
    }
    function voValidMD(mo, dy, yr) {
      return mo >= 1 && mo <= 12 && dy >= 1 && dy <= voDaysInMonth(mo, yr);
    }
    var voSawDMY = null, voSawMDY = null; // a clearly-DD/MM and a clearly-MM/DD example
    // Identical impossible tokens are grouped: the 3 October 2026 Greensky run
    // sealed "Impossible date: 15.20.9094" FOURTEEN times (the same two tokens
    // on eight invoice pages), and fourteen copies of one observation read as
    // fourteen contradictions. One finding per distinct token, every page cited.
    var voImpRaw = [], voImpByRaw = {};
    // A case, docket or reference number shaped like a date is not a date:
    // "CAS 96/6/2026" (a SAPS case number) was sealed as "Impossible date:
    // 96/6/2026" on the AllFuels timeline report (13 September 2026).
    var VO_CASE_CUE = /\b(?:cas|case\s*(?:no|number|#)?|docket|ref(?:erence)?(?:\s*no)?|file\s*(?:no|number)|matter\s*no|our\s*ref|your\s*ref|enquiry|inquiry)\s*[:.#]?\s*$/i;
    for (var d = 0; d < dates.length; d++) {
      var dd = dates[d].raw.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
      if (!dd) continue;
      var before = String(dates[d].text || '').slice(0, Math.max(0, String(dates[d].text || '').indexOf(dates[d].raw)));
      if (VO_CASE_CUE.test(before)) continue;
      var a = parseInt(dd[1]), b = parseInt(dd[2]), year = parseInt(dd[3]);
      // A day or month of 0 is not a date anyone wrote: it is a digit OCR
      // lost ("0/09/2026" for "30/09/2026" on this platform's own seal
      // footer, 25 findings on the evidence-bundle-4 run). Not a claim of
      // the record, so not an impossible date; the OCR provenance names the
      // page for a person to read.
      if (a === 0 || b === 0) continue;
      // The year horizon applies to EVERY date reading, not only impossible
      // dates. "Application: E/2024/02/28/0001" is a reference number; its
      // 0001 tail must never establish a month/day/year convention.
      if (!voDocumentaryYearPlausible(year)) continue;
      // A date followed by a clock time in the company of a seal footer's
      // other words (hash, seal id, zone name, page marker) is the stamp. An
      // email header's or a till slip's own timestamp is the record's and
      // is still checked.
      if (VO_CLOCK_AFTER_RE.test(String(dates[d].after || '')) && voIsStampContext(textBlocks[dates[d].page], dates[d].idx, dates[d].raw.length)) continue;
      var okDMY = voValidMD(b, a, year); // day=a, month=b  (DD/MM/YYYY)
      var okMDY = voValidMD(a, b, year); // month=a, day=b  (MM/DD/YYYY)
      if (!okDMY && !okMDY) {
        // Year horizon. A dotted triplet whose "year" no document could carry
        // is not a date anyone wrote: "15.20.9094" and "15.20.9115" on the
        // Greensky customs invoices (3 October 2026 run, pp. 408-438) are
        // commodity-code tokens, and the engine sealed them as fourteen
        // "Impossible date" findings under fraud law. A date-shaped token is
        // only a date when its year field could be one (1200-2200 spans every
        // documentary horizon); an impossible day/month WITH a plausible year
        // (31/02/2021, 15.20.2025) keeps firing - that is the signature of a
        // fabricated or mistyped date, not of a part number.
        if (!voDocumentaryYearPlausible(year)) continue;
        var why = (a === 2 || b === 2) ? 'February cannot have that many days' : 'not a real calendar date';
        var impKey = dates[d].raw + '|' + why;
        if (!voImpByRaw[impKey]) { voImpByRaw[impKey] = { raw: dates[d].raw, why: why, pages: [] }; voImpRaw.push(impKey); }
        if (voImpByRaw[impKey].pages.indexOf(dates[d].page + 1) === -1) voImpByRaw[impKey].pages.push(dates[d].page + 1);
      } else {
        // Only one reading is valid -- record which convention it forces, so a
        // bundle that genuinely mixes BOTH can be noted once (below).
        if (okDMY && !okMDY && a > 12) voSawDMY = voSawDMY || dates[d]; // first field >12 -> must be DD/MM
        if (okMDY && !okDMY && b > 12) voSawMDY = voSawMDY || dates[d]; // second field >12 -> must be MM/DD
      }
    }
    // One finding per distinct impossible token, every page it appears on cited.
    for (var ik = 0; ik < voImpRaw.length; ik++) {
      var imp = voImpByRaw[voImpRaw[ik]];
      var impList = imp.pages.length > 8 ? imp.pages.slice(0, 8).join(', ') + ' and ' + (imp.pages.length - 8) + ' more' : imp.pages.join(', ');
      findings.push({ type: 'CT03', severity: 5,
        evidence: 'Impossible date: ' + imp.raw + ' (' + imp.why + ' read as day/month/year or month/day/year)' +
          (imp.pages.length > 1 ? ' — the same token appears on ' + imp.pages.length + ' pages (' + impList + ')' : ''),
        location: 'Page ' + impList, pages: imp.pages.slice() });
    }
    // A single anchored, non-overclaiming note when ONE document mixes
    // conventions. Two documents of a bundle written in two conventions are
    // two documents, not one mixed one (Combine 06 April 2026: "31/07/2016"
    // on p. 110 and "12/30/2020" on p. 147, in different documents).
    var d03Segs = voDetectDocuments(textBlocks) || [];
    var d03Key = voDocKeyOf(d03Segs, textBlocks.length);
    // One stated document, or one unnumbered run within twenty pages (a
    // schedule printed without page numbers is still one document).
    var d03SameDoc = function (pa, pb) { return pa === pb || !d03Segs.length || (d03Key(pa) === d03Key(pb) && (d03Key(pa).charAt(0) === 'd' || Math.abs(pa - pb) <= 20)); };
    if (voSawDMY && voSawMDY && d03SameDoc(voSawDMY.page, voSawMDY.page)) {
      findings.push({ type: 'CT03', severity: 2,
        evidence: 'Document mixes date formats: "' + voSawDMY.raw + '" reads as day/month/year while "' + voSawMDY.raw + '" reads as month/day/year -- numeric dates in this bundle are ambiguous; confirm the intended reading before relying on any date',
        location: 'Page ' + (voSawDMY.page + 1) + ' vs Page ' + (voSawMDY.page + 1) });
    }

    // A *labelled* date stated at two different values -- "Effective Date:
    // January 15, 2023" here, "Effective Date: March 1, 2023" there -- is the
    // date analogue of D02's restated amounts, and was previously invisible:
    // this detector only checked for impossible calendar dates. Same window
    // discipline as D02: a date belongs to a label only if it appears before
    // the next label, so a label with no date cannot borrow a neighbour's.
    var DATE_LABEL_RE = /\b(effective date|execution date|date signed|signed on|dated|date of signature|signature date|commencement date|termination date|expiry date|expiration date|invoice date|due date|closing date|notice date|meeting date|date of birth)\b/gi;
    var MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    // Month-name formats plus ISO (YYYY-MM-DD). Ambiguous day/month numeric
    // formats (DD/MM vs MM/DD) are still excluded because a false "restated
    // date" is a fabricated allegation -- but ISO is unambiguous, so a labelled
    // ISO date restated at two values is safe to flag.
    var LABELLED_DATE_RE = /\b(?:(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})|([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/;
    function normDate(m) {
      var day, mon, year;
      if (m[1]) { day = +m[1]; mon = MONTHS[m[2].slice(0, 3).toLowerCase()]; year = +m[3]; }
      else if (m[4]) { mon = MONTHS[m[4].slice(0, 3).toLowerCase()]; day = +m[5]; year = +m[6]; }
      else { year = +m[7]; mon = +m[8]; day = +m[9]; }
      if (!mon || mon < 1 || mon > 12 || day < 1 || day > 31 || !voDocumentaryYearPlausible(year)) return null;
      return { key: year * 10000 + mon * 100 + day, raw: m[0] };
    }
    var byDateLabel = {};
    for (var b = 0; b < textBlocks.length; b++) {
      var block = textBlocks[b];
      var marks = [];
      DATE_LABEL_RE.lastIndex = 0;
      var lm;
      while ((lm = DATE_LABEL_RE.exec(block)) !== null) {
        marks.push({ text: lm[0], start: lm.index, end: lm.index + lm[0].length });
      }
      for (var k = 0; k < marks.length; k++) {
        var from = marks[k].end;
        var boundary = k + 1 < marks.length ? marks[k + 1].start : block.length;
        var to = Math.min(boundary, from + 50);
        if (to <= from) continue;
        var dm = block.slice(from, to).match(LABELLED_DATE_RE);
        if (!dm) continue;
        var nd = normDate(dm);
        if (!nd) continue;
        var lab = marks[k].text.toLowerCase().replace(/\s+/g, ' ');
        if (!byDateLabel[lab]) byDateLabel[lab] = [];
        byDateLabel[lab].push({ key: nd.key, raw: nd.raw, page: b });
      }
    }
    for (var lab2 in byDateLabel) {
      if (!Object.prototype.hasOwnProperty.call(byDateLabel, lab2)) continue;
      var st = byDateLabel[lab2].slice().sort(function (x, y) { return x.key - y.key; });
      // A generic date label ("dated") carrying MANY distinct dates is an index
      // of separately-dated documents in a bundle, not one date restated -- on
      // the Louw v Moolla scan "dated" alone produced 10 false findings. A
      // genuine restatement is one labelled date given as two (occasionally
      // three) values; more than that means it is a list, so skip the group.
      var distinctD = {};
      for (var di = 0; di < st.length; di++) distinctD[st[di].key] = true;
      if (Object.keys(distinctD).length > 3) continue;
      // A GENERIC label ("dated", "signed on") may only pair values on the
      // SAME page. Across a bundle, "dated 6 April" on p.5 and "dated 30
      // April" on p.368 are two separately-dated letters, not one date
      // restated — the Greensky run reported exactly that pair as a HIGH
      // finding twice. A qualified label ("termination date", "effective
      // date") names ONE event, so it still pairs across pages; and a generic
      // label restated on one page (the p.95 termination conflict pattern)
      // still fires.
      // A label that every instrument of its kind carries ("invoice date",
      // "due date", a person's "date of birth") names one date PER instrument:
      // two invoices dated 20 January and 31 March are two invoices
      // (Combine 06 April 2026, p. 49 vs p. 680). They pair on one page only.
      var GENERIC_DATE_LABEL = { 'dated': 1, 'date signed': 1, 'signed on': 1, 'invoice date': 1, 'due date': 1, 'date of birth': 1, 'notice date': 1, 'meeting date': 1 };
      var base2 = st[0];
      var seenKeys2 = {};
      for (var q = 1; q < st.length; q++) {
        if (st[q].key === base2.key) continue;
        if (seenKeys2[st[q].key]) continue; // a repeated value is one discrepancy, not many
        if (GENERIC_DATE_LABEL[lab2] && st[q].page !== base2.page) continue;
        // An event label ("termination date") names one event of ONE
        // instrument: across the documents of a bundle it is compared only
        // inside one stated document.
        if (!d03SameDoc(base2.page, st[q].page)) continue;
        seenKeys2[st[q].key] = true;
        findings.push({ type: 'CT03', severity: 4,
          evidence: '"' + lab2 + '" is stated as ' + base2.raw + ' and as ' + st[q].raw,
          location: 'Page ' + (base2.page + 1) + ' vs Page ' + (st[q].page + 1) });
      }
    }
    return findings;
  },


  // D03B: narrative event-date conflicts. D03 needs a LABEL ("termination
  // date: X" vs "termination date: Y"); real affidavits state events
  // narratively — "... terminated by the effluxion of time on 28 February
  // 2018" (ten pages of evidence-bundle-3) versus "as on 28 February 2019,
  // the franchise agreement terminated ..." (p. 136) — the same event at two
  // dates a year apart, missed until the external review of 22 October 2026.
  // The event is identified by a RARE shared bigram (two adjacent content
  // words, frequency 2-8 among dated sentences) whose tokens are not
  // commonplace, plus topical overlap, so two different letters' ordinary
  // dates never pair. A cluster carrying more than three distinct dates is a
  // list of separately-dated events, not a restatement. Month-name and ISO
  // dates only: an ambiguous day/month numeric pair is a fabricated
  // allegation, not a finding (the D03 rule).
  D03B_DETECT_EVENT_DATE_CONFLICT: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var MONTHS2 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    // Ordinal suffixes included ("31st December 2017") — litigation prose
    // uses them heavily. Month-year dates with no day were tried and
    // rejected: "during February 2016" / "in March 2015" pair across a
    // correspondence narrative and multiplied false findings.
    var DATE_G = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})|([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/g;
    function normD(m) {
      var day, mon, year;
      if (m[1]) { day = +m[1]; mon = MONTHS2[m[2].slice(0, 3).toLowerCase()]; year = +m[3]; }
      else if (m[4]) { mon = MONTHS2[m[4].slice(0, 3).toLowerCase()]; day = +m[5]; year = +m[6]; }
      else { year = +m[7]; mon = +m[8]; day = +m[9]; }
      if (!mon || mon < 1 || mon > 12 || day < 1 || day > 31 || !voDocumentaryYearPlausible(year)) return null;
      var stamp = Date.UTC(year, mon - 1, day), chk = new Date(stamp);
      if (chk.getUTCFullYear() !== year || chk.getUTCMonth() + 1 !== mon || chk.getUTCDate() !== day) return null;
      return { key: year * 10000 + mon * 100 + day, raw: m[0], day: day };
    }
    var STOP = { the: 1, and: 1, that: 1, this: 1, with: 1, from: 1, which: 1, have: 1, has: 1, had: 1, was: 1, were: 1, are: 1, not: 1, but: 1, for: 1, said: 1, been: 1, being: 1, into: 1, upon: 1, shall: 1, will: 1, would: 1, could: 1, should: 1, must: 1, any: 1, all: 1, its: 1, his: 1, her: 1, their: 1, there: 1, here: 1, then: 1, than: 1, thus: 1, also: 1, such: 1, same: 1, more: 1, most: 1, other: 1, between: 1, under: 1, over: 1, after: 1, before: 1, each: 1, both: 1, about: 1, above: 1, against: 1, within: 1, without: 1, through: 1, during: 1, these: 1, those: 1, them: 1, they: 1, what: 1, when: 1, where: 1, while: 1, whom: 1, whose: 1, case: 1, court: 1, page: 1, paragraph: 1, annexure: 1, supra: 1, infra: 1, honourable: 1, respectfully: 1, applicant: 1, respondent: 1, deponent: 1, affidavit: 1, matter: 1, terms: 1, regard: 1, refer: 1, referred: 1, refers: 1, contents: 1, record: 1, records: 1, document: 1, documents: 1, dated: 1, date: 1, does: 1, done: 1, made: 1, make: 1, take: 1, taken: 1, give: 1, given: 1, state: 1, states: 1, stated: 1 };
    // Shared legal vocabulary does not make two matters one event. Within a
    // stated document the pair may span the document; across unnumbered runs,
    // use the same twenty-page locality guard as D03 rather than comparing an
    // early agreement with a different case hundreds of pages later.
    var d03bSegs = voDetectDocuments(blocks) || [];
    var d03bKey = voDocKeyOf(d03bSegs, blocks.length);
    var d03bSameDocument = function (pa, pb) {
      return pa === pb || (d03bKey(pa) === d03bKey(pb) && (d03bKey(pa).charAt(0) === 'd' || Math.abs(pa - pb) <= 20));
    };
    var sents = [];
    for (var b = 0; b < blocks.length; b++) {
      var raw = String(blocks[b] || '');
      // PDF text wraps mid-sentence; a bare newline is a line break, not a
      // sentence boundary. Splitting on it severed "the franchise agreement"
      // from its verb ("terminated by the effluxion of time") on
      // evidence-bundle-4 and the pair died.
      var parts = raw.split(/[.!?]+\s+/);
      for (var sp = 0; sp < parts.length; sp++) {
        var sen = parts[sp].replace(/\s+/g, ' ').trim();
        if (sen.length < 40 || sen.length > 600) continue;
        DATE_G.lastIndex = 0;
        var m, dates = [], spans = [];
        while ((m = DATE_G.exec(sen)) !== null) {
          var nd = normD(m);
          if (nd) { nd.idx = m.index; dates.push(nd); spans.push([m.index, m.index + m[0].length]); }
        }
        if (!dates.length) continue;
        var stripped = sen.toLowerCase();
        for (var rr = spans.length - 1; rr >= 0; rr--) stripped = stripped.slice(0, spans[rr][0]) + ' ' + stripped.slice(spans[rr][1]);
        var seq = stripped.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (t) { return t.length >= 4 && !STOP[t]; });
        if (seq.length < 3) continue;
        var set = {}, bigr = [];
        for (var tq = 0; tq < seq.length; tq++) set[seq[tq]] = 1;
        for (var g = 1; g < seq.length; g++) bigr.push(seq[g - 1] + ' ' + seq[g]);
        sents.push({ page: b + 1, text: sen, dates: dates, set: set, n: Object.keys(set).length, bigrams: bigr, seq: seq });
        if (sents.length > 8000) return findings; // safety valve: absurd corpus
      }
    }
    // Frequencies over dated sentences: rare bigrams of uncommon tokens.
    var df = {}, tdf = {};
    for (var i = 0; i < sents.length; i++) {
      var seenB = {}, seenT = {};
      for (var j = 0; j < sents[i].bigrams.length; j++) {
        var bg = sents[i].bigrams[j];
        if (!seenB[bg]) { seenB[bg] = 1; df[bg] = (df[bg] || 0) + 1; }
      }
      for (var tk in sents[i].set) {
        if (Object.prototype.hasOwnProperty.call(sents[i].set, tk) && !seenT[tk]) { seenT[tk] = 1; tdf[tk] = (tdf[tk] || 0) + 1; }
      }
    }
    var tokCap = Math.max(4, Math.floor(sents.length * 0.2));
    var byBigram = {};
    for (var i2 = 0; i2 < sents.length; i2++) {
      var added = {};
      for (var j2 = 0; j2 < sents[i2].bigrams.length; j2++) {
        var bg2 = sents[i2].bigrams[j2];
        if (added[bg2]) continue;
        var w = bg2.split(' ');
        if ((df[bg2] || 0) >= 2 && df[bg2] <= 20 && (tdf[w[0]] || 0) <= tokCap && (tdf[w[1]] || 0) <= tokCap) {
          added[bg2] = 1;
          (byBigram[bg2] = byBigram[bg2] || []).push(i2);
        }
      }
    }
    // Candidate conflicts, aggregated by date pair: one finding per event
    // restated at two values, every stating page cited on its own side.
    var conflicts = {};
    for (var bg3 in byBigram) {
      if (!Object.prototype.hasOwnProperty.call(byBigram, bg3)) continue;
      var group = byBigram[bg3];
      for (var a = 0; a < group.length; a++) {
        for (var c = a + 1; c < group.length; c++) {
          var A = sents[group[a]], C = sents[group[c]];
          if (!d03bSameDocument(A.page - 1, C.page - 1)) continue;
          var inter = 0;
          for (var tok in A.set) if (Object.prototype.hasOwnProperty.call(A.set, tok) && C.set[tok]) inter++;
          var union = A.n + C.n - inter;
          if (!union || inter / union < 0.2) continue;
          // Template guard: two DIFFERENT instruments recite the same legal
          // boilerplate ("commenced ... for an initial period ... expiring by
          // effluxion of time thereafter as stipulated"), which shares enough
          // bigrams to pass Jaccard while describing different events. A true
          // restatement shares a token OUTSIDE the template lexicon -- the
          // subject of the event ("the FRANCHISE AGREEMENT terminated ...").
          // Require at least one shared content token not in the lexicon.
          var TLEX = { commenced: 1, commencing: 1, initial: 1, period: 1, expiring: 1, expires: 1, expired: 1, effluxion: 1, thereafter: 1, stipulated: 1, terminated: 1, terminates: 1, terminating: 1, termination: 1, time: 1, signed: 1, executed: 1, concluded: 1, entered: 1, renewed: 1, extended: 1, effective: 1 };
          var sharedOk = 0;
          for (var tok2 in A.set) {
            if (Object.prototype.hasOwnProperty.call(A.set, tok2) && C.set[tok2] && !TLEX[tok2]) { sharedOk = 1; break; }
          }
          if (!sharedOk) continue;
          var bw3 = bg3.split(' ');
          // Unique-event guard: the shared bigram must carry a UNIQUE-event
          // verb — an agreement terminates once, a judgment is delivered
          // once — so a restatement at two dates is a true conflict.
          // Repeatable events ("attorneys sent a letter on X" / "...on Y")
          // share party names and vocabulary while describing DIFFERENT
          // letters; without this guard they flooded the findings (29 pairs
          // on evidence-bundle-4, mostly correspondence noise).
          var VERB_BG = { terminated: 1, terminates: 1, termination: 1, effluxion: 1, expires: 1, expiry: 1, expired: 1, cancelled: 1, cancellation: 1, granted: 1, awarded: 1, judgment: 1, judgement: 1, dismissed: 1, reserved: 1, delivered: 1 };
          if (!VERB_BG[bw3[0]] && !VERB_BG[bw3[1]]) continue;
          // A sentence can hold several dates ("bought in February 2003 ...
          // owned until August 2021"); only the date NEAREST the shared
          // subject belongs to the restated event. Pairing every date in
          // one sentence with every date in the other fused the tenure
          // endpoint into the acquisition conflict.
          function nearestDate(S, w0) {
            var pos = S.text.toLowerCase().indexOf(w0);
            if (pos < 0) pos = 0;
            var best = S.dates[0], bd = Infinity;
            for (var q = 0; q < S.dates.length; q++) {
              var dd = Math.abs(S.dates[q].idx - pos);
              if (dd < bd) { bd = dd; best = S.dates[q]; }
            }
            return best;
          }
          var dA = nearestDate(A, bw3[0]), dC = nearestDate(C, bw3[0]);
          var pairs = [[dA, dC]];
          for (var da = 0; da < pairs.length; da++) {
            var dc = 0;
            {
              var ka2 = pairs[da][0].key, kc2 = pairs[da][1].key;
              if (ka2 === kc2) continue;
              var lo = ka2 < kc2
                ? { d: pairs[da][0], page: A.page, text: A.text, k: ka2 }
                : { d: pairs[da][1], page: C.page, text: C.text, k: kc2 };
              var hi = ka2 < kc2
                ? { d: pairs[da][1], page: C.page, text: C.text, k: kc2 }
                : { d: pairs[da][0], page: A.page, text: A.text, k: ka2 };
              var ck = lo.k + '|' + hi.k;
              if (!conflicts[ck]) conflicts[ck] = { lo: lo.d, hi: hi.d, loPages: {}, hiPages: {}, loQuote: lo.text, hiQuote: hi.text };
              conflicts[ck].loPages[lo.page] = 1;
              conflicts[ck].hiPages[hi.page] = 1;
            }
          }
        }
      }
    }
    function plistOf(map) {
      var ps = Object.keys(map).map(Number).sort(function (x, y) { return x - y; });
      return ps.length > 8 ? ps.slice(0, 8).join(', ') + ' and ' + (ps.length - 8) + ' more' : ps.join(', ');
    }
    function snap(t) { return t.length > 180 ? t.slice(0, 177).trim() + '…' : t; }
    for (var ck2 in conflicts) {
      if (!Object.prototype.hasOwnProperty.call(conflicts, ck2)) continue;
      var cf = conflicts[ck2];
      // More than three pages on EACH side with many distinct dates was already
      // filtered by the date-pair key; a restatement pair is the finding.
      findings.push({ type: 'CT03', severity: 5,
        evidence: 'The same event is stated at two different dates: "' + snap(cf.loQuote) + '" (' + cf.lo.raw + ', p. ' + plistOf(cf.loPages) + ') versus "' + snap(cf.hiQuote) + '" (' + cf.hi.raw + ', p. ' + plistOf(cf.hiPages) + '). One event cannot carry both dates; which date is true is for the record, not the engine.',
        location: 'Page ' + plistOf(cf.loPages) + ' vs Page ' + plistOf(cf.hiPages) });
    }
    return findings;
  },

  // D03C: term arithmetic. The All Fuels letter of 1 September 2017 (master
  // pp. 383-385) grants "a franchise license ... for a period of 15 (fifteen)
  // years" over an agreement "dated 01 March 2013" and then states the same
  // agreement "finally terminates by the effluxion of time at midnight (00h00)
  // on the 28 February 2018" — five years, not fifteen. A start date, a
  // stated term and a stated end date form a sum the engine can check;
  // anchors must sit close together (one letter, one clause set), day-first
  // month-name dates only (the D03 rule: no fabricated allegation), and a
  // 60-day tolerance absorbs expiry-at-midnight phrasing.
  D03C_DETECT_TERM_ARITHMETIC: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var MONTHS3 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    var FDATE_G = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g;
    function normF(m) {
      var day = +m[1], mon = MONTHS3[m[2].slice(0, 3).toLowerCase()], year = +m[3];
      if (!mon || day < 1 || day > 31) return null;
      var stamp = Date.UTC(year, mon - 1, day), chk = new Date(stamp);
      if (chk.getUTCFullYear() !== year || chk.getUTCMonth() + 1 !== mon || chk.getUTCDate() !== day) return null;
      return { stamp: stamp, raw: m[0] };
    }
    function dateAfter(W, fromIdx, within) {
      FDATE_G.lastIndex = fromIdx;
      var m = FDATE_G.exec(W);
      if (m && m.index - fromIdx <= within) { var d = normF(m); if (d) { d.idx = m.index; return d; } }
      return null;
    }
    var TERM_G = /period of (\d{1,2})\s*(?:\([a-z]+\))?\s*years\b/gi;
    var START_G = /(?:agreement|contract|franchise agreement)\s+dated\s+/gi;
    var END_G = /\b(?:finally\s+)?(?:terminates?|expiry|expires?|expiring)\b/gi;
    var DAYMS = 86400000;
    function snip(W, i) {
      var s = Math.max(0, i - 60), e = Math.min(W.length, i + 120);
      var t = W.slice(s, e).replace(/\s+/g, ' ').trim();
      return (s > 0 ? '…' : '') + t + (e < W.length ? '…' : '');
    }
    var seen = {};
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '') + ' ' + String(blocks[b + 1] || '');
      if (W.length > 20000) W = W.slice(0, 20000);
      var terms = [], mT;
      TERM_G.lastIndex = 0;
      while ((mT = TERM_G.exec(W)) !== null) {
        var yrs = +mT[1];
        if (yrs >= 1 && yrs <= 99) terms.push({ years: yrs, idx: mT.index });
      }
      if (!terms.length) continue;
      var starts = [], mS;
      START_G.lastIndex = 0;
      while ((mS = START_G.exec(W)) !== null) {
        var sd = dateAfter(W, START_G.lastIndex, 40);
        if (sd) starts.push({ d: sd, idx: mS.index });
      }
      var ends = [], mE;
      END_G.lastIndex = 0;
      while ((mE = END_G.exec(W)) !== null) {
        var ed = dateAfter(W, END_G.lastIndex, 160);
        if (ed) ends.push({ d: ed, idx: mE.index });
      }
      if (!starts.length || !ends.length) continue;
      for (var ti = 0; ti < terms.length; ti++) {
        for (var si = 0; si < starts.length; si++) {
          if (Math.abs(terms[ti].idx - starts[si].idx) > 450) continue;
          for (var ei = 0; ei < ends.length; ei++) {
            if (Math.abs(ends[ei].idx - starts[si].idx) > 600) continue;
            var expected = starts[si].d.stamp + terms[ti].years * 365.25 * DAYMS;
            var diffDays = Math.abs(ends[ei].d.stamp - expected) / DAYMS;
            if (diffDays <= 60) continue;
            var ck = terms[ti].years + '|' + starts[si].d.stamp + '|' + ends[ei].d.stamp;
            if (seen[ck]) continue;
            seen[ck] = 1;
            var exp = new Date(expected);
            var expStr = exp.getUTCDate() + ' ' + ['January','February','March','April','May','June','July','August','September','October','November','December'][exp.getUTCMonth()] + ' ' + exp.getUTCFullYear();
            var onePage = ends[ei].idx < blocks[b].length && starts[si].idx < blocks[b].length && terms[ti].idx < blocks[b].length;
            findings.push({ type: 'CT03', severity: 5,
              evidence: 'The agreement is dated ' + starts[si].d.raw + ' ("' + snip(W, starts[si].idx) + '") with a stated period of ' + terms[ti].years + ' years ("' + snip(W, terms[ti].idx) + '"), yet the record states it ends on ' + ends[ei].d.raw + ' ("' + snip(W, ends[ei].idx) + '"). ' + terms[ti].years + ' years from ' + starts[si].d.raw + ' runs to about ' + expStr + ', not ' + ends[ei].d.raw + '. Which figure governs is for the record, not the engine.',
              location: onePage ? 'Page ' + (b + 1) : 'Pages ' + (b + 1) + '-' + (b + 2) });
          }
        }
      }
    }
    return findings;
  },

  // D04B: a document that predates its own contents. The Marius-folder
  // schedule (item 9): Annexure L is dated 13 April 2025 on its cover yet
  // records a "Structural Repair Date: 21 April 2025" inside — a report
  // finalised on the 13th cannot record an accomplished repair dated the
  // 21st. Only LABELLED completion-type dates count ("Repair Date:",
  // "Completion Date:" ...), so a report legitimately referencing a future
  // hearing or deadline is not flagged.
  D04B_DETECT_DOCUMENT_PREDATES_CONTENT: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var MONTHS4 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    var DAY_RE = '(\\d{1,2})(?:st|nd|rd|th)?\\s+([A-Za-z]{3,9})\\.?,?\\s+(\\d{4})';
    function normG(day, monS, year) {
      var mon = MONTHS4[monS.slice(0, 3).toLowerCase()];
      if (!mon) return null;
      var stamp = Date.UTC(+year, mon - 1, +day), chk = new Date(stamp);
      if (chk.getUTCFullYear() !== +year || chk.getUTCMonth() + 1 !== mon || chk.getUTCDate() !== +day) return null;
      return stamp;
    }
    // The document's own date: a labelled "Date:" on one of the first two
    // pages (cover conventions), month-name dates only (the D03 rule).
    var COVER_RE = new RegExp('\\bDate:\\s*' + DAY_RE);
    var docStamp = null, docRaw = '', docPage = 0;
    for (var b = 0; b < Math.min(2, blocks.length); b++) {
      var cm = COVER_RE.exec(String(blocks[b] || ''));
      if (cm) {
        var st = normG(cm[1], cm[2], cm[3]);
        if (st) { docStamp = st; docRaw = cm[1] + ' ' + cm[2] + ' ' + cm[3]; docPage = b + 1; break; }
      }
    }
    if (docStamp === null) return findings;
    var INNER_G = new RegExp('(?:structural\\s+repair|repair|completion|completed|finalised|finalized|revised|updated|signature)\\s+date[:\\s]+' + DAY_RE, 'gi');
    for (var b2 = 0; b2 < blocks.length; b2++) {
      var W = String(blocks[b2] || '');
      INNER_G.lastIndex = 0;
      var m;
      while ((m = INNER_G.exec(W)) !== null) {
        var ist = normG(m[1], m[2], m[3]);
        if (!ist || ist <= docStamp) continue;
        var raw = m[1] + ' ' + m[2] + ' ' + m[3];
        var s = Math.max(0, m.index - 60), e = Math.min(W.length, m.index + m[0].length + 60);
        findings.push({ type: 'CT04', severity: 5,
          evidence: 'The document is dated ' + docRaw + ' (p. ' + docPage + ') yet records an accomplished fact dated later: "' + W.slice(s, e).replace(/\s+/g, ' ').trim() + '" (' + raw + ', p. ' + (b2 + 1) + '). A document finalised on ' + docRaw + ' cannot record as done something dated ' + raw + '. Which date is true is for the record, not the engine.',
          location: 'Page ' + docPage + ' vs Page ' + (b2 + 1) });
      }
    }
    return findings;
  },

  // D01B: theft vs scam. The camera case: the record carries "the theft
  // case against you ... will continue" and "the camera was stolen" beside
  // "you tried to sell the camera ... and got conned" and "lost in a
  // courier scam, not stolen". A taking with intent to deprive and a
  // disclosed sale that ended in a scam are different events; the record
  // cannot carry both characterisations of the same property.
  D01B_DETECT_THEFT_VS_SCAM_CHARACTERISATION: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var THEFT_G = /\b(?:theft|stolen|stealing)\b/gi;
    var SCAM_G = /\b(?:scam(?:med)?|conned)\b/gi;
    var theft = [], scam = [];
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '');
      var m;
      THEFT_G.lastIndex = 0;
      while ((m = THEFT_G.exec(W)) !== null) {
        if (voNegatedBefore(W, m.index)) continue; // "not stolen" alleges no theft
        theft.push({ page: b + 1, idx: m.index, quote: (voSentenceAround(W, m[0]) || m[0]).replace(/\s+/g, ' ').trim() });
      }
      SCAM_G.lastIndex = 0;
      while ((m = SCAM_G.exec(W)) !== null) {
        if (voNegatedBefore(W, m.index)) continue;
        scam.push({ page: b + 1, idx: m.index, quote: (voSentenceAround(W, m[0]) || m[0]).replace(/\s+/g, ' ').trim() });
      }
    }
    var tsPair = null;
    for (var ti = 0; ti < theft.length && !tsPair; ti++) {
      for (var si = 0; si < scam.length; si++) {
        // One sentence ("lost in a courier scam, not stolen") is one position,
        // not two opposing statements. Separate events need separate passages.
        if (theft[ti].page !== scam[si].page || Math.abs(theft[ti].idx - scam[si].idx) > 400) {
          tsPair = { theft: theft[ti], scam: scam[si] }; break;
        }
      }
    }
    if (tsPair) {
      var tp = [], sp = [], i;
      for (i = 0; i < theft.length; i++) if (tp.indexOf(theft[i].page) < 0) tp.push(theft[i].page);
      for (i = 0; i < scam.length; i++) if (sp.indexOf(scam[i].page) < 0) sp.push(scam[i].page);
      findings.push({ type: 'CT01', severity: 4,
        evidence: 'The record characterises the same property event in two incompatible ways: as theft ("' + tsPair.theft.quote + '", p. ' + tsPair.theft.page + (tp.length > 1 ? '; also p. ' + tp.slice(1).join(', ') : '') + ') and as a scam in which the seller was deceived ("' + tsPair.scam.quote + '", p. ' + tsPair.scam.page + (sp.length > 1 ? '; also p. ' + sp.slice(1).join(', ') : '') + '). Theft requires an intention to deprive; a disclosed attempted sale ending in a scam records the opposite. Which characterisation is true is for the record, not the engine.',
        location: 'Pages ' + tp.join(', ') + ' vs Pages ' + sp.join(', ') });
    }
    return findings;
  },

  // D01C: denial then admission of the same transaction. The camera case
  // and the Greensky file: "there were no sales" / "we never invoiced at
  // all" beside "Kevin's Export proceeded with the deal". Both positions must
  // be direct: a narrator's report of someone else's denial is not paired with
  // a third party's conduct as if one actor had contradicted himself.
  D01C_DETECT_DENIAL_ADMISSION_PAIR: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var DENY_G = /\b(?:there were no sales|no sales were (?:made|recorded)|never invoiced|nothing was sold|the deal fell through|the deal did not happen|the deal didn't happen|order (?:did not|didn't) happen)\b/gi;
    var ADMIT_G = /\b(?:proceeded with the deal|the deal happened|the deal went ahead|sale was made|sales were made|invoiced and exported)\b/gi;
    var denials = [], admissions = [];
    function reportedPosition(W, idx, quote) {
      // Generic speaker attribution only — never a party-name list. An express
      // quotation remains reviewable; narrative attribution is not a direct
      // statement by the person whose conduct is reported.
      if (/["“]/.test(quote)) return false;
      var before = W.slice(Math.max(0, idx - 100), idx);
      return /\b(?:[\w'’-]+\s+){1,3}(?:told\s+me|said|claimed|alleged|stated)\b[^.;]{0,90}$/i.test(before);
    }
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '');
      var m;
      DENY_G.lastIndex = 0;
      while ((m = DENY_G.exec(W)) !== null) {
        // A narrator's report that someone else denied a transaction is not
        // paired with a third party's conduct as if one actor contradicted himself.
        var denialQuote = (voSentenceAround(W, m[0]) || m[0]).replace(/\s+/g, ' ').trim();
        if (reportedPosition(W, m.index, denialQuote)) continue;
        denials.push({ page: b + 1, quote: denialQuote });
      }
      ADMIT_G.lastIndex = 0;
      while ((m = ADMIT_G.exec(W)) !== null) {
        // The admission must be direct too: both sides of this pair need the
        // same source-quality discipline.
        var admissionQuote = (voSentenceAround(W, m[0]) || m[0]).replace(/\s+/g, ' ').trim();
        if (reportedPosition(W, m.index, admissionQuote)) continue;
        admissions.push({ page: b + 1, quote: admissionQuote });
      }
    }
    if (denials.length && admissions.length) {
      var dn = denials[0], ad = admissions[0];
      for (var di = 0; di < denials.length; di++) for (var ai = 0; ai < admissions.length; ai++) {
        if (denials[di].page !== admissions[ai].page) { dn = denials[di]; ad = admissions[ai]; break; }
      }
      findings.push({ type: 'CT01', severity: 4,
        evidence: 'The record carries both a denial of the transaction ("' + dn.quote + '", p. ' + dn.page + ') and an admission that it went ahead ("' + ad.quote + '", p. ' + ad.page + '). A transaction that never happened cannot later be admitted to have proceeded; which statement was true when made is for the record, not the engine.',
        location: 'Page ' + dn.page + ' vs Page ' + ad.page });
    }
    return findings;
  },

  // D04C: competing meeting accounts. The camera case: "refused to attend a
  // meeting I had requested" / "refused to meet and blocked" sit in the
  // same record as "I've asked quite a few times to have a meeting with
  // you" and "I requested a meeting on March 9th". Private/group meetings
  // and different periods require review; this is a tension, not an impossibility.
  D04C_DETECT_MEETING_REQUEST_REFUSAL_REVERSAL: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var REFUSE_G = /\brefused to (?:attend|meet)|refus(?:ed|ing) (?:my|the|a) meeting/gi;
    var REQUEST_G = /\b(?:asked|asking|requested|request)(?:[^.]{0,60}?)(?:a\s+)?(?:private\s+|personal\s+)?meeting|meeting[^.]{0,40}\b(?:request|asked)\b/gi;
    var refusals = [], requests = [];
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '');
      var m;
      REFUSE_G.lastIndex = 0;
      while ((m = REFUSE_G.exec(W)) !== null) refusals.push({ page: b + 1, idx: m.index, quote: W.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80).replace(/\s+/g, ' ').trim() });
      REQUEST_G.lastIndex = 0;
      while ((m = REQUEST_G.exec(W)) !== null) requests.push({ page: b + 1, idx: m.index, quote: W.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80).replace(/\s+/g, ' ').trim() });
    }
    // A single sentence like "he refused the meeting I requested" is one
    // event, not a reversal: require a refusal and a request that are not
    // the same passage.
    var pair = null;
    for (var i = 0; i < refusals.length && !pair; i++) {
      for (var j = 0; j < requests.length && !pair; j++) {
        if (refusals[i].page !== requests[j].page || Math.abs(refusals[i].idx - requests[j].idx) > 400) pair = { r: refusals[i], q: requests[j] };
      }
    }
    if (pair) {
      findings.push({ type: 'CT01', severity: 4, meetingDispute: true,
        evidence: 'The record carries an accusation that a meeting was refused ("' + pair.r.quote + '", p. ' + pair.r.page + ') and statements that meetings were requested and went unanswered ("' + pair.q.quote + '", p. ' + pair.q.page + '). These accounts require review of whether they concern the same meeting, a private or group meeting, and the same period; they do not by themselves establish a direct contradiction.',
        location: 'Page ' + pair.r.page + ' vs Page ' + pair.q.page });
    }
    return findings;
  },

  // D06B: same asset, two owners. The camera case: Marius's message calls
  // it "my camera, valued at approximately R7,000" while the same record
  // styles it the "Greensky Ornamentals camera" and "property belonging to
  // Greensky ...". One asset cannot be both a party's personal property
  // and the company's.
  D06B_DETECT_OWNERSHIP_ATTRIBUTION_CONFLICT: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var STOPN = { name: 1, account: 1, email: 1, emails: 1, phone: 1, signature: 1, opinion: 1, understanding: 1, recollection: 1, statement: 1, affidavit: 1, client: 1, attorney: 1, attorneys: 1, lawyer: 1, wife: 1, girlfriend: 1, husband: 1, partner: 1, brother: 1, sister: 1, mother: 1, father: 1, son: 1, daughter: 1, friend: 1, colleague: 1, time: 1, life: 1, mind: 1, view: 1, position: 1, case: 1, matter: 1, side: 1, word: 1, words: 1, hands: 1, way: 1, part: 1, share: 1, shares: 1, exit: 1, salary: 1, drawing: 1, drawings: 1, dad: 1, attention: 1, knowledge: 1, behalf: 1, own: 1, response: 1, reply: 1, input: 1, request: 1, company: 1, business: 1, complaint: 1, contentions: 1, submissions: 1, papers: 1, pleadings: 1, version: 1, application: 1, opposition: 1, evidence: 1, defence: 1, defense: 1, argument: 1, story: 1, authority: 1, capacity: 1, mandate: 1,
      // Court-process and document nouns can never be possessable ASSETS —
      // "my rescission" vs "the Constitutional Court rescission" is not two
      // owners of one asset (LPC complaint bundle, 31 Oct 2026 live run).
      rescission: 1, proceedings: 1, proceeding: 1, referral: 1, arbitration: 1, litigation: 1, action: 1, counterclaim: 1, summons: 1, plea: 1, replication: 1, rejoinder: 1, surrejoinder: 1, judgment: 1, judgement: 1, order: 1, appeal: 1, condonation: 1, interdict: 1, mediation: 1, motion: 1, hearing: 1, trial: 1, discovery: 1, subpoena: 1, notice: 1, report: 1, document: 1, letter: 1,
      // Communications and legal acts are not ownable physical assets. The
      // Greensky run paired "my message" with a CIPC disclaimer and "my
      // resignation" with a company-secretary narrative as two asset owners.
      message: 1, call: 1, text: 1, sms: 1, voicemail: 1, conversation: 1, correspondence: 1,
      resignation: 1, decision: 1, dismissal: 1, termination: 1, appointment: 1,
      demand: 1, instruction: 1, confirmation: 1, approval: 1,
      claim: 1, submission: 1 };
    // A possessable asset is a concrete noun: not an -ing form, not a plural.
    function isAsset(a) { return !STOPN[a] && !/ing$/.test(a) && !/s$/.test(a); }
    var MY_G = /\bmy\s+([a-z][a-z-]{2,20})\b/g;
    var ENT_G = /\b([A-Z][A-Za-z&]+(?:\s+[A-Z][A-Za-z&]+){1,3})\s+([a-z][a-z-]{2,20})\b/g;
    var personal = {}, entity = {};
    function add(map, asset, rec) { (map[asset] = map[asset] || []).push(rec); }
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '');
      var m;
      MY_G.lastIndex = 0;
      while ((m = MY_G.exec(W)) !== null) {
        var a = m[1].toLowerCase();
        if (!isAsset(a)) continue;
        add(personal, a, { page: b + 1, quote: W.slice(Math.max(0, m.index - 70), m.index + m[0].length + 70).replace(/\s+/g, ' ').trim() });
      }
      ENT_G.lastIndex = 0;
      while ((m = ENT_G.exec(W)) !== null) {
        var a2 = m[2].toLowerCase();
        if (!isAsset(a2)) continue;
        add(entity, a2, { page: b + 1, ent: m[1], quote: W.slice(Math.max(0, m.index - 70), m.index + m[0].length + 70).replace(/\s+/g, ' ').trim() });
      }
    }
    for (var asset in personal) {
      if (!Object.prototype.hasOwnProperty.call(personal, asset) || !entity[asset]) continue;
      var P = personal[asset][0], Erec = entity[asset][0];
      findings.push({ type: 'CT06', severity: 4,
        evidence: 'The same asset ("' + asset + '") is claimed as personal property ("' + P.quote + '", p. ' + P.page + ') and attributed to an entity ("' + Erec.quote + '" — ' + Erec.ent + ', p. ' + Erec.page + '). One asset cannot be both a party\'s personal property and the entity\'s; whose it is — and what the invoice shows — is for the record, not the engine.',
        location: 'Page ' + P.page + ' vs Page ' + Erec.page });
    }
    return findings;
  },

  // ---- BATCH 5: shapes from the defamation record (case 2026-179949) -------
  // Each detector below is anchored to a real instance in the sealed record
  // (LH19 schedule / LH30 narrative / evidence schedule A7-A10 / the two
  // firms' letters of 7 and 9 July 2026) and is worded as an observation of
  // the record, never a conclusion of law.

  // D02D: billed for a period after the record says it ended. The narrative
  // pleads the lease ended 31 July 2026, yet INV98185 charges "Damages
  // October 2026" and INV68876/INV68913 charge August 2026; 87 months of
  // rent are claimed after the purported expiry. A charge for a period after
  // the claimed end is either an admission that it had not ended or a charge
  // that should not exist — which it is, is for the record, not the engine.
  // Codex review (PR #266): pair an end with a charge only when their
  // contexts share a distinguishing token — in a bundle spanning two matters,
  // Site A's lease ending in July must not pair with Site B's October rental.
  D02D_DETECT_BILLING_AFTER_CLAIMED_END: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    var MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    var END_G = /\b(?:lease|tenancy|agreement|contract|occupation|employment|mandate|engagement|appointment|supply|membership)\b[^.\n]{0,200}?\b(?:terminated|came to an end|ended|expired|lapsed|cancelled|canceled|ceased)\b[^.\n]{0,120}?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi;
    // Occupation is a possession period, not itself a monetary charge. Only
    // an actual billing/charge noun can found a post-termination billing lead.
    var CHARGE_G = /\b(?:rent|rental|invoice|damages|levy|instalment|installment|fee|charge)s?\b[^.\n]{0,80}?\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi;
    // Distinguishing tokens only: party, site and instrument names. The
    // generic vocabulary of ends and charges (agreement, invoice, payment…)
    // is shared by EVERY matter in a bundle, so it cannot pair them.
    var STOPW = { lease: 1, tenancy: 1, agreement: 1, contract: 1, occupation: 1, employment: 1, mandate: 1, engagement: 1, appointment: 1, supply: 1, membership: 1, terminated: 1, ended: 1, expired: 1, lapsed: 1, cancelled: 1, canceled: 1, ceased: 1, invoice: 1, rental: 1, damages: 1, instalment: 1, installment: 1, charge: 1, charges: 1, payment: 1, payable: 1, amount: 1, period: 1, between: 1, parties: 1, plaintiff: 1, defendant: 1, respondent: 1, applicant: 1, effluxion: 1, pleaded: 1, particulars: 1, within: 1, presentation: 1, october: 1, january: 1, february: 1, march: 1, april: 1, june: 1, july: 1, august: 1, september: 1, november: 1, december: 1 };
    function ctxOf(W, i) {
      var win = W.slice(Math.max(0, i - 250), i + 250).toLowerCase().replace(/[^a-z\s]/g, ' ');
      var toks = win.split(/\s+/), ctx = {};
      for (var ti = 0; ti < toks.length; ti++) if (toks[ti].length >= 5 && !STOPW[toks[ti]]) ctx[toks[ti]] = 1;
      return ctx;
    }
    function snip(W, i) {
      var s = Math.max(0, i - 60), e = Math.min(W.length, i + 110);
      var t = W.slice(s, e).replace(/\s+/g, ' ').trim();
      return (s > 0 ? '…' : '') + t + (e < W.length ? '…' : '');
    }
    var ends = [], charges = [];
    for (var b = 0; b < blocks.length; b++) {
      var W = String(blocks[b] || '');
      var m;
      END_G.lastIndex = 0;
      while ((m = END_G.exec(W)) !== null) {
        ends.push({ key: parseInt(m[3], 10) * 12 + MONTHS[m[2].toLowerCase()], raw: m[1] + ' ' + m[2] + ' ' + m[3], page: b + 1, quote: snip(W, m.index), ctx: ctxOf(W, m.index) });
      }
      CHARGE_G.lastIndex = 0;
      while ((m = CHARGE_G.exec(W)) !== null) {
        // A month preceded by a day number is a full date ("from 7 July
        // 2026"), not a billing period — mora interest and dated events are
        // not period charges.
        var pre = m[0].slice(0, m[0].length - m[0].match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i)[0].length);
        if (/\d\s*$/.test(pre)) continue;
        charges.push({ key: parseInt(m[2], 10) * 12 + MONTHS[m[1].toLowerCase()], raw: m[1] + ' ' + m[2], page: b + 1, quote: snip(W, m.index), ctx: ctxOf(W, m.index) });
      }
    }
    var seen = {};
    for (var e = 0; e < ends.length; e++) {
      for (var c = 0; c < charges.length; c++) {
        if (charges[c].key <= ends[e].key) continue;
        var shared = 0;
