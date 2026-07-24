// Tests for ots-proof.js — the OpenTimestamps detached-timestamp implementation.
// Verifies binary-format conformance and build/parse round-trips.
//
// Run:  node tests/ots-proof.test.js

const path = require('path');
require(path.join(__dirname, '..', 'ots-proof.js'));
const V = globalThis.VoOts;
const t = require('./_assert');

const H = 'deadbeef00112233445566778899aabbccddeeff0123456789abcdef01234567';

// hex round-trip
t.ok(V.bytesToHex(V.hexToBytes(H)) === H, 'hex round-trips (bytesToHex(hexToBytes)==id)');
t.ok(V.hexToBytes(H).length === 32, '64 hex chars -> 32 bytes');

// URL normalization
t.ok(V.normalizeCalendarUrl(' https://a.pool.opentimestamps.org/ ') === 'https://a.pool.opentimestamps.org', 'normalize trims and strips trailing slash');
t.ok(V.normalizeCalendarUrl(null) === '', 'normalize handles null');

// digest / input validation
t.ok(t.throws(() => V.buildPendingReceipt('abcd', ['https://a.calendar.org'])), 'buildPendingReceipt rejects non-32-byte digest');
t.ok(t.throws(() => V.buildPendingReceipt(H, [])), 'buildPendingReceipt rejects empty calendar list');
t.ok(t.throws(() => V.buildFileFromFragment(H, new Uint8Array([]))), 'buildFileFromFragment rejects empty fragment');

// build + spec-conformance
const cals = ['https://alice.btc.calendar.opentimestamps.org', 'https://bob.btc.calendar.opentimestamps.org'];
const ots = V.buildPendingReceipt(H, cals);
t.ok(ots instanceof Uint8Array && ots.length > 40, 'buildPendingReceipt returns non-trivial bytes');
t.ok(Buffer.from(ots.slice(1, 15)).toString('latin1') === 'OpenTimestamps', 'header magic contains "OpenTimestamps"');
t.ok(V.bytesToHex(ots.slice(33, 65)) === H, 'digest embedded at correct offset (after magic+version+op)');

// parse round-trip
const summary = V.parseSummary(ots);
t.ok(summary && Array.isArray(summary.calendars), 'parseSummary returns calendars array');
t.ok(summary.digestHex === H, 'parseSummary recovers digest hex');
t.ok(summary.version === 1, 'parseSummary version == 1');
t.ok((summary.calendars || []).length === 2, 'parseSummary recovers both calendar URIs');

// robustness on garbage / empty
const bad = V.parseSummary(new Uint8Array([1, 2, 3, 4, 5]));
t.ok(bad && bad.valid === false && bad.errors.length > 0, 'parseSummary flags invalid input without throwing');
t.ok(V.parseSummary(new Uint8Array([])).errors.length > 0, 'parseSummary handles empty input');

t.done('ots-proof');
