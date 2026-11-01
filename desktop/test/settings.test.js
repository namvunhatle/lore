const test = require('node:test');
const assert = require('node:assert');
test('appearance defaults to the system and accepts only light, dark or system', () => {
  const { Settings } = require('../src/settings');
  const s = new Settings({});
  assert.strictEqual(s.get().appearance, 'system');
  s.update({ appearance: 'dark' });
  assert.strictEqual(s.get().appearance, 'dark');
  s.update({ appearance: 'purple' });
  assert.strictEqual(s.get().appearance, 'dark', 'an unknown value changes nothing');
  assert.strictEqual(s.view().appearance, 'dark');
});

test('automatic update checks are on by default and can be turned off', () => {
  const { Settings } = require('../src/settings');
  const s = new Settings({});
  assert.strictEqual(s.get().autoUpdate, true);
  s.update({ autoUpdate: false });
  assert.strictEqual(s.get().autoUpdate, false);
  s.update({ autoUpdate: 'no' });
  assert.strictEqual(s.get().autoUpdate, false, 'only a real boolean changes it');
  assert.strictEqual(s.view().autoUpdate, false);
});
