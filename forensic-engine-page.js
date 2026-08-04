// ============== FORENSIC CONTRADICTION ENGINE v5.3.5-web ================
// 43 Contradiction Types | 37 Detectors | 17 Serial Patterns
// ========================================================================


// ========================================================================
// VERUM OMNIS FORENSIC CONTRADICTION ENGINE v5.3.5-web
// 43 Contradiction Types | 37 Detectors | 17 Serial Patterns
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
var VO_ENGINE_VERSION = '5.3.5-web';

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
var VO_SEAL_BOILERPLATE_RE = /VERUM\s+OMNIS\s+SEALED\s+ORIGINAL|PRIVATE\s+SEAL(?:\s*[-\u2013\u2014]+\s*FREE\s+TIER)?|VERIFY\s+SEAL|verumglobal\.foundation|OpenTimestamps|Patent\s+Pending|Africa\/Johannesburg|AI\s+FORENSICS\s+FOR\s+TRUTH|Founder,?\s+Verum\s+Omnis|\bVerum\s+Omnis\b|\bSeal:\s*|\bUTC\b|\bFREE\s+TIER\b/gi;
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
    severity: 5, category: 'STATEMENTAL',
    example: '"Payment was made on 15 March" vs "No payment was ever made"'
  },
  CT02_NUMERICAL_DISCREPANCY: {
    id: 'CT02', name: 'Numerical Discrepancy',
    desc: 'Numbers, amounts, or quantities do not match across the document',
    severity: 4, category: 'STATEMENTAL',
    example: 'Invoice total R50,000 but supporting docs show R45,000'
  },
  CT03_DATE_INCONSISTENCY: {
    id: 'CT03', name: 'Date Inconsistency',
    desc: 'Dates, timestamps, or chronological references conflict',
    severity: 5, category: 'STATEMENTAL',
    example: 'Contract dated 2024-01-15 references an event from 2024-03-20'
  },
  CT04_TEMPORAL_SEQUENCE_BREAK: {
    id: 'CT04', name: 'Temporal Sequence Break',
    desc: 'Events are described in an impossible chronological order',
    severity: 4, category: 'STATEMENTAL',
    example: 'Document claims discovery happened before the incident occurred'
  },
  CT05_CAUSAL_IMPOSSIBILITY: {
    id: 'CT05', name: 'Causal Impossibility',
    desc: 'A claimed cause could not have produced the stated effect',
    severity: 3, category: 'STATEMENTAL',
    example: 'Email claims response was sent before the original was received'
  },
  CT06_LOGICAL_IMPOSSIBILITY: {
    id: 'CT06', name: 'Logical Impossibility',
    desc: 'The document asserts something that is logically impossible',
    severity: 5, category: 'STATEMENTAL',
    example: 'Entity claims to be both registered and deregistered simultaneously'
  },
  CT07_SCOPE_CREEP: {
    id: 'CT07', name: 'Scope Creep Indicator',
    desc: 'Document scope expands beyond original stated boundaries',
    severity: 2, category: 'STATEMENTAL',
    example: 'Quote for kitchen renovation includes pool construction'
  },
  CT08_TERM_DEFINITION_CONFLICT: {
    id: 'CT08', name: 'Term Definition Contradiction',
    desc: 'Key terms are defined differently in different sections',
    severity: 3, category: 'STATEMENTAL',
    example: '"Net profit" defined one way in section 2, another in section 8'
  },

  // === CATEGORY 2: IDENTITY CONTRADICTIONS (9-14) ===
  // Conflicts involving people, entities, roles, or identities

  CT09_IDENTITY_CONTRADICTION: {
    id: 'CT09', name: 'Identity Contradiction',
    desc: 'The same person/entity is described with conflicting attributes',
    severity: 5, category: 'IDENTITY',
    example: 'Director listed as John Smith (ID 760101) and John Smit (ID 850202)'
  },
  CT10_ROLE_CONTRADICTION: {
    id: 'CT10', name: 'Role Contradiction',
    desc: 'Person acts in a capacity they do not hold',
    severity: 4, category: 'IDENTITY',
    example: 'Person signs as "Managing Director" but company records show different MD'
  },
  CT11_AUTHORITY_CONTRADICTION: {
    id: 'CT11', name: 'Authority Contradiction',
    desc: 'Action taken exceeds stated authority or delegation',
    severity: 5, category: 'IDENTITY',
    example: 'Junior employee approves R5 million expenditure without authorization'
  },
  CT12_NAME_SPELLING_VARIATION: {
    id: 'CT12', name: 'Name Spelling Variation',
    desc: 'Same entity/person spelled differently across document',
    severity: 2, category: 'IDENTITY',
    example: '"Johannes van der Merwe" vs "Johannes van der Merve"'
  },
  CT13_TITLE_INCONSISTENCY: {
    id: 'CT13', name: 'Title Inconsistency',
    desc: 'Professional titles, ranks, or designations do not match',
    severity: 2, category: 'IDENTITY',
    example: 'Signatory titled "Dr" in one section, "Mr" in another'
  },
  CT14_ENTITY_STATUS_CONFLICT: {
    id: 'CT14', name: 'Entity Status Contradiction',
    desc: 'Organization claimed status does not match reality',
    severity: 5, category: 'IDENTITY',
    example: 'Company claims "registered and active" but CIPC shows deregistered'
  },

  // === CATEGORY 3: FINANCIAL CONTRADICTIONS (15-22) ===
  // Monetary, accounting, and financial inconsistencies

  CT15_AMOUNT_DISCREPANCY: {
    id: 'CT15', name: 'Amount Discrepancy',
    desc: 'Financial amounts do not reconcile across the document',
    severity: 5, category: 'FINANCIAL',
    example: 'Subtotal R100,000 + VAT R15,000 = Total R120,000 (should be R115,000)'
  },
  CT16_CURRENCY_MISMATCH: {
    id: 'CT16', name: 'Currency Mismatch',
    desc: 'Currency conversions or references are inconsistent',
    severity: 4, category: 'FINANCIAL',
    example: 'Contract in USD but invoice in ZAR without conversion rate'
  },
  CT17_ACCOUNT_NUMBER_INVALID: {
    id: 'CT17', name: 'Account Number Invalidity',
    desc: 'Bank account numbers fail validation or are inconsistent',
    severity: 5, category: 'FINANCIAL',
    example: 'Bank account number changes between pages of same document'
  },
  CT18_BANK_DETAIL_MISMATCH: {
    id: 'CT18', name: 'Bank Detail Mismatch',
    desc: 'Banking details conflict with known or stated information',
    severity: 5, category: 'FINANCIAL',
    example: 'Payment instruction to Bank A but company normally uses Bank B'
  },
  CT19_VAT_NUMBER_INVALID: {
    id: 'CT19', name: 'VAT Number Invalid',
    desc: 'VAT number fails checksum validation or is inconsistent',
    severity: 4, category: 'FINANCIAL',
    example: 'VAT number 4120245773 fails mod-97 check (South Africa)'
  },
  CT20_REGISTRATION_NUMBER_FAKE: {
    id: 'CT20', name: 'Registration Number Fake',
    desc: 'Company or entity registration number is invalid or fabricated',
    severity: 5, category: 'FINANCIAL',
    example: 'CIPC registration number does not match entity name'
  },
  CT21_QUOTATION_MISMATCH: {
    id: 'CT21', name: 'Quotation Mismatch',
    desc: 'Quoted terms, prices, or conditions differ from final document',
    severity: 3, category: 'FINANCIAL',
    example: 'Quote states 30-day payment but invoice demands immediate payment'
  },
  CT22_FINANCIAL_CALCULATION_ERROR: {
    id: 'CT22', name: 'Financial Calculation Error',
    desc: 'Mathematical calculations in financial sections are incorrect',
    severity: 4, category: 'FINANCIAL',
    example: 'VAT calculated at 20% when standard rate is 15%'
  },

  // === CATEGORY 4: DOCUMENT INTEGRITY CONTRADICTIONS (23-30) ===
  // Physical and digital document manipulation indicators

  CT23_SIGNATURE_MISMATCH: {
    id: 'CT23', name: 'Signature Mismatch',
    desc: 'Signature does not match known specimen or appears forged',
    severity: 5, category: 'INTEGRITY',
    example: 'Signature on page 1 visibly different from signature on page 5'
  },
  CT24_METADATA_CONTRADICTION: {
    id: 'CT24', name: 'Metadata Contradiction',
    desc: 'PDF metadata conflicts with document content or claims',
    severity: 4, category: 'INTEGRITY',
    example: 'Document claims created 2024-01-01 but metadata shows 2024-06-15'
  },
  CT25_FONT_INCONSISTENCY: {
    id: 'CT25', name: 'Font Inconsistency',
    desc: 'Different fonts used where consistency is expected',
    severity: 3, category: 'INTEGRITY',
    example: 'Body text uses Arial on some pages, Times New Roman on others'
  },
  CT26_FORMAT_ANOMALY: {
    id: 'CT26', name: 'Format Anomaly',
    desc: 'Document formatting suggests editing or manipulation',
    severity: 3, category: 'INTEGRITY',
    example: 'Margins, headers, or page numbering change mid-document'
  },
  CT27_LAYOUT_MANIPULATION: {
    id: 'CT27', name: 'Layout Manipulation',
    desc: 'Page layout suggests content was added, removed, or rearranged',
    severity: 4, category: 'INTEGRITY',
    example: 'Page 3 has different header/footer suggesting inserted page'
  },
  CT28_IMAGE_INTEGRITY_FAILURE: {
    id: 'CT28', name: 'Image Integrity Failure',
    desc: 'Embedded images show signs of manipulation or replacement',
    severity: 4, category: 'INTEGRITY',
    example: 'Logo image has different compression than surrounding content'
  },
  CT29_TIMESTAMP_MANIPULATION: {
    id: 'CT29', name: 'Timestamp Manipulation',
    desc: 'Document timestamps are inconsistent or impossible',
    severity: 5, category: 'INTEGRITY',
    example: 'Document modification time precedes creation time'
  },
  CT30_VERSION_CONTROL_ANOMALY: {
    id: 'CT30', name: 'Version Control Anomaly',
    desc: 'Document version tracking is inconsistent or absent',
    severity: 2, category: 'INTEGRITY',
    example: 'Page footer says "Version 3" but header says "Version 1"'
  },

  // === CATEGORY 5: CROSS-REFERENCE CONTRADICTIONS (31-35) ===
  // Failures in internal and external document references

  CT31_CROSS_REFERENCE_FAILURE: {
    id: 'CT31', name: 'Cross-Reference Failure',
    desc: 'Referenced sections, clauses, or documents do not exist or conflict',
    severity: 3, category: 'CROSS_REF',
    example: '"See Appendix A" but no Appendix A exists in document'
  },
  CT32_SOURCE_ATTRIBUTION_FAILURE: {
    id: 'CT32', name: 'Source Attribution Failure',
    desc: 'Cited sources cannot be verified or do not support claims',
    severity: 4, category: 'CROSS_REF',
    example: 'Cites "Case 123/2024" but court records show no such case'
  },
  CT33_LEGAL_REFERENCE_INVALID: {
    id: 'CT33', name: 'Legal Reference Invalid',
    desc: 'Referenced legislation, cases, or regulations are incorrect',
    severity: 4, category: 'CROSS_REF',
    example: 'References "Section 42 of the Companies Act" but Act has no Section 42'
  },
  CT34_PRECEDENT_VIOLATION: {
    id: 'CT34', name: 'Precedent Violation',
    desc: 'Document contradicts established legal or procedural precedent',
    severity: 3, category: 'CROSS_REF',
    example: 'Court order format deviates from standard High Court requirements'
  },
  CT35_PROCEDURE_BREACH: {
    id: 'CT35', name: 'Procedure Breach',
    desc: 'Required procedural steps were skipped or incorrectly followed',
    severity: 4, category: 'CROSS_REF',
    example: 'Contract signed without required witness signatures'
  },

  // === CATEGORY 6: CONTACT & LOCATION CONTRADICTIONS (36-38) ===
  // Physical address, contact details, and jurisdictional issues

  CT36_ADDRESS_CONTRADICTION: {
    id: 'CT36', name: 'Address Contradiction',
    desc: 'Physical addresses are inconsistent or non-existent',
    severity: 3, category: 'CONTACT',
    example: 'Registered address on page 1 differs from address on page 10'
  },
  CT37_CONTACT_DETAIL_MISMATCH: {
    id: 'CT37', name: 'Contact Detail Mismatch',
    desc: 'Phone numbers, emails, or other contacts are inconsistent',
    severity: 2, category: 'CONTACT',
    example: 'Email domain changes from @company.co.za to @company-gmail.com'
  },
  CT38_JURISDICTIONAL_IMPOSSIBILITY: {
    id: 'CT38', name: 'Jurisdictional Impossibility',
    desc: 'Legal jurisdiction claims are impossible or contradictory',
    severity: 4, category: 'CONTACT',
    example: 'South African court order claims jurisdiction over Dubai entity'
  },

  // === CATEGORY 7: EVIDENCE & WITNESS CONTRADICTIONS (39-41) ===
  // Issues with evidence handling and witness statements

  CT39_CHAIN_OF_CUSTODY_BREAK: {
    id: 'CT39', name: 'Chain of Custody Break',
    desc: 'Evidence handling chain has gaps or inconsistencies',
    severity: 5, category: 'EVIDENCE',
    example: 'Evidence receipt shows transfer to Person A but next record shows Person B'
  },
  CT40_WITNESS_STATEMENT_CONFLICT: {
    id: 'CT40', name: 'Witness Statement Conflict',
    desc: 'Witness accounts contradict each other or physical evidence',
    severity: 4, category: 'EVIDENCE',
    example: 'Two witness statements describe mutually exclusive events'
  },
  CT41_EVIDENCE_TAMPERING_INDICATOR: {
    id: 'CT41', name: 'Evidence Tampering Indicator',
    desc: 'Evidence shows signs of alteration, substitution, or manipulation',
    severity: 5, category: 'EVIDENCE',
    example: 'Page numbers are non-sequential suggesting page removal'
  },

  // === CATEGORY 8: DIGITAL FORENSIC CONTRADICTIONS (42-43) ===
  // Digital artifacts and technical inconsistencies

  CT42_DIGITAL_FOOTPRINT_MISMATCH: {
    id: 'CT42', name: 'Digital Footprint Mismatch',
    desc: 'Digital traces (hashes, creation tools) conflict with claims',
    severity: 4, category: 'DIGITAL',
    example: 'Document claims scanned original but metadata shows created in Word'
  },
  CT43_DOCUMENT_INTERNAL_CONFLICT: {
    id: 'CT43', name: 'Document Internal Conflict',
    desc: 'Catch-all: any other internal contradiction not covered above',
    severity: 3, category: 'DIGITAL',
    example: 'Multiple anomalies detected that suggest systematic document fraud'
  },

  // === CATEGORY 9: FRANCHISE / LEASE CONTRADICTIONS (44-45) ===
  // Conditional-right and asset-value contradictions surfaced by the AllFuels
  // case, where the lease agreement had to be read against the ownership record.

  CT44_CONDITIONAL_CLAUSE_MISINVOKED: {
    id: 'CT44', name: 'Conditional Clause Misinvoked (Lessee/Owner Trap)',
    desc: 'A termination or expiry rests on a clause conditioned on the party being the lessee (not the owner) under a head lease, but the record shows that party had become the owner of the premises — the triggering event never occurred, so the termination may be void.',
    severity: 5, category: 'FRANCHISE_LEASE',
    example: 'Franchise deemed "expired by effluxion" under cl. 3.2.3 (lessee-only), but the franchisor had purchased the site and was the registered owner.'
  },
  CT45_ASSET_VALUE_DENIAL: {
    id: 'CT45', name: 'Asset Value Recognised Then Denied (Goodwill)',
    desc: 'Goodwill or value of the business is recognised or quantified in one document but denied or said to have no compensable value in another — a forfeiture or clawback is itself an admission that the asset exists.',
    severity: 5, category: 'FRANCHISE_LEASE',
    example: 'The clawback table quantifies the Value of the Business, yet a later submission argues "goodwill has no compensable value".'
  }
};

