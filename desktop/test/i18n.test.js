const test = require('node:test');
const assert = require('node:assert');
const { D, t, resolve } = require('../src/ui/i18n');

test('every English key exists in every language', () => {
  for (const lang of Object.keys(D)) {
    const missing = Object.keys(D.en).filter((k) => !(k in D[lang]));
    assert.deepStrictEqual(missing, [], lang + ' is missing keys');
  }
});
test('no language has stray keys', () => {
  for (const lang of Object.keys(D)) assert.deepStrictEqual(Object.keys(D[lang]).filter((k) => !(k in D.en)), []);
});
test('placeholders match across languages', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(D.en)) assert.strictEqual(ph(D.vi[k]), ph(D.en[k]), k);
});
test('t interpolates and falls back', () => {
  assert.strictEqual(t('vi', 'ago.days', { n: 3 }), '3 ngày trước');
  assert.strictEqual(t('xx', 'ago.today'), 'today');
  assert.strictEqual(t('en', 'no.such.key'), 'no.such.key');
});
test('resolve', () => {
  assert.strictEqual(resolve('auto', 'vi-VN'), 'vi');
  assert.strictEqual(resolve('auto', 'en-US'), 'en');
  assert.strictEqual(resolve('en', 'vi-VN'), 'en');
});
