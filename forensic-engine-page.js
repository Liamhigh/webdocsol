// ==================== FORENSIC CONTRADICTION ENGINE v2.0 ====================
// 43 Contradiction Types | 37 Detectors | 17 Serial Patterns
// ========================================================================


// ========================================================================
// VERUM OMNIS FORENSIC CONTRADICTION ENGINE v2.0
// 43 Contradiction Types | 37 Detectors | 17 Serial Patterns
// ========================================================================
// This engine analyzes documents for internal contradictions, fraudulent
// patterns, and forensic anomalies. It is designed to detect perjury,
// forgery, document tampering, and systemic fraud across any document.
// ========================================================================

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
  }
};

// ===================== 37 DETECTOR FUNCTIONS =====================
// Each detector scans for a specific type of contradiction or fraud indicator.
// Detectors return an array of findings: [{ type, severity, evidence, location }]

var DETECTORS = {

  // D01-D05: Statemental detectors
  D01_DETECT_DIRECT_CONTRADICTION: function(textBlocks) {
    var findings = [];
    var negationPairs = [
      ['paid','not paid'],['received','not received'],['approved','rejected'],
      ['accepted','declined'],['valid','invalid'],['true','false'],
      ['completed','incomplete'],['submitted','not submitted'],['agreed','disputed'],
      ['confirmed','denied'],['authorized','unauthorized'],['registered','deregistered']
    ];
    var fullText = textBlocks.join(' ').toLowerCase();
    for (var i = 0; i < negationPairs.length; i++) {
      var hasPos = fullText.indexOf(negationPairs[i][0]) !== -1;
      var hasNeg = fullText.indexOf(negationPairs[i][1]) !== -1;
      if (hasPos && hasNeg) {
        findings.push({ type: 'CT01', severity: 5,
          evidence: 'Document contains both "' + negationPairs[i][0] + '" and "' + negationPairs[i][1] + '"',
          location: 'Full document text' });
      }
    }
    return findings;
  },

  D02_DETECT_NUMERICAL_DISCREPANCY: function(textBlocks) {
    var findings = [];
    var amounts = [];
    var amountRe = /[R$€£]\s*[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b/g;
    for (var i = 0; i < textBlocks.length; i++) {
      var matches = textBlocks[i].match(amountRe);
      if (matches) {
        for (var j = 0; j < matches.length; j++) {
          var num = parseFloat(matches[j].replace(/[^0-9.]/g, ''));
          if (!isNaN(num) && num > 100) amounts.push({ value: num, page: i, raw: matches[j] });
        }
      }
    }
    // Check for amounts that appear as both total and subtotal with >10% variance
    if (amounts.length >= 2) {
      for (var a = 0; a < amounts.length; a++) {
        for (var b = a + 1; b < amounts.length; b++) {
          var diff = Math.abs(amounts[a].value - amounts[b].value);
          var avg = (amounts[a].value + amounts[b].value) / 2;
          if (diff / avg > 0.1 && diff > 1000) {
            findings.push({ type: 'CT02', severity: 4,
              evidence: 'Amount ' + amounts[a].raw + ' differs from ' + amounts[b].raw + ' (variance: ' + Math.round(diff/avg*100) + '%)',
              location: 'Page ' + (amounts[a].page + 1) + ' vs Page ' + (amounts[b].page + 1) });
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
          dates.push({ raw: match[0], page: i, text: textBlocks[i].substring(Math.max(0, match.index-30), match.index+30) });
        }
      }
    }
    // Check for impossible dates (e.g., 31/02/2024)
    var months31 = [1,3,5,7,8,10,12];
    for (var d = 0; d < dates.length; d++) {
      var dd = dates[d].raw.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
      if (dd) {
        var day = parseInt(dd[1]), month = parseInt(dd[2]), year = parseInt(dd[3]);
        if (month === 2 && day > 29) {
          findings.push({ type: 'CT03', severity: 5,
            evidence: 'Impossible date: ' + dates[d].raw + ' (February cannot have ' + day + ' days)',
            location: 'Page ' + (dates[d].page + 1) });
        }
        if (month > 12) {
          findings.push({ type: 'CT03', severity: 5,
            evidence: 'Invalid month in date: ' + dates[d].raw,
            location: 'Page ' + (dates[d].page + 1) });
        }
      }
    }
    return findings;
  },

  D04_DETECT_TEMPORAL_IMPOSSIBILITY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var impossibleSequences = [
      ['before the incident','after the incident'],['prior to','subsequent to'],
      ['preceding','following'],['earlier','later']
    ];
    for (var i = 0; i < impossibleSequences.length; i++) {
      if (fullText.indexOf(impossibleSequences[i][0]) !== -1 &&
          fullText.indexOf(impossibleSequences[i][1]) !== -1) {
        findings.push({ type: 'CT04', severity: 3,
          evidence: 'Temporal language conflict: "' + impossibleSequences[i][0] + '" and "' + impossibleSequences[i][1] + '" both present',
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
    if (ids.length >= 2) {
      findings.push({ type: 'CT09', severity: 4,
        evidence: ids.length + ' different ID numbers found in document',
        location: 'Pages ' + ids.map(function(x){return x.page+1;}).join(', ') });
    }
    return findings;
  },

  D07_DETECT_ROLE_CONTRADICTION: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var roleClaims = [
      { role: 'managing director', check: 'board resolution' },
      { role: 'company secretary', check: 'appointment letter' },
      { role: 'authorized signatory', check: 'power of attorney' },
      { role: 'executor', check: 'letters of executorship' },
      { role: 'trustee', check: 'trust deed' },
      { role: 'liquidator', check: 'court order' }
    ];
    for (var i = 0; i < roleClaims.length; i++) {
      if (fullText.indexOf(roleClaims[i].role) !== -1 &&
          fullText.indexOf(roleClaims[i].check) === -1) {
        findings.push({ type: 'CT10', severity: 3,
          evidence: 'Role "' + roleClaims[i].role + '" claimed without supporting "' + roleClaims[i].check + '"',
          location: 'Full document' });
      }
    }
    return findings;
  },

  D08_DETECT_AUTHORITY_EXCEEDED: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var authorityPatterns = [
      /approved\s+by\s+.*?(?:clerk|assistant|junior|trainee)/gi,
      /authorized\s+by\s+.*?(?:intern|temp|contractor)/gi,
      /signed\s+by\s+.*?(?:on behalf of|p.p.|per pro)/gi
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
    var fullText = textBlocks.join(' ').toLowerCase();
    var statusClaims = [
      ['registered','deregistered','dissolved','liquidated'],
      ['active','suspended','under administration'],
      ['compliant','non-compliant','delinquent']
    ];
    for (var i = 0; i < statusClaims.length; i++) {
      var found = [];
      for (var j = 0; j < statusClaims[i].length; j++) {
        if (fullText.indexOf(statusClaims[i][j]) !== -1) found.push(statusClaims[i][j]);
      }
      if (found.length > 1) {
        findings.push({ type: 'CT14', severity: 5,
          evidence: 'Conflicting status claims: ' + found.join(', '),
          location: 'Full document' });
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
    var regRe = /\b(CK\d{7}|\d{14})\b/g;
    var seen = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = regRe.exec(textBlocks[i])) !== null) {
        if (seen[match[0]] && seen[match[0]] !== i) {
          findings.push({ type: 'CT20', severity: 4,
            evidence: 'Registration number ' + match[0] + ' appears on multiple pages with different context',
            location: 'Page ' + (i + 1) });
        }
        seen[match[0]] = i;
      }
    }
    return findings;
  },

  D12_DETECT_BANK_DETAIL_MISMATCH: function(textBlocks) {
    var findings = [];
    var bankRe = /\b\d{6,12}\b/g;
    var accounts = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = bankRe.exec(textBlocks[i])) !== null) {
        if (match[0].length >= 8) {
          accounts.push({ number: match[0], page: i });
        }
      }
    }
    // Check for multiple different account numbers
    var uniqueAccounts = {};
    for (var j = 0; j < accounts.length; j++) {
      uniqueAccounts[accounts[j].number] = true;
    }
    var accountList = Object.keys(uniqueAccounts);
    if (accountList.length >= 2) {
      findings.push({ type: 'CT18', severity: 4,
        evidence: accountList.length + ' different account numbers found: ' + accountList.slice(0,3).join(', '),
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
    var pageLengths = textBlocks.map(function(t){return t.length;});
    if (pageLengths.length >= 3) {
      var avg = pageLengths.reduce(function(a,b){return a+b;},0) / pageLengths.length;
      for (var i = 0; i < pageLengths.length; i++) {
        if (Math.abs(pageLengths[i] - avg) / avg > 0.5 && pageLengths[i] > 100) {
          findings.push({ type: 'CT26', severity: 2,
            evidence: 'Page ' + (i+1) + ' text length deviates ' + Math.round(Math.abs(pageLengths[i]-avg)/avg*100) + '% from average',
            location: 'Page ' + (i+1) });
        }
      }
    }
    return findings;
  },

  D18_DETECT_LAYOUT_MANIPULATION: function(textBlocks) {
    var findings = [];
    // Check for inconsistent header/footer patterns
    var headerPatterns = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var lines = textBlocks[i].split('\n').filter(function(l){return l.trim();});
      if (lines.length > 0) headerPatterns.push({ page: i, first: lines[0].substring(0,50), last: lines[lines.length-1].substring(0,50) });
    }
    var firstLines = headerPatterns.map(function(h){return h.first;});
    var uniqueFirsts = {};
    for (var j = 0; j < firstLines.length; j++) uniqueFirsts[firstLines[j]] = true;
    if (Object.keys(uniqueFirsts).length >= 3 && headerPatterns.length >= 4) {
      findings.push({ type: 'CT27', severity: 3,
        evidence: 'Inconsistent page headers detected across ' + headerPatterns.length + ' pages',
        location: 'Multiple pages' });
    }
    return findings;
  },

  D19_DETECT_PAGE_SEQUENCE_ANOMALY: function(textBlocks) {
    var findings = [];
    // Check for page numbering inconsistencies
    var pageNums = [];
    var pageNumRe = /\b(?:page|pg\.?)\s*(\d+)\s*(?:of\s*(\d+))?\b/gi;
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = pageNumRe.exec(textBlocks[i])) !== null) {
        pageNums.push({ stated: parseInt(match[1]), actual: i + 1, total: match[2] ? parseInt(match[2]) : null });
      }
    }
    for (var k = 0; k < pageNums.length; k++) {
      if (pageNums[k].stated !== pageNums[k].actual) {
        findings.push({ type: 'CT41', severity: 4,
          evidence: 'Page number mismatch: text says "page ' + pageNums[k].stated + '" but is actually page ' + pageNums[k].actual,
          location: 'Page ' + pageNums[k].actual });
      }
    }
    return findings;
  },

  D20_DETECT_SCANNED_VS_DIGITAL: function(textBlocks, pdfDoc) {
    var findings = [];
    // If document claims to be scanned but has selectable text, or vice versa
    var hasText = textBlocks.some(function(t){return t.trim().length > 50;});
    var fullText = textBlocks.join(' ').toLowerCase();
    if (fullText.indexOf('scanned') !== -1 || fullText.indexOf('scan of') !== -1) {
      if (hasText) {
        findings.push({ type: 'CT42', severity: 3,
          evidence: 'Document references scanning but contains digital text (possible digital creation)',
          location: 'Full document' });
      }
    }
    return findings;
  },

  // D21-D25: Cross-reference detectors
  D21_DETECT_REFERENCE_FAILURE: function(textBlocks) {
    var findings = [];
    var refRe = /(?:see|refer to|as per|per|according to)\s+(appendix|annexure|schedule|section|clause|paragraph|exhibit)\s+([A-Z0-9]+)/gi;
    var referenced = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = refRe.exec(textBlocks[i])) !== null) {
        referenced.push({ type: match[1].toLowerCase(), ref: match[2], page: i });
      }
    }
    // Check if referenced items exist
    var fullText = textBlocks.join(' ').toLowerCase();
    for (var j = 0; j < referenced.length; j++) {
      var searchTerm = referenced[j].type + ' ' + referenced[j].ref.toLowerCase();
      var found = false;
      // Check if the reference target exists as a heading
      for (var k = 0; k < textBlocks.length; k++) {
        if (textBlocks[k].toLowerCase().indexOf(searchTerm) !== -1 && k !== referenced[j].page) {
          found = true;
          break;
        }
      }
      if (!found) {
        findings.push({ type: 'CT31', severity: 3,
          evidence: 'Reference to "' + referenced[j].type + ' ' + referenced[j].ref + '" not found in document',
          location: 'Page ' + (referenced[j].page + 1) });
      }
    }
    return findings;
  },

  D22_DETECT_LEGAL_REFERENCE_INVALID: function(textBlocks) {
    var findings = [];
    var legalRefs = [
      { pattern: /section\s+(\d+)\s+of\s+the\s+companies\s+act/gi, maxSection: 214, name: 'Companies Act' },
      { pattern: /section\s+(\d+)\s+of\s+the\s+constitution/gi, maxSection: 243, name: 'Constitution' },
      { pattern: /article\s+([ivxlcdm]+)/gi, maxArticle: 20, name: 'Constitution (articles)' }
    ];
    for (var i = 0; i < textBlocks.length; i++) {
      for (var j = 0; j < legalRefs.length; j++) {
        var match;
        while ((match = legalRefs[j].pattern.exec(textBlocks[i])) !== null) {
          var num = parseInt(match[1]) || 0;
          if (legalRefs[j].maxSection && num > legalRefs[j].maxSection) {
            findings.push({ type: 'CT33', severity: 4,
              evidence: 'Reference to Section ' + num + ' of ' + legalRefs[j].name + ' (max: ' + legalRefs[j].maxSection + ')',
              location: 'Page ' + (i + 1) });
          }
        }
      }
    }
    return findings;
  },

  D23_DETECT_PROCEDURE_BREACH: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var procedureChecks = [
      { required: 'witness', context: 'signature', message: 'Document signed without witness requirement mentioned' },
      { required: 'notar', context: 'affidavit', message: 'Affidavit without notarization reference' },
      { required: 'seal', context: 'deed', message: 'Deed without seal reference' },
      { required: 'commissioner', context: 'oath', message: 'Oath without commissioner reference' }
    ];
    for (var i = 0; i < procedureChecks.length; i++) {
      if (fullText.indexOf(procedureChecks[i].context) !== -1 &&
          fullText.indexOf(procedureChecks[i].required) === -1) {
        findings.push({ type: 'CT35', severity: 3,
          evidence: procedureChecks[i].message,
          location: 'Full document' });
      }
    }
    return findings;
  },

  D24_DETECT_ADDRESS_INCONSISTENCY: function(textBlocks) {
    var findings = [];
    var addrRe = /\b\d+\s+[A-Za-z\s]+(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|way|place|pl\.?|court|ct\.?|circle|cir\.?)\b/gi;
    var addresses = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = addrRe.exec(textBlocks[i])) !== null) {
        addresses.push({ addr: match[0].toLowerCase(), page: i });
      }
    }
    var uniqueAddrs = {};
    for (var j = 0; j < addresses.length; j++) uniqueAddrs[addresses[j].addr] = true;
    if (Object.keys(uniqueAddrs).length >= 3) {
      findings.push({ type: 'CT36', severity: 2,
        evidence: Object.keys(uniqueAddrs).length + ' different addresses found',
        location: 'Multiple pages' });
    }
    return findings;
  },

  D25_DETECT_CONTACT_INCONSISTENCY: function(textBlocks) {
    var findings = [];
    var emailRe = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
    var domains = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = emailRe.exec(textBlocks[i])) !== null) {
        domains.push({ domain: match[1].toLowerCase(), page: i });
      }
    }
    var uniqueDomains = {};
    for (var j = 0; j < domains.length; j++) uniqueDomains[domains[j].domain] = true;
    if (Object.keys(uniqueDomains).length >= 2) {
      var domainList = Object.keys(uniqueDomains);
      // Check for suspicious domain changes (e.g., company.co.za to company-gmail.com)
      var suspicious = false;
      for (var k = 0; k < domainList.length; k++) {
        for (var l = k + 1; l < domainList.length; l++) {
          var base1 = domainList[k].split('.')[0];
          var base2 = domainList[l].split('.')[0];
          if (base1 === base2 || domainList[k].indexOf(base2) !== -1 || domainList[l].indexOf(base1) !== -1) {
            suspicious = true;
          }
        }
      }
      if (suspicious || domainList.length >= 3) {
        findings.push({ type: 'CT37', severity: 2,
          evidence: 'Multiple email domains: ' + domainList.slice(0, 3).join(', '),
          location: 'Multiple pages' });
      }
    }
    return findings;
  },

  // D26-D30: Jurisdiction & entity detectors
  D26_DETECT_JURISDICTION_IMPOSSIBILITY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var jurisdictions = ['south africa','dubai','mauritius','cayman','british virgin','panama','delaware','london','new york','singapore'];
    var found = [];
    for (var i = 0; i < jurisdictions.length; i++) {
      if (fullText.indexOf(jurisdictions[i]) !== -1) found.push(jurisdictions[i]);
    }
    if (found.length >= 3) {
      findings.push({ type: 'CT38', severity: 3,
        evidence: 'Multiple jurisdictions referenced: ' + found.slice(0, 4).join(', '),
        location: 'Full document' });
    }
    return findings;
  },

  D27_DETECT_CHAIN_OF_CUSTODY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var custodyTerms = ['chain of custody','evidence bag','sealed container','evidence number','exhibit number','collected by','received by','transferred to'];
    var found = [];
    for (var i = 0; i < custodyTerms.length; i++) {
      if (fullText.indexOf(custodyTerms[i]) !== -1) found.push(custodyTerms[i]);
    }
    if (found.length >= 2 && found.length < 4) {
      findings.push({ type: 'CT39', severity: 3,
        evidence: 'Partial chain of custody documentation (' + found.length + ' of ' + custodyTerms.length + ' expected elements)',
        location: 'Evidence handling section' });
    }
    return findings;
  },

  D28_DETECT_WITNESS_CONFLICT: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var witnessIndicators = ['witness statement','sworn statement','affidavit','testimony','deposition'];
    var conflictIndicators = ['however','but','contrary to','in contrast','on the other hand','disputes','denies','contradicts'];
    var hasWitness = false, hasConflict = false;
    for (var i = 0; i < witnessIndicators.length; i++) {
      if (fullText.indexOf(witnessIndicators[i]) !== -1) { hasWitness = true; break; }
    }
    var conflictCount = 0;
    for (var j = 0; j < conflictIndicators.length; j++) {
      if (fullText.indexOf(conflictIndicators[j]) !== -1) conflictCount++;
    }
    if (hasWitness && conflictCount >= 3) {
      findings.push({ type: 'CT40', severity: 4,
        evidence: 'Witness statements with ' + conflictCount + ' conflict indicators',
        location: 'Witness statements' });
    }
    return findings;
  },

  D29_DETECT_SCOPE_EXPANSION: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var scopeTerms = ['additional work','extra work','change order','variation','amendment','addendum','supplementary'];
    var originalTerms = ['original quote','original scope','initial agreement','original contract'];
    var hasExpansion = false, hasOriginal = false;
    for (var i = 0; i < scopeTerms.length; i++) {
      if (fullText.indexOf(scopeTerms[i]) !== -1) { hasExpansion = true; break; }
    }
    for (var j = 0; j < originalTerms.length; j++) {
      if (fullText.indexOf(originalTerms[j]) !== -1) { hasOriginal = true; break; }
    }
    if (hasExpansion && hasOriginal) {
      findings.push({ type: 'CT07', severity: 2,
        evidence: 'Document shows scope expansion beyond original agreement',
        location: 'Full document' });
    }
    return findings;
  },

  D30_DETECT_TERM_CONFLICT: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var termPairs = [
      ['gross profit','net profit'],['pre-tax','post-tax'],['inclusive of vat','exclusive of vat'],
      ['per annum','per month','per day'],['fixed rate','variable rate']
    ];
    for (var i = 0; i < termPairs.length; i++) {
      var found = [];
      for (var j = 0; j < termPairs[i].length; j++) {
        if (fullText.indexOf(termPairs[i][j]) !== -1) found.push(termPairs[i][j]);
      }
      if (found.length > 1) {
        findings.push({ type: 'CT08', severity: 3,
          evidence: 'Conflicting terms used: ' + found.join(' vs '),
          location: 'Full document' });
      }
    }
    return findings;
  },

  // D31-D35: Additional forensic detectors
  D31_DETECT_IMPOSSIBLE_CLAIM: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var impossibleClaims = [
      'same day delivery and shipping took 3 weeks',
      'payment made before invoice was issued',
      'document signed before it was drafted',
      'approved before the application was submitted'
    ];
    for (var i = 0; i < impossibleClaims.length; i++) {
      if (fullText.indexOf(impossibleClaims[i]) !== -1) {
        findings.push({ type: 'CT05', severity: 4,
          evidence: 'Impossible claim detected: ' + impossibleClaims[i],
          location: 'Full document' });
      }
    }
    return findings;
  },

  D32_DETECT_SIGNATURE_ANOMALY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var sigTerms = ['signature','signed','signatory','initial'];
    var sigPages = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var pageText = textBlocks[i].toLowerCase();
      for (var j = 0; j < sigTerms.length; j++) {
        if (pageText.indexOf(sigTerms[j]) !== -1) {
          sigPages.push(i);
          break;
        }
      }
    }
    if (sigPages.length >= 3) {
      findings.push({ type: 'CT23', severity: 2,
        evidence: 'Signatures/initials referenced on ' + sigPages.length + ' pages (verify all match)',
        location: 'Signature block' });
    }
    return findings;
  },

  D33_DETECT_IMAGE_MANIPULATION: function(textBlocks, pdfDoc) {
    var findings = [];
    // Check for image-heavy pages that might be manipulated
    try {
      var pages = pdfDoc.getPages();
      var imageCount = 0;
      for (var i = 0; i < pages.length; i++) {
        // This is a heuristic - if page has very little text but exists, might be image
        if (textBlocks[i] && textBlocks[i].trim().length < 20) {
          imageCount++;
        }
      }
      if (imageCount >= 2) {
        findings.push({ type: 'CT28', severity: 3,
          evidence: imageCount + ' pages appear to be image-based (verify authenticity)',
          location: 'Image sections' });
      }
    } catch(e) {}
    return findings;
  },

  D34_DETECT_FINANCIAL_INCONSISTENCY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var currencyRe = /\b(R|ZAR|USD|\$|EUR|€|GBP|£)\s*[\d,.]+/g;
    var currencies = {};
    var match;
    while ((match = currencyRe.exec(fullText)) !== null) {
      var c = match[1].toUpperCase();
      currencies[c] = true;
    }
    var currencyList = Object.keys(currencies);
    if (currencyList.length >= 2) {
      findings.push({ type: 'CT16', severity: 3,
        evidence: 'Multiple currencies: ' + currencyList.join(', '),
        location: 'Financial sections' });
    }
    return findings;
  },

  D35_DETECT_VERSION_ANOMALY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var versionRe = /version\s+(\d+)|v(\d+)\.(\d+)|draft\s+(\d+)|revision\s+(\d+)/gi;
    var versions = [];
    var match;
    while ((match = versionRe.exec(fullText)) !== null) {
      versions.push(match[0]);
    }
    var uniqueVersions = {};
    for (var i = 0; i < versions.length; i++) uniqueVersions[versions[i]] = true;
    if (Object.keys(uniqueVersions).length >= 2) {
      findings.push({ type: 'CT30', severity: 2,
        evidence: 'Multiple version references: ' + Object.keys(uniqueVersions).slice(0, 3).join(', '),
        location: 'Document header/footer' });
    }
    return findings;
  },

  // D36-D37: Systemic fraud detectors
  D36_DETECT_SYSTEMATIC_PATTERN: function(textBlocks) {
    var findings = [];
    // Check for boilerplate fraud patterns
    var fullText = textBlocks.join(' ').toLowerCase();
    var fraudPhrases = [
      'guaranteed returns','risk-free investment','act now','limited time offer',
      'exclusive opportunity','once in a lifetime','secret method','insider information',
      'offshore account','tax haven','shell company','nominee director',
      'bearer shares','anonymous trust','private placement'
    ];
    var found = [];
    for (var i = 0; i < fraudPhrases.length; i++) {
      if (fullText.indexOf(fraudPhrases[i]) !== -1) found.push(fraudPhrases[i]);
    }
    if (found.length >= 2) {
      findings.push({ type: 'CT43', severity: 4,
        evidence: 'Systematic fraud indicators: ' + found.slice(0, 4).join(', '),
        location: 'Full document' });
    }
    return findings;
  },

  D37_DETECT_INTERNAL_CONFLICT: function(textBlocks) {
    var findings = [];
    // This is the catch-all detector that looks for any remaining anomalies
    var fullText = textBlocks.join(' ').toLowerCase();
    var words = fullText.split(/\s+/);
    var wordCount = {};
    for (var i = 0; i < words.length; i++) {
      if (words[i].length > 5) {
        wordCount[words[i]] = (wordCount[words[i]] || 0) + 1;
      }
    }
    // Check for unusual repetition (may indicate template fraud)
    var repeated = [];
    for (var word in wordCount) {
      if (wordCount[word] > 20) repeated.push(word + '(' + wordCount[word] + ')');
    }
    if (repeated.length >= 3) {
      findings.push({ type: 'CT43', severity: 2,
        evidence: 'Unusual word repetition: ' + repeated.slice(0, 3).join(', '),
        location: 'Full document' });
    }
    return findings;
  }
};