// ===================== 37 DETECTOR FUNCTIONS =====================
// Each detector scans for a specific type of contradiction or fraud indicator.
// Detectors return an array of findings: [{ type, severity, evidence, location }]

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
    var NEG_BEFORE = /\b(?:no longer|not|never|without|denied|denies|refused to|refuses to|failed to|no)\b(?:\s+\w+){0,5}\s*$/;
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
          if (Math.abs(asserts[ai] - negs[ni]) <= 240 && subjectsAligned(asserts[ai], negs[ni])) { pair = [asserts[ai], negs[ni]]; break; }
        }
      }
      if (!pair) continue;
      findings.push({ type: 'CT01', severity: 4,
        evidence: 'The document both affirms and negates "' + cw + '": "…' + mkSnip(pair[0]) + '…" vs "…' + mkSnip(pair[1]) + '…"',
        location: 'Same passage' });
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
    var AMOUNT_RE = /(?:[R$€£]\s*)?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|(?:[R$€£]\s*)\d+(?:\.\d{2})?/;

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
        var value = parseFloat(am[0].replace(/[^0-9.]/g, ''));
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
          dates.push({ raw: match[0], page: i, text: textBlocks[i].substring(Math.max(0, match.index-30), match.index+30) });
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
    for (var d = 0; d < dates.length; d++) {
      var dd = dates[d].raw.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
      if (!dd) continue;
      var a = parseInt(dd[1]), b = parseInt(dd[2]), year = parseInt(dd[3]);
      var okDMY = voValidMD(b, a, year); // day=a, month=b  (DD/MM/YYYY)
      var okMDY = voValidMD(a, b, year); // month=a, day=b  (MM/DD/YYYY)
      if (!okDMY && !okMDY) {
        var why = (a === 2 || b === 2) ? 'February cannot have that many days' : 'not a real calendar date';
        findings.push({ type: 'CT03', severity: 5,
          evidence: 'Impossible date: ' + dates[d].raw + ' (' + why + ' read as day/month/year or month/day/year)',
          location: 'Page ' + (dates[d].page + 1) });
      } else {
        // Only one reading is valid -- record which convention it forces, so a
        // bundle that genuinely mixes BOTH can be noted once (below).
        if (okDMY && !okMDY && a > 12) voSawDMY = voSawDMY || dates[d]; // first field >12 -> must be DD/MM
        if (okMDY && !okDMY && b > 12) voSawMDY = voSawMDY || dates[d]; // second field >12 -> must be MM/DD
      }
    }
    // A single anchored, non-overclaiming note when the bundle mixes conventions.
    if (voSawDMY && voSawMDY) {
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
      if (!mon || mon < 1 || mon > 12 || day < 1 || day > 31) return null;
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
      var base2 = st[0];
      var seenKeys2 = {};
      for (var q = 1; q < st.length; q++) {
        if (st[q].key === base2.key) continue;
        if (seenKeys2[st[q].key]) continue; // a repeated value is one discrepancy, not many
        seenKeys2[st[q].key] = true;
        findings.push({ type: 'CT03', severity: 4,
          evidence: '"' + lab2 + '" is stated as ' + base2.raw + ' and as ' + st[q].raw,
          location: 'Page ' + (base2.page + 1) + ' vs Page ' + (st[q].page + 1) });
      }
    }
    return findings;
  },

  D04_DETECT_TEMPORAL_IMPOSSIBILITY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    // A temporal conflict requires the two opposing markers to describe the SAME
    // event, so they must sit close together (one clause/sentence). The old
    // version flagged the pair if each word merely appeared SOMEWHERE in the
    // document -- on a long legal bundle "preceding"/"following" and
    // "earlier"/"later" are ordinary relational words that co-occur by default,
    // so it fired on essentially every multi-page file (a confirmed false
    // positive on the 148-page scanned bundle). The bare relational pairs are
    // dropped entirely (no forensic signal); the phrase pairs are kept but only
    // when they appear within a short window of each other.
    var PROXIMITY = 140;
    var impossibleSequences = [
      ['before the incident','after the incident'],
      ['prior to','subsequent to']
    ];
    for (var i = 0; i < impossibleSequences.length; i++) {
      var a = impossibleSequences[i][0], b = impossibleSequences[i][1];
      var near = false, from = 0, ai;
      while ((ai = fullText.indexOf(a, from)) !== -1) {
        // b within PROXIMITY chars on either side of this occurrence of a.
        var windowStart = Math.max(0, ai - PROXIMITY);
        var windowEnd = ai + a.length + PROXIMITY;
        if (fullText.substring(windowStart, windowEnd).indexOf(b) !== -1) { near = true; break; }
        from = ai + a.length;
      }
      if (near) {
        findings.push({ type: 'CT04', severity: 3,
          evidence: 'Temporal language conflict: "' + a + '" and "' + b + '" describe the same event',
          location: 'Full document' });
      }
    }
    return findings;
  },

  D05_DETECT_LOGICAL_IMPOSSIBILITY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var impossibleStates = [
      ['active and deregistered','registered and dissolved'],[' solvent and insolvent'],
      ['employed and terminated','appointed and removed']
    ];
    for (var i = 0; i < impossibleStates.length; i++) {
      if (fullText.indexOf(impossibleStates[i][0]) !== -1) {
        findings.push({ type: 'CT06', severity: 5,
          evidence: 'Logically impossible state: "' + impossibleStates[i][0] + '"',
          location: 'Full document' });
      }
    }
    return findings;
  },

  // D06-D10: Identity detectors
  D06_DETECT_IDENTITY_CONFLICT: function(textBlocks) {
    var findings = [];
    var idPatterns = [
      /\b\d{6}\s?\d{4}\s?\d{1}\s?\d{1}\b/g,     // SA ID 13 digits
      /\b[A-Z]{2}\d{7,10}\b/g,                    // Passport patterns
      /\b[A-Z]{1,2}\d{6,8}[A-Z]?\b/g              // Generic ID
    ];
    var ids = [];
    for (var i = 0; i < textBlocks.length; i++) {
      for (var p = 0; p < idPatterns.length; p++) {
        var match;
        while ((match = idPatterns[p].exec(textBlocks[i])) !== null) {
          ids.push({ value: match[0], page: i });
        }
      }
    }
    // Check for same person with different IDs
    var names = [];
    var nameRe = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
    for (var j = 0; j < textBlocks.length; j++) {
      var nm;
      while ((nm = nameRe.exec(textBlocks[j])) !== null) {
        names.push({ value: nm[1], page: j });
      }
    }
    // Count DISTINCT values, not raw matches: on a bank statement the same
    // reference code repeats on every line, which made the old count report
    // "3 different ID numbers" when it was one code seen three times. And a
    // finding that cannot say WHICH numbers is not actionable -- cite-or-stay-
    // silent -- so name the values and stay honest that they are ID-*shaped*
    // strings (a Capitec client reference matches the same pattern as an ID).
    var idVals = ids.map(function(x){ return x.value; });
    var idUniq = idVals.filter(function(v, ix){ return idVals.indexOf(v) === ix; });
    if (idUniq.length >= 2) {
      var idPages = ids.map(function(x){ return x.page + 1; })
        .filter(function(v, ix, arr){ return arr.indexOf(v) === ix; });
      findings.push({ type: 'CT09', severity: 4,
        evidence: idUniq.length + ' different identity-shaped numbers appear: ' +
          idUniq.slice(0, 6).join(', ') + (idUniq.length > 6 ? ' …' : '') +
          ' — confirm which are ID numbers and whose (reference/account codes share the same shape)',
        location: 'Pages ' + idPages.join(', ') });
    }
    return findings;
  },

  D07_DETECT_ROLE_CONTRADICTION: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    // Only flag a role when the text EXPLICITLY challenges its authority. The old
    // version flagged a role whenever a supporting-document phrase ("power of
    // attorney", "trust deed", ...) was merely absent from the document -- but
    // absence is not a contradiction, and it fired on ordinary documents that
    // simply named an "authorized signatory" or "trustee".
    var roles = ['managing director','company secretary','authorized signatory','executor','trustee','liquidator'];
    var challenge = /(?:without (?:the )?authority|no authority|not authoris|not authorized|unauthoris|unauthorized|lacked (?:the )?authority|purport(?:ed|s|ing)?|falsely (?:claim|represent)|had no (?:power|right|mandate))/;
    for (var i = 0; i < roles.length; i++) {
      var idx = fullText.indexOf(roles[i]);
      while (idx !== -1) {
        var windowText = fullText.slice(Math.max(0, idx - 90), idx + roles[i].length + 90);
        if (challenge.test(windowText)) {
          findings.push({ type: 'CT10', severity: 3,
            evidence: 'Role "' + roles[i] + '" is expressly challenged as lacking authority',
            location: 'Full document' });
          break;
        }
        idx = fullText.indexOf(roles[i], idx + 1);
      }
    }
    return findings;
  },

  D08_DETECT_AUTHORITY_EXCEEDED: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    // Bound the gap: an unbounded .*? with match() stretched from the first
    // "signed by" to any later anchor, capturing hundreds of chars (including
    // seal-footer debris) as one "finding". Cap it so only a genuinely local
    // "approved by <junior role>" phrase matches. Dots in p.p. are escaped.
    var authorityPatterns = [
      /approved\s+by\s+.{0,40}?(?:clerk|assistant|junior|trainee)/gi,
      /authorized\s+by\s+.{0,40}?(?:intern|temp|contractor)/gi,
      /signed\s+by\s+.{0,40}?(?:on behalf of|p\.p\.|per pro)/gi
    ];
    for (var i = 0; i < authorityPatterns.length; i++) {
      var match = fullText.match(authorityPatterns[i]);
      if (match) {
        findings.push({ type: 'CT11', severity: 4,
          evidence: 'Potential authority exceeded: "' + match[0] + '"',
          location: 'Full document' });
      }
    }
    return findings;
  },

  D09_DETECT_ENTITY_STATUS_FAKE: function(textBlocks) {
    var findings = [];
    // A status word only counts when it is used ABOUT AN ENTITY. The old check
    // paired any "registered" with any "liquidated" across the whole corpus, so
    // "utilities is to be registered" (a lease clause) + a case-law mention of
    // liquidation 200 pages away produced a CRITICAL "conflicting status"
    // with no quotes — unverifiable, and read by reviewers as fabrication.
    // Now: each status word must appear near an entity noun, common non-status
    // uses of "registered" are excluded, and the finding quotes BOTH passages
    // with their pages so it can be checked against the source in seconds.
    var ENTITY_NEAR = /\b(compan(?:y|ies)|close corporation|\bcc\b|pty|ltd|limited|corporation|entity|entities|enterprise|business|firm|trust|incorporated)\b/i;
    // Delivery-method uses may carry intervening words ("registered RECORDED
    // DELIVERY letters" in the Greensky MOA notices clause slipped a strict
    // "registered mail|letter" list and produced a CRITICAL false positive).
    var NOT_STATUS_REGISTERED = /\bregistered\s+(?:[a-z]+\s+){0,2}?(?:mail|post|letters?|office|address|owner|deliver(?:y|ies))\b|\bto\s+be\s+registered\b|\bregistered\s+in\s+whose\s+name\b|\bregistered\s+against\b|\bis\s+to\s+be\s+registered\b/i;
    // A status word inside a PROVISION ("shall be dissolved", "in the event of
    // liquidation", "upon winding-up") describes a hypothetical, not the
    // entity's current status — an MOA's dissolution clause is not a claim
    // that the company IS dissolved.
    var NOT_STATUS_PROVISION_BEFORE = /\b(?:shall|may|must|will|would|can|could|to)\s+be\s+(?:[a-z]+\s+){0,2}?$/i;
    var NOT_STATUS_PROVISION_NEAR = /\bin\s+the\s+event\s+(?:of|that)\b|\bupon\s+(?:the\s+)?(?:dissolution|liquidation|winding[\s-]?up|deregistration)\b|\bon\s+(?:dissolution|liquidation|winding[\s-]?up)\b/i;
    var statusClaims = [
      ['registered','deregistered','dissolved','liquidated'],
      ['active','suspended','under administration'],
      ['compliant','non-compliant','delinquent']
    ];
    function findStatusUse(word) {
      // First occurrence of `word` used as an entity status; returns
      // { page, snippet } or null.
      var re = new RegExp('\\b' + word.replace(/ /g, '\\s+') + '\\b', 'gi');
      for (var b = 0; b < textBlocks.length; b++) {
        var t = textBlocks[b] || '';
        var m;
        re.lastIndex = 0;
        while ((m = re.exec(t)) !== null) {
          var win = t.substring(Math.max(0, m.index - 90), Math.min(t.length, m.index + m[0].length + 90));
          var pre = t.substring(Math.max(0, m.index - 40), m.index);
          var excluded = ((word === 'registered') && NOT_STATUS_REGISTERED.test(win)) ||
                         NOT_STATUS_PROVISION_BEFORE.test(pre) ||
                         NOT_STATUS_PROVISION_NEAR.test(win);
          if (!excluded && ENTITY_NEAR.test(win)) {
            return { page: b + 1, snippet: win.replace(/\s+/g, ' ').trim() };
          }
        }
      }
      return null;
    }
    for (var i = 0; i < statusClaims.length; i++) {
      var uses = [];
      for (var j = 0; j < statusClaims[i].length; j++) {
        var u = findStatusUse(statusClaims[i][j]);
        if (u) uses.push({ word: statusClaims[i][j], page: u.page, snippet: u.snippet });
      }
      if (uses.length > 1) {
        var a = uses[0], c = uses[1];
        findings.push({ type: 'CT14', severity: 5,
          evidence: 'Conflicting entity-status claims: "…' + a.snippet + '…" (' + a.word + ', page ' + a.page + ') vs "…' + c.snippet + '…" (' + c.word + ', page ' + c.page + ')',
          location: a.page === c.page ? 'Page ' + a.page : 'Page ' + a.page + ' and Page ' + c.page });
      }
    }
    return findings;
  },

  // D10-D15: Financial detectors
  D10_DETECT_VAT_INVALID: function(textBlocks) {
    var findings = [];
    var vatRe = /\b4\d{9,10}\b/g;
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = vatRe.exec(textBlocks[i])) !== null) {
        var vat = match[0];
        // SA VAT check: must start with 4, be 10 or 11 digits
        if (vat.length < 10 || vat.length > 11 || vat[0] !== '4') {
          findings.push({ type: 'CT19', severity: 4,
            evidence: 'Invalid VAT number format: ' + vat,
            location: 'Page ' + (i + 1) });
        }
      }
    }
    return findings;
  },

  D11_DETECT_REGISTRATION_FAKE: function(textBlocks) {
    var findings = [];
    // A "registration number" is only what the document LABELS as one. The old
    // detector matched any bare 14-digit run and flagged it "fake" merely
    // because it recurred -- but a bank-statement reference (a Capitec client
    // code is 14 digits) is not a registration number, and a genuine company
    // registration number is SUPPOSED to recur across a document. Now: read the
    // token sitting after an explicit registration cue, and flag it only when it
    // is NOT a valid SA registration format. A number with no "registration"
    // label (the bank reference) never fires; a valid one that recurs never
    // fires. Each malformed value is reported once, anchored to its pages.
    var cueRe = /(?:company\s+)?registration\s+(?:number|no\.?|nr\.?)|reg(?:istration)?\.?\s*(?:number|no\.?|nr\.?)|CIPC/gi;
    var SA_REG = /^(?:\d{4}\/\d{6}\/\d{2}|CK\d{2}\/\d{5,6}|CK\d{7})$/;
    var bad = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var block = textBlocks[i] || '';
      cueRe.lastIndex = 0;
      var cm;
      while ((cm = cueRe.exec(block)) !== null) {
        var after = block.slice(cm.index + cm[0].length, cm.index + cm[0].length + 40);
        var tok = after.match(/[A-Z]{0,2}\d[\d\/]{5,19}/);
        if (!tok) continue;
        var val = tok[0].replace(/\s+/g, '');
        if (SA_REG.test(val)) continue; // a valid registration format is not "fake"
        if (!bad[val]) {
          var quote = block.substring(cm.index, cm.index + cm[0].length + 30).replace(/\s+/g, ' ').trim();
          bad[val] = { pages: [], quote: quote };
        }
        if (bad[val].pages.indexOf(i + 1) === -1) bad[val].pages.push(i + 1);
      }
    }
    for (var v in bad) {
      if (!Object.prototype.hasOwnProperty.call(bad, v)) continue;
      findings.push({ type: 'CT20', severity: 4,
        evidence: 'A number labelled as a registration is not a valid SA registration format (expected YYYY/NNNNNN/NN or CK…): "' + bad[v].quote + '"',
        location: 'Page ' + bad[v].pages.join(', ') });
    }
    return findings;
  },

  D12_DETECT_BANK_DETAIL_MISMATCH: function(textBlocks) {
    var findings = [];
    // Only treat an 8-12 digit number as a bank account when it sits next to
    // banking context ("account", "a/c", "acc no", "bank", "branch", "iban").
    // The old detector matched ANY 8+ digit run, so in a legal bundle it read
    // dates (11122018 = 11/12/2018), concatenated years (20162017), reference
    // and case numbers as "account numbers" and cried mismatch. False positives
    // like that on a HIGH finding destroy the report's credibility.
    var CONTEXT = /(account|acc\.?\s*no|a\/c|bank|branch|iban|swift)/i;
    // Reject values that are really dates or year-runs.
    function looksLikeDateOrYears(n) {
      if (/^(19|20)\d{2}(19|20)\d{2}$/.test(n)) return true;      // 20162017
      if (/^\d{2}\d{2}(19|20)\d{2}$/.test(n)) {                    // DDMMYYYY / MMDDYYYY
        var dd = +n.slice(0,2), mm = +n.slice(2,4);
        if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) return true;
        if (mm >= 1 && mm <= 31 && dd >= 1 && dd <= 12) return true;
      }
      if (/^(19|20)\d{2}\d{2}\d{2}$/.test(n)) {                    // YYYYMMDD
        var m2 = +n.slice(4,6), d2 = +n.slice(6,8);
        if (m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31) return true;
      }
      return false;
    }
    var numRe = /\b\d{8,12}\b/g;
    var uniqueAccounts = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var text = textBlocks[i], match;
      while ((match = numRe.exec(text)) !== null) {
        var n = match[0];
        if (looksLikeDateOrYears(n)) continue;
        // require a banking keyword within 40 chars before the number
        var windowStart = Math.max(0, match.index - 40);
        if (!CONTEXT.test(text.slice(windowStart, match.index))) continue;
        uniqueAccounts[n] = true;
      }
    }
    var accountList = Object.keys(uniqueAccounts);
    if (accountList.length >= 2) {
      findings.push({ type: 'CT18', severity: 4,
        evidence: accountList.length + ' different bank account numbers found near banking references: ' + accountList.slice(0,3).join(', '),
        location: 'Multiple pages' });
    }
    return findings;
  },

  D13_DETECT_CALCULATION_ERROR: function(textBlocks) {
    var findings = [];
    var calcRe = /(subtotal|total|vat|tax|amount)\s*[:=]?\s*[R$€£]?\s*([\d,.]+)/gi;
    var amounts = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = calcRe.exec(textBlocks[i])) !== null) {
        var val = parseFloat(match[2].replace(/,/g, ''));
        if (!isNaN(val)) amounts.push({ label: match[1].toLowerCase(), value: val, page: i });
      }
    }
    // Check if VAT is approximately 15% of subtotal
    var subtotal = amounts.find(function(a){return a.label==='subtotal';});
    var vat = amounts.find(function(a){return a.label==='vat'||a.label==='tax';});
    var total = amounts.find(function(a){return a.label==='total';});
    if (subtotal && vat) {
      var expectedVat = subtotal.value * 0.15;
      var vatDiff = Math.abs(vat.value - expectedVat);
      if (vatDiff > subtotal.value * 0.005) {  // 0.5% tolerance
        findings.push({ type: 'CT22', severity: 4,
          evidence: 'VAT mismatch: calculated R' + expectedVat.toFixed(2) + ' but stated R' + vat.value.toFixed(2),
          location: 'Page ' + (subtotal.page + 1) });
      }
    }
    if (subtotal && vat && total) {
      var expectedTotal = subtotal.value + vat.value;
      if (Math.abs(total.value - expectedTotal) > 0.01) {
        findings.push({ type: 'CT15', severity: 5,
          evidence: 'Total mismatch: ' + subtotal.label + '(R' + subtotal.value + ') + ' + vat.label + '(R' + vat.value + ') = R' + expectedTotal + ' but stated R' + total.value,
          location: 'Page ' + (subtotal.page + 1) });
      }
    }
    return findings;
  },

  D14_DETECT_AMOUNT_ROUNDING_ANOMALY: function(textBlocks) {
    var findings = [];
    // Suspiciously round amounts may indicate fabrication
    var amountRe = /[R$€£]\s*([\d,]+(?:\.\d{2})?)/g;
    var roundAmounts = 0, totalAmounts = 0;
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = amountRe.exec(textBlocks[i])) !== null) {
        var val = parseFloat(match[1].replace(/,/g, ''));
        if (val > 1000 && val % 1000 === 0) roundAmounts++;
        if (val > 100) totalAmounts++;
      }
    }
    if (totalAmounts >= 3 && roundAmounts / totalAmounts > 0.7) {
      findings.push({ type: 'CT15', severity: 2,
        evidence: roundAmounts + ' of ' + totalAmounts + ' amounts are suspiciously round (multiples of 1000)',
        location: 'Financial sections' });
    }
    return findings;
  },

  // D15-D20: Document integrity detectors
  D15_DETECT_METADATA_FRAUD: function(pdfDoc) {
    var findings = [];
    try {
      var producer = (pdfDoc.getProducer() || '').toLowerCase();
      var creator = (pdfDoc.getCreator() || '').toLowerCase();
      var creationDate = pdfDoc.getCreationDate();
      var modDate = pdfDoc.getModificationDate();
      var suspiciousTools = ['photoshop','gimp','pixelmator','affinity','canva','paint','illustrator'];
      for (var i = 0; i < suspiciousTools.length; i++) {
        if (producer.indexOf(suspiciousTools[i]) !== -1 || creator.indexOf(suspiciousTools[i]) !== -1) {
          findings.push({ type: 'CT24', severity: 4,
            evidence: 'Document created/edited with image manipulation tool: ' + suspiciousTools[i],
            location: 'PDF metadata' });
        }
      }
      if (creationDate && modDate && modDate < creationDate) {
        findings.push({ type: 'CT29', severity: 5,
          evidence: 'Modification date (' + modDate + ') before creation date (' + creationDate + ')',
          location: 'PDF metadata' });
      }
    } catch(e) {}
    return findings;
  },

  D16_DETECT_FONT_ANOMALY: function(textBlocks, pdfDoc) {
    var findings = [];
    // Check for font changes mid-document via text characteristics
    var fontMarkers = [];
    for (var i = 0; i < textBlocks.length; i++) {
      // Check for mixed character widths (indicates font mixing)
      var lines = textBlocks[i].split('\n');
      var widths = [];
      for (var j = 0; j < lines.length; j++) {
        if (lines[j].trim()) widths.push(lines[j].length);
      }
      if (widths.length > 1) {
        var avg = widths.reduce(function(a,b){return a+b;},0) / widths.length;
        var variance = widths.reduce(function(a,b){return a+Math.pow(b-avg,2);},0) / widths.length;
        if (variance > 500) {
          fontMarkers.push(i);
        }
      }
    }
    if (fontMarkers.length >= 2) {
      findings.push({ type: 'CT25', severity: 3,
        evidence: 'Font inconsistencies detected on ' + fontMarkers.length + ' pages',
        location: 'Pages ' + fontMarkers.map(function(x){return x+1;}).join(', ') });
    }
    return findings;
  },

  D17_DETECT_FORMAT_ANOMALY: function(textBlocks) {
    var findings = [];
    // Generic page-length variance is NOT a forensic indicator -- title pages,
    // dense pages and sparse pages are all normal, and flagging every one of
    // them produced a "red cross on every page" report. The only version of
    // this with real signal is a NEAR-BLANK page sitting among full ones, which
    // can mark an inserted or removed page. Only that is flagged, at low
    // severity.
    // Content mass, not raw length: seal-footer layers on a re-sealed scan
    // otherwise make an image-only page look like a text page (see voContentMass).
    var lens = textBlocks.map(function(t){ return voContentMass(t); });
    if (lens.length >= 4) {
      var avg = lens.reduce(function(a,b){ return a+b; }, 0) / lens.length;
      // Distinct-word mass runs roughly half of raw character length on real
      // prose (repeated words count once), so the old raw-length gate of 300
      // rescales to ~180 here.
      if (avg > 180) {
        var blanks = [];
        for (var i = 0; i < lens.length; i++) {
          if (lens[i] < VO_NEAR_EMPTY_CHARS && lens[i] < avg * 0.1) blanks.push(i);
        }
        // A RUN of near-empty pages (or many of them) is the signature of an
        // image-only / scanned section that OCR could not read — NOT surgical
        // insertion. Flagging each as "possibly inserted/removed" produced false
        // positives on exactly those pages. Collapse that case to one honest,
        // low-severity note. Only a SINGLE near-empty page sitting between two
        // full pages keeps the "possible inserted/removed" reading.
        var consecutive = blanks.length > 1 && blanks.every(function (p, k) { return k === 0 || p === blanks[k-1] + 1; });
        if (blanks.length > 3 || consecutive) {
          var span = (blanks[0]+1) + (blanks.length > 1 ? '-' + (blanks[blanks.length-1]+1) : '');
          findings.push({ type: 'CT26', severity: 1,
            evidence: blanks.length + ' near-empty pages (' + span + ') among pages averaging ' + Math.round(avg) + ' chars — most likely image-only pages not captured by OCR; re-scan with OCR enabled to read them, or confirm they are intentional dividers',
            location: 'Pages ' + span });
        } else {
          for (var b = 0; b < blanks.length; b++) {
            var pi = blanks[b];
            var isolated = (pi > 0 && pi < lens.length - 1 && lens[pi-1] >= avg * 0.5 && lens[pi+1] >= avg * 0.5);
            findings.push({ type: 'CT26', severity: 2,
              evidence: 'Page ' + (pi+1) + ' is nearly empty (' + lens[pi] + ' chars) among pages averaging ' + Math.round(avg) +
                (isolated ? ' — an isolated blank between two full pages; possible inserted or removed page' : ' — may be an image-only page not read by OCR, or an inserted/removed page'),
              location: 'Page ' + (pi+1) });
          }
        }
      }
    }
    return findings;
  },

  D18_DETECT_PAGE_MANIPULATION: function(textBlocks) {
    var findings = [];
    // Check for repeated internal page numbers. A couple of duplicates is worth
    // flagging individually; MANY repeats just means a compiled bundle (each
    // document restarts at page 1), so we collapse those into ONE summary rather
    // than emitting 25 near-identical findings that drown the substantive ones.
    var pageNumRe = /\b(page|p\.?|pg)\s*(\d+)\s*(?:of|\/)\s*(\d+)\b/gi;
    var seenNumbers = {}, repeated = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = pageNumRe.exec(textBlocks[i])) !== null) {
        var num = parseInt(match[2]);
        if (seenNumbers[num] !== undefined && seenNumbers[num] !== i) repeated[num] = true;
        seenNumbers[num] = i;
      }
    }
    var nums = Object.keys(repeated).map(Number).sort(function (a, b) { return a - b; });
    if (nums.length === 0) return findings;
    if (nums.length <= 2) {
      for (var n = 0; n < nums.length; n++) {
        findings.push({ type: 'CT27', severity: 4,
          evidence: 'Page number ' + nums[n] + ' appears on multiple pages (potential duplicate or insertion)',
          location: 'Multiple pages' });
      }
    } else {
      findings.push({ type: 'CT27', severity: 4,
        evidence: nums.length + ' internal page numbers repeat across the document (' +
          nums.slice(0, 10).join(', ') + (nums.length > 10 ? ', …' : '') +
          ') — typical of a compiled multi-document bundle; check the page order if this is meant to be one document',
        location: 'Whole document' });
    }
    return findings;
  },

  D19_DETECT_EVIDENCE_TAMPERING: function(textBlocks) {
    var findings = [];
    var tamperingIndicators = [
      'white out','whited out','correction fluid','tippex','tipp-ex',
      'scanned copy','photocopied signature','pasted signature','stamped signature',
      'inserted page','removed page','replaced page','added later'
    ];
    var fullText = textBlocks.join(' ').toLowerCase();
    for (var i = 0; i < tamperingIndicators.length; i++) {
      if (fullText.indexOf(tamperingIndicators[i]) !== -1) {
        findings.push({ type: 'CT41', severity: 5,
          evidence: 'Tampering indicator found: "' + tamperingIndicators[i] + '"',
          location: 'Full document' });
      }
    }
    return findings;
  },

  D20_DETECT_DIGITAL_FOOTPRINT_MISMATCH: function(pdfDoc) {
    var findings = [];
    try {
      var producer = pdfDoc.getProducer() || '';
      var creator = pdfDoc.getCreator() || '';
      // If it claims to be scanned but metadata says word processor
      if ((producer.indexOf('Scan') !== -1 || creator.indexOf('Scan') !== -1) &&
          (producer.indexOf('Microsoft') !== -1 || creator.indexOf('Microsoft') !== -1)) {
        findings.push({ type: 'CT42', severity: 4,
          evidence: 'Claims scanned but metadata shows word processor: ' + producer + ' / ' + creator,
          location: 'PDF metadata' });
      }
    } catch(e) {}
    return findings;
  },

  // D21-D25: Cross-reference detectors
  D21_DETECT_MISSING_APPENDIX: function(textBlocks) {
    var findings = [];
    var appendixRefs = [];
    // "see Annexure A", "refer to Appendix 12", "as per Schedule B2". The LABEL
    // must be a genuine annexure label: an uppercase letter / short code (A, B2)
    // or a number (1, 12). OCR routinely splits the word itself --
    // "annexure" -> "annex ure", "annexures" -> "annex ure", "schedules" ->
    // "schedule s" -- and the lowercase tail ("ure", "ee", "s") was being
    // captured as a label, then reported as a phantom missing annexure (9 such
    // false positives on the 148-page scanned bundle). Requiring an
    // uppercase/numeric label rejects those OCR fragments. match[2] preserves
    // original case, so the case-sensitive test below is what does the filtering
    // (the /i regex alone would still accept "ure").
    var appendixRe = /(?:see|refer(?:red|ring)?\s+to|as\s+per|per|under|in)\s+(appendix|annexures?|annex|schedules?|exhibits?)\s*([A-Za-z]{1,3}\d{0,3}|\d{1,3})\b/gi;
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = appendixRe.exec(textBlocks[i])) !== null) {
        var label = match[2];
        // Genuine label: uppercase letters (<=3) optionally trailed by digits, or
        // a bare number. Lowercase fragments (OCR word-splits) are rejected.
        if (!/^[A-Z]{1,3}\d{0,3}$/.test(label) && !/^\d{1,3}$/.test(label)) continue;
        appendixRefs.push({ label: label.toLowerCase(), ref: (match[1] + ' ' + label).toLowerCase(), page: i });
      }
    }
    // The reference is satisfied if the SAME label appears as a heading anywhere
    // beside any annexure-kind word (annexure/annex/appendix/schedule/exhibit) --
    // tolerant of the keyword variant so "refer to Annex A" is not reported
    // missing merely because the heading reads "Annexure A".
    var fullText = textBlocks.join(' ').toLowerCase();
    for (var j = 0; j < appendixRefs.length; j++) {
      var lbl = appendixRefs[j].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var headingRe = new RegExp('(?:appendix|annexures?|annex|schedules?|exhibits?)\\s*' + lbl + '\\b', 'g');
      var occurrences = (fullText.match(headingRe) || []).length;
      // >=2 occurrences means the label appears somewhere beyond the reference
      // itself (i.e. it resolves). Only 1 occurrence => referenced but absent.
      if (occurrences < 2) {
        findings.push({ type: 'CT31', severity: 3,
          evidence: 'Referenced "' + appendixRefs[j].ref + '" not found in document',
          location: 'Page ' + (appendixRefs[j].page + 1) });
      }
    }
    return findings;
  },

  D22_DETECT_INVALID_LEGAL_REF: function(textBlocks) {
    var findings = [];
    var legalRe = /\b(section|regulation|act|rule)\s+(\d+[A-Z]*)\s+(?:of|in)\s+(?:the\s+)?([A-Za-z\s]+(?:Act|Regulations|Rules))/gi;
    var fullText = textBlocks.join(' ');
    var match;
    while ((match = legalRe.exec(fullText)) !== null) {
      // Flag if section number seems invalid (>500 for most acts)
      var sectionNum = parseInt(match[2]);
      if (sectionNum > 500) {
        findings.push({ type: 'CT33', severity: 3,
          evidence: 'Suspiciously high section number: Section ' + match[2] + ' of ' + match[3],
          location: 'Full document' });
      }
    }
    return findings;
  },

  D23_DETECT_PROCEDURE_BREACH: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    // Only flag an EXPLICIT statement that a required procedure was NOT followed.
    // The previous version flagged "may require witness but none found" whenever
    // the word "agreement" appeared without "witness" -- absence of a keyword is
    // not evidence of a breach, and it fired on clean documents. Inventing a
    // procedural breach is a fabricated allegation, the worst thing a forensic
    // detector can do, so this now keys on the breach being stated in the text.
    var breaches = [
      { re: /\b(?:not witnessed|without (?:a |any )?witness(?:es)?|no witness(?:es)?)\b/, msg: 'Document indicates it was executed without a witness' },
      { re: /\b(?:not notaris(?:ed|zed)|without notaris(?:ation|ing)|un-?notaris(?:ed|zed)|not certified)\b/, msg: 'Document indicates it was not notarised/certified' },
      { re: /\b(?:no board resolution|without (?:a )?(?:board |shareholder )?resolution|no resolution was (?:passed|taken|adopted))\b/, msg: 'Document indicates no board/shareholder resolution authorised the act' },
      { re: /\b(?:unstamped|not stamped|without stamp duty|no stamp duty (?:paid|was paid))\b/, msg: 'Document indicates stamp duty was not paid' },
      { re: /\b(?:not countersigned|never countersigned|without (?:a )?countersignature|uncountersigned)\b/, msg: 'Document indicates it was never countersigned' }
    ];
    for (var i = 0; i < breaches.length; i++) {
      if (breaches[i].re.test(fullText)) {
        findings.push({ type: 'CT35', severity: 4,
          evidence: breaches[i].msg, location: 'Full document' });
      }
    }
    return findings;
  },

  // D24-D28: Contact/location detectors
  D24_DETECT_ADDRESS_CONFLICT: function(textBlocks) {
    var findings = [];
    // Street name bounded to letters/spaces on one line (no newlines, max ~30
    // chars) so it cannot swallow OCR blobs. The old greedy [A-Za-z\s]+ matched
    // across lines and produced 276 phantom "addresses" on a scanned bundle.
    var addressRe = /\b\d{1,4}\s+[A-Za-z][A-Za-z ]{2,30}?\b(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Way|Boulevard|Blvd)\b/gi;
    var unique = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = addressRe.exec(textBlocks[i])) !== null) {
        unique[match[0].toLowerCase().replace(/\s+/g, ' ').trim()] = true;
      }
    }
    var addrList = Object.keys(unique);
    // 2-40 distinct addresses can be a genuine multi-address / service-evasion
    // signal; an implausibly high count is OCR/regex noise, not evidence, so it
    // is suppressed rather than reported as "276 different addresses".
    if (addrList.length >= 2 && addrList.length <= 40) {
      findings.push({ type: 'CT36', severity: 2,
        evidence: addrList.length + ' different addresses found',
        location: 'Multiple pages' });
    }
    return findings;
  },

  D25_DETECT_CONTACT_MISMATCH: function(textBlocks) {
    var findings = [];
    var emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    var emails = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = emailRe.exec(textBlocks[i])) !== null) {
        emails.push({ value: match[0].toLowerCase(), page: i });
      }
    }
    var domains = {};
    for (var j = 0; j < emails.length; j++) {
      var domain = emails[j].value.split('@')[1];
      domains[domain] = true;
    }
    var domainList = Object.keys(domains);
    if (domainList.length >= 2) {
      findings.push({ type: 'CT37', severity: 2,
        evidence: 'Multiple email domains: ' + domainList.join(', '),
        location: 'Multiple pages' });
    }
    return findings;
  },

  D26_DETECT_JURISDICTIONAL_ISSUE: function(textBlocks) {
    // Naming more than one jurisdiction is not an impossibility — every
    // cross-border matter (parties in two countries, agreements spanning both)
    // does it, so scoring it as a MEDIUM finding was guaranteed noise. An
    // external reviewer of the Greensky report called it out as "not a finding
    // at all", and they were right. The observation is still worth recording
    // for context, so it is emitted as an UNSCORED context note (contextOnly)
    // that the engine routes into the extraction notes, never the findings.
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var jurisdictions = [
      ['south africa','dubai','uae','u.k','u.s.a','australia','india'],
      ['high court','magistrate','supreme court','federal court']
    ];
    var foundJurisdictions = [];
    for (var i = 0; i < jurisdictions[0].length; i++) {
      if (fullText.indexOf(jurisdictions[0][i]) !== -1) foundJurisdictions.push(jurisdictions[0][i]);
    }
    if (foundJurisdictions.length > 1) {
      findings.push({ type: 'CT38', severity: 0, contextOnly: true,
        evidence: 'Context: multiple jurisdictions are referenced (' + foundJurisdictions.join(', ') + ') — expected in a cross-border matter and NOT scored as a finding.',
        location: 'Full document' });
    }
    return findings;
  },

  // D27-D30: Evidence/witness detectors
  D27_DETECT_CUSTODY_GAP: function(textBlocks) {
    // A custody GAP only exists where custody documentation is EXPECTED. The
    // old check counted five hand-over phrases across the whole document and
    // flagged any compilation of emails/screenshots as an "incomplete chain of
    // custody" — technically wrong for a bundle, as an external reviewer noted.
    // Now: silent unless the document itself claims chain-of-custody
    // procedures; and when it does, the finding quotes that claim with its page.
    var findings = [];
    var CUSTODY_CONTEXT = /\bchain\s+of\s+custody\b|\bcustody\s+(?:log|register|record)\b|\bevidence\s+(?:register|bag|locker|log)\b|\bexhibit\s+register\b/i;
    var ctxPage = 0, ctxSnippet = '';
    for (var b = 0; b < textBlocks.length; b++) {
      var m = CUSTODY_CONTEXT.exec(textBlocks[b] || '');
      if (m) {
        ctxPage = b + 1;
        var t = textBlocks[b];
        ctxSnippet = t.substring(Math.max(0, m.index - 60), Math.min(t.length, m.index + m[0].length + 60)).replace(/\s+/g, ' ').trim();
        break;
      }
    }
    if (!ctxPage) return findings;
    var fullText = textBlocks.join(' ').toLowerCase();
    var custodyTerms = ['received by','handed to','transferred to','logged by','signed for'];
    var found = [];
    for (var i = 0; i < custodyTerms.length; i++) {
      if (fullText.indexOf(custodyTerms[i]) !== -1) found.push(custodyTerms[i]);
    }
    if (found.length < 3) {
      findings.push({ type: 'CT39', severity: 2,
        evidence: 'Chain-of-custody documentation is claimed ("…' + ctxSnippet + '…", page ' + ctxPage + ') but only ' + found.length + ' of ' + custodyTerms.length + ' expected hand-over steps (received by / handed to / transferred to / logged by / signed for) appear in the document',
        location: 'Page ' + ctxPage });
    }
    return findings;
  },

  D28_DETECT_WITNESS_CONFLICT: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    // Look for phrases suggesting conflicting accounts
    var conflictMarkers = [
      'however the witness','contrary to','in contrast','on the other hand',
      'the witness stated','according to the witness'
    ];
    var count = 0;
    for (var i = 0; i < conflictMarkers.length; i++) {
      if (fullText.indexOf(conflictMarkers[i]) !== -1) count++;
    }
    if (count >= 3) {
      findings.push({ type: 'CT40', severity: 3,
        evidence: count + ' witness conflict markers found',
        location: 'Witness statements' });
    }
    return findings;
  },

  D29_DETECT_SCOPE_CREEP: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var originalScope = fullText.match(/\b(scope of work|scope of services|what is included)\b/gi);
    var expandedTerms = fullText.match(/\b(additionally|furthermore|including but not limited to|etc|and so on)\b/gi);
    if (originalScope && expandedTerms && expandedTerms.length > 5) {
      findings.push({ type: 'CT07', severity: 2,
        evidence: 'Scope may have expanded: ' + originalScope.length + ' scope references but ' + expandedTerms.length + ' expansion phrases',
        location: 'Full document' });
    }
    return findings;
  },

  D30_DETECT_TERM_DEFINITION_CONFLICT: function(textBlocks) {
    var findings = [];
    // A real defined term is a quoted phrase or a content word — not a function
    // word. The old rule matched any \w+ before "means", so "by means of" and
    // "this means that" were reported as defined terms "by" and "this". Guard
    // with a stoplist, a length floor, and reject the "means of" grammar.
    var TERM_STOP = { the:1, this:1, that:1, those:1, these:1, then:1, than:1,
      by:1, of:1, to:1, in:1, on:1, at:1, for:1, and:1, nor:1, or:1, but:1,
      any:1, all:1, such:1, each:1, both:1, either:1, it:1, its:1, is:1, are:1,
      was:1, were:1, be:1, been:1, as:1, so:1, if:1, which:1, who:1, whom:1,
      shall:1, will:1, may:1, must:1, agreement:1, party:1, parties:1, clause:1,
      section:1, hereto:1, herein:1, hereof:1, thereof:1, herewith:1 };
    var definitionRe = /("[^"]+"|\b[a-z][a-z'-]{3,})\s+(?:shall mean|means|is defined as|refers to)\b(?!\s+of\b)/gi;
    var definitions = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = definitionRe.exec(textBlocks[i])) !== null) {
        var quoted = match[1].charAt(0) === '"';
        var term = match[1].toLowerCase().replace(/"/g, '').trim();
        // Bare (unquoted) words must be plausible defined terms, not boilerplate.
        if (!quoted && (TERM_STOP[term] || term.length < 4)) continue;
        if (definitions[term] !== undefined && definitions[term] !== i) {
          findings.push({ type: 'CT08', severity: 3,
            evidence: 'Term "' + term + '" defined in multiple locations',
            location: 'Page ' + (definitions[term]+1) + ' and Page ' + (i+1) });
        }
        definitions[term] = i;
      }
    }
    return findings;
  },

  // D31-D37: Advanced detectors
  D31_DETECT_CAUSAL_IMPOSSIBILITY: function(textBlocks) {
    // The old check ran `before.*received.*sent` across the ENTIRE document as
    // one string — on a 353-page file those three words appear somewhere in
    // order almost by chance, and the resulting finding ("Possible causal
    // impossibility in event sequence", no quote, no page) was unverifiable
    // noise. Now the impossible ordering must occur INSIDE ONE SENTENCE, and
    // the finding quotes that sentence with its page — or stays silent.
    var findings = [];
    var causalPatterns = [
      /\breceived\b[^.!?]{0,120}\bbefore\b[^.!?]{0,120}\b(?:it\s+was\s+|being\s+|be(?:en)?\s+)?sent\b/i,
      /\breplied\b[^.!?]{0,120}\bbefore\b[^.!?]{0,120}\breceiv(?:ed|ing)\b/i,
      /\bdelivered\b[^.!?]{0,120}\bbefore\b[^.!?]{0,120}\b(?:it\s+was\s+|being\s+|be(?:en)?\s+)?dispatched\b/i
    ];
    for (var b = 0; b < textBlocks.length; b++) {
      var t = textBlocks[b] || '';
      for (var i = 0; i < causalPatterns.length; i++) {
        var m = causalPatterns[i].exec(t);
        if (m) {
          var quote = m[0].replace(/\s+/g, ' ').trim();
          if (quote.length > 220) quote = quote.substring(0, 220) + '…';
          findings.push({ type: 'CT05', severity: 3,
            evidence: 'Possible causal impossibility in one sentence: "' + quote + '"',
            location: 'Page ' + (b + 1) });
          break; // one finding per page is enough; dedup caps the rest
        }
      }
    }
    return findings;
  },

  D32_DETECT_SIGNATURE_ANOMALY: function(textBlocks) {
    var findings = [];
    // A signature-METHOD anomaly means the document was executed by an unusual
    // mechanism -- a conformed "/s/" mark, a per-procurationem (p.p.) surrogate
    // signing, an "on behalf of" execution. It does NOT mean the phrase "power
    // of attorney" appears somewhere in the bundle: a power of attorney is a
    // legal INSTRUMENT, not a way of signing, and treating it as one (reported
    // at a fictional "Signature block") was a false positive that fired on any
    // correspondence that merely discussed a POA. "electronic/digital
    // signature" is dropped too -- it is the ordinary modern method, not an
    // anomaly. Each surviving hit is anchored to its real page with the quote.
    var sigPatterns = ['/s/', 'signed per pro', 'per procurationem', 'signed on behalf of', 'signed by proxy'];
    for (var i = 0; i < textBlocks.length; i++) {
      var low = (textBlocks[i] || '').toLowerCase();
      for (var p = 0; p < sigPatterns.length; p++) {
        var idx = low.indexOf(sigPatterns[p]);
        if (idx === -1) continue;
        var quote = textBlocks[i].substring(Math.max(0, idx - 20), idx + sigPatterns[p].length + 20).replace(/\s+/g, ' ').trim();
        findings.push({ type: 'CT23', severity: 3,
          evidence: 'Non-standard signature method "' + sigPatterns[p] + '": "' + quote + '"',
          location: 'Page ' + (i + 1) });
      }
    }
    return findings;
  },

  D33_DETECT_IMAGE_MANIPULATION: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    // Only flag when a manipulation verb sits NEXT TO an actual image reference.
    // The old version flagged the bare word "compressed" anywhere -- including
    // the file name -- so a document a user had to compress to upload was
    // accused of "image manipulation". "compressed" is dropped entirely (file
    // compression is benign and ubiquitous); the rest must be near an image noun.
    var imageNoun = '(?:image|images|photo|photos|photograph|picture|screenshot|figure|exhibit|scan|jpeg|jpg|png)';
    var manipTerms = ['resized','cropped','filtered','retouched','photoshopped','edited image','doctored'];
    for (var i = 0; i < manipTerms.length; i++) {
      var term = manipTerms[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(?:' + imageNoun + '[^.]{0,40}' + term + '|' + term + '[^.]{0,40}' + imageNoun + ')');
      if (re.test(fullText)) {
        findings.push({ type: 'CT28', severity: 3,
          evidence: 'Possible image manipulation: "' + manipTerms[i] + '" referenced next to an image',
          location: 'Image sections' });
      }
    }
    return findings;
  },

  D34_DETECT_CURRENCY_FRAUD: function(textBlocks) {
    var findings = [];
    var currencies = [];
    var currencyRe = /\b(R|ZAR|USD|\$|EUR|€|GBP|£)\s*[\d,.]+/g;
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = currencyRe.exec(textBlocks[i])) !== null) {
        currencies.push(match[1]);
      }
    }
    var unique = {};
    for (var j = 0; j < currencies.length; j++) unique[currencies[j]] = true;
    var currList = Object.keys(unique);
    if (currList.length >= 2) {
      findings.push({ type: 'CT16', severity: 3,
        evidence: 'Multiple currencies without conversion: ' + currList.join(', '),
        location: 'Financial sections' });
    }
    return findings;
  },

  D35_DETECT_VERSION_ANOMALY: function(textBlocks) {
    var findings = [];
    // Require the full word "version"/"revision" -- the old pattern matched bare
    // "v" and "rev", so "v9" and "v3" anywhere (or in a file name) were read as
    // a version going backwards, which produced false anomalies.
    var versionRe = /\b(version|revision)\s*[:=.]?\s*(\d+\.?\d*)\b/gi;
    var versions = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = versionRe.exec(textBlocks[i])) !== null) {
        versions.push({ num: match[2], page: i });
      }
    }
    if (versions.length >= 2) {
      var first = parseFloat(versions[0].num);
      var last = parseFloat(versions[versions.length-1].num);
      if (last < first) {
        findings.push({ type: 'CT30', severity: 3,
          evidence: 'Version decreased from ' + versions[0].num + ' to ' + versions[versions.length-1].num,
          location: 'Document header/footer' });
      }
    }
    return findings;
  },

  D36_DETECT_SOURCE_FAILURE: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ');
    var sourceRe = /\b(according to|as per|in accordance with|citing|referenced in)\s+["']?([^"'.]{5,50})["']?/gi;
    var match;
    while ((match = sourceRe.exec(fullText)) !== null) {
      // If source is cited but no supporting document reference
      if (fullText.indexOf(match[2]) === match.index) {
        findings.push({ type: 'CT32', severity: 2,
          evidence: 'Unverified source cited: "' + match[2] + '"',
          location: 'References section' });
      }
    }
    return findings;
  },

  // D38: Conditional-clause trap (Caltex Franchise Agreement cl. 3.2.3). A
  // termination/expiry rests on a clause whose precondition is that the party is
  // the LESSEE (not the owner) under a head lease, but the record shows that
  // party had become the OWNER. The clause's trigger never occurred. This is the
  // evidence the engine missed: the lease clause must be read against ownership.
  // Requires an ownership-ACQUISITION phrase (not just the word "owner", which a
  // franchise agreement uses generically in its definitions), so clean
  // agreements that merely define "lessee"/"owner" do not trip it.
  D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    // Anchor to the PAGE + quote where each half sits, so the finding names a
    // real WHERE (page) instead of a pseudo-location the anchor rule demotes.
    // Matching is case-insensitive; the quote is taken from the original text.
    function pageOf(re) {
      for (var i = 0; i < blocks.length; i++) {
        var raw = String(blocks[i] || '');
        var m = re.exec(raw.toLowerCase());
        if (m) {
          var q = raw.substring(Math.max(0, m.index - 10), Math.min(raw.length, m.index + m[0].length + 40)).replace(/\s+/g, ' ').trim();
          return { page: i + 1, quote: q };
        }
      }
      return null;
    }
    var lessee = pageOf(/not the owner[^.]{0,60}lessee|lessee[^.]{0,60}head lease|head lease[^.]{0,80}(terminat|expir)/);
    var owner = pageOf(/(became|is|registered|the)\s+(the\s+)?owner\b|purchased the property|acquired the property|took transfer|bought the site|owns the (premises|property)|ownership of the premises/);
    var invokesTermination = false;
    for (var b = 0; b < blocks.length; b++) {
      if (/(effluxion|deemed to have terminated|expires?|expiry|terminat)/.test(String(blocks[b]).toLowerCase())) { invokesTermination = true; break; }
    }
    if (lessee && owner && invokesTermination) {
      findings.push({ type: 'CT44', severity: 5,
        evidence: 'Termination/expiry rests on a lessee-only clause (party not the owner): "' + lessee.quote + '" — yet the record shows the party had become the owner of the premises: "' + owner.quote + '". The clause\'s precondition never occurred. HYPOTHESIS: requires legal review.',
        location: (lessee.page === owner.page) ? 'Page ' + lessee.page : 'Page ' + lessee.page + ' vs Page ' + owner.page });
    }
    return findings;
  },

  // D39: Goodwill / value of the business recognised or quantified in one place
  // but denied or said to have no compensable value in another. "You only take
  // away what exists": a forfeiture or clawback of goodwill is an admission it
  // exists. The denial must be goodwill/value-specific to avoid tripping on an
  // ordinary "no compensation for improvements on termination" clause.
  D39_DETECT_ASSET_VALUE_DENIAL: function(textBlocks) {
    var findings = [];
    var blocks = textBlocks || [];
    // Anchor to the PAGE + quote of each half (recognition, denial), so the
    // finding names a real WHERE instead of a pseudo-location the anchor rule
    // demotes. Case-insensitive match; quote from the original text.
    function pageOf(re) {
      for (var i = 0; i < blocks.length; i++) {
        var raw = String(blocks[i] || '');
        var m = re.exec(raw.toLowerCase());
        if (m) {
          var q = raw.substring(Math.max(0, m.index - 10), Math.min(raw.length, m.index + m[0].length + 40)).replace(/\s+/g, ' ').trim();
          return { page: i + 1, quote: q };
        }
      }
      return null;
    }
    var loc = function (a, c) { return a.page === c.page ? 'Page ' + a.page : 'Page ' + a.page + ' vs Page ' + c.page; };
    // Path A — explicit goodwill recognised then denied. "forfeit" counts as
    // recognition (nothing to forfeit unless the asset exists); the denial may
    // be phrased negation-before ("held no compensable goodwill") or -after.
    var recog = pageOf(/(goodwill|value of the business)[^.]{0,120}(clawback|inure|percentage|value|means|quantif|recognis|forfeit)/) ||
                pageOf(/(clawback|percentage of the value)[^.]{0,80}(goodwill|value of the business)/);
    var denies = pageOf(/goodwill[^.]{0,40}(no|not)[^.]{0,20}(compensable|value)|no compensable value|goodwill has no value|(goodwill|value of the business)[^.]{0,40}(no value|not compensable)|(no|not|without)\s+(any\s+)?compensable\s+goodwill|goodwill\s+(is|was)\s+(valueless|worthless)/);
    if (recog && denies) {
      findings.push({ type: 'CT45', severity: 5,
        evidence: 'Goodwill / value of the business is recognised: "' + recog.quote + '" — yet denied or said to have no compensable value: "' + denies.quote + '". The forfeiture/clawback is itself an admission the asset exists. HYPOTHESIS: requires legal review.',
        location: loc(recog, denies) });
    }
    // Path B — the Caltex/AllFuels clause-11 trap: the franchisee gets NO
    // compensation for its OWN improvements to the premises, while the
    // franchisor is entitled to acquire the property itself at (fair market)
    // value. Value denied to the party who built it, realised by the other —
    // the same recognised-then-denied principle in one clause. Requires BOTH
    // halves, so an ordinary no-compensation-for-improvements clause stays
    // silent (that clause alone is not a contradiction).
    var noComp = pageOf(/not\s+(?:be\s+)?entitled\s+to\s+(?:any\s+)?(?:compensation|repayment)[^.]{0,140}(?:structural|addition|alteration|improvement)/);
    var acquires = pageOf(/entitled[^.]{0,60}(?:purchase|acquire|buy)[^.]{0,70}(?:property|premises|site)[^.]{0,70}(?:fair market value|market value|value)/);
    if (noComp && acquires) {
      findings.push({ type: 'CT45', severity: 5,
        evidence: 'The franchisee is denied any compensation for its own improvements to the premises: "' + noComp.quote + '" — while the franchisor is entitled to acquire the property itself at value: "' + acquires.quote + '". Value denied to the party who built it, yet realised by the other. HYPOTHESIS: requires legal review.',
        location: loc(noComp, acquires) });
    }
    return findings;
  },

  D37_DETECT_INTERNAL_CONFLICT_CATCHALL: function(textBlocks, otherFindings) {
    var findings = [];
    // If multiple different contradiction types found, flag as systematic fraud
    var uniqueTypes = {};
    for (var i = 0; i < otherFindings.length; i++) {
      uniqueTypes[otherFindings[i].type] = true;
    }
    var typeCount = Object.keys(uniqueTypes).length;
    // Breadth of indicator TYPES is context, not itself a contradiction, and it
    // must never be labelled "fraud" — that is a conclusion the engine cannot
    // draw, and it double-counts (some of those types may be low-signal). It is
    // a meta-observation about the engine's own output, so it must not be
    // COUNTED as a finding either (an external reviewer flagged exactly that):
    // contextOnly routes it into the extraction notes, out of the findings.
    if (typeCount >= 8) {
      findings.push({ type: 'CT43', severity: 0, contextOnly: true,
        evidence: 'Breadth note: ' + typeCount + ' different indicator types were triggered across the document — a high count reflects variety of checks, not a determination of wrongdoing.',
        location: 'Full document' });
    }
    return findings;
  }
};

