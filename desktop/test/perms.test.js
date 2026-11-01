const test = require('node:test');
const assert = require('node:assert');
const { SitePerms } = require('../src/perms');

test('decisions are remembered, listed in order, removed one by one, and saved', () => {
  let saved;
  const p = new SitePerms({ save: (d) => { saved = d; } });
  p.set('https://b.example', 'media', true);
  p.set('https://a.example', 'geolocation', false);
  assert.strictEqual(p.get('https://b.example', 'media'), true);
  assert.deepStrictEqual(p.list().map((x) => x.origin), ['https://a.example', 'https://b.example']);
  assert.strictEqual(Object.keys(saved).length, 2);
  p.remove('https://b.example', 'media');
  assert.ok(!p.has('https://b.example', 'media'));
  const again = new SitePerms({ load: () => saved });
  assert.strictEqual(again.get('https://a.example', 'geolocation'), false);
  again.reset();
  assert.strictEqual(again.list().length, 0);
});

test('a damaged file or a strange key is ignored', () => {
  assert.strictEqual(new SitePerms({ load: () => [] }).list().length, 0);
  assert.strictEqual(new SitePerms({ load: () => ({ 'file:///x|media': true, 'https://ok.example|media': true, 'https://x.example|a|b': true, bad: 1 }) }).list().length, 1);
  const p = new SitePerms();
  p.set('javascript:alert(1)', 'media', true);
  assert.strictEqual(p.list().length, 0);
});
