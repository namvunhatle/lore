const test = require('node:test');
const assert = require('node:assert');
const { check, major } = require('../scripts/check-electron');

test('major parsing', () => {
  assert.strictEqual(major('^45.2.1'), 45);
  assert.strictEqual(major('~33.4.11'), 33);
  assert.strictEqual(major('45.2.1'), 45);
});
test('within the two newest majors passes; older fails', () => {
  assert.strictEqual(check('^45.2.1', '45.3.0').status, 'ok');
  assert.strictEqual(check('^45.2.1', '46.0.0').status, 'warn');   // one behind: allowed, but flagged
  assert.strictEqual(check('^45.2.1', '47.0.0').status, 'fail');   // two behind
  assert.strictEqual(check('^33.2.0', '45.2.1').status, 'fail');   // where Lore was before the upgrade
  assert.strictEqual(check('^46.0.0', '45.9.9').status, 'ok');     // ahead (beta channel) is fine
});
