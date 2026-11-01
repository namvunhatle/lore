const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { PrivacyStats } = require('../src/pstats');
const privacy = require('../src/privacy');

test('tracking parameters are removed and everything else is untouched', () => {
  const r = privacy.stripTrackingParams('https://shop.example/p?id=7&utm_source=x&fbclid=abc&sig=a%2Bb==&gclid=1#top');
  assert.strictEqual(r.removed, 3);
  assert.strictEqual(r.url, 'https://shop.example/p?id=7&sig=a%2Bb==#top');
  assert.strictEqual(privacy.stripTrackingParams('https://a.example/?utm_medium=z').url, 'https://a.example/');
  assert.strictEqual(privacy.stripTrackingParams('https://a.example/?q=hello').removed, 0);
  assert.strictEqual(privacy.stripTrackingParams('not a url').removed, 0);
});

test('plain http goes to https except local and odd addresses', () => {
  assert.strictEqual(privacy.httpsUpgrade('http://news.example/a?b=1'), 'https://news.example/a?b=1');
  for (const u of ['http://localhost:3000/', 'http://192.168.1.1/', 'http://printer.local/', 'http://site.example:8080/', 'https://a.example/', 'http://intranet/']) assert.strictEqual(privacy.httpsUpgrade(u), '', u);
});

test('counters are kept per day, summed for the week, and saved', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-ps-')); const file = path.join(dir, 's.json');
  const s = new PrivacyStats({ file });
  const now = new Date(2026, 10, 1, 12).getTime();
  s.record('blocked', 'ads.example', 1, now); s.record('blocked', 'ads.example', 1, now); s.record('blocked', 'trk.example', 1, now - 86400000);
  s.record('params', '', 4, now); s.record('https', '', 1, now);
  const w = s.week(now);
  assert.strictEqual(w.days.length, 7);
  assert.deepStrictEqual(w.total, { blocked: 3, params: 4, https: 1 });
  assert.deepStrictEqual(w.top[0], { host: 'ads.example', count: 2 });
  s.save();
  assert.strictEqual(new PrivacyStats({ file }).week(now).total.blocked, 3);
  s.record('blocked', 'old.example', 1, now - 40 * 86400000); s.prune(now);
  assert.strictEqual(s.week(now).total.blocked, 3);
  fs.rmSync(dir, { recursive: true });
});
