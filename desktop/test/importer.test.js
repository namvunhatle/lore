const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const imp = require('../src/importer');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lore-imp-test-'));

test('Chromium time is microseconds since 1601 and Firefox time since 1970', () => {
  assert.strictEqual(imp.chromeTime(13_300_000_000_000_000), 13_300_000_000_000 - 11_644_473_600_000);
  assert.strictEqual(imp.firefoxTime(1_700_000_000_000_000), 1_700_000_000_000);
});

test('Chromium bookmarks: the bar stays on top, folders keep their name, other goes under a label', () => {
  const json = { roots: {
    bookmark_bar: { children: [
      { type: 'url', name: 'A', url: 'https://a.example/', date_added: '13300000000000000' },
      { type: 'folder', name: 'Work', children: [
        { type: 'url', name: 'B', url: 'https://b.example/' },
        { type: 'folder', name: 'Deep', children: [{ type: 'url', name: 'C', url: 'https://c.example/' }] }
      ] },
      { type: 'url', name: 'bad', url: 'javascript:alert(1)' }
    ] },
    other: { children: [{ type: 'url', name: 'D', url: 'https://d.example/' }] }
  } };
  const r = imp.chromiumBookmarks(json, 'Imported');
  const by = Object.fromEntries(r.map((x) => [x.title, x.folder]));
  assert.deepStrictEqual(by, { A: '', B: 'Work', C: 'Work', D: 'Imported' });
});

test('a bookmarks file is read with its folders, entities and dates', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://a.example/?x=1&amp;y=2" ADD_DATE="1700000000">A &amp; B</A>
    <DT><H3>Trips</H3>
    <DL><p>
      <DT><A HREF="https://t.example/">Trip</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="https://loose.example/">Loose</A>
  <DT><A HREF="ftp://nope.example/">No</A>
</DL><p>`;
  const r = imp.parseNetscape(html, 'Imported');
  assert.strictEqual(r.length, 3);
  assert.deepStrictEqual(r.map((x) => [x.title, x.folder]), [['A & B', ''], ['Trip', 'Trips'], ['Loose', 'Imported']]);
  assert.strictEqual(r[0].url, 'https://a.example/?x=1&y=2');
  assert.strictEqual(r[0].ts, 1700000000000);
});

test('browsers are found on a Mac by their folders, with profile names', () => {
  const home = tmp();
  const base = path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  fs.mkdirSync(path.join(base, 'Default'), { recursive: true });
  fs.mkdirSync(path.join(base, 'Profile 2'), { recursive: true });
  fs.mkdirSync(path.join(base, 'Cache'), { recursive: true });
  fs.writeFileSync(path.join(base, 'Default', 'Bookmarks'), '{}');
  fs.writeFileSync(path.join(base, 'Profile 2', 'History'), '');
  fs.writeFileSync(path.join(base, 'Local State'), JSON.stringify({ profile: { info_cache: { 'Profile 2': { name: 'Work' } } } }));
  const r = imp.detect({ platform: 'darwin', home, env: {} });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].name, 'Google Chrome');
  assert.deepStrictEqual(r[0].profiles.map((p) => p.name), ['Default', 'Work']);
  assert.deepStrictEqual(imp.detect({ platform: 'darwin', home: tmp(), env: {} }), []);
});

test('only web addresses are accepted', () => {
  assert.ok(imp.isWeb('https://a.example'));
  assert.ok(!imp.isWeb('file:///x'));
  assert.ok(!imp.isWeb('https://a.example/' + 'x'.repeat(2100)));
});