// ===================== 17 SERIAL PATTERNS =====================
// Multi-step fraud schemes that unfold across a document or document set.
// Each pattern is a sequence of stages that, when detected together,
// indicate a sophisticated fraud operation.

var SERIAL_PATTERNS = {

  SP01_ADVANCE_FEE_FRAUD: {
    name: 'Advance Fee Fraud (419 Scam)',
    stages: [
      { indicator: 'Unsolicited contact', keywords: ['dear beneficiary','dear friend','confidential proposal'] },
      { indicator: 'Large sum promised', keywords: ['million dollars','inheritance','unclaimed funds','compensation'] },
      { indicator: 'Upfront fee requested', keywords: ['processing fee','transfer fee','legal fee','release fee'] },
      { indicator: 'Urgency pressure', keywords: ['urgent','time sensitive','act now','expires'] },
      { indicator: 'Secrecy demanded', keywords: ['confidential','do not disclose','keep secret','private matter'] }
    ],
    severity: 5, category: 'FINANCIAL_FRAUD'
  },

  SP02_GHOST_EMPLOYEE_SCHEME: {
    name: 'Ghost Employee Scheme',
    stages: [
      { indicator: 'Fictitious staff', keywords: ['ghost employee','fictitious employee','phantom worker'] },
      { indicator: 'Payroll manipulation', keywords: ['payroll','salary','wages','direct deposit'] },
      { indicator: 'Identity fabrication', keywords: ['id number','bank account','fake identity'] },
      { indicator: 'Supervisor collusion', keywords: ['approved by','authorized by','manager sign off'] }
    ],
    severity: 5, category: 'PAYROLL_FRAUD'
  },

  SP03_SHELL_COMPANY_FRAUD: {
    name: 'Shell Company Fraud',
    stages: [
      { indicator: 'New entity creation', keywords: ['new company','new registration','recently formed'] },
      { indicator: 'No physical presence', keywords: ['virtual office','mailing address','no premises'] },
      { indicator: 'Round-trip invoicing', keywords: ['invoice','payment','supplier','vendor'] },
      { indicator: 'Beneficial owner hidden', keywords: ['nominee director','trust arrangement','beneficial owner'] }
    ],
    severity: 5, category: 'CORPORATE_FRAUD'
  },

  SP04_INVOICE_FRAUD: {
    name: 'Invoice Fraud',
    stages: [
      { indicator: 'Duplicate invoice', keywords: ['duplicate invoice','copy invoice','reissued'] },
      { indicator: 'Altered details', keywords: ['amended','corrected','revised','updated'] },
      { indicator: 'Bank detail change', keywords: ['new bank details','updated banking','account change'] },
      { indicator: 'Pressure to pay', keywords: ['urgent payment','overdue','final demand','immediate'] }
    ],
    severity: 4, category: 'FINANCIAL_FRAUD'
  },

  SP05_VAT_CAROUSEL: {
    name: 'VAT Carousel Fraud',
    stages: [
      { indicator: 'Cross-border trade', keywords: ['import','export','cross-border','eu member'] },
      { indicator: 'Missing trader', keywords: ['missing trader','disappeared','cannot locate'] },
      { indicator: 'Circular transactions', keywords: ['supplier','customer','broker','agent'] },
      { indicator: 'VAT reclaim', keywords: ['vat refund','input tax','zero-rated','export vat'] }
    ],
    severity: 5, category: 'TAX_FRAUD'
  },

  SP06_DOCUMENT_FORGERY_CHAIN: {
    name: 'Document Forgery Chain',
    stages: [
      { indicator: 'Template acquisition', keywords: ['template','original document','scanned copy'] },
      { indicator: 'Content manipulation', keywords: ['edited','modified','changed','updated'] },
      { indicator: 'Signature fabrication', keywords: ['scanned signature','pasted','copied signature'] },
      { indicator: 'Metadata cleaning', keywords: ['properties removed','metadata cleared','anonymized'] }
    ],
    severity: 5, category: 'DOCUMENT_FRAUD'
  },

  SP07_IDENTITY_THEFT_CHAIN: {
    name: 'Identity Theft Document Chain',
    stages: [
      { indicator: 'ID document theft', keywords: ['stolen id','lost passport','compromised identity'] },
      { indicator: 'Account takeover', keywords: ['account access','password reset','unauthorized access'] },
      { indicator: 'Fraudulent application', keywords: ['new account','credit application','loan application'] },
      { indicator: 'Financial exploitation', keywords: ['unauthorized transaction','fraudulent withdrawal','false claim'] }
    ],
    severity: 5, category: 'IDENTITY_FRAUD'
  },

  SP08_BRIBERY_SCHEME: {
    name: 'Bribery and Corruption Scheme',
    stages: [
      { indicator: 'Approach', keywords: ['gift','hospitality','facilitation payment','consulting fee'] },
      { indicator: 'Agreement', keywords: ['arrangement','understanding','mutual benefit','quid pro quo'] },
      { indicator: 'Payment', keywords: ['cash','offshore','shell company','third party'] },
      { indicator: 'Action', keywords: ['favorable decision','contract award','exemption','waiver'] }
    ],
    severity: 5, category: 'CORRUPTION'
  },

  SP09_LOAN_FRAUD: {
    name: 'Loan Application Fraud',
    stages: [
      { indicator: 'Income inflation', keywords: ['salary','income','revenue','turnover'] },
      { indicator: 'Asset overstatement', keywords: ['property value','asset','collateral','security'] },
      { indicator: 'Liability concealment', keywords: ['existing loan','debt','obligation','commitment'] },
      { indicator: 'Identity fabrication', keywords: ['employment letter','payslip','bank statement'] }
    ],
    severity: 4, category: 'FINANCIAL_FRAUD'
  },

  SP10_INSURANCE_FRAUD: {
    name: 'Insurance Claim Fraud',
    stages: [
      { indicator: 'Staged event', keywords: ['accident','incident','loss','damage'] },
      { indicator: 'Exaggerated claim', keywords: ['total loss','beyond repair','irreparable'] },
      { indicator: 'False documentation', keywords: ['repair quote','assessment','valuation','medical report'] },
      { indicator: 'Previous claims', keywords: ['prior claim','previous loss','another incident'] }
    ],
    severity: 4, category: 'INSURANCE_FRAUD'
  },

  SP11_TENDER_MANIPULATION: {
    name: 'Tender/RFP Manipulation',
    stages: [
      { indicator: 'Specification rigging', keywords: ['exclusive requirement','unique specification','only supplier'] },
      { indicator: 'Bid collusion', keywords: ['agreed price','coordinated bid','market allocation'] },
      { indicator: 'Evaluation bias', keywords: ['preferred bidder','pre-selected','favored'] },
      { indicator: 'Award irregularity', keywords: ['deviation','waiver','exception','urgent award'] }
    ],
    severity: 5, category: 'PROCUREMENT_FRAUD'
  },

  SP12_MONEY_LAUNDERING: {
    name: 'Money Laundering Documentation',
    stages: [
      { indicator: 'Layering', keywords: ['multiple transfers','intermediary','broker','agent'] },
      { indicator: 'Integration', keywords: ['investment','property purchase','business acquisition'] },
      { indicator: 'Source concealment', keywords: ['consulting fee','commission','referral','introduction'] },
      { indicator: 'Offshore routing', keywords: ['offshore account','tax haven','shell company','trust'] }
    ],
    severity: 5, category: 'MONEY_LAUNDERING'
  },

  SP13_DIGITAL_SIGNATURE_FRAUD: {
    name: 'Digital Signature Forgery',
    stages: [
      { indicator: 'Signature theft', keywords: ['scanned signature','signature file','image of signature'] },
      { indicator: 'Document preparation', keywords: ['template','blank form','pre-filled'] },
      { indicator: 'Signature application', keywords: ['pasted','inserted','placed','applied'] },
      { indicator: 'Distribution', keywords: ['email','fax','scanned copy','pdf'] }
    ],
    severity: 4, category: 'DIGITAL_FRAUD'
  },

  SP14_CONTRACT_FRUAD: {
    name: 'Contract Fraud',
    stages: [
      { indicator: 'Bait terms', keywords: ['introductory rate','special offer','limited period'] },
      { indicator: 'Hidden clauses', keywords: ['fine print','schedule','annex','appendix'] },
      { indicator: 'Unilateral change', keywords: ['reserves the right','may change','at our discretion'] },
      { indicator: 'Enforcement barrier', keywords: ['arbitration','foreign jurisdiction','governing law'] }
    ],
    severity: 3, category: 'CONTRACT_FRAUD'
  },

  SP15_WITNESS_TAMPERING: {
    name: 'Witness Statement Tampering',
    stages: [
      { indicator: 'Statement acquisition', keywords: ['witness statement','affidavit','deposition'] },
      { indicator: 'Content alteration', keywords: ['amended','corrected','clarified','revised'] },
      { indicator: 'Coercion indicators', keywords: ['persuaded','convinced','advised','suggested'] },
      { indicator: 'Submission fraud', keywords: ['signed','certified','true copy','original'] }
    ],
    severity: 5, category: 'EVIDENCE_TAMPERING'
  },

  SP16_PERJURY_CHAIN: {
    name: 'Perjury Documentation Chain',
    stages: [
      { indicator: 'False oath', keywords: ['sworn','affirm','solemnly declare','under oath'] },
      { indicator: 'False statement', keywords: ['i swear','i affirm','to the best of my knowledge'] },
      { indicator: 'Material falsity', keywords: ['specifically','exactly','precisely','definitely'] },
      { indicator: 'Corroboration failure', keywords: ['i recall','i remember','as far as i know'] }
    ],
    severity: 5, category: 'PERJURY'
  },

  SP17_SYSTEMIC_FRAUD: {
    name: 'Systemic Institutional Fraud',
    stages: [
      { indicator: 'Pattern of victims', keywords: ['multiple complaints','class action','group claim'] },
      { indicator: 'Institutional cover-up', keywords: ['internal investigation','confidential settlement','non-disclosure'] },
      { indicator: 'Regulatory evasion', keywords: ['exemption','waiver','special permission','temporary relief'] },
      { indicator: 'Continued operation', keywords: ['ongoing','continues to','still operating','business as usual'] }
    ],
    severity: 5, category: 'SYSTEMIC_FRAUD'
  }
};