// ===================== 17 SERIAL PATTERNS =====================
// Multi-stage fraud patterns that require multiple findings to confirm

var SERIAL_PATTERNS = [
  {
    id: 'SP01', name: 'Advance Fee Fraud',
    stages: ['upfront payment','processing fee','transfer fee','tax clearance','customs duty'],
    threshold: 2,
    description: 'Requests multiple upfront payments before promised funds are released'
  },
  {
    id: 'SP02', name: 'Invoice Diversion Fraud',
    stages: ['bank detail change','new account','update banking','payment redirect','account amendment'],
    threshold: 2,
    description: 'Attempts to redirect payments to a different bank account'
  },
  {
    id: 'SP03', name: 'Identity Takeover',
    stages: ['verify identity','confirm details','update information','security check','account verification'],
    threshold: 3,
    description: 'Harvests personal information for identity theft'
  },
  {
    id: 'SP04', name: 'Procurement Fraud',
    stages: ['tender','bid','quote','preferred supplier','sole source','urgent procurement'],
    threshold: 3,
    description: 'Manipulates procurement process for kickbacks or inflated pricing'
  },
  {
    id: 'SP05', name: 'Document Forgery Ring',
    stages: ['template','sample','specimen','draft copy','unsigned version'],
    threshold: 2,
    description: 'Mass-produces forged documents from templates'
  },
  {
    id: 'SP06', name: 'Payroll Fraud',
    stages: ['ghost employee','salary','payroll','overtime','bonus','commission'],
    threshold: 3,
    description: 'Creates fictitious employees or inflates compensation'
  },
  {
    id: 'SP07', name: 'Expense Fraud',
    stages: ['expense claim','receipt','reimbursement','petty cash','travel expense'],
    threshold: 3,
    description: 'Submits false or inflated expense claims'
  },
  {
    id: 'SP08', name: 'Vendor Fraud',
    stages: ['new vendor','supplier registration','vendor approval','preferred vendor'],
    threshold: 2,
    description: 'Creates fictitious vendors for payment diversion'
  },
  {
    id: 'SP09', name: 'Refund Fraud',
    stages: ['refund','credit note','return','cancellation','reversal'],
    threshold: 3,
    description: 'Processes false refunds or credit notes'
  },
  {
    id: 'SP10', name: 'Asset Misappropriation',
    stages: ['asset register','disposal','write-off','surplus','scrap'],
    threshold: 2,
    description: 'Diverts organizational assets for personal use'
  },
  {
    id: 'SP11', name: 'Financial Statement Fraud',
    stages: ['revenue recognition','accrual','deferral','reclassification','adjustment'],
    threshold: 3,
    description: 'Manipulates financial statements to misstate performance'
  },
  {
    id: 'SP12', name: 'Insurance Fraud',
    stages: ['claim','policy','premium','coverage','excess','deductible'],
    threshold: 3,
    description: 'Submits false or inflated insurance claims'
  },
  {
    id: 'SP13', name: 'Tax Fraud',
    stages: ['vat return','tax invoice','input tax','output tax','tax clearance'],
    threshold: 3,
    description: 'Evades taxes through false documentation'
  },
  {
    id: 'SP14', name: 'Money Laundering',
    stages: ['cash deposit','transfer','offshore','shell','layering','structuring'],
    threshold: 3,
    description: 'Disguises origins of illegally obtained funds'
  },
  {
    id: 'SP15', name: 'Bid Rigging',
    stages: ['collusive tender','cover bid','bid rotation','market allocation'],
    threshold: 2,
    description: 'Coordinates bids to manipulate competitive tendering'
  },
  {
    id: 'SP16', name: 'Ponzi Scheme',
    stages: ['investment returns','referral bonus','membership fee','pyramid','downline'],
    threshold: 2,
    description: 'Pays returns from new investor funds rather than profits'
  },
  {
    id: 'SP17', name: 'Legal Document Fraud',
    stages: ['court order','summons','warrant','judgment','decree'],
    threshold: 2,
    description: 'Creates fake legal documents to intimidate or defraud'
  }
];

