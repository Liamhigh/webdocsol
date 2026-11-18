/*
 * Verum Omnis South African legal-citation pack (first jurisdiction pack).
 *
 * Owns the ZA grammar and identifiers only; spans, identity and resolution
 * live in the neutral core (legal-citations.js). Recognized forms:
 *   - neutral citations: [2026] ZACC 1 (and the other ZA* court identifiers
 *     listed below; an unrecognized court identifier simply does not match);
 *   - reported citations: 2026 (3) SA 112 (SCA) and 2011 (1) SACR 200 (CC),
 *     with an optional "at para 12" / "at 115" pinpoint immediately following;
 *     "SALR" is only ever a display name and never replaces the SA token;
 *   - Constitutional Court dockets: CCT 19/20, CCT237/20;
 *   - SAFLII source URLs.
 * Statute/section/Act extraction stays with the legacy voExtractCitations
 * coverage (forensic-engine-page.js) until parity is demonstrated; this pack
 * deliberately does not migrate those forms. No clock, no randomness, no
 * regex lookbehind. Classic script; CommonJS export for Node tests.
 */
(function (root) {
  'use strict';

  var PACK_ID = 'za';
  var PACK_VERSION = '1.0.0';

  // ZA neutral-citation court identifiers (SAFLII). Fail-closed by design: a
  // court identifier not listed here is not a neutral citation match.
  var NEUTRAL_COURTS = [
    'ZACC', 'ZASCA',
    'ZAGPJHC', 'ZAGPPHC', 'ZAKZDHC', 'ZAKZPHC', 'ZAWCHC',
    'ZAECELLC', 'ZAECGHC', 'ZAECMHC', 'ZAECPEHC',
    'ZAFSHC', 'ZALMPPHC', 'ZANWHC', 'ZANCHC',
    'ZALCJHB', 'ZALC'
  ];

  // Court/division codes that appear in parentheses after a SALR/SACR page.
  var REPORT_COURTS = [
    'A', 'AD', 'SCA', 'CC',
    'C', 'N', 'O', 'T', 'W', 'E', 'SE',
    'CPD', 'ECD', 'NCD', 'NPD', 'TPD', 'WLD', 'SWA', 'GDP', 'GSJ', 'KZD', 'KZP'
  ];

  var NEUTRAL_RE = new RegExp('\\[(\\d{4})\\]\\s+(' + NEUTRAL_COURTS.join('|') + ')\\s+(\\d+)\\b', 'g');
  var REPORTED_RE = new RegExp(
    '\\b(\\d{4})\\s+\\((\\d)\\)\\s+(SA|SACR)\\s+(\\d+)' +
    '(?:\\s+\\((' + REPORT_COURTS.join('|') + ')\\))?' +
    '(?:\\s+at\\s+(para(?:graph)?s?\\.?\\s+\\d+(?:\\s*[-\u2013]\\s*\\d+)?|\\d+[A-Z]?(?:\\s*[-\u2013]\\s*\\d+[A-Z])?))?',
    'g'
  );
  var CCT_DOCKET_RE = /\bCCT\s?(\d{1,3})\s?\/\s?(\d{2,4})\b/g;
  var SAFLII_RE = /\bhttps?:\/\/(?:www\.)?saflii\.org(?:\.za)?\/[^\s)\]"'<>]+/g;

  function orNull(value) {
    return value === undefined ? null : value;
  }

  var pack = {
    id: PACK_ID,
    version: PACK_VERSION,
    rules: [
      {
        rule_id: 'za-neutral-court',
        kind: 'neutral_case',
        pattern: NEUTRAL_RE,
        extract: function (match, context) {
          return {
            year: match[1],
            court: match[2],
            ordinal: match[3],
            caption: context.captureCaption(context.text, match.index)
          };
        }
      },
      {
        rule_id: 'za-reported-sa',
        kind: 'reported_case',
        pattern: REPORTED_RE,
        extract: function (match, context) {
          return {
            year: match[1],
            volume: match[2],
            reporter: match[3],
            first_page: match[4],
            court: orNull(match[5]),
            pinpoint: orNull(match[6]),
            caption: context.captureCaption(context.text, match.index)
          };
        }
      },
      {
        rule_id: 'za-docket-cct',
        kind: 'docket',
        pattern: CCT_DOCKET_RE,
        extract: function (match) {
          return { court: 'CCT', number: match[1], year_suffix: match[2] };
        }
      },
      {
        rule_id: 'za-saflii-url',
        kind: 'source_url',
        pattern: SAFLII_RE,
        extract: function (match) {
          return { url: match[0], host: 'saflii.org' };
        }
      }
    ]
  };

  if (root && root.VOLegalPacks) root.VOLegalPacks.register(pack);
  if (typeof module !== 'undefined' && module.exports) module.exports = pack;
  if (root) root.VOLegalPackZA = pack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
