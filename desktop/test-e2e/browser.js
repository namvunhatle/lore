// Browser basics: file downloads through a real session (BRW-04) and find in page (BRW-01).
const { app, BrowserWindow, session } = require('electron');
app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'lore-e2e-')));
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { DownloadList } = require('../src/downloads');

const listen = (handler) => new Promise((r) => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => r(s)); });

app.whenReady().then(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-dl-'));
  const server = await listen((req, res) => {
    if (req.url.startsWith('/report')) {
      res.setHeader('content-disposition', 'attachment; filename="../report.txt"');
      res.setHeader('content-type', 'application/octet-stream');
      res.end('hello lore');
    } else {
      res.setHeader('content-type', 'text/html');
      res.end('<p>alpha beta alpha</p><p>gamma ALPHA</p>');
    }
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let code = 0;
  try {
    const ses = session.fromPartition('persist:test-browser');
    const changes = [];
    const list = new DownloadList({ dir, onChange: (r) => changes.push(r && r.state) });
    ses.on('will-download', (_e, item) => list.track(item));
    const win = new BrowserWindow({ show: false, webPreferences: { session: ses } });
    await win.loadURL(base + '/page');

    const finished = () => new Promise((resolve) => {
      const t = setInterval(() => { if (list.items.length && list.items.every((r) => r.state !== 'progressing')) { clearInterval(t); resolve(); } }, 50);
    });
    win.webContents.downloadURL(base + '/report');
    await finished();
    assert.strictEqual(list.items[0].state, 'done');
    assert.strictEqual(path.dirname(list.items[0].path), dir, 'file stays inside the downloads folder (the ../ in the name is ignored)');
    assert.strictEqual(fs.readFileSync(list.items[0].path, 'utf8'), 'hello lore');
    assert.match(path.basename(list.items[0].path), /report\.txt$/);

    win.webContents.downloadURL(base + '/report');
    await new Promise((r) => setTimeout(r, 100));
    await finished();
    assert.strictEqual(list.items.length, 2);
    assert.match(path.basename(list.items[0].path), /report \(1\)\.txt$/, 'second file with the same name is numbered');
    assert.ok(changes.includes('done'));

    // Find in page: counts case-insensitive matches and moves between them.
    const found = (q, opts) => new Promise((resolve) => {
      win.webContents.once('found-in-page', (_e, r) => resolve(r));
      win.webContents.findInPage(q, opts);
    });
    const first = await found('alpha', { forward: true, findNext: false });
    assert.strictEqual(first.matches, 3, 'three matches, ignoring case');
    assert.strictEqual(first.activeMatchOrdinal, 1);
    const second = await found('alpha', { forward: true, findNext: true });
    assert.strictEqual(second.activeMatchOrdinal, 2);
    win.webContents.stopFindInPage('clearSelection');

    console.log('browser ok');
  } catch (e) { console.error('browser FAILED', e); code = 1; }
  server.close();
  app.exit(code);
});