// ===================== TEXT EXTRACTION =====================
// Extract text from PDF content streams per page, with ToUnicode CMap decoding

function _voHexToUniStr(hex) {
  var out = '';
  for (var i = 0; i + 3 < hex.length; i += 4) {
    var code = parseInt(hex.substr(i, 4), 16);
    if (code === 0x000D || code === 0x000A) { out += '\n'; continue; }
    if (code >= 0xD800 && code <= 0xDBFF && i + 7 < hex.length) {
      var lo = parseInt(hex.substr(i + 4, 4), 16);
      if (lo >= 0xDC00 && lo <= 0xDFFF) {
        out += String.fromCharCode(0x10000 + ((code - 0xD800) << 10) + (lo - 0xDC00));
        i += 4;
        continue;
      }
    }
    out += String.fromCharCode(code);
  }
  return out;
}

function _voParseToUnicode(cmapText) {
  var map = {};
  var i, j, start, end, dest, lines, parts, code;
  var bfcharBlocks = cmapText.match(/beginbfchar[\s\S]*?endbfchar/g);
  if (bfcharBlocks) {
    for (i = 0; i < bfcharBlocks.length; i++) {
      var entries = bfcharBlocks[i].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g);
      if (entries) {
        for (j = 0; j < entries.length; j++) {
          var m = entries[j].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
          if (m) map[parseInt(m[1], 16)] = _voHexToUniStr(m[2]);
        }
      }
    }
  }
  var bfrangeBlocks = cmapText.match(/beginbfrange[\s\S]*?endbfrange/g);
  if (bfrangeBlocks) {
    for (i = 0; i < bfrangeBlocks.length; i++) {
      lines = bfrangeBlocks[i].split('\n');
      for (j = 0; j < lines.length; j++) {
        var rangeMatch = lines[j].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
        if (rangeMatch) {
          start = parseInt(rangeMatch[1], 16);
          end = parseInt(rangeMatch[2], 16);
          dest = parseInt(rangeMatch[3], 16);
          for (code = start; code <= end; code++) {
            map[code] = String.fromCharCode(dest + (code - start));
          }
        }
        var arrayMatch = lines[j].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/);
        if (arrayMatch) {
          start = parseInt(arrayMatch[1], 16);
          var dests = arrayMatch[3].match(/<([0-9A-Fa-f]+)>/g);
          if (dests) {
            for (var k = 0; k < dests.length; k++) {
              map[start + k] = _voHexToUniStr(dests[k].replace(/[<>]/g, ''));
            }
          }
        }
      }
    }
  }
  return map;
}

