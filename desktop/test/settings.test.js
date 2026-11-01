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
