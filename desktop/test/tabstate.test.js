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
  assert.deepStrictEqual(r.tabs, [{ url: 'https://ok.example/', title: '', pinned: false, group: 0, parent: -1 }]);
  assert.strictEqual(r.active, 0);
  for (const bad of [null, undefined, [], 'x', { tabs: 'x' }]) assert.deepStrictEqual(ts.restore(bad), { tabs: [], groups: [], active: 0 });
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

const G = (id, group, extra = {}) => ({ id, url: 'https://x.example/' + id, title: 't' + id, group, ...extra });

test('groups are saved and restored, and unknown group ids are dropped', () => {
  const tabs = [G(1, 5), G(2, 0), G(3, 5)];
  const snap = ts.snapshot(tabs, 3, [{ id: 5, name: 'Trip', color: 'blue', collapsed: true }, { id: 9, name: 'Unused' }]);
  assert.deepStrictEqual(snap.groups.map((g) => g.id), [5]);
  const back = ts.restore(JSON.parse(JSON.stringify(snap)));
  assert.deepStrictEqual(back.tabs.map((t) => t.group), [5, 0, 5]);
  assert.strictEqual(back.groups[0].collapsed, true);
  const odd = ts.restore({ tabs: [{ url: 'https://a.example/', group: 77 }], groups: [{ id: 'x' }] });
  assert.strictEqual(odd.tabs[0].group, 0);
  assert.deepStrictEqual(odd.groups, []);
});

test('arrange gathers each group at its first member and keeps pinned tabs in front', () => {
  const tabs = [G(1, 0, { pinned: true }), G(2, 7), G(3, 0), G(4, 7), G(5, 8), G(6, 8), G(7, 7)];
  assert.deepStrictEqual(ts.arrange(tabs).map((t) => t.id), [1, 2, 4, 7, 3, 5, 6]);
});

test('a pinned tab cannot be in a group', () => {
  const tabs = [G(1, 4, { pinned: true }), G(2, 4)];
  ts.arrange(tabs);
  assert.strictEqual(tabs[0].group, 0);
});

test('dropping a tab inside a group joins it, away from its group leaves it', () => {
  const tabs = [G(1, 3), G(2, 0), G(3, 3), G(4, 0)];
  ts.settle(tabs, 2); // between two members of group 3
  assert.strictEqual(tabs[1].group, 3);
  const apart = [G(1, 3), G(2, 3), G(3, 0), G(4, 3)];
  ts.settle(apart, 4); // dragged to the far end, next to an ungrouped tab only
  assert.strictEqual(apart[3].group, 0, 'its neighbour is outside the group, so it leaves it');
});

test('assign puts tabs into a new group and gathers them', () => {
  const tabs = [G(1, 0), G(2, 0), G(3, 0), G(4, 0)];
  const out = ts.assign(tabs, [{ groupId: 9, ids: [1, 3] }]);
  assert.deepStrictEqual(out.map((t) => t.id), [1, 3, 2, 4]);
  assert.deepStrictEqual(out.map((t) => t.group), [9, 9, 0, 0]);
});

// Reading trail: `parent` is the id of the tab a tab was opened from (0 = none). On disk it is an index into `tabs`.
const P = (id, parent = 0, extra = {}) => ({ id, parent, url: 'https://x.example/' + id, title: 't' + id, ...extra });

test('a child is inserted after the last descendant of its parent', () => {
  const tabs = [P(1), P(2, 1), P(3, 2), P(4)];
  assert.strictEqual(ts.childSlot(tabs, 1), 3);
  assert.strictEqual(ts.childSlot(tabs, 2), 3);
  assert.strictEqual(ts.childSlot(tabs, 4), 4);
  assert.strictEqual(ts.childSlot(tabs, 99), tabs.length);
});

test('closing a parent lifts its children one level, to the grandparent', () => {
  const tabs = [P(1), P(2, 1), P(3, 2), P(4, 2)];
  ts.release(tabs, 2);
  assert.deepStrictEqual(tabs.map((t) => t.parent), [0, 1, 1, 1]);
  ts.release(tabs, 1);
  assert.deepStrictEqual(tabs.map((t) => t.parent), [0, 0, 0, 0]);
});

test('detach cuts a tab out of the tree and lifts its children', () => {
  const tabs = [P(1), P(2, 1), P(3, 2)];
  ts.detach(tabs, 2);
  assert.strictEqual(tabs[1].parent, 0);
  assert.strictEqual(tabs[2].parent, 1);
});

test('a private tab never joins the tree of a normal tab, nor the reverse', () => {
  const tabs = [P(1), P(2, 0, { private: true })];
  assert.strictEqual(ts.canParent(tabs[0], tabs[1]), false);
  assert.strictEqual(ts.canParent(tabs[1], tabs[0]), false);
  assert.strictEqual(ts.canParent(tabs[0], P(3)), true);
  assert.strictEqual(ts.canParent(P(4, 0, { pinned: true }), P(3)), false);
  assert.strictEqual(ts.canParent(null, P(3)), false);
});

test('depth counts levels from the root and survives a broken loop', () => {
  const tabs = [P(1), P(2, 1), P(3, 2), P(4, 3)];
  assert.deepStrictEqual(tabs.map((t) => ts.depth(tabs, t.id)), [0, 1, 2, 3]);
  const loop = [P(1, 2), P(2, 1)];
  assert.ok(ts.depth(loop, 1) < 100);
});

test('the trail is saved as indexes and restored', () => {
  const tabs = [P(10), P(11, 10), P(12, 11), P(13, 0, { private: true }), P(14, 12)];
  const snap = ts.snapshot(tabs, 10);
  assert.deepStrictEqual(snap.tabs.map((t) => t.parent), [-1, 0, 1, 2]);
  const back = ts.restore(JSON.parse(JSON.stringify(snap)));
  assert.deepStrictEqual(back.tabs.map((t) => t.parent), [-1, 0, 1, 2]);
});

test('a parent that was not saved is dropped when snapshotting', () => {
  const tabs = [P(1, 0, { private: true }), P(2, 1)];
  assert.deepStrictEqual(ts.snapshot(tabs, 2).tabs.map((t) => t.parent), [-1]);
});

test('restore ignores parents that are out of range, itself, a later tab, a pinned tab or part of a loop', () => {
  const u = (parent, extra = {}) => ({ url: 'https://a.example/', parent, ...extra });
  const r = ts.restore({ tabs: [u(5), u(1), u(0), u('x'), u(-3), u(2, { pinned: true }), u(0)] });
  assert.deepStrictEqual(r.tabs.map((t) => t.parent), [-1, -1, 0, -1, -1, -1, 0]);
  const loop = ts.restore({ tabs: [u(1), u(0)] });
  assert.deepStrictEqual(loop.tabs.map((t) => t.parent), [-1, 0]);
});
