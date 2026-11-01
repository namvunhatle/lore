// Importing from other browsers, with real SQLite files (Electron's Node has node:sqlite; older Node does not).
const { app } = require('electron');
app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'lore-e2e-')));
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const imp = require('../src/importer');

app.whenReady().then(() => {
  let code = 0;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-imp-home-'));
  try {
    // A Chromium-style profile: History (SQLite) and Bookmarks (JSON).
    const chrome = path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default');
    fs.mkdirSync(chrome, { recursive: true });
    const h = new DatabaseSync(path.join(chrome, 'History'));
    h.exec('CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, visit_count INTEGER, last_visit_time INTEGER, hidden INTEGER DEFAULT 0)');
    const ins = h.prepare('INSERT INTO urls (url, title, last_visit_time, hidden) VALUES (?, ?, ?, ?)');
    const now = (Date.now() + 11644473600000) * 1000;
    ins.run('https://news.example/a', 'News A', now - 1000, 0);
    ins.run('https://news.example/b', 'News B', now - 5000, 0);
    ins.run('https://hidden.example/', 'Hidden', now - 2000, 1);
    ins.run('file:///etc/hosts', 'Local', now - 3000, 0);
    h.close();
    fs.writeFileSync(path.join(chrome, 'Bookmarks'), JSON.stringify({ roots: { bookmark_bar: { children: [{ type: 'url', name: 'Site', url: 'https://site.example/' }] }, other: { children: [] } } }));

    // A Firefox-style profile: places.sqlite holds both.
    const ff = path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles', 'abcd1234.default-release');
    fs.mkdirSync(ff, { recursive: true });
    const f = new DatabaseSync(path.join(ff, 'places.sqlite'));
    f.exec('CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_date INTEGER)');
    f.exec('CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT, dateAdded INTEGER)');
    f.exec("INSERT INTO moz_places VALUES (1, 'https://ff.example/', 'FF page', 1700000000000000), (2, 'https://tagged.example/', 'Tagged', NULL)");
    f.exec("INSERT INTO moz_bookmarks VALUES (1, 2, NULL, 0, '', 0), (2, 2, NULL, 1, 'menu', 0), (3, 2, NULL, 1, 'toolbar', 0), (4, 2, NULL, 1, 'tags', 0), (5, 2, NULL, 1, 'unfiled', 0), (10, 2, NULL, 3, 'Reading', 0), (11, 1, 1, 10, 'FF bookmark', 1700000000000000), (12, 1, 2, 4, 'tag entry', 0)");
    f.close();

    const found = imp.detect({ platform: 'darwin', home, env: {} });
    assert.deepStrictEqual(found.map((s) => s.id), ['chrome', 'firefox']);

    const c = imp.read(found[0], found[0].profiles[0], { bookmarks: true, history: true }, { otherLabel: 'Imported' });
    assert.deepStrictEqual(c.errors, []);
    assert.deepStrictEqual(c.history.map((x) => x.title), ['News A', 'News B'], 'newest first, hidden and non-web rows left out');
    assert.ok(Math.abs(c.history[0].ts - Date.now()) < 60000, 'Chromium time converted');
    assert.deepStrictEqual(c.bookmarks.map((x) => x.title), ['Site']);

    const r = imp.read(found[1], found[1].profiles[0], { bookmarks: true, history: true }, { otherLabel: 'Imported' });
    assert.deepStrictEqual(r.errors, []);
    assert.deepStrictEqual(r.history.map((x) => x.title), ['FF page']);
    assert.strictEqual(r.history[0].ts, 1700000000000);
    assert.deepStrictEqual(r.bookmarks.map((x) => [x.title, x.folder]), [['FF bookmark', 'Reading']], 'folder kept, tags ignored');
    console.log('import ok');
  } catch (e) { console.error('import FAILED', e); code = 1; }
  fs.rmSync(home, { recursive: true, force: true });
  app.exit(code);
});