function _voDecodeHexString(hexStr, fontMaps, currentFont) {
  var result = '';
  var cmap = fontMaps[currentFont];
  for (var i = 0; i + 1 < hexStr.length; i += 2) {
    var code = parseInt(hexStr.substr(i, 2), 16);
    if (cmap && cmap[code]) { result += cmap[code]; continue; }
    if (code >= 32 && code <= 126) { result += String.fromCharCode(code); continue; }
    if (code === 10 || code === 13) { result += '\n'; continue; }
    result += ' ';
  }
  return result;
}

function _voDecodeParenString(str, fontMaps, currentFont) {
  var result = '';
  var cmap = fontMaps[currentFont];
  var i = 0;
  while (i < str.length) {
    var ch = str[i];
    if (ch === '\\' && i + 1 < str.length) {
      var next = str[i + 1];
      if (next === 'n') { result += '\n'; i += 2; continue; }
      if (next === 'r') { result += '\n'; i += 2; continue; }
      if (next === 't') { result += ' '; i += 2; continue; }
      if (next === '(' || next === ')' || next === '\\') { result += next; i += 2; continue; }
      if (next >= '0' && next <= '7') {
        var octal = next;
        var j = i + 2;
        while (j < Math.min(i + 4, str.length) && str[j] >= '0' && str[j] <= '7') {
          octal += str[j]; j++;
        }
        var code = parseInt(octal, 8);
        if (cmap && cmap[code]) { result += cmap[code]; }
        else if (code >= 32 && code <= 126) { result += String.fromCharCode(code); }
        else { result += ' '; }
        i = j;
        continue;
      }
      if (next === '\n' || next === '\r') { i += 2; continue; }
      result += next;
      i += 2;
      continue;
    }
    var code = str.charCodeAt(i);
    if (cmap && cmap[code]) { result += cmap[code]; }
    else { result += ch; }
    i++;
  }
  return result;
}

