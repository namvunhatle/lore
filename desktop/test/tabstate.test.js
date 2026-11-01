const test = require('node:test');
const assert = require('node:assert');
const ts = require('../src/tabstate');

const T = (id, url, extra = {}) => ({ id, url, title: 't' + id, ...extra });

test('snapshot keeps web tabs only, never private or New tab, and marks the active one', () => {
  const s = ts.snapshot([T(1, 'file:///home.html'), T(2, 'https://a.example/'), T(3, 'https://b.example/', { private: true }), T(4, 'https://c.example/', { pinned: true })], 4);
  assert.deepStrictEqual(s.tabs.map((t) => t.url), ['https://a.example/', 'https://c.example/']);
  assert.strictEqual(s.active, 1);
  assert.strictEqual(s.tabs[1].pinned, true);
});

test('restore refuses anything that is not a web address and clamps the active index', () => {
  const r = ts.restore({ tabs: [{ url: 'javascript:alert(1)' }, { url: 'file:///etc/passwd' }, { url: 'https://ok.example/', title: 5 }, null, 'x'], active: 99 });
  assert.deepStrictEqual(r.tabs, [{ url: 'https://ok.example/', title: '', pinned: false }]);
  assert.strictEqual(r.active, 0);
  for (const bad of [null, undefined, [], 'x', { tabs: 'x' }]) assert.deepStrictEqual(ts.restore(bad), { tabs: [], active: 0 });
});

test('closed tabs come back newest first and private tabs are not remembered', () => {
  const c = new ts.ClosedTabs();
  c.push(T(1, 'https://a.example/'));
  c.push(T(2, 'https://b.example/', { private: true }));
  c.push(T(3, 'about:blank'));
  c.push(T(4, 'https://d.example/'));
  assert.strictEqual(c.pop().url, 'https://d.example/');
  assert.strictEqual(c.pop().url, 'https://a.example/');
  assert.strictEqual(c.pop(), null);
});

test('closed tab history is capped', () => {
  const c = new ts.ClosedTabs();
  for (let i = 0; i < 60; i++) c.push(T(i, 'https://x.example/' + i));
  assert.strictEqual(c.size, ts.MAX_CLOSED);
  assert.strictEqual(c.pop().url, 'https://x.example/59');
});

test('reorder moves a tab before another or to the end', () => {
  const tabs = [T(1, 'a'), T(2, 'b'), T(3, 'c')];
  assert.deepStrictEqual(ts.reorder(tabs, 3, 1).map((t) => t.id), [3, 1, 2]);
  assert.deepStrictEqual(ts.reorder(tabs, 1, null).map((t) => t.id), [2, 3, 1]);
  assert.deepStrictEqual(ts.reorder(tabs, 2, 2).map((t) => t.id), [1, 2, 3]);
  assert.deepStrictEqual(ts.reorder(tabs, 9, 1).map((t) => t.id), [1, 2, 3]);
});

test('pinned tabs stay in front of unpinned ones', () => {
  const tabs = [T(1, 'a', { pinned: true }), T(2, 'b'), T(3, 'c')];
  assert.deepStrictEqual(ts.reorder(tabs, 3, 1).map((t) => t.id), [1, 3, 2]);
  assert.strictEqual(ts.reorder(tabs, 1, null)[0].id, 1);
});

test('pin and unpin move the tab across the boundary', () => {
  let tabs = [T(1, 'a'), T(2, 'b'), T(3, 'c')];
  tabs = ts.setPinned(tabs, 3, true);
  assert.deepStrictEqual(tabs.map((t) => t.id), [3, 1, 2]);
  tabs = ts.setPinned(tabs, 3, false);
  assert.deepStrictEqual(tabs.map((t) => t.id), [3, 1, 2]);
  assert.strictEqual(tabs[0].pinned, false);
});

test('next tab after closing, cycling and numbered switching', () => {
  const tabs = [T(1, 'a'), T(2, 'b'), T(3, 'c')];
  assert.strictEqual(ts.nextAfterClose([tabs[0], tabs[2]], 1).id, 3);
  assert.strictEqual(ts.nextAfterClose([tabs[0]], 5).id, 1);
  assert.strictEqual(ts.nextAfterClose([], 0), null);
  assert.strictEqual(ts.cycle(tabs, 3, 1).id, 1);
  assert.strictEqual(ts.cycle(tabs, 1, -1).id, 3);
  assert.strictEqual(ts.nth(tabs, 2).id, 2);
  assert.strictEqual(ts.nth(tabs, 9).id, 3);
  assert.strictEqual(ts.nth(tabs, 7), null);
});