// ===================== SERIAL PATTERN DETECTOR =====================

// Serial patterns are multi-stage fraud schemes (e.g. a 419 letter: big sum
// promised -> upfront fee -> urgency -> secrecy). A real scheme has those
// stages TOGETHER in one short document. The old detector joined every page
// into one string and asked whether each stage's keyword appeared ANYWHERE --
// so a 528-page legal bundle "matched" 419 Scam, Money Laundering, Bribery and
// more purely because those common words each occur somewhere across 500 pages.
// That is a false-positive machine that put fabricated fraud-scheme headlines
// on top of the report.
//
// Co-location fix: a pattern is only detected when its stages cluster within a
// sliding window of consecutive pages (WINDOW). A genuine scam email (1-3 pages)
// still matches; scattered vocabulary across a large bundle does not. The
// detected location becomes the real page range of the cluster, not
// "Full document". textBlocks are per-page (see extractPageText); a single
// collapsed block (short doc / OCR fallback) is treated as one window.
var SERIAL_WINDOW_PAGES = 3;

// A stage may only be satisfied by a DISTINCTIVE keyword: a multi-word phrase,
// or one of these strong single words. Generic single words (pdf, signed,
// income, urgent, compensation, confidential, amended, advised, placed,
// template, security, obligation, …) appear innocently all over legal bundles,
// so on their own they matched fraud "stages" and produced scary false labels
// (Digital Signature Forgery on "pdf"; Witness Tampering on "signed"). Those
// words still exist in the pattern definitions but no longer, alone, satisfy a
// stage. All matching is word-boundary (so "signed" ≠ "designed"/"assigned").
var SERIAL_DISTINCTIVE_SINGLE = {
  racketeering: 1, embezzlement: 1, kickback: 1, laundering: 1, forgery: 1,
  ponzi: 1, bribery: 1, affidavit: 1, deposition: 1, perjury: 1, collusion: 1
};
function voSerialStageStrong(kw) {
  return kw.indexOf(' ') !== -1 || SERIAL_DISTINCTIVE_SINGLE[kw] === 1;
}
function voSerialKeywordHit(windowText, kw) {
  var re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  return re.test(windowText);
}