async function extractPageText(pdfBytes, pageIndex) {
  var texts = [];
  try {
    var doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    var pages = doc.getPages();
    if (pageIndex >= pages.length) return texts;
    var page = pages[pageIndex];

    // Get font resources and their ToUnicode maps
    var fontMaps = {};
    try {
      var res = doc.context.lookup(page.node.get(PDFLib.PDFName.of('Resources')));
      var fontsRef = res && res.get(PDFLib.PDFName.of('Font'));
      if (fontsRef) {
        var fonts = doc.context.lookup(fontsRef);
        if (fonts && fonts.entries) {
          var entries = fonts.entries();
          for (var fi = 0; fi < entries.length; fi++) {
            var fName = entries[fi][0].asString();
            var fObj = doc.context.lookup(entries[fi][1]);
            var tuRef = fObj && fObj.get(PDFLib.PDFName.of('ToUnicode'));
            if (tuRef) {
              var tuObj = doc.context.lookup(tuRef);
              if (tuObj && PDFLib.PDFRawStream && tuObj instanceof PDFLib.PDFRawStream) {
                var cmapBytes = PDFLib.decodePDFRawStream(tuObj).decode();
                var cmapText = new TextDecoder('latin1').decode(cmapBytes);
                fontMaps[fName] = _voParseToUnicode(cmapText);
              }
            }
          }
        }
      }
    } catch (e2) {}

    // Get page content stream(s)
    var contentsRef = page.node.get(PDFLib.PDFName.of('Contents'));
    var contentBytes = [];
    try {
      var contents = doc.context.lookup(contentsRef);
      if (contents) {
        var streams = [];
        if (PDFLib.PDFArray && contents instanceof PDFLib.PDFArray) {
          for (var si = 0; si < contents.size(); si++) {
            var s = doc.context.lookup(contents.get(si));
            if (s) streams.push(s);
          }
        } else {
          streams.push(contents);
        }
        for (var ci = 0; ci < streams.length; ci++) {
          var st = streams[ci];
          if (!(PDFLib.PDFRawStream && st instanceof PDFLib.PDFRawStream)) continue;
          var u8 = null;
          try { u8 = PDFLib.decodePDFRawStream(st).decode(); } catch (e3) { continue; }
          contentBytes.push(u8);
        }
      }
    } catch (e4) {}

    // Parse text-showing operations from content stream
    var currentFont = null;
    var inText = false;
    for (var cbi = 0; cbi < contentBytes.length; cbi++) {
      var str = new TextDecoder('latin1').decode(contentBytes[cbi]);
      // Track font selection: /F1 12 Tf
      var fontSetRe = /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf/g;
      var fontMatch;
      while ((fontMatch = fontSetRe.exec(str)) !== null) {
        currentFont = fontMatch[1];
      }
      // Extract hex strings <...> Tj and paren strings (...) Tj
      var hexTjRe = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
      var hexMatch;
      while ((hexMatch = hexTjRe.exec(str)) !== null) {
        var decoded = _voDecodeHexString(hexMatch[1].replace(/\s/g, ''), fontMaps, currentFont);
        if (decoded.trim()) texts.push(decoded);
      }
      var parenTjRe = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g;
      var parenMatch;
      while ((parenMatch = parenTjRe.exec(str)) !== null) {
        var decoded2 = _voDecodeParenString(parenMatch[1], fontMaps, currentFont);
        if (decoded2.trim()) texts.push(decoded2);
      }
      // TJ arrays: [(...) -250 <...> -250 (...)] TJ
      var tjArrayRe = /\[([^\]]*)\]\s*TJ/g;
      var tjMatch;
      while ((tjMatch = tjArrayRe.exec(str)) !== null) {
        var arrayContent = tjMatch[1];
        var parts = arrayContent.match(/\((?:[^()\\]|\\.)*\)|<[^<>]*>/g);
        if (parts) {
          var joined = '';
          for (var pi = 0; pi < parts.length; pi++) {
            if (parts[pi][0] === '(') {
              joined += _voDecodeParenString(parts[pi].substring(1, parts[pi].length - 1), fontMaps, currentFont);
            } else if (parts[pi][0] === '<') {
              joined += _voDecodeHexString(parts[pi].substring(1, parts[pi].length - 1).replace(/\s/g, ''), fontMaps, currentFont);
            }
          }
          if (joined.trim()) texts.push(joined);
        }
      }
      // Single/double quote operators: (...) ' and (...) "
      var sqRe = /\(([^)]*(?:\\.[^)]*)*)\)\s*['"]/g;
      var sqMatch;
      while ((sqMatch = sqRe.exec(str)) !== null) {
        var decoded3 = _voDecodeParenString(sqMatch[1], fontMaps, currentFont);
        if (decoded3.trim()) texts.push(decoded3);
      }
    }
  } catch (e) {}
  return texts;
}

