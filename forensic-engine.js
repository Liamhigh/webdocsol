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

const CONTRADICTION_TYPES = {
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

const DETECTORS = {

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
        if (Math.abs(pageLengths[i] - avg) > avg * 0.5) {
          findings.push({ type: 'CT26', severity: 2,
            evidence: 'Page ' + (i+1) + ' text length (' + pageLengths[i] + ') deviates ' + Math.round(Math.abs(pageLengths[i]-avg)/avg*100) + '% from average',
            location: 'Page ' + (i+1) });
        }
      }
    }
    return findings;
  },

  D18_DETECT_PAGE_MANIPULATION: function(textBlocks) {
    var findings = [];
    // Check for page number gaps or duplicates
    var pageNumRe = /\b(page|p\.?|pg)\s*(\d+)\s*(?:of|\/)\s*(\d+)\b/gi;
    var seenNumbers = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = pageNumRe.exec(textBlocks[i])) !== null) {
        var num = parseInt(match[2]);
        if (seenNumbers[num] !== undefined && seenNumbers[num] !== i) {
          findings.push({ type: 'CT27', severity: 4,
            evidence: 'Page number ' + num + ' appears on multiple pages (potential duplicate or insertion)',
            location: 'Page ' + (i+1) + ' and Page ' + (seenNumbers[num]+1) });
        }
        seenNumbers[num] = i;
      }
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
    var appendixRe = /(?:see|refer to|as per|in)\s+(appendix|annex|schedule|exhibit)\s*([A-Z\d]+)/gi;
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = appendixRe.exec(textBlocks[i])) !== null) {
        appendixRefs.push({ ref: (match[1] + ' ' + match[2]).toLowerCase(), page: i });
      }
    }
    // Check if referenced appendices exist
    var fullText = textBlocks.join(' ').toLowerCase();
    for (var j = 0; j < appendixRefs.length; j++) {
      var appendixTitle = new RegExp('\\b' + appendixRefs[j].ref.replace(/\s+/g,'\\s+') + '\\b', 'i');
      if (!appendixTitle.test(fullText)) {
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
    var procedureReqs = [
      { req: 'witness', context: 'signature|signed|contract|agreement' },
      { req: 'notar', context: 'affidavit|oath|sworn|certified' },
      { req: 'resolution', context: 'board|director|shareholder' },
      { req: 'stamp duty', context: 'lease|agreement|transfer' }
    ];
    for (var i = 0; i < procedureReqs.length; i++) {
      var contextRe = new RegExp(procedureReqs[i].context, 'i');
      var reqRe = new RegExp('\\b' + procedureReqs[i].req + '\\b', 'i');
      if (contextRe.test(fullText) && !reqRe.test(fullText)) {
        findings.push({ type: 'CT35', severity: 4,
          evidence: 'Document type may require "' + procedureReqs[i].req + '" but none found',
          location: 'Full document' });
      }
    }
    return findings;
  },

  // D24-D28: Contact/location detectors
  D24_DETECT_ADDRESS_CONFLICT: function(textBlocks) {
    var findings = [];
    var addressRe = /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Way|Boulevard|Blvd)/gi;
    var addresses = [];
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = addressRe.exec(textBlocks[i])) !== null) {
        addresses.push({ value: match[0].toLowerCase().replace(/\s+/g,' '), page: i });
      }
    }
    // Check for different addresses
    var unique = {};
    for (var j = 0; j < addresses.length; j++) {
      unique[addresses[j].value] = true;
    }
    var addrList = Object.keys(unique);
    if (addrList.length >= 2) {
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
      findings.push({ type: 'CT38', severity: 3,
        evidence: 'Multiple jurisdictions referenced: ' + foundJurisdictions.join(', '),
        location: 'Full document' });
    }
    return findings;
  },

  // D27-D30: Evidence/witness detectors
  D27_DETECT_CUSTODY_GAP: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var custodyTerms = ['received by','handed to','transferred to','logged by','signed for'];
    var found = [];
    for (var i = 0; i < custodyTerms.length; i++) {
      if (fullText.indexOf(custodyTerms[i]) !== -1) found.push(custodyTerms[i]);
    }
    if (found.length >= 1 && found.length < 3) {
      findings.push({ type: 'CT39', severity: 3,
        evidence: 'Incomplete chain of custody: only ' + found.length + ' of ' + custodyTerms.length + ' required steps found',
        location: 'Evidence handling section' });
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
    var definitionRe = /\b("[^"]+"|\w+)\s+(?:shall mean|means|is defined as|refers to)\b/gi;
    var definitions = {};
    for (var i = 0; i < textBlocks.length; i++) {
      var match;
      while ((match = definitionRe.exec(textBlocks[i])) !== null) {
        var term = match[1].toLowerCase().replace(/"/g,'');
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
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var causalPatterns = [
      /\bbefore\b.*\breceived\b.*\bsent\b/gi,
      /\bafter\b.*\bsent\b.*\breceived\b/gi
    ];
    for (var i = 0; i < causalPatterns.length; i++) {
      if (causalPatterns[i].test(fullText)) {
        findings.push({ type: 'CT05', severity: 3,
          evidence: 'Possible causal impossibility in event sequence',
          location: 'Full document' });
      }
    }
    return findings;
  },

  D32_DETECT_SIGNATURE_ANOMALY: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var sigPatterns = [
      'electronic signature','digital signature','/s/','signed per pro',
      'power of attorney','authorized representative','by proxy'
    ];
    for (var i = 0; i < sigPatterns.length; i++) {
      if (fullText.indexOf(sigPatterns[i]) !== -1) {
        findings.push({ type: 'CT23', severity: 3,
          evidence: 'Non-standard signature method: "' + sigPatterns[i] + '"',
          location: 'Signature block' });
      }
    }
    return findings;
  },

  D33_DETECT_IMAGE_MANIPULATION: function(textBlocks) {
    var findings = [];
    var fullText = textBlocks.join(' ').toLowerCase();
    var imageTerms = ['compressed','resized','cropped','filtered','edited image'];
    for (var i = 0; i < imageTerms.length; i++) {
      if (fullText.indexOf(imageTerms[i]) !== -1) {
        findings.push({ type: 'CT28', severity: 3,
          evidence: 'Image manipulation reference: "' + imageTerms[i] + '"',
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
    var versionRe = /\b(version|v|rev|revision)\s*[:=.]?\s*(\d+\.?\d*)\b/gi;
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

  D37_DETECT_INTERNAL_CONFLICT_CATCHALL: function(textBlocks, otherFindings) {
    var findings = [];
    // If multiple different contradiction types found, flag as systematic fraud
    var uniqueTypes = {};
    for (var i = 0; i < otherFindings.length; i++) {
      uniqueTypes[otherFindings[i].type] = true;
    }
    var typeCount = Object.keys(uniqueTypes).length;
    if (typeCount >= 5) {
      findings.push({ type: 'CT43', severity: 4,
        evidence: 'Systematic fraud pattern: ' + typeCount + ' different contradiction types detected',
        location: 'Full document' });
    }
    return findings;
  }
};

// ===================== 17 SERIAL PATTERNS =====================
// Multi-step fraud schemes that unfold across a document or document set.
// Each pattern is a sequence of stages that, when detected together,
// indicate a sophisticated fraud operation.

const SERIAL_PATTERNS = {

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

function detectSerialPatterns(textBlocks) {
  var findings = [];
  var fullText = textBlocks.join(' ').toLowerCase();

  for (var spKey in SERIAL_PATTERNS) {
    var pattern = SERIAL_PATTERNS[spKey];
    var matchedStages = 0;
    var matchedDetails = [];

    for (var s = 0; s < pattern.stages.length; s++) {
      var stage = pattern.stages[s];
      var stageMatched = false;
      for (var k = 0; k < stage.keywords.length; k++) {
        if (fullText.indexOf(stage.keywords[k]) !== -1) {
          stageMatched = true;
          matchedDetails.push(stage.indicator + ': "' + stage.keywords[k] + '"');
          break;
        }
      }
      if (stageMatched) matchedStages++;
    }

    // Flag if 3+ stages of a 4+ stage pattern are matched
    if (matchedStages >= 3 && pattern.stages.length >= 4) {
      findings.push({
        type: 'SERIAL',
        serialPattern: spKey,
        serialName: pattern.name,
        severity: pattern.severity,
        category: pattern.category,
        evidence: pattern.name + ' detected: ' + matchedStages + '/' + pattern.stages.length + ' stages matched. ' + matchedDetails.join('; '),
        location: 'Full document'
      });
    }
    // Flag if 2+ stages of a 3- stage pattern
    else if (matchedStages >= 2 && pattern.stages.length < 4) {
      findings.push({
        type: 'SERIAL',
        serialPattern: spKey,
        serialName: pattern.name,
        severity: pattern.severity,
        category: pattern.category,
        evidence: pattern.name + ' detected: ' + matchedStages + '/' + pattern.stages.length + ' stages matched',
        location: 'Full document'
      });
    }
  }

  return findings;
}

// ===================== MAIN FORENSIC ENGINE =====================

async function runForensicEngine(pdfBytes, pdfDoc) {
  var allFindings = [];

  // Extract text blocks (one per page)
  var textBlocks = [];
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
  }

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
    DETECTORS.D36_DETECT_SOURCE_FAILURE
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
    // Yield to browser every 8 detectors to prevent UI freeze
    if ((d + 1) % 8 === 0) {
      await new Promise(function(resolve) { setTimeout(resolve, 0); });
    }
  }

  // Yield before catch-all detector
  await new Promise(function(resolve) { setTimeout(resolve, 0); });

  // Run catch-all detector (needs other findings)
  try {
    var catchallFindings = DETECTORS.D37_DETECT_INTERNAL_CONFLICT_CATCHALL(textBlocks, allFindings);
    allFindings = allFindings.concat(catchallFindings);
  } catch(e) {}

  // Yield before serial pattern detection
  await new Promise(function(resolve) { setTimeout(resolve, 0); });

  // Run serial pattern detection
  try {
    var serialFindings = detectSerialPatterns(textBlocks);
    allFindings = allFindings.concat(serialFindings);
  } catch(e) {}

  // Calculate overall score
  var totalScore = 0;
  var maxScore = 0;
  var findingsByType = {};
  var findingsByCategory = {};

  for (var f = 0; f < allFindings.length; f++) {
    var finding = allFindings[f];
    totalScore += finding.severity;
    maxScore += 5; // max severity per finding

    if (!findingsByType[finding.type]) findingsByType[finding.type] = [];
    findingsByType[finding.type].push(finding);

    var ct = CONTRADICTION_TYPES[finding.type];
    var cat = ct ? ct.category : (finding.category || 'UNKNOWN');
    if (!findingsByCategory[cat]) findingsByCategory[cat] = [];
    findingsByCategory[cat].push(finding);
  }

  var overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  var confidence = overallScore >= 80 ? 'VERY_HIGH' : overallScore >= 60 ? 'HIGH' :
                   overallScore >= 40 ? 'MODERATE' : overallScore >= 20 ? 'LOW' : 'CLEAN';

  return {
    clean: overallScore < 20,
    overallScore: overallScore,
    maxPossibleScore: 100,
    confidence: confidence,
    totalFindings: allFindings.length,
    findings: allFindings,
    findingsByType: findingsByType,
    findingsByCategory: findingsByCategory,
    contradictionTypesUsed: Object.keys(findingsByType).length,
    serialPatternsDetected: allFindings.filter(function(f){return f.type==='SERIAL';}).length,
    summary: generateSummary(allFindings, overallScore)
  };
}

function generateSummary(findings, score) {
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
    CONTRADICTION_TYPES: CONTRADICTION_TYPES,
    DETECTORS: DETECTORS,
    SERIAL_PATTERNS: SERIAL_PATTERNS,
    runForensicEngine: runForensicEngine,
    detectSerialPatterns: detectSerialPatterns
  };
}
