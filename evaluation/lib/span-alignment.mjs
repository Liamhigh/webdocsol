// Development-only evaluation span alignment. All offsets are UTF-16 code units.

function assertText(value, name) {
  if (typeof value !== 'string') throw new TypeError(name + ' must be a string');
}

function assertBoundary(value, limit, name) {
  if (!Number.isInteger(value) || value < 0 || value > limit) {
    throw new RangeError(name + ' must be an integer between 0 and ' + limit);
  }
}

export function createAlignmentTable(sourceText, normalizedText, normalizedToOriginal, transformation = 'identity') {
  assertText(sourceText, 'sourceText');
  assertText(normalizedText, 'normalizedText');
  if (typeof transformation !== 'string' || !transformation.trim()) {
    throw new TypeError('transformation must name the recorded normalization');
  }
  const identity = sourceText === normalizedText && normalizedToOriginal === undefined;
  const map = identity ? Array.from({ length: sourceText.length + 1 }, (_, index) => index) : normalizedToOriginal;
  if (!Array.isArray(map) || map.length !== normalizedText.length + 1) {
    throw new RangeError('normalized_to_original must contain one boundary mapping per UTF-16 code unit, plus the end boundary');
  }
  let previous = 0;
  for (let index = 0; index < map.length; index++) {
    assertBoundary(map[index], sourceText.length, 'normalized_to_original[' + index + ']');
    if (map[index] < previous) throw new RangeError('normalized_to_original must be monotonic');
    previous = map[index];
  }
  if (map[0] !== 0 || map[map.length - 1] !== sourceText.length) {
    throw new RangeError('alignment must cover the complete original and normalized texts');
  }
  return Object.freeze({
    sourceText,
    normalizedText,
    normalizedToOriginal: Object.freeze(map.slice()),
    transformation
  });
}

export function mapNormalizedSpan(span, table) {
  if (!span || typeof span !== 'object') throw new TypeError('span is required');
  assertBoundary(span.start, table.normalizedText.length, 'span.start');
  assertBoundary(span.end, table.normalizedText.length, 'span.end');
  if (span.start >= span.end) throw new RangeError('span.start must be smaller than span.end');
  const start = table.normalizedToOriginal[span.start];
  const end = table.normalizedToOriginal[span.end];
  if (start >= end) throw new RangeError('normalization collapses the expected span to an empty original range');
  return Object.freeze({
    start,
    end,
    quote: table.sourceText.slice(start, end),
    transformation: table.transformation
  });
}

export function spanKey(span) {
  return span.start + ':' + span.end;
}

export function sameSpan(a, b) {
  return Boolean(a && b && a.start === b.start && a.end === b.end);
}

export function spansOverlap(a, b) {
  return Boolean(a && b && a.start < b.end && b.start < a.end);
}

export function unicodeTokens(text) {
  assertText(text, 'text');
  return text.match(/[\p{L}\p{N}_]+/gu) || [];
}

export function tokenOverlapCounts(expectedText, actualText) {
  const expected = unicodeTokens(expectedText);
  const actual = unicodeTokens(actualText);
  const remaining = new Map();
  for (const token of actual) remaining.set(token, (remaining.get(token) || 0) + 1);
  let tp = 0;
  for (const token of expected) {
    const count = remaining.get(token) || 0;
    if (count > 0) {
      tp++;
      remaining.set(token, count - 1);
    }
  }
  return { tp, fp: actual.length - tp, fn: expected.length - tp };
}