// ===================== DIGITAL FORENSICS (raw PDF structure) =====================
// Deterministic, on-device checks on the raw PDF bytes + Info dictionary. These
// look at what the FILE says about its own history — revision snapshots, XMP vs
// Info disagreement, post-signature saves, embedded active content. Every output
// is an INDICATOR with an innocent explanation stated alongside; none is a
// determination of tampering. Designed not to self-flag Verum's own sealed
// outputs (pdf-lib full-save writes a single revision and no XMP).

function voToU8(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes && bytes.buffer instanceof ArrayBuffer) return new Uint8Array(bytes.buffer);
  return new Uint8Array(bytes);
}

// Find an ASCII needle in a byte array (no big string materialisation).
function voByteIndexOf(u8, needle, from) {
  var n0 = needle.charCodeAt(0), nLen = needle.length, max = u8.length - nLen;
  for (var i = Math.max(0, from | 0); i <= max; i++) {
    if (u8[i] !== n0) continue;
    var hit = true;
    for (var j = 1; j < nLen; j++) { if (u8[i + j] !== needle.charCodeAt(j)) { hit = false; break; } }
    if (hit) return i;
  }
  return -1;
}

function voByteOffsets(u8, needle, cap) {
  var out = [], at = 0;
  while (out.length < (cap || 1000)) {
    var idx = voByteIndexOf(u8, needle, at);
    if (idx === -1) break;
    out.push(idx);
    at = idx + needle.length;
  }
  return out;
}

// Slice a byte range to a latin1 string (bounded, for XMP parsing only).
function voBytesToLatin1(u8, start, end) {
  var s = '', e = Math.min(end, u8.length);
  for (var i = Math.max(0, start); i < e; i++) s += String.fromCharCode(u8[i]);
  return s;
}

// Pull the XMP packet (if any) as text, capped at 128KB.
function voExtractXmp(u8) {
  var a = voByteIndexOf(u8, '<x:xmpmeta', 0);
  if (a === -1) return null;
  var b = voByteIndexOf(u8, '</x:xmpmeta>', a);
  if (b === -1 || b - a > 131072) b = Math.min(a + 131072, u8.length);
  return voBytesToLatin1(u8, a, b + 12);
}

function voXmpValue(xmp, tag) {
  // Element form <tag>value</tag> or attribute form tag="value".
  var m = new RegExp('<' + tag + '>([^<]{1,80})</' + tag + '>').exec(xmp);
  if (m) return m[1].trim();
  m = new RegExp(tag + '="([^"]{1,80})"').exec(xmp);
  return m ? m[1].trim() : null;
}

function voDigitalForensicsScan(pdfBytes, pdfDoc) {
  var findings = [];
  var u8;
  try { u8 = voToU8(pdfBytes); } catch (e) { return findings; }
  if (!u8 || u8.length < 100) return findings;

  // 1. Embedded revision snapshots. Every incremental save appends a new xref +
  // %%EOF, leaving the previous version recoverable inside the file. One EOF is
  // a clean single save; two is common for linearized ("fast web view") files;
  // three or more means the file carries real revision history.
  var eofs = voByteOffsets(u8, '%%EOF', 200);
  if (eofs.length >= 3) {
    findings.push({ type: 'CT30', severity: 2,
      evidence: 'The file contains ' + eofs.length + ' embedded revision snapshots (incremental saves) — earlier versions of the document may be recoverable from within this file. Common in normal editing workflows, but on a document presented as a final/original it merits review with a PDF forensic tool.',
      location: 'PDF structure' });
  }

  // 2. Content saved AFTER a digital signature. A signature's own revision ends
  // with one %%EOF; any %%EOF after the signature object means the file was
  // saved again after signing. (Some later saves are benign, e.g. adding a
  // second signature — which is why this stays an indicator.)
  var byteRangeAt = voByteIndexOf(u8, '/ByteRange', 0);
  if (byteRangeAt !== -1) {
    var eofsAfterSig = 0;
    for (var i = 0; i < eofs.length; i++) { if (eofs[i] > byteRangeAt) eofsAfterSig++; }
    if (eofsAfterSig >= 2) {
      findings.push({ type: 'CT41', severity: 4,
        evidence: 'The file was saved ' + (eofsAfterSig - 1) + ' more time(s) AFTER a digital signature was applied — content may have been added or changed post-signing. (A benign cause is a second signature or form fill; verify the signed revision against the final file.)',
        location: 'PDF structure' });
    }
  }

  // 3. Embedded active content (JavaScript / auto-run action). Legitimate PDFs
  // rarely need it; on evidence it deserves a look because scripts can change
  // what a document displays.
  if (voByteIndexOf(u8, '/JavaScript', 0) !== -1 ||
      (voByteIndexOf(u8, '/OpenAction', 0) !== -1 && voByteIndexOf(u8, '/JS', 0) !== -1)) {
    findings.push({ type: 'CT42', severity: 2,
      evidence: 'The file embeds active content (JavaScript / auto-run action). Scripts can alter what a PDF displays; review with a PDF forensic tool before relying on the on-screen rendering.',
      location: 'PDF structure' });
  }

  // 4. XMP vs Info dictionary disagreement. The two metadata stores are written
  // together by well-behaved tools; large disagreement means the file passed
  // through multiple tools or was edited with only one store updated.
  try {
    var xmp = voExtractXmp(u8);
    // SELF-SEAL GUARD. Verum's own sealing pass calls setProducer('Verum Omnis
    // …') and setCreationDate(now) on the output. So on any sealed file that
    // carried pre-existing XMP, the Info dictionary describes OUR SEAL (today's
    // date, our tool) while the XMP still describes the original document —
    // and both the creation-date and producer comparisons below fire every
    // single time. On the AllFuels rerun that produced a "Timestamp
    // Manipulation" finding whose real cause was the user's own seal, which is
    // exactly the kind of allegation that gets a bundle impeached. When the
    // Info dictionary is ours, these two comparisons say nothing about the
    // document's history and are suppressed — disclosed, never silent.
    var _selfProducer = '';
    try { _selfProducer = pdfDoc ? (pdfDoc.getProducer() || '') : ''; } catch (eSp) {}
    var _isVerumSealed = /verum\s*omnis/i.test(_selfProducer);
    if (_isVerumSealed && xmp) {
      findings.voSelfSealNote = 'Metadata comparison suppressed: this file was sealed by Verum Omnis, so its Info dictionary carries the SEAL\'s tool and timestamp, not the source document\'s. The XMP-vs-Info creation-date and producer differences that follow from that are artefacts of sealing, not evidence about the document, and were NOT reported as findings. To test the original document\'s metadata, scan the unsealed original.';
    }
    if (xmp && pdfDoc && !_isVerumSealed) {
      var xmpCreate = voXmpValue(xmp, 'xmp:CreateDate');
      var infoCreate = null;
      try { infoCreate = pdfDoc.getCreationDate(); } catch (e2) {}
      if (xmpCreate && infoCreate) {
        var xd = Date.parse(xmpCreate);
        if (isFinite(xd) && Math.abs(xd - infoCreate.getTime()) > 26 * 3600 * 1000) {
          findings.push({ type: 'CT29', severity: 3,
            evidence: 'The file\'s two metadata stores disagree on the creation date: XMP says ' + xmpCreate + ' but the Info dictionary says ' + infoCreate.toISOString() + ' — consistent with editing that updated one store but not the other. Request the native original to establish the true date.',
            location: 'PDF metadata' });
        }
      }
      var xmpTool = voXmpValue(xmp, 'pdf:Producer') || voXmpValue(xmp, 'xmp:CreatorTool');
      var infoProducer = '';
      try { infoProducer = pdfDoc.getProducer() || ''; } catch (e3) {}
      if (xmpTool && infoProducer) {
        var a2 = xmpTool.toLowerCase().replace(/\s+/g, ' ').trim();
        var b2 = infoProducer.toLowerCase().replace(/\s+/g, ' ').trim();
        if (a2 && b2 && a2.indexOf(b2) === -1 && b2.indexOf(a2) === -1) {
          findings.push({ type: 'CT24', severity: 2,
            evidence: 'The file\'s two metadata stores name different creating tools: XMP says "' + xmpTool + '" but the Info dictionary says "' + infoProducer + '" — the file has passed through more than one tool since creation.',
            location: 'PDF metadata' });
        }
      }
    }
  } catch (e4) {}

  return findings;
}

