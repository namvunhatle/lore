const test = require('node:test');
const assert = require('node:assert');
const start = require('../src/start');

const NOW = new Date(2026, 10, 2, 9, 0).getTime();

test('the greeting follows the hour', () => {
  assert.deepStrictEqual([6, 13, 19, 2].map(start.periodOf), ['morning', 'afternoon', 'evening', 'night']);
});

test('continue cards: the latest chat first, then pages, a saved page and a closed tab, no repeats', () => {
  const s = start.build({
    chats: [{ key: 'c1', title: 'Da Nang trip', host: 'wikipedia.org', ts: NOW - 3600000, count: 4 }],
    recent: [{ url: 'https://a.example/x', title: 'A', host: 'a.example', ts: NOW - 1000 }, { url: 'https://b.example/', title: 'B', host: 'b.example', ts: NOW - 2000 }, { url: 'https://c.example/', title: 'C', ts: NOW - 3000 }],
    reading: [{ url: 'https://r.example/', title: 'Read me' }], closed: [{ url: 'https://a.example/x', title: 'A' }], modelReady: true
  }, NOW);
  assert.deepStrictEqual(s.cards.map((c) => c.kind), ['chat', 'page', 'page', 'read']);
  assert.strictEqual(s.cards[0].key, 'c1');
  assert.ok(s.cards.length <= 4);
});

test('an old chat is not offered, and a private tab gets nothing from history', () => {
  assert.strictEqual(start.build({ chats: [{ key: 'c', title: 't', ts: NOW - 20 * 86400000, count: 2 }], modelReady: true }, NOW).cards.length, 0);
  const p = start.build({ private: true, recent: [{ url: 'https://a.example/', title: 'A', ts: NOW }], sites: [{ host: 'a.example', url: 'https://a.example/' }] }, NOW);
  assert.deepStrictEqual([p.cards.length, p.tiles.length, p.private], [0, 0, true]);
});

test('hints fit the moment: set up AI, many tabs, a long reading list', () => {
  const s = start.build({ modelReady: false, tabs: 11, readingCount: 6, recent: [{ url: 'https://a.example/', title: 'A', ts: NOW }] }, NOW);
  assert.deepStrictEqual(s.tips.map((t) => t.kind), ['setup', 'organize']);
  const t = start.build({ modelReady: true, tabs: 2, readingCount: 6, recent: [{ url: 'https://a.example/', title: 'A', ts: NOW }] }, NOW);
  assert.deepStrictEqual(t.tips.map((x) => x.kind), ['reading']);
});

test('with nothing yet, a few ideas are offered and they change from day to day', () => {
  const a = start.build({ modelReady: true }, NOW);
  const b = start.build({ modelReady: true }, NOW + 86400000);
  assert.ok(a.empty && a.tips.length === 2 && a.tips.every((x) => x.kind === 'idea'));
  assert.notDeepStrictEqual(a.tips.map((x) => x.idea), b.tips.map((x) => x.idea));
});

test('top sites: most visited in the last month, one per host', () => {
  const items = [1, 2, 3].map((i) => ({ url: 'https://a.example/p' + i, title: 't', ts: NOW - i * 1000 })).concat([{ url: 'https://b.example/x', title: 't', ts: NOW }, { url: 'https://old.example/', title: 't', ts: NOW - 60 * 86400000 }]);
  const t = start.topSites(items, NOW);
  assert.deepStrictEqual(t.map((x) => x.host), ['a.example', 'b.example']);
  assert.strictEqual(t[0].url, 'https://a.example/');
});
