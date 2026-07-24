// Tiny zero-dependency assertion helper shared by the test files.
let pass = 0, fail = 0;
const failures = [];

function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; failures.push(name); console.log('  ✗ FAIL: ' + name); }
}

function noThrow(fn, name) {
  try { return fn(); }
  catch (e) { fail++; failures.push(name + ' threw: ' + e.message); console.log('  ✗ FAIL: ' + name + ' threw: ' + e.message); return undefined; }
}

function throws(fn) {
  try { fn(); return false; }
  catch (e) { return true; }
}

function done(suite) {
  console.log('\n[' + suite + '] PASS=' + pass + ' FAIL=' + fail);
  if (fail) { process.exit(1); }
  console.log('[' + suite + '] ALL GREEN');
}

module.exports = { ok, noThrow, throws, done };