// ===================== PAGE-ANCHOR BACK-FILL =====================
// Most detectors scan the joined text and report location "Full document", which
// downstream becomes page 0 — so the highest-value findings (CT01/CT14/CT35/…)
// arrived unanchored. This pass pins a finding to a real page when its evidence
// resolves to EXACTLY ONE page: either a verbatim quoted passage found on one
// page, or the distinctive tokens after a colon co-occurring on one page. If the
// evidence spans multiple pages or can't be located, the finding stays "Full
// document" — no false precision, and a genuinely cross-page conflict is not
// misreported as living on a single page.
function voNormMatch(s) {
  // Keep Unicode letters/numbers (accented names, non-Latin scripts) rather than
  // stripping to a-z0-9, which would mangle e.g. "Nortjé"; collapse the rest to
  // spaces. \p{L}\p{N} needs the /u flag (ES2018, supported in every browser we
  // target and in Node).
  // NFC first so a precomposed "é" and a decomposed "e"+combining-acute compare
  // equal (the combining mark would otherwise be stripped from only one side).
  return String(s == null ? '' : s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function voPageForEvidence(ev, normBlocks) {
  var text = String(ev == null ? '' : ev);
  // 1. Verbatim quoted fragments (straight or curly quotes), 14+ chars.
  var frags = [];
  var qRe = /["“”‘’']([^"“”‘’']{14,})["“”‘’']/g, m;
  while ((m = qRe.exec(text)) !== null) frags.push(m[1]);
  for (var i = 0; i < frags.length; i++) {
    var norm = voNormMatch(frags[i]);
    if (norm.length < 12) continue;
    // Use a solid inner window so a fragment cut at a page edge still matches.
    var start = Math.floor((norm.length - 30) / 2);
    var probe = norm.length > 40 ? norm.slice(start, start + 30) : norm;
    var hits = [];
    for (var b = 0; b < normBlocks.length; b++) { if (normBlocks[b].indexOf(probe) !== -1) hits.push(b + 1); }
    if (hits.length === 1) return hits[0];
  }
  // 2. Distinctive tokens after a colon ("... claims: registered, liquidated").
  var colon = text.indexOf(':');
  if (colon !== -1) {
    var toks = voNormMatch(text.slice(colon + 1)).split(' ').filter(function (w) { return w.length >= 5; });
    toks = toks.slice(0, 4);
    if (toks.length >= 2) {
      var pages = [];
      for (var b2 = 0; b2 < normBlocks.length; b2++) {
        var all = true;
        for (var t = 0; t < toks.length; t++) { if (normBlocks[b2].indexOf(toks[t]) === -1) { all = false; break; } }
        if (all) pages.push(b2 + 1);
      }
      if (pages.length === 1) return pages[0];
    }
  }
  return 0;
}

// MULTI-PAGE ANCHORING. A document-wide pattern — many email domains, a bank
// account repeated across correspondence — is NOT unanchorable; it is anchored
// to a SET of pages. voPageForEvidence resolves a page only when a probe hits
// EXACTLY one, so these findings ("Multiple email domains: …", location
// "Multiple pages") failed the anchor rule and dropped out of the report as
// unanchored observations, even though every instance sits on a known page.
//
// This UPHOLDS the anchor rule rather than waiving it: the finding must still
// cite real pages, and a pattern that cannot be enumerated to a bounded page
// set stays unanchored. Probes must be >= 4 normalised chars, so a bare "R" or
// "$" (which appears on nearly every page) can never anchor anything.
var VO_MULTIPAGE_CAP = 25; // hitting more pages than this is noise, not an anchor
function voPagesForEvidence(ev, normBlocks, cap) {
  var text = String(ev == null ? '' : ev);
  // `cap === undefined` rather than a truthiness test, so an explicit cap of 0
  // ("anchor nothing") is honoured instead of silently becoming the default.
  var limit = (cap === undefined || cap === null) ? VO_MULTIPAGE_CAP : cap;
  var probes = [], i, m;
  // Items enumerated after a colon: "Multiple email domains: a.com, b.org".
  var colon = text.indexOf(':');
  if (colon !== -1) {
    var items = text.slice(colon + 1).split(/[,;]/);
    for (i = 0; i < items.length; i++) {
      var t = voNormMatch(items[i]);
      if (t.length >= 4) probes.push(t);
    }
  }
  // Verbatim quoted fragments.
  var qRe = /["“”‘’']([^"“”‘’']{6,})["“”‘’']/g;
  while ((m = qRe.exec(text)) !== null) {
    var q = voNormMatch(m[1]);
    if (q.length >= 4) probes.push(q);
  }
  if (!probes.length) return [];
  // Short-circuit once the page set passes the cap: beyond it the answer is
  // already "not an anchor", so scanning the rest of a 491-page bundle for every
  // remaining probe is pure waste. This is the common case for a probe that is
  // too generic, and it is exactly the case that was slowest.
  var pageSet = {}, found = 0;
  for (i = 0; i < probes.length; i++) {
    for (var b = 0; b < normBlocks.length; b++) {
      if (normBlocks[b].indexOf(probes[i]) === -1) continue;
      if (pageSet[b + 1]) continue;
      pageSet[b + 1] = true;
      if (++found > limit) return []; // too widespread to be an anchor
    }
  }
  var pages = Object.keys(pageSet).map(Number).sort(function (x, y) { return x - y; });
  if (pages.length < 2) return [];
  return pages;
}

function voBackfillPageAnchors(findings, blocks) {
  if (!blocks || blocks.length < 2) return findings; // one block: nothing to pin against
  var normBlocks = blocks.map(voNormMatch);
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    if (/page\s+\d+/i.test(String(f.location || ''))) continue; // detector already anchored it
    var pg = voPageForEvidence(f.evidence, normBlocks);
    if (pg > 0) { f.location = 'Page ' + pg; continue; }
    // Single page failed: a document-wide pattern is anchored to a page SET.
    var multi = voPagesForEvidence(f.evidence, normBlocks);
    if (multi.length) f.location = 'Pages ' + multi.join(', ');
  }
  return findings;
}

// Template/boilerplate suppression. Case bundles built on the Verum Omnis
// analysis template embed the template's own pages, whose ILLUSTRATIVE text
// ("cropped WhatsApp logs", "forged messages", worked contradiction examples,
// jurisdiction checklists) uses exactly the vocabulary the detectors hunt for.
// A keyword detector cannot tell teaching text from evidence — the Greensky
// scan's unanchored "image manipulation" finding matched the template's own
// example, not the screenshots. Pages carrying the template masthead are
// excluded from evidence scanning (replaced IN PLACE with a neutral
// placeholder so page numbering and page-count statistics survive), and the
// exclusion is disclosed via the returned note (Prime Directive 6).
var VO_TEMPLATE_PAGE_RE = /INSTITUTIONAL\s+REVIEW\s+TEMPLATE|GOLD\s+STANDARD\s+FOR\s+FORENSIC\s+CHAT\s+LOG\s+ANALYSIS/i;
var VO_TEMPLATE_PLACEHOLDER = new Array(11).join('analysis template boilerplate excluded. ');
function voExcludeTemplatePages(textBlocks) {
  if (!textBlocks || textBlocks.length < 2) return null;
  var templatePages = [];
  for (var tp = 0; tp < textBlocks.length; tp++) {
    if (VO_TEMPLATE_PAGE_RE.test(textBlocks[tp] || '')) {
      templatePages.push(tp + 1);
      textBlocks[tp] = VO_TEMPLATE_PLACEHOLDER;
    }
  }
  if (!templatePages.length) return null;
  var tpList = templatePages.length > 12
    ? templatePages.slice(0, 12).join(', ') + ', … (' + templatePages.length + ' in total)'
    : templatePages.join(', ');
  return 'Template boilerplate: ' + templatePages.length + ' page(s) (' + tpList +
    ') carry the Verum Omnis analysis-template masthead. Their text is instructional boilerplate' +
    ' (worked examples, keyword checklists), not case evidence, and was excluded from contradiction scanning.';
}

// The anchor rule, in full (Constitution v6.0, Prime Directives: "If a
// sentence cannot cite anchors, it cannot exist"; Anchor = artifact hash +
// page/line + timestamp + source path). v5.3.2-web only DEMOTED an
// unanchorable finding to LOW — the Greensky rerun showed that still leaves
// findings with source_page 0 inside a sealed report, which is a breach.
// Now: a CONTENT finding that cannot cite a page after back-fill is MOVED OUT
// of the findings entirely. It is not silently dropped (Prime Directive 6):
// its full text goes into the engine notes as an unanchored observation for a
// human to chase. Artifact-level findings (PDF metadata / PDF structure) are
// anchored by the artifact itself and stay; page-span locations ("Pages
// 12-14") are anchored. Pseudo-locations ("Signature block", "Image
// sections", "Full document") are NOT anchors and no longer exempt anything.
var VO_ANCHOR_EXEMPT_LOC = /metadata|pdf structure|pages \d/i;
function voEnforceAnchorRule(findings) {
  var kept = [], unanchored = [];
  for (var ua = 0; ua < findings.length; ua++) {
    var uf = findings[ua];
    if (!uf) continue;
    var uloc = String(uf.location || '');
    if (/page\s*\d/i.test(uloc) || VO_ANCHOR_EXEMPT_LOC.test(uloc)) { kept.push(uf); continue; }
    uf.unanchored = true;
    unanchored.push(uf);
  }
  return { kept: kept, unanchored: unanchored };
}

// ===================== ANCHORED STATEMENT LAYER (v5.4) =====================
// A forensic instrument must not merely say "a contradiction exists" — it must
// bind the finding to WHO, WHERE (page), WHAT (verbatim quote), WHEN (date),
// and — only when the document ITSELF cites one — WHICH provision. The engine
// never invents a statute. It quotes the citation already on the page, or it
// stays silent on law. (The breathalyzer states its reading; it does not write
// the charge sheet. The reading is the machine's; the charge is the court's.)
//
// The timeline is what turns bound findings into a story a human can read:
// ordered by date — "on <date> <party> stated X; on <date> the same point is
// denied" — the narrative form people understand without touching a hash.

// id -> canonical type. CONTRADICTION_TYPES is keyed by long name
// (CT01_DIRECT_STATEMENT) but each value carries .id ('CT01'); findings speak
// in ids, so resolve through this rather than the raw map.
var _VO_CT_BY_ID = null;
function voCtById(id) {
  if (!_VO_CT_BY_ID) {
    _VO_CT_BY_ID = {};
    for (var k in CONTRADICTION_TYPES) {
      if (!Object.prototype.hasOwnProperty.call(CONTRADICTION_TYPES, k)) continue;
      var t = CONTRADICTION_TYPES[k];
      if (t && t.id) _VO_CT_BY_ID[t.id] = t;
    }
  }
  return _VO_CT_BY_ID[id] || null;
}

// Pre-seal page normalisation decision. A PDF CropBox smaller than its MediaBox
// HIDES part of the page from every viewer — the Wallers Garage franchise
// agreement arrived with 58 pages cropped to a landscape slice, so a reader (and
// the sealed copy) saw only ~half of each page though the whole page was in the
// file. Given the MediaBox and CropBox as [x0,y0,x1,y1] arrays, returns true
// when the crop insets any edge beyond a 1pt tolerance (i.e. hides content). A
// CropBox equal to, or larger than, the MediaBox is not a hide and is left
// alone. Deterministic and side-effect-free so the seal pipeline can decide
// per page whether to restore the full page before stamping.
function voCropHidesContent(media, crop) {
  if (!media || !crop || media.length < 4 || crop.length < 4) return false;
  var m = [Number(media[0]), Number(media[1]), Number(media[2]), Number(media[3])];
  var c = [Number(crop[0]), Number(crop[1]), Number(crop[2]), Number(crop[3])];
  for (var i = 0; i < 4; i++) { if (isNaN(m[i]) || isNaN(c[i])) return false; }
  var tol = 1; // sub-point differences are rounding, not a crop
  return (c[0] > m[0] + tol) || (c[1] > m[1] + tol) || (c[2] < m[2] - tol) || (c[3] < m[3] - tol);
}

// Party-role vocabulary for two-sided instruments. A role ("Lessee") is a more
// durable anchor than a personal name and survives redaction.
var VO_PARTY_ROLES = ['lessor','lessee','landlord','tenant','sublessor','sublessee','plaintiff','defendant','applicant','respondent','appellant','purchaser','seller','buyer','vendor','franchisor','franchisee','licensor','licensee','mortgagor','mortgagee','creditor','debtor','guarantor','surety','cedent','cessionary','employer','employee','grantor','grantee','transferor','transferee','assignor','assignee','trustee','beneficiary','insurer','insured'];

// Statute / clause citations the document ITSELF carries. Cite-or-stay-silent:
// law is attached ONLY where one of these literally appears — nothing here
// derives, infers, or looks up an applicable law. It quotes what is on the page.
function voExtractCitations(text) {
  var s = String(text == null ? '' : text);
  var out = [], seen = {};
  var add = function (c) { c = c.replace(/\s+/g, ' ').trim(); var k = c.toLowerCase(); if (c && !seen[k]) { seen[k] = true; out.push(c); } };
  var pats = [
    /\b(?:sub-?)?clause\s+\d+(?:\.\d+)*(?:\([a-z0-9]+\))?/gi,
    /\bparagraph\s+\d+(?:\.\d+)*(?:\([a-z0-9]+\))?/gi,
    /\bpara\.?\s+\d+(?:\.\d+)+/gi,
    /\bsection\s+\d+[A-Z]?(?:\([a-z0-9]+\))*/gi,
    /\bs\.?\s?\d+[A-Z]?(?:\([a-z0-9]+\))+/g,   // s 12(1)(a) — require a bracket so bare "s 12" cannot over-fire
    /\bregulation\s+\d+(?:\.\d+)*/gi,
    /\barticle\s+\d+(?:\.\d+)*(?:\([a-z0-9]+\))*/gi,   // Article 110(2)
    // Abbreviated provision references the Greensky template itself uses:
    // "Art. 110(2)", "Sec. 86(1)", "reg. 4", "cl. 4.5.2". A digit must follow,
    // so a name like "Art Vandelay" or the word "section" cannot trip it.
    /\b(?:art|sec|reg|cl)\.?\s+\d+[A-Z]?(?:\.\d+)*(?:\([a-z0-9]+\))*/gi,
    /\b(?:[A-Z][A-Za-z'’]+\s+){0,4}Act(?:,?\s+(?:No\.?\s*)?\d+)?\s+of\s+\d{4}/g,  // Companies Act 71 of 2008 / Act No. 71 of 2008
    /\bAct\s+(?:No\.?\s*)?\d+\s+of\s+\d{4}/gi,
    /\b(?:Federal\s+)?Law\s+(?:No\.?\s*)?\d+(?:\/\d+)*\/\d{4}/gi   // Federal Law 32/2021
  ];
  for (var p = 0; p < pats.length; p++) { var m; pats[p].lastIndex = 0; while ((m = pats[p].exec(s)) !== null) add(m[0]); }
  // Drop any citation wholly contained in a longer one it overlaps — "Act 71 of
  // 2008" is not a separate provision from "Companies Act 71 of 2008".
  return out.filter(function (c) {
    return !out.some(function (other) {
      return other !== c && other.toLowerCase().indexOf(c.toLowerCase()) !== -1;
    });
  });
}

// Parties present in a passage: explicit legal roles, plus 2–3-token proper
// names (Gary Highcock / Norton Rose Fulbright). Conservative and deterministic
// — a lone capitalised word (sentence start) is not a party.
var VO_NAME_STOP = { The:1, This:1, That:1, These:1, Page:1, Total:1, Date:1, Effective:1, Signed:1, Same:1, Opposing:1, Impossible:1, Invalid:1, Company:1, Document:1, Parties:1, Provision:1, February:1, March:1, January:1 };

// Tokens that mean "this capitalised run is not a person". The Greensky rerun
// indexed "PRIVATE SEAL" (Verum's own seal footer), "Gooale Drive" (an OCR
// mangling of Google Drive) and "Kevin. Late Mares The" as parties — a person
// index that names the seal itself is worse than an empty one, because a
// reviewer may act on it. Checked case-insensitively against EVERY token, so a
// stop word anywhere in the run rejects it, not just in first position.
var VO_NON_PERSON_TOK = (function () {
  var m = {}, words = ('the this that these those page total date effective signed same opposing impossible ' +
    'invalid company document documents parties provision clause section article annexure annexures exhibit ' +
    'agreement contract invoice tax rental escalation notice report summary appendix schedule attachment ' +
    'seal sealed private public original certificate verify verification timestamps opentimestamps patent ' +
    'pending free tier verum omnis foundation drive folder file scan copy version draft final ' +
    'january february march april may june july august september october november december ' +
    'monday tuesday wednesday thursday friday saturday sunday ' +
    // Furniture the Greensky rerun bound as parties: 'Confidential RAKEZ
    // Case', 'Legal Relevance', 'Hong Kong Legal Relevance'. 'Case' can be a
    // rare surname; losing it is the safe direction for a forensic index.
    'confidential case legal relevance matter notice correspondence whatsapp screenshot screenshots email emails ' +
    // From the 3 Aug Greensky rerun: hash fragments ('BCFF SHA-', 'EC SHA-'),
    // 'Evidence Analyzed', and the SAPS case-number label ('SAPS CAS') were
    // bound as parties. 'Cas' can be a given name; safe direction is exclusion.
    'sha cas evidence analyzed analysis ' +
    // From the AllFuels/Des Caltex franchise-agreement OCR: a scanned contract's
    // "Yes/No" schedule cells were bound as a party ("Yes No"). "Yes"/"No" are
    // never person names; losing them is costless.
    'yes no').split(' ');
  for (var i = 0; i < words.length; i++) m[words[i]] = 1;
  return m;
})();

// WHOLE-PHRASE furniture. A scanned contract is full of capitalised DEFINED
// TERMS ("Business System", "Trade Marks", "Intellectual Property") and schedule
// headings that recur enough to clear the roster's recurrence bar and masquerade
// as parties. Blocking them per-token would also drop real surnames that happen
// to be common words ("Marks", "Business"), so they are blocked as whole phrases
// only — the exact string must match, so a person merely sharing one word is safe.
var VO_NON_PERSON_PHRASE = (function () {
  var m = {}, phrases = ('business system|trade marks|trade mark|intellectual property|' +
    'franchised business|franchise agreement|value of the business|retail outlet|' +
    'retail outlet standards manual|motor fuel|petroleum products|convenience area|' +
    'designated area|food area|confidential information|commencement date|force majeure|' +
    'electronic tag|resolution of disputes|conditions precedent|books of account|' +
    'minimum sales|agreement schedule|table of contents|business day|' +
    'yes no|no yes|yes yes|no no|caltex card|caltex facilities|caltex outlets|' +
    'caltex franchisees|caltex operated outlets|starmart franchise system').split('|');
  for (var i = 0; i < phrases.length; i++) m[phrases[i]] = 1;
  return m;
})();

// A candidate run is a person/party name only if it is 2-4 tokens, carries no
// stop token, and does not run through a sentence end (a word ending in "." that
// is not an initial) — which is how "Kevin." glued itself to "Late Mares The".
// "Kevin Lappeman\u2019s" and "Kevin Lappeman" are one party: strip a trailing
// possessive before validity checks and dedupe, so both forms collapse.
function voCleanPersonName(n) {
  return String(n == null ? '' : n).replace(/[\u2019']s$/i, '').replace(/[\s.,;:]+$/, '').trim();
}
function voLooksLikePerson(name) {
  var toks = String(name == null ? '' : name).split(/\s+/).filter(Boolean);
  if (toks.length < 2 || toks.length > 4) return false;
  // Whole-phrase furniture (a scanned contract's defined terms / schedule cells).
  if (VO_NON_PERSON_PHRASE[toks.join(' ').toLowerCase()]) return false;
  for (var i = 0; i < toks.length; i++) {
    var bare = toks[i].replace(/[.'’-]+$/, '');
    if (!bare) return false;
    if (VO_NON_PERSON_TOK[bare.toLowerCase()]) return false;
    if (i < toks.length - 1 && /\.$/.test(toks[i]) && bare.length > 1) return false; // sentence end mid-run
  }
  return true;
}
function voExtractParties(text) {
  var s = String(text == null ? '' : text);
  var out = [], seen = {};
  var add = function (n, kind) { n = voCleanPersonName(n); var k = n.toLowerCase(); if (n && !seen[k]) { seen[k] = true; out.push({ name: n, kind: kind }); } };
  for (var r = 0; r < VO_PARTY_ROLES.length; r++) {
    if (new RegExp('\\b' + VO_PARTY_ROLES[r] + '\\b', 'i').test(s)) {
      var role = VO_PARTY_ROLES[r];
      add(role.charAt(0).toUpperCase() + role.slice(1), 'role');
    }
  }
  // ASCII \b treats accented letters as non-word, so a trailing \b let the
  // match end before the accent ("Marius Nortj"). Unicode-aware lookarounds.
  var nameRe = new RegExp("(?<![" + VO_NAME_ANY + "])([" + VO_NAME_UC + "][a-z\u00DF-\u024F]{1,}(?:\\s+[" + VO_NAME_UC + "][a-z\u00DF-\u024F'\u2019.]+){1,2})(?![" + VO_NAME_ANY + "])", "g"), nm;
  while ((nm = nameRe.exec(s)) !== null) {
    if (VO_NAME_STOP[nm[1].split(/\s+/)[0]]) continue;
    if (!voLooksLikePerson(nm[1])) continue; // seal boilerplate / OCR garbage
    add(nm[1], 'name');
  }
  return out;
}

// Parties named on the CITED PAGE rather than inside the short evidence
// snippet. Scanning raw page text for any capitalised pair would pull document
// furniture ("Rental Escalation", "Tax Invoice") into a person index, so the
// scan is anchored to the places documents actually name people: email headers
// (From/To/Cc), salutations and sign-offs, signature and attestation lines, and
// courtesy titles. On the AllFuels bundle these are precisely where the OCR'd
// email chain names Gary Highcock, Rabia Seedat, Amrit Singh and Mohamed Ally.
var VO_PERSON_MARKER_RE = /(?:^|[\s>|;])(?:from|to|cc|bcc|dear|regards|sincerely|attention|attn|signed\s+by|per|deponent|witnessed\s+by|witness)\s*:?\s+/gi;
// A name token is a capitalised word/initial, or a surname particle (de, van
// der, du …) so "E de Waal" survives. Separators are spaces/tabs ONLY — using
// \s let a name run across a line break and swallow the next email header
// label, producing "Rabia Seedat Cc" instead of "Rabia Seedat".
// \u00C0-\u024F covers Latin-1 Supplement + Extended-A/B, so "Nortjé" is one
// token instead of truncating at the accent ("Marius Nortj" in the Greensky run).
var VO_NAME_UC = "A-Z\u00C0-\u00DE";
var VO_NAME_ANY = "A-Za-z\u00C0-\u024F";
var VO_NAME_TOK = "(?:[" + VO_NAME_UC + "][" + VO_NAME_ANY + "'\u2019.-]*|de|van|der|den|du|le|la|von|bin|al)";
var VO_TITLE_NAME_RE = new RegExp("\\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Adv|Advocate|Judge|Justice)\\.?[ \\t]+([" + VO_NAME_UC + "][" + VO_NAME_ANY + "'\u2019.-]*(?:[ \\t]+" + VO_NAME_TOK + "){1,3})", "g");
var VO_NAME_SEQ_RE = new RegExp("^([" + VO_NAME_UC + "][" + VO_NAME_ANY + "'\u2019.-]*(?:[ \\t]+" + VO_NAME_TOK + "){1,3})");
function voExtractPersonsFromContext(text, cap) {
  var s = String(text == null ? '' : text);
  var out = [], seen = {}, lim = cap || 8, m;
  var add = function (n) {
    n = voCleanPersonName(String(n || '').replace(/\s+/g, ' '));
    if (!n) return;
    if (VO_NAME_STOP[n.split(' ')[0]]) return;
    if (!voLooksLikePerson(n)) return; // seal boilerplate / OCR garbage
    var k = n.toLowerCase();
    if (!seen[k] && out.length < lim) { seen[k] = true; out.push({ name: n, kind: 'name' }); }
  };
  VO_PERSON_MARKER_RE.lastIndex = 0;
  while ((m = VO_PERSON_MARKER_RE.exec(s)) !== null) {
    // A header may list several people ("Cc: A Singh, M Ally"); walk the
    // comma-separated run and stop at the first fragment that is not a name.
    // Stop the run at a line break or the next header's colon, so one header's
    // value can never absorb the label that follows it.
    var raw = s.slice(m.index + m[0].length, m.index + m[0].length + 120);
    var cut = raw.search(/[\n\r:]/);
    if (cut !== -1) raw = raw.slice(0, cut);
    var tail = raw.split(/[,;]/);
    for (var t = 0; t < tail.length && t < 5; t++) {
      var nm = tail[t].trim().match(VO_NAME_SEQ_RE);
      if (!nm) break;
      add(nm[1]);
    }
  }
  VO_TITLE_NAME_RE.lastIndex = 0;
  while ((m = VO_TITLE_NAME_RE.exec(s)) !== null) add(m[1]);
  return out;
}

// DOCUMENT-LEVEL PARTY ROSTER. Marker-anchored extraction (From:/To:/Cc:,
// salutations, titles) catches people named in email headers, but the commonest
// case in a case bundle is a name in ORDINARY PROSE — "Kevin Lappeman operates
// the registered entity …" on the very page a finding cites. Those were never
// bound, so a finding read "not attributed to a named party" beside a page that
// names the person twice.
//
// Scanning prose for any capitalised pair would flood the index with noise, so
// the signal is RECURRENCE: a name that appears repeatedly across the bundle is
// a party to the matter; a capitalised pair that appears once is furniture. The
// roster is built once per document and reused for every finding.
var VO_ROSTER_MAX = 40;        // most-mentioned names kept
var VO_ROSTER_PER_FINDING = 4; // roster names attachable to any one finding
// Built once at load rather than per call (the roster runs over every page of a
// 491-page bundle, so the object churn is pointless).
var VO_ROSTER_NAME_RE = new RegExp("(?<![" + VO_NAME_ANY + "])([" + VO_NAME_UC + "][" + VO_NAME_ANY + "'\u2019-]{1,}(?:[ \\t]+" + VO_NAME_TOK + "){1,3})", "g");
function voBuildNameRoster(blocks, minMentions) {
  var list = blocks || [];
  // A long bundle repeats a real party many times; a short one may name them
  // only twice, so the bar scales rather than silently excluding short documents.
  var min = minMentions || (list.length >= 10 ? 3 : 2);
  var counts = {}, display = {};
  var re = VO_ROSTER_NAME_RE;
  for (var b = 0; b < list.length; b++) {
    var s = String(list[b] || '').replace(VO_SEAL_BOILERPLATE_RE, ' ');
    var m; re.lastIndex = 0;
    while ((m = re.exec(s)) !== null) {
      var n = voCleanPersonName(m[1].replace(/\s+/g, ' '));
      if (!voLooksLikePerson(n)) continue;
      var k = n.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
      if (!display[k]) display[k] = n;
    }
  }
  var out = [];
  for (var k2 in counts) {
    if (!Object.prototype.hasOwnProperty.call(counts, k2)) continue;
    if (counts[k2] >= min) out.push({ name: display[k2], count: counts[k2] });
  }
  out.sort(function (a, b) { return (b.count - a.count) || a.name.localeCompare(b.name); });
  return out.slice(0, VO_ROSTER_MAX);
}

var VO_DATE_TOKEN_RE = /\b(?:\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/gi;
function voExtractDates(text) {
  var s = String(text == null ? '' : text), out = [], seen = {}, m;
  VO_DATE_TOKEN_RE.lastIndex = 0;
  while ((m = VO_DATE_TOKEN_RE.exec(s)) !== null) {
    var v = m[0].replace(/\s+/g, ' ').trim(), k = v.toLowerCase();
    if (!seen[k]) { seen[k] = true; out.push(v); }
  }
  return out;
}

function voExtractQuotes(text) {
  var s = String(text == null ? '' : text), out = [], m;
  var qRe = /["“”]([^"“”]{6,})["“”]/g;
  while ((m = qRe.exec(s)) !== null) out.push(m[1].replace(/\s+/g, ' ').trim());
  return out;
}

function voParsePages(loc) {
  // Reads "Page 88", "Page 15 vs Page 85", AND the plural set form this engine
  // itself writes since multi-page anchoring — "Pages 1, 3, 4" / "Pages 12-14".
  // The old /page\s+\d+/ missed the plural entirely (anchor.where came back
  // null on set-anchored findings) and kept duplicates ("p.88/88").
  var s = String(loc == null ? '' : loc), out = [], seen = {}, m;
  var re = /pages?\s+((?:\d+)(?:\s*[,\-&]\s*\d+)*)/gi;
  while ((m = re.exec(s)) !== null) {
    var nums = m[1].match(/\d+/g) || [];
    for (var i = 0; i < nums.length; i++) {
      var n = parseInt(nums[i], 10);
      if (n > 0 && !seen[n]) { seen[n] = true; out.push(n); }
    }
  }
  return out;
}

// A sortable calendar key (YYYYMMDD) for a date token, or null if unparseable.
// Numeric DD/MM/YYYY is read day-first (South African convention).
var VO_MON = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
function voDateSortKey(str) {
  var s = String(str == null ? '' : str).toLowerCase().trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]);
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,})\.?,?\s+(\d{4})$/))) { var mo = VO_MON[m[2].slice(0, 3)]; if (mo) return (+m[3]) * 10000 + mo * 100 + (+m[1]); }
  if ((m = s.match(/^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/))) { var mo2 = VO_MON[m[1].slice(0, 3)]; if (mo2) return (+m[3]) * 10000 + mo2 * 100 + (+m[2]); }
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) { var y = +m[3]; if (y < 100) y += 2000; return y * 10000 + (+m[2]) * 100 + (+m[1]); }
  return null;
}

