const test = require('node:test');
const assert = require('node:assert');
const { mode, isNewer, RELEASES } = require('../src/update');

test('which systems can install an update by themselves', () => {
  assert.strictEqual(mode({ platform: 'win32' }), 'auto');
  assert.strictEqual(mode({ platform: 'linux', appImage: true }), 'auto');
  assert.strictEqual(mode({ platform: 'linux', appImage: false }), 'manual');
  assert.strictEqual(mode({ platform: 'darwin', signed: true }), 'auto');
  assert.strictEqual(mode({ platform: 'darwin', signed: false }), 'manual', 'macOS will not swap in an unsigned app');
  assert.strictEqual(mode({ platform: 'freebsd' }), 'manual');
});

test('version comparison', () => {
  assert.ok(isNewer('0.1.1', '0.1.2'));
  assert.ok(isNewer('0.9.9', '0.10.0'));
  assert.ok(isNewer('v1.0.0-beta.1', '1.0.0'));
  assert.ok(!isNewer('0.1.2', '0.1.2'));
  assert.ok(!isNewer('0.2.0', '0.1.9'));
  assert.ok(!isNewer('1.0.0', '1.0.0-beta.1'));
  assert.ok(!isNewer('nonsense', '1.0.0'));
});

test('the download page is on the project\'s own repository', () => {
  assert.match(RELEASES, /^https:\/\/github\.com\/tevo-web\/lore\//);
});
