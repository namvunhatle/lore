const test = require('node:test');
const assert = require('node:assert');
const { Bookmarks } = require('../src/bookmarks');
const { connectionOf, certReason, httpsVersion } = require('../src/security');

const make = (data) => { const saved = []; const b = new Bookmarks({ load: () => data, save: (d) => saved.push(JSON.parse(JSON.stringify(d))) }); return { b, saved }; };

test('the star adds a page once and removes it the second time', () => {
  const { b, saved } = make(null);
  const r1 = b.toggle('https://a.example/x', 'A');
  assert.ok(r1.added);
  assert.ok(b.find('https://a.example/x'));
  const r2 = b.toggle('https://a.example/x', 'A');
  assert.ok(!r2.added);
  assert.strictEqual(b.items.length, 0);
  assert.strictEqual(saved.length, 2);
});

test('only web addresses can be bookmarked and bad saved data is dropped', () => {
  const { b } = make({ items: [{ id: 1, url: 'javascript:alert(1)' }, { id: 2, url: 'https://ok.example/', title: 'ok' }, null] });
  assert.deepStrictEqual(b.items.map((x) => x.url), ['https://ok.example/']);
  assert.strictEqual(b.add({ url: 'file:///etc/passwd' }), null);
  assert.strictEqual(make([]).b.items.length, 0);
});

test('ids keep counting up and titles fall back to the address', () => {
  const { b } = make({ items: [{ id: 7, url: 'https://a.example/' }] });
  const n = b.add({ url: 'https://b.example/' });
  assert.strictEqual(n.id, 8);
  assert.strictEqual(n.title, 'https://b.example/');
});

test('search, folders and the bar', () => {
  const { b } = make(null);
  b.add({ url: 'https://news.example/ev', title: 'Xe điện tuần này' });
  const w = b.add({ url: 'https://work.example/', title: 'Work', folder: 'Công việc' });
  b.add({ url: 'https://work.example/2', title: 'Plan', folder: 'Công việc' });
  assert.deepStrictEqual(b.folders(), ['Công việc']);
  assert.strictEqual(b.list({ q: 'xe điện' }).length, 1);
  assert.strictEqual(b.list({ folder: 'Công việc' }).length, 2);
  const bar = b.barItems();
  assert.deepStrictEqual(bar.map((x) => x.type), ['link', 'folder']);
  assert.strictEqual(bar[1].count, 2);
  b.update(w.id, { folder: '' });
  assert.deepStrictEqual(b.barItems().map((x) => x.type), ['link', 'link', 'folder']);
});

test('export is a Netscape file with escaped text', () => {
  const { b } = make(null);
  b.add({ url: 'https://a.example/?a=1&b=2', title: '<b>"x"</b>' });
  b.add({ url: 'https://f.example/', title: 'F', folder: 'Dir' });
  const html = b.exportHtml();
  assert.match(html, /NETSCAPE-Bookmark-file-1/);
  assert.match(html, /a=1&amp;b=2/);
  assert.match(html, /&lt;b&gt;&quot;x&quot;&lt;\/b&gt;/);
  assert.match(html, /<H3>Dir<\/H3>/);
});

test('connection state of an address', () => {
  assert.strictEqual(connectionOf('https://a.example/'), 'https');
  assert.strictEqual(connectionOf('http://a.example/'), 'http');
  assert.strictEqual(connectionOf('http://localhost:3000/'), 'local');
  assert.strictEqual(connectionOf('http://127.0.0.1/'), 'local');
  assert.strictEqual(connectionOf('file:///x.html'), '');
  assert.strictEqual(connectionOf('nonsense'), '');
});

test('certificate error codes map to a reason and others are not certificate errors', () => {
  assert.strictEqual(certReason(-201), 'date');
  assert.strictEqual(certReason(-202), 'authority');
  assert.strictEqual(certReason(-200), 'name');
  assert.strictEqual(certReason(-105), null);
  assert.strictEqual(certReason(-20), null);
});

test('https version of a plain http address', () => {
  assert.strictEqual(httpsVersion('http://a.example/p?q=1'), 'https://a.example/p?q=1');
  assert.strictEqual(httpsVersion('https://a.example/'), null);
});