// The flat statement: the finding stated as a declarative fact, no hedge words,
// with its anchors bound in. Legal characterisation (fraud/misrepresentation)
// is named once as the court's, so the fact is never weakened by the caveat.
function voStatement(f) {
  var ct = voCtById(f.type);
  var label = ct ? ct.name : f.type;
  var a = f.anchor || {};
  var where = (a.where && a.where.length) ? ' (p.' + a.where.join('/') + ')' : '';
  var out = label + where + ': ' + String(f.evidence || '').replace(/\s+/g, ' ').trim();
  var who = (a.who || []).map(function (x) { return x.name; });
  if (who.length) out += ' Parties: ' + who.join(', ') + '.';
  if (a.law && a.law.length) out += ' Provision cited in the document: ' + a.law.join(', ') + '.';
  return out;
}

// Bind each surviving finding to who/where/quote/when/law. Evidence prose (which
// the detectors curated) is the primary source; the cited page text is a
// fallback for context that the evidence string did not carry.
function voAnchorEnrich(findings, textBlocks) {
  var blocks = textBlocks || [];
  // Built once per document, then reused for every finding (see voBuildNameRoster).
  var roster = voBuildNameRoster(blocks);
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    if (!f) continue;
    var ev = String(f.evidence || '');
    var pages = voParsePages(f.location);
    var ctx = ev;
    for (var p = 0; p < pages.length; p++) { var b = blocks[pages[p] - 1]; if (b) ctx += ' ' + b; }
    // Verum's own seal footer repeats on every sealed page ("PRIVATE SEAL",
    // "VERUM OMNIS SEALED ORIGINAL", "OpenTimestamps"). Left in, it gets indexed
    // as a party. Strip it before any party scan — the seal is not a person.
    var ctxParties = ctx.replace(VO_SEAL_BOILERPLATE_RE, ' ');
    var dates = voExtractDates(ev);
    if (!dates.length) dates = voExtractDates(ctx).slice(0, 2);
    var law = voExtractCitations(ev);
    if (!law.length) law = voExtractCitations(ctx);
    // Parties: the evidence snippet first (tightest link to the contradiction),
    // then the people the CITED PAGE names via email headers / signature lines.
    // The old form was `ev.length > 20 ? ev : ctx`, and detector evidence is
    // essentially always longer than 20 chars — so the page text was never
    // searched and the person index came back empty on a bundle whose OCR'd
    // pages were full of names. Dates and law already fell back to ctx; parties
    // now do too.
    var _who = voExtractParties(ev);
    var _seenWho = {};
    for (var _w = 0; _w < _who.length; _w++) _seenWho[_who[_w].name.toLowerCase()] = true;
    var _ctxWho = voExtractPersonsFromContext(ctxParties, 6);
    for (var _c = 0; _c < _ctxWho.length && _who.length < 10; _c++) {
      if (!_seenWho[_ctxWho[_c].name.toLowerCase()]) { _seenWho[_ctxWho[_c].name.toLowerCase()] = true; _who.push(_ctxWho[_c]); }
    }
    // Recurring document parties named in ordinary prose on the cited page.
    var _ctxLower = ctxParties.toLowerCase();
    var _fromRoster = 0;
    for (var _r = 0; _r < roster.length && _who.length < 10 && _fromRoster < VO_ROSTER_PER_FINDING; _r++) {
      var _rk = roster[_r].name.toLowerCase();
      if (_seenWho[_rk]) continue;
      if (_ctxLower.indexOf(_rk) === -1) continue; // must appear on the cited page
      _seenWho[_rk] = true;
      _who.push({ name: roster[_r].name, kind: 'name' });
      _fromRoster++;
    }
    f.anchor = {
      who: _who,
      where: pages.length ? pages : null,
      quote: voExtractQuotes(ev),
      when: dates,
      law: law // cite-or-stay-silent: [] means the engine asserts no provision
    };
    f.statement = voStatement(f);
  }
  return findings;
}

// The timeline narrative: every dated finding becomes one chronological line a
// human can read top to bottom. This is the story layer — the sealed proof
// stays underneath; this is what a person actually reads.
function voBuildTimeline(findings) {
  var events = [];
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    if (!f || !f.anchor) continue;
    var dates = f.anchor.when || [];
    for (var d = 0; d < dates.length; d++) {
      var key = voDateSortKey(dates[d]);
      if (key === null) continue;
      events.push({
        key: key, date: dates[d], type: f.type,
        page: (f.anchor.where && f.anchor.where[0]) || null,
        who: (f.anchor.who || []).map(function (x) { return x.name; }),
        evidence: String(f.evidence || '').replace(/\s+/g, ' ').trim()
      });
    }
  }
  events.sort(function (a, b) { return (a.key - b.key) || ((a.page || 0) - (b.page || 0)); });
  var lines = [];
  for (var e = 0; e < events.length; e++) {
    var ev = events[e];
    var whoStr = ev.who.length ? ev.who.join(', ') + ' — ' : '';
    var pgStr = ev.page ? ' (p.' + ev.page + ')' : '';
    lines.push('On ' + ev.date + ': ' + whoStr + ev.evidence + pgStr);
  }
  return { events: events, narrative: lines.join('\n') };
}

// The person-mention index: for every party the engine bound to a finding
// (anchor.who), the pages where they appear and the findings on those pages.
// This is DESCRIPTIVE — it maps who the DOCUMENT names to where, so a human can
// pull everything about a person quickly. It asserts NO culpability: being named
// near a contradiction is not being guilty of it. That determination is the
// court's; this index only says "here is where this name appears."
function voBuildPersonIndex(findings) {
  var byName = {};
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    if (!f || !f.anchor || !f.anchor.who) continue;
    var pages = f.anchor.where || [];
    for (var w = 0; w < f.anchor.who.length; w++) {
      var person = f.anchor.who[w];
      if (!person || !person.name) continue;
      var key = person.name.toLowerCase();
      if (!byName[key]) byName[key] = { name: person.name, kind: person.kind, pages: {}, mentions: [] };
      // A personal name is a stronger label than a bare role if both are seen.
      if (byName[key].kind === 'role' && person.kind === 'name') { byName[key].kind = 'name'; byName[key].name = person.name; }
      for (var p = 0; p < pages.length; p++) byName[key].pages[pages[p]] = true;
      byName[key].mentions.push({
        type: f.type,
        pages: pages.slice(),
        severity: f.severity || 0,
        evidence: String(f.evidence || '').replace(/\s+/g, ' ').trim()
      });
    }
  }
  var out = [];
  for (var k in byName) {
    if (!Object.prototype.hasOwnProperty.call(byName, k)) continue;
    var e = byName[k];
    var pageList = Object.keys(e.pages).map(Number).sort(function (a, b) { return a - b; });
    out.push({ name: e.name, kind: e.kind, pages: pageList, mentionCount: e.mentions.length, mentions: e.mentions });
  }
  // Most-mentioned first (the names a reviewer should look at soonest), then A→Z.
  out.sort(function (a, b) { return (b.mentionCount - a.mentionCount) || a.name.localeCompare(b.name); });
  return out;
}

function detectSerialPatterns(textBlocks) {
  var findings = [];
  var blocks = (textBlocks && textBlocks.length) ? textBlocks.map(function (b) { return String(b || '').toLowerCase(); }) : [''];
  var nWin = Math.max(1, blocks.length - SERIAL_WINDOW_PAGES + 1);

  for (var spKey in SERIAL_PATTERNS) {
    var pattern = SERIAL_PATTERNS[spKey];
    var best = null; // { matchedStages, details, startPage, endPage }

    for (var w = 0; w < nWin; w++) {
      var windowText = blocks.slice(w, w + SERIAL_WINDOW_PAGES).join(' ');
      var matchedStages = 0, matchedDetails = [];
      for (var s = 0; s < pattern.stages.length; s++) {
        var stage = pattern.stages[s];
        for (var k = 0; k < stage.keywords.length; k++) {
          var kw = stage.keywords[k];
          if (!voSerialStageStrong(kw)) continue; // generic single word cannot alone satisfy a stage
          if (voSerialKeywordHit(windowText, kw)) {
            matchedStages++;
            matchedDetails.push(stage.indicator + ': "' + kw + '"');
            break;
          }
        }
      }
      if (!best || matchedStages > best.matchedStages) {
        best = { matchedStages: matchedStages, details: matchedDetails, startPage: w + 1, endPage: Math.min(blocks.length, w + SERIAL_WINDOW_PAGES) };
      }
    }

    var enough = (pattern.stages.length >= 4) ? (best.matchedStages >= 3) : (best.matchedStages >= 2);
    if (!enough) continue;

    // Report the location as the page cluster where the stages co-occurred.
    var loc = (blocks.length <= 1)
      ? 'Full document'
      : (best.startPage === best.endPage ? ('Page ' + best.startPage) : ('Pages ' + best.startPage + '-' + best.endPage));
    findings.push({
      type: 'SERIAL',
      serialPattern: spKey,
      serialName: pattern.name,
      severity: pattern.severity,
      category: pattern.category,
      evidence: pattern.name + ' detected: ' + best.matchedStages + '/' + pattern.stages.length + ' stages matched within a ' +
        SERIAL_WINDOW_PAGES + '-page window. ' + best.details.join('; '),
      location: loc
    });
  }

  return findings;
}

// ===================== PER-PAGE TEXT EXTRACTION (with ToUnicode CMap) =====================
// Restores per-page forensic page anchoring. Uses pdf-lib low-level objects.
// Returns array of word tokens for one page (same shape as extractPdfText).

function _voParseToUnicode(cmapStr) {
  // Parse beginbfchar / beginbfrange blocks of a ToUnicode CMap.
  var map = {};
  var i, j;
  var bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  var m;
  while ((m = bfcharRe.exec(cmapStr)) !== null) {
    var pairs = m[1].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || [];
    for (i = 0; i < pairs.length; i++) {
      var p = pairs[i].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (p) map[p[1].toUpperCase()] = _voHexToUniStr(p[2]);
    }
  }
  var bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrangeRe.exec(cmapStr)) !== null) {
    var body = m[1];
    // Array form: <start> <end> [<u1> <u2> ...]
    var arrRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    var am;
    while ((am = arrRe.exec(body)) !== null) {
      var start = parseInt(am[1], 16);
      var codes = am[3].match(/<([0-9A-Fa-f]+)>/g) || [];
      for (j = 0; j < codes.length; j++) {
        var codeHex = (start + j).toString(16).toUpperCase();
        while (codeHex.length < am[1].length) codeHex = '0' + codeHex;
        map[codeHex] = _voHexToUniStr(codes[j].slice(1, -1));
      }
    }
    // Sequential form: <start> <end> <base>
    var seqRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    var sm;
    var bodyNoArr = body.replace(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[[\s\S]*?\]/g, '');
    while ((sm = seqRe.exec(bodyNoArr)) !== null) {
      var lo = parseInt(sm[1], 16), hi = parseInt(sm[2], 16);
      var baseHex = sm[3];
      var base = parseInt(baseHex, 16);
      if (hi - lo > 4096) continue; // sanity guard
      for (j = lo; j <= hi; j++) {
        var ch = (j).toString(16).toUpperCase();
        while (ch.length < sm[1].length) ch = '0' + ch;
        var uni = (base + (j - lo)).toString(16).toUpperCase();
        while (uni.length < baseHex.length) uni = '0' + uni;
        map[ch] = _voHexToUniStr(uni);
      }
    }
  }
  return map;
}

function _voHexToUniStr(hex) {
  // Interpret hex as UTF-16BE code units
  var out = '';
  if (hex.length % 4 !== 0) hex = ('000' + hex).slice(-(Math.ceil(hex.length / 4) * 4));
  for (var i = 0; i + 4 <= hex.length; i += 4) {
    out += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16));
  }
  return out;
}

function _voDecodeParenString(raw) {
  // Decode PDF literal string escapes
  var out = '';
  for (var i = 0; i < raw.length; i++) {
    var c = raw[i];
    if (c === '\\' && i + 1 < raw.length) {
      var n = raw[i + 1];
      if (n === 'n') { out += '\n'; i++; }
      else if (n === 'r') { out += '\r'; i++; }
      else if (n === 't') { out += '\t'; i++; }
      else if (n === 'b' || n === 'f') { i++; }
      else if (n === '(' || n === ')' || n === '\\') { out += n; i++; }
      else if (n >= '0' && n <= '7') {
        var oct = n; var k = i + 2;
        while (k < raw.length && k < i + 4 && raw[k] >= '0' && raw[k] <= '7') { oct += raw[k]; k++; }
        out += String.fromCharCode(parseInt(oct, 8) & 0xFF);
        i = k - 1;
      }
      else if (n === '\n' || n === '\r') { i++; if (n === '\r' && raw[i + 1] === '\n') i++; }
      else { out += n; i++; }
    } else {
      out += c;
    }
  }
  return out;
}

function _voDecodeHexString(hex, cmap) {
  hex = hex.replace(/\s+/g, '');
  var out = '';
  if (cmap && Object.keys(cmap).length > 0) {
    // Type0 Identity-H: 2-byte codes (4 hex chars)
    for (var i = 0; i + 4 <= hex.length; i += 4) {
      var code = hex.substring(i, i + 4).toUpperCase();
      if (cmap[code] !== undefined) out += cmap[code];
      else {
        var cp = parseInt(code, 16);
        if (cp >= 32 && cp < 0xD800) out += String.fromCharCode(cp);
      }
    }
  } else {
    // No cmap: try UTF-16BE then latin1 bytes
    if (hex.length % 4 === 0) {
      for (var j = 0; j + 4 <= hex.length; j += 4) {
        var v = parseInt(hex.substring(j, j + 4), 16);
        if (v >= 32 && v < 0xD800) out += String.fromCharCode(v);
      }
    }
    if (!out) {
      for (var k = 0; k + 2 <= hex.length; k += 2) {
        var b = parseInt(hex.substring(k, k + 2), 16);
        if (b >= 32 && b <= 126) out += String.fromCharCode(b);
      }
    }
  }
  return out;
}

// `preloadedDoc` is the already-parsed document. Without it this reloaded and
// re-parsed the whole PDF once per page, making extraction quadratic in
// document size: a 159-page file meant 159 full parses, which locked up the
// browser for so long the scan looked permanently frozen.
async function extractPageText(pdfBytes, pageIndex, preloadedDoc) {
  var texts = [];
  try {
    var doc = preloadedDoc || await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    var page = doc.getPages()[pageIndex];
    if (!page) return texts;

    // Build per-font ToUnicode maps from page resources
    var fontMaps = {};
    try {
      var res = doc.context.lookup(page.node.get(PDFLib.PDFName.of('Resources')));
      var fontsRef = res && res.get(PDFLib.PDFName.of('Font'));
      var fonts = fontsRef && doc.context.lookup(fontsRef);
      if (fonts && fonts.entries) {
        var entries = fonts.entries();
        for (var e = 0; e < entries.length; e++) {
          var fname = entries[e][0].asString().replace(/^\//, '');
          var fobj = doc.context.lookup(entries[e][1]);
          var cmap = null;
          try {
            var tuRef = fobj && fobj.get(PDFLib.PDFName.of('ToUnicode'));
            var tuObj = tuRef && doc.context.lookup(tuRef);
            if (tuObj && PDFLib.PDFRawStream && tuObj instanceof PDFLib.PDFRawStream) {
              var cmapBytes = PDFLib.decodePDFRawStream(tuObj).decode();
              cmap = _voParseToUnicode(new TextDecoder('utf-8', { fatal: false }).decode(cmapBytes));
            }
          } catch (e2) {}
          fontMaps[fname] = cmap;
        }
      }
    } catch (e) {}

    // Decode page content stream(s)
    var contents = doc.context.lookup(page.node.get(PDFLib.PDFName.of('Contents')));
    var streams = [];
    if (contents) {
      if (PDFLib.PDFArray && contents instanceof PDFLib.PDFArray) {
        for (var k = 0; k < contents.size(); k++) streams.push(doc.context.lookup(contents.get(k)));
      } else {
        streams.push(contents);
      }
    }

    var curFont = null;
    var pushText = function (t) {
      if (!t) return;
      if (!/\S/.test(t)) { texts.push(' '); return; } // word boundary sentinel
      var tokens = t.split(/\s+/);
      for (var q = 0; q < tokens.length; q++) {
        var w = tokens[q];
        if (w && w.replace(/[^a-zA-Z0-9]/g, '').length >= 1) texts.push(w);
      }
    };

    for (var s = 0; s < streams.length; s++) {
      var st = streams[s];
      if (!(PDFLib.PDFRawStream && st instanceof PDFLib.PDFRawStream)) continue;
      var u8;
      try { u8 = PDFLib.decodePDFRawStream(st).decode(); } catch (e3) { continue; }
      var str = new TextDecoder('utf-8', { fatal: false }).decode(u8);

      // Walk the stream in order: font selects, literal strings, hex strings, TJ arrays
      var re = /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf|\(((?:\\.|[^\\()])*)\)\s*(Tj|'|")|<([0-9A-Fa-f\s]+)>\s*Tj|\[([\s\S]*?)\]\s*TJ/g;
      var m;
      while ((m = re.exec(str)) !== null) {
        if (m[1]) { curFont = m[1]; continue; }
        var cmap = curFont ? fontMaps[curFont] : null;
        if (m[2] !== undefined) { pushText(_voDecodeParenString(m[2])); continue; }
        if (m[4] !== undefined) { pushText(_voDecodeHexString(m[4], cmap)); continue; }
        if (m[5] !== undefined) {
          // TJ array: mix of <hex> and (literal) chunks with kerning numbers
          var body = m[5];
          var chunkRe = /<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\()])*)\)/g;
          var cm;
          var acc = '';
          while ((cm = chunkRe.exec(body)) !== null) {
            if (cm[1] !== undefined) acc += _voDecodeHexString(cm[1], cmap);
            else acc += _voDecodeParenString(cm[2]);
          }
          pushText(acc);
        }
      }
    }
    // Merge letter-spaced runs ("N F O" -> "NFO") within word boundaries only
    var merged = [];
    var run = [];
    for (var t = 0; t <= texts.length; t++) {
      var tok = t < texts.length ? texts[t] : null;
      if (tok === ' ' || tok === null) { // word boundary
        if (run.length >= 2) merged.push(run.join(''));
        else for (var r2 = 0; r2 < run.length; r2++) merged.push(run[r2]);
        run = [];
        if (tok !== null) continue; else break;
      }
      if (tok.length === 1 && /[a-zA-Z0-9]/.test(tok)) { run.push(tok); continue; }
      if (run.length >= 2) merged.push(run.join(''));
      else for (var r3 = 0; r3 < run.length; r3++) merged.push(run[r3]);
      run = [];
      merged.push(tok);
    }
    texts = merged;
  } catch (e) {}
  return texts;
}

