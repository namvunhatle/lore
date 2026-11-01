const test = require('node:test');
const assert = require('node:assert');
const { Favicons, toDataUrl, valid } = require('../src/favicons');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const mem = () => { let d = []; return { load: () => d, save: (x) => { d = JSON.parse(JSON.stringify(x)); }, get disk() { return d; } }; };

test('only small raster data URLs are accepted', () => {
  assert.ok(valid(PNG));
  assert.ok(!valid('data:image/svg+xml;base64,AAAA'));
  assert.ok(!valid('https://x.com/favicon.ico'));
  assert.ok(!valid('data:text/html;base64,AAAA'));
  assert.ok(!valid('data:image/png;base64,' + 'A'.repeat(40000)));
});

test('store: set, get, replace, remove, clear, cap', () => {
  const s = mem();
  const f = new Favicons(s);
  assert.ok(f.set('a.com', PNG) && f.get('a.com') === PNG && f.has('a.com'));
  assert.ok(!f.set('b.com', 'javascript:alert(1)'));
  assert.deepStrictEqual(Object.keys(s.disk), ['a.com']);
  assert.strictEqual(new Favicons(s).get('a.com'), PNG, 'survives a reload');
  f.remove('a.com');
  assert.strictEqual(f.get('a.com'), '');
  for (let i = 0; i < 520; i++) f.set('h' + i + '.com', PNG);
  assert.strictEqual(Object.keys(f.map).length, 500);
  assert.ok(!f.has('h0.com') && f.has('h519.com'));
  f.clear();
  assert.deepStrictEqual(s.disk, {});
});

test('a store holding old data (an array) starts empty', () => {
  const s = { load: () => [], save() {} };
  assert.strictEqual(new Favicons(s).get('a.com'), '');
});

test('toDataUrl rejects svg, html, huge and failed responses', async () => {
  const res = (type, bytes, ok = true) => ({ ok, headers: new Headers({ 'content-type': type }), arrayBuffer: async () => new Uint8Array(bytes).buffer });
  assert.ok((await toDataUrl(res('image/png', 100))).startsWith('data:image/png;base64,'));
  assert.strictEqual(await toDataUrl(res('image/svg+xml', 100)), '');
  assert.strictEqual(await toDataUrl(res('text/html', 100)), '');
  assert.strictEqual(await toDataUrl(res('image/png', 30000)), '');
  assert.strictEqual(await toDataUrl(res('image/png', 100, false)), '');
});