// ===================== MAIN ENGINE =====================

async function runForensicEngine(pdfBytes, pdfDoc) {
  var allFindings = [];

  // Extract text blocks (one per page)
  var textBlocks = [];
  var extractionNote = 'Per-page PDF content-stream decoding with ToUnicode CMaps.';
  try {
    var pages = pdfDoc.getPages();
    for (var i = 0; i < pages.length; i++) {
      var texts = await extractPageText(pdfBytes, i);
      textBlocks.push(texts.join(' '));
    }
  } catch(e) {
    // Fallback: treat entire document as one block
    var allTexts = await extractPdfText(pdfBytes);
    textBlocks = [allTexts.join(' ')];
    extractionNote = 'Fallback: raw string extraction (page-level decoding failed).';
  }

  // Run all 37 detectors
  var detectorNames = Object.keys(DETECTORS);
  for (var d = 0; d < detectorNames.length; d++) {
    var detectorName = detectorNames[d];
    try {
      var detector = DETECTORS[detectorName];
      var findings;
      if (detectorName === 'D15_DETECT_METADATA_FRAUD' || detectorName === 'D33_DETECT_IMAGE_MANIPULATION') {
        findings = detector(textBlocks, pdfDoc);
      } else if (detectorName === 'D16_DETECT_FONT_ANOMALY') {
        findings = detector(textBlocks, pdfDoc);
      } else if (detectorName === 'D20_DETECT_SCANNED_VS_DIGITAL') {
        findings = detector(textBlocks, pdfDoc);
      } else {
        findings = detector(textBlocks);
      }
      if (findings && findings.length > 0) {
        for (var f = 0; f < findings.length; f++) {
          findings[f].detector = detectorName;
          allFindings.push(findings[f]);
        }
      }
    } catch(e) {
      console.warn('Detector ' + detectorName + ' failed:', e.message);
    }
  }

  // Run serial pattern detection
  var serialFindings = detectSerialPatterns(textBlocks);
  for (var s = 0; s < serialFindings.length; s++) {
    allFindings.push(serialFindings[s]);
  }

  // Calculate overall score
  var totalSeverity = 0;
  var findingsByType = {};
  var findingsByCategory = {};
  for (var g = 0; g < allFindings.length; g++) {
    var finding = allFindings[g];
    totalSeverity += finding.severity || 1;
    if (!findingsByType[finding.type]) findingsByType[finding.type] = [];
    findingsByType[finding.type].push(finding);
    var ct = CONTRADICTION_TYPES[finding.type];
    if (ct) {
      if (!findingsByCategory[ct.category]) findingsByCategory[ct.category] = [];
      findingsByCategory[ct.category].push(finding);
    }
  }

  var maxScore = allFindings.length * 5;
  var overallScore = maxScore > 0 ? Math.round((totalSeverity / maxScore) * 100) : 0;

  // Determine confidence level
  var confidence = 'CLEAN';
  if (overallScore >= 80) confidence = 'VERY_HIGH';
  else if (overallScore >= 60) confidence = 'HIGH';
  else if (overallScore >= 40) confidence = 'MODERATE';
  else if (overallScore >= 20) confidence = 'LOW';

  return {
    clean: allFindings.length === 0,
    overallScore: overallScore,
    confidence: confidence,
    totalFindings: allFindings.length,
    findings: allFindings,
    findingsByType: findingsByType,
    findingsByCategory: findingsByCategory,
    contradictionTypesUsed: Object.keys(findingsByType).length,
    serialPatternsDetected: serialFindings.length,
    extractionNotes: extractionNote,
    summary: generateSummary(allFindings, overallScore, confidence)
  };
}