// Yields to the event loop so the browser can repaint mid-scan.
function _voYield() {
  return new Promise(function (r) { setTimeout(r, 0); });
}

// ===================== MAIN FORENSIC ENGINE =====================

async function runForensicEngine(pdfBytes, pdfDoc, onProgress) {
  var allFindings = [];

  // Extract text blocks (one per page)
  var textBlocks = [];
  var extractionNote = 'Per-page PDF content-stream decoding with ToUnicode CMaps.';
  try {
    var pages = pdfDoc.getPages();
    for (var i = 0; i < pages.length; i++) {
      var texts = await extractPageText(pdfBytes, i, pdfDoc);
      textBlocks.push(texts.join(' '));
      // Hand the main thread back periodically. `await` on an already-resolved
      // value only drains microtasks, so without this the browser never
      // repaints during a long scan and the page appears hung.
      if ((i & 7) === 7) {
        if (onProgress) onProgress(i + 1, pages.length);
        await _voYield();
      }
    }
    // OCR rescue hook (optional). A page whose text layer is empty is
    // invisible to every detector -- exactly where scanned exhibits hide.
    // When the hosting page provides window.voOcrRescuePages (on-device
    // tesseract.js, vendored), it may recover text for image-only pages.
    // Runs BEFORE the too-little-text check so a fully scanned document can
    // be rescued rather than falling through to the raw-stream fallback.
    // Inert when absent; a failure is disclosed, never fatal (PD6).
    try {
      var _g = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
      if (_g && typeof _g.voOcrRescuePages === 'function' && textBlocks.length > 1) {
        var _ocr = await _g.voOcrRescuePages(pdfBytes, textBlocks, onProgress);
        if (_ocr && Array.isArray(_ocr.textBlocks) && _ocr.textBlocks.length === textBlocks.length) {
          textBlocks = _ocr.textBlocks;
          if (_ocr.note) extractionNote += ' ' + _ocr.note;
        }
      }
    } catch (ocrErr) {
      extractionNote += ' OCR rescue attempted but failed (' + (ocrErr && ocrErr.message ? ocrErr.message : 'unknown') + '); image-only pages remain unread.';
    }
    // If per-page extraction yielded almost nothing (image-only PDF or parse
    // failure), disclose it and use the whole-document raw scan instead.
    if (textBlocks.join(' ').replace(/\s+/g, '').length < 20) {
      throw new Error('per-page extraction yielded too little text');
    }
  } catch(e) {
    // Fallback: treat entire document as one block
    extractionNote = 'FALLBACK: per-page text extraction failed (' + (e && e.message ? e.message : 'unknown error') + '); whole-document raw stream scan used. Page anchors may be degraded.';
    var allTexts = await extractPdfText(pdfBytes);
    textBlocks = [allTexts.join(' ')];
  }

  // Template/boilerplate suppression (see voExcludeTemplatePages).
  var templateNote = voExcludeTemplatePages(textBlocks);
  if (templateNote) extractionNote += ' ' + templateNote;

  // Run all 37 detectors
  var detectors = [
    DETECTORS.D01_DETECT_DIRECT_CONTRADICTION,
    DETECTORS.D02_DETECT_NUMERICAL_DISCREPANCY,
    DETECTORS.D03_DETECT_DATE_INCONSISTENCY,
    DETECTORS.D04_DETECT_TEMPORAL_IMPOSSIBILITY,
    DETECTORS.D05_DETECT_LOGICAL_IMPOSSIBILITY,
    DETECTORS.D06_DETECT_IDENTITY_CONFLICT,
    DETECTORS.D07_DETECT_ROLE_CONTRADICTION,
    DETECTORS.D08_DETECT_AUTHORITY_EXCEEDED,
    DETECTORS.D09_DETECT_ENTITY_STATUS_FAKE,
    DETECTORS.D10_DETECT_VAT_INVALID,
    DETECTORS.D11_DETECT_REGISTRATION_FAKE,
    DETECTORS.D12_DETECT_BANK_DETAIL_MISMATCH,
    DETECTORS.D13_DETECT_CALCULATION_ERROR,
    DETECTORS.D14_DETECT_AMOUNT_ROUNDING_ANOMALY,
    DETECTORS.D15_DETECT_METADATA_FRAUD,
    DETECTORS.D16_DETECT_FONT_ANOMALY,
    DETECTORS.D17_DETECT_FORMAT_ANOMALY,
    DETECTORS.D18_DETECT_PAGE_MANIPULATION,
    DETECTORS.D19_DETECT_EVIDENCE_TAMPERING,
    DETECTORS.D20_DETECT_DIGITAL_FOOTPRINT_MISMATCH,
    DETECTORS.D21_DETECT_MISSING_APPENDIX,
    DETECTORS.D22_DETECT_INVALID_LEGAL_REF,
    DETECTORS.D23_DETECT_PROCEDURE_BREACH,
    DETECTORS.D24_DETECT_ADDRESS_CONFLICT,
    DETECTORS.D25_DETECT_CONTACT_MISMATCH,
    DETECTORS.D26_DETECT_JURISDICTIONAL_ISSUE,
    DETECTORS.D27_DETECT_CUSTODY_GAP,
    DETECTORS.D28_DETECT_WITNESS_CONFLICT,
    DETECTORS.D29_DETECT_SCOPE_CREEP,
    DETECTORS.D30_DETECT_TERM_DEFINITION_CONFLICT,
    DETECTORS.D31_DETECT_CAUSAL_IMPOSSIBILITY,
    DETECTORS.D32_DETECT_SIGNATURE_ANOMALY,
    DETECTORS.D33_DETECT_IMAGE_MANIPULATION,
    DETECTORS.D34_DETECT_CURRENCY_FRAUD,
    DETECTORS.D35_DETECT_VERSION_ANOMALY,
    DETECTORS.D36_DETECT_SOURCE_FAILURE,
    DETECTORS.D38_DETECT_CONDITIONAL_CLAUSE_MISINVOKED,
    DETECTORS.D39_DETECT_ASSET_VALUE_DENIAL
  ];

  for (var d = 0; d < detectors.length; d++) {
    try {
      var detectorFindings;
      if (detectors[d] === DETECTORS.D15_DETECT_METADATA_FRAUD ||
          detectors[d] === DETECTORS.D20_DETECT_DIGITAL_FOOTPRINT_MISMATCH) {
        detectorFindings = detectors[d](pdfDoc);
      } else if (detectors[d] === DETECTORS.D16_DETECT_FONT_ANOMALY) {
        detectorFindings = detectors[d](textBlocks, pdfDoc);
      } else {
        detectorFindings = detectors[d](textBlocks);
      }
      allFindings = allFindings.concat(detectorFindings);
    } catch(e) {
      console.warn('Detector ' + (d+1) + ' failed:', e.message);
    }
  }

  // Route contextOnly output (CT38 multi-jurisdiction note, CT43 breadth note)
  // into the extraction notes: context is disclosed, but it is never scored,
  // never counted in totalFindings, and never rendered as a contradiction.
  var _voContextNotes = [];
  var _voSplitContext = function (list) {
    var kept = [];
    for (var cn = 0; cn < list.length; cn++) {
      if (list[cn] && list[cn].contextOnly) _voContextNotes.push(list[cn].evidence);
      else kept.push(list[cn]);
    }
    return kept;
  };
  allFindings = _voSplitContext(allFindings);

  // Run catch-all detector (needs other findings)
  try {
    var catchallFindings = _voSplitContext(DETECTORS.D37_DETECT_INTERNAL_CONFLICT_CATCHALL(textBlocks, allFindings));
    allFindings = allFindings.concat(catchallFindings);
  } catch(e) {}

  // Run serial pattern detection
  try {
    var serialFindings = detectSerialPatterns(textBlocks);
    allFindings = allFindings.concat(serialFindings);
  } catch(e) {}

  // Digital forensics on the raw PDF structure (revisions, post-signature
  // saves, active content, XMP vs Info disagreement).
  try {
    var _dfFindings = voDigitalForensicsScan(pdfBytes, pdfDoc);
    // Disclose any self-seal metadata suppression (Prime Directive 6).
    if (_dfFindings && _dfFindings.voSelfSealNote) _voContextNotes.push(_dfFindings.voSelfSealNote);
    allFindings = allFindings.concat(_dfFindings);
  } catch(e) {}

  // Drop findings that repeat an earlier one verbatim, and bound how many any
  // single contradiction type may contribute. A detector that misfires
  // otherwise buries the real findings -- D02 alone once produced 739 of 742.
  // Suppression is reported rather than silent: a report that quietly dropped
  // evidence would be worse than a noisy one.
  var MAX_PER_TYPE = 25;
  var deduped = [];
  var seenEvidence = {};
  var countPerType = {};
  var suppressed = {};
  for (var g = 0; g < allFindings.length; g++) {
    var cand = allFindings[g];
    var sig = cand.type + '|' + (cand.evidence || '') + '|' + (cand.location || '');
    if (seenEvidence[sig]) { suppressed[cand.type] = (suppressed[cand.type] || 0) + 1; continue; }
    seenEvidence[sig] = true;
    countPerType[cand.type] = (countPerType[cand.type] || 0) + 1;
    if (countPerType[cand.type] > MAX_PER_TYPE) {
      suppressed[cand.type] = (suppressed[cand.type] || 0) + 1;
      continue;
    }
    deduped.push(cand);
  }
  var suppressedTypes = Object.keys(suppressed);
  if (suppressedTypes.length) {
    var parts = [];
    for (var s = 0; s < suppressedTypes.length; s++) {
      parts.push(suppressedTypes[s] + ': ' + suppressed[suppressedTypes[s]]);
    }
    extractionNote += ' Duplicate/over-cap findings withheld (max ' + MAX_PER_TYPE +
      ' per contradiction type) -- ' + parts.join(', ') + '.';
  }
  allFindings = deduped;

  // Pin findings to a real page where their evidence resolves to exactly one.
  allFindings = voBackfillPageAnchors(allFindings, textBlocks);

  // The anchor rule (see voEnforceAnchorRule): unanchorable content findings
  // move out of the findings into the disclosed engine notes. Skipped when
  // the whole document is one raw-fallback block: page anchors are impossible
  // there and that degradation is already disclosed above.
  if (textBlocks.length > 1) {
    var anchored = voEnforceAnchorRule(allFindings);
    allFindings = anchored.kept;
    if (anchored.unanchored.length) {
      var uaTexts = [];
      for (var un = 0; un < anchored.unanchored.length; un++) {
        var uif = anchored.unanchored[un];
        uaTexts.push('[' + uif.type + '] ' + (uif.evidence || ''));
      }
      extractionNote += ' Anchor rule: ' + anchored.unanchored.length +
        ' indicator(s) could not be pinned to a page and are recorded here as unanchored observations, NOT as findings' +
        ' (no anchor, no sentence): ' + uaTexts.join(' | ');
    }
  }

  // Bind each surviving finding to its anchors (who/where/quote/when/law) so
  // every finding names WHO, WHERE, WHAT and — where the document itself cites
  // one — WHICH provision. Runs on the kept, page-anchored findings only.
  voAnchorEnrich(allFindings, textBlocks);

  // Disclose the context notes (multi-jurisdiction, breadth) gathered earlier.
  if (_voContextNotes.length) {
    extractionNote += ' ' + _voContextNotes.join(' ');
  }

  // Calculate overall score — confidence-weighted per indicator type
  // (v5.2.9 lineage: per-detector calibration). A written figure restated at
  // two values (CT02) and a fuzzy image-manipulation keyword hit (CT28) are
  // not equally reliable, and scoring them equally is how "multiple
  // jurisdictions referenced" once outweighed real contradictions. Weights
  // reflect each detector's observed false-positive propensity across the
  // AllFuels, Louw v Moolla and Greensky runs; unlisted types get 0.75.
  // Each finding carries its weight (confidence) so reports can show it.
  var VO_DETECTOR_CONFIDENCE = {
    CT01: 0.85, CT02: 0.9, CT03: 0.9, CT06: 0.9, CT07: 0.85, CT09: 0.85,
    CT10: 0.8, CT13: 0.9, CT14: 0.85, CT24: 0.9, CT29: 0.9, CT42: 0.9,
    CT35: 0.8, CT04: 0.5, CT08: 0.7, CT26: 0.7, CT27: 0.6, CT28: 0.6,
    CT05: 0.6, CT31: 0.6, CT36: 0.6, CT39: 0.6, SERIAL: 0.7
  };
  var totalScore = 0;
  var maxScore = 0;
  var findingsByType = {};
  var findingsByCategory = {};

  for (var f = 0; f < allFindings.length; f++) {
    var finding = allFindings[f];
    var cw = VO_DETECTOR_CONFIDENCE[finding.type];
    if (cw === undefined) cw = 0.75;
    finding.confidence = cw;
    totalScore += finding.severity * cw;
    maxScore += 5; // max severity per finding at full confidence

    if (!findingsByType[finding.type]) findingsByType[finding.type] = [];
    findingsByType[finding.type].push(finding);

    var ct = CONTRADICTION_TYPES[finding.type];
    var cat = ct ? ct.category : (finding.category || 'UNKNOWN');
    if (!findingsByCategory[cat]) findingsByCategory[cat] = [];
    findingsByCategory[cat].push(finding);
  }
  if (allFindings.length) {
    extractionNote += ' Indicator score is confidence-weighted per indicator type (calibration v1): lower-precision detectors contribute less than high-precision ones.';
  }

  var overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  var confidence = overallScore >= 80 ? 'VERY_HIGH' : overallScore >= 60 ? 'HIGH' :
                   overallScore >= 40 ? 'MODERATE' : overallScore >= 20 ? 'LOW' : 'CLEAN';

  // False-clean guard (Prime Directive 6). A scanned document that was sealed
  // before carries ~130 chars of seal-footer text per page, which passed the
  // "some text exists" check while the page CONTENT stayed unread -- and a
  // 187-page image bundle then reported "CLEAN: internally consistent". If
  // zero findings came out of a multi-page document averaging under 200
  // non-space chars per page, the honest verdict is UNREADABLE, not clean.
  var _contentChars = 0;
  for (var _tb = 0; _tb < textBlocks.length; _tb++) _contentChars += voContentMass(textBlocks[_tb]);
  var unreadable = allFindings.length === 0 && textBlocks.length >= 3 &&
                   (_contentChars / textBlocks.length) < 200;
  if (unreadable) {
    confidence = 'INSUFFICIENT';
    extractionNote += ' UNREADABLE: the document averages under 200 machine-readable characters per page (' +
      Math.round(_contentChars / textBlocks.length) + ' chars/page over ' + textBlocks.length +
      ' pages) -- effectively no text layer. Zero findings here means the content was NOT examined, not that it is consistent.';
  }

  return {
    engineVersion: VO_ENGINE_VERSION,
    clean: unreadable ? false : overallScore < 20,
    unreadable: unreadable,
    overallScore: overallScore,
    maxPossibleScore: 100,
    confidence: confidence,
    totalFindings: allFindings.length,
    findings: allFindings,
    timeline: voBuildTimeline(allFindings),
    personIndex: voBuildPersonIndex(allFindings),
    findingsByType: findingsByType,
    findingsByCategory: findingsByCategory,
    contradictionTypesUsed: Object.keys(findingsByType).length,
    serialPatternsDetected: allFindings.filter(function(f){return f.type==='SERIAL';}).length,
    extractionNotes: extractionNote,
    summary: unreadable
      ? 'UNREADABLE: the document has no usable machine-readable text (scanned or image-only PDF). ' +
        'No contradiction analysis was performed. This is NOT a clean result -- it is an unread document. ' +
        'Re-submit a text-layer copy, or rely on the OCR-rescued pages disclosed in the extraction notes.'
      : generateSummary(allFindings, overallScore)
  };
}

function generateSummary(findings, score) {
  // A density score over a tiny finding set reads as a sweeping verdict —
  // 2 findings on a 451-page bundle scored "70/100 HIGH ... suggests fraud
  // or tampering", HIGHER than the old 12-finding report, purely because the
  // per-finding average rose. With few findings the honest story is "a
  // couple of specific, checkable issues", so say exactly that.
  if (findings.length > 0 && findings.length <= 3) {
    return 'FOCUSED: ' + findings.length + ' page-anchored indicator' + (findings.length === 1 ? '' : 's') +
      ' found. Per-indicator severity is ' + (score >= 60 ? 'high' : 'moderate') +
      ', but the indicator COUNT is low for the document — read each finding on its cited page; the density score is not an overall verdict on the document.';
  }
  if (score >= 80) {
    return 'CRITICAL: ' + findings.length + ' contradictions detected across ' +
      'multiple categories. Document shows strong indicators of systematic fraud. ' +
      'Manual forensic review strongly recommended.';
  } else if (score >= 60) {
    return 'HIGH: ' + findings.length + ' contradictions detected. Document ' +
      'contains significant inconsistencies that suggest fraud or tampering.';
  } else if (score >= 40) {
    return 'MODERATE: ' + findings.length + ' contradictions found. Some ' +
      'inconsistencies present that warrant closer examination.';
  } else if (score >= 20) {
    return 'LOW: ' + findings.length + ' minor contradictions detected. ' +
      'Document largely consistent with minor anomalies.';
  } else {
    return 'CLEAN: No significant contradictions detected. Document appears ' +
      'internally consistent.';
  }
}

// ===================== EXPORT =====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VO_ENGINE_VERSION: VO_ENGINE_VERSION,
    CONTRADICTION_TYPES: CONTRADICTION_TYPES,
    DETECTORS: DETECTORS,
    SERIAL_PATTERNS: SERIAL_PATTERNS,
    runForensicEngine: runForensicEngine,
    detectSerialPatterns: detectSerialPatterns,
    voBackfillPageAnchors: voBackfillPageAnchors,
    voPageForEvidence: voPageForEvidence,
    voPagesForEvidence: voPagesForEvidence,
    voDigitalForensicsScan: voDigitalForensicsScan,
    voExcludeTemplatePages: voExcludeTemplatePages,
    voEnforceAnchorRule: voEnforceAnchorRule,
    voContentMass: voContentMass,
    VO_NEAR_EMPTY_CHARS: VO_NEAR_EMPTY_CHARS,
    voCtById: voCtById,
    voCropHidesContent: voCropHidesContent,
    voExtractCitations: voExtractCitations,
    voExtractParties: voExtractParties,
    voExtractPersonsFromContext: voExtractPersonsFromContext,
    voLooksLikePerson: voLooksLikePerson,
    voCleanPersonName: voCleanPersonName,
    voBuildNameRoster: voBuildNameRoster,
    voExtractDates: voExtractDates,
    voExtractQuotes: voExtractQuotes,
    voParsePages: voParsePages,
    voDateSortKey: voDateSortKey,
    voStatement: voStatement,
    voAnchorEnrich: voAnchorEnrich,
    voBuildTimeline: voBuildTimeline,
    voBuildPersonIndex: voBuildPersonIndex
  };
}