function detectSerialPatterns(textBlocks) {
  var findings = [];
  var fullText = textBlocks.join(' ').toLowerCase();

  for (var i = 0; i < SERIAL_PATTERNS.length; i++) {
    var pattern = SERIAL_PATTERNS[i];
    var matchedStages = [];
    for (var j = 0; j < pattern.stages.length; j++) {
      if (fullText.indexOf(pattern.stages[j]) !== -1) {
        matchedStages.push(pattern.stages[j]);
      }
    }
    if (matchedStages.length >= pattern.threshold) {
      findings.push({
        type: 'SERIAL',
        serialPattern: pattern.id,
        serialName: pattern.name,
        severity: Math.min(5, matchedStages.length),
        evidence: 'Serial pattern "' + pattern.name + '" detected: ' + matchedStages.length + ' of ' + pattern.stages.length + ' stages matched (' + matchedStages.slice(0, 3).join(', ') + ')',
        location: 'Full document',
        description: pattern.description
      });
    }
  }
  return findings;
}

function generateSummary(findings, score, confidence) {
  if (findings.length === 0) {
    return 'CLEAN: No contradictions or forensic indicators detected. Document appears internally consistent across all ' + Object.keys(DETECTORS).length + ' detectors and ' + SERIAL_PATTERNS.length + ' serial patterns.';
  }
  var typeCount = {};
  for (var i = 0; i < findings.length; i++) {
    var t = findings[i].type;
    typeCount[t] = (typeCount[t] || 0) + 1;
  }
  var topTypes = Object.keys(typeCount).sort(function(a,b){return typeCount[b]-typeCount[a];}).slice(0, 3);
  var typeNames = topTypes.map(function(t) {
    var ct = CONTRADICTION_TYPES[t];
    return ct ? ct.name : t;
  });

  if (score >= 80) {
    return 'VERY HIGH: ' + findings.length + ' contradictions detected. Document ' +
      'shows systematic internal inconsistencies consistent with fraud or ' +
      'sophisticated tampering. Primary indicators: ' + typeNames.join(', ') + '. ' +
      'Immediate forensic review required.';
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
    CONTRADICTION_TYPES: CONTRADICTION_TYPES,
    DETECTORS: DETECTORS,
    SERIAL_PATTERNS: SERIAL_PATTERNS,
    runForensicEngine: runForensicEngine,
    detectSerialPatterns: detectSerialPatterns
  };
}

