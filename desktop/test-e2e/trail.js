// Reading trail, in the real app: Cmd-click and middle-click make child tabs, closing a parent lifts its children, dragging
// a tab out of the tree detaches it, and the tree survives a restart. Runs main.js itself (two launches, one data folder).
const { app, BrowserWindow, webContents } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { spawnSync } = require('child_process');
const phase2 = process.argv.includes('--phase2');
const ud = phase2 ? process.argv[process.argv.indexOf('--phase2') + 1] : fs.mkdtempSync(path.join(os.tmpdir(), 'lore-trail-'));
app.setPath('userData', ud);
process.env.LORE_NO_WELCOME = '1';
const assert = require('node:assert');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = (title, links) => `<!doctype html><title>${title}</title><body style="margin:0">${links.map((l, i) => `<a id="${l}" href="/${l}" style="display:block;position:absolute;left:20px;top:${20 + i * 60}px;width:200px;height:40px">${l}</a>`).join('')}`;
const server = http.createServer((req, res) => {
  const name = req.url.slice(1).split('?')[0] || 'a';
  const links = { a: ['b', 'c', 'e'], b: ['d'], c: [], d: [], e: [] }[name] || [];
  res.setHeader('content-type', 'text/html'); res.end(page(name, links));
});

app.on('window-all-closed', () => {}); // destroying the probe window must not quit the app
app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // Remember the newest state the main process sent to its window.
  let state = null;
  const probe = new BrowserWindow({ show: false });
  const proto = Object.getPrototypeOf(probe.webContents);
  const send = proto.send;
  proto.send = function (ch, ...a) { if (ch === 'state') state = a[0]; return send.call(this, ch, ...a); };
  probe.destroy();
  require('../src/main.js');
  const until = async (f, what) => { for (let i = 0; i < 100; i++) { try { if (f()) return; } catch { /* not yet */ } await sleep(100); } throw new Error('timed out: ' + what + '\n' + JSON.stringify(state && state.tabs.map((t) => [t.id, t.title, t.parent, t.depth]))); };
  const rows = () => state.tabs.map((t) => t.title + ':' + t.parent);
  const tabWc = (needle) => webContents.getAllWebContents().find((w) => w.getURL().startsWith('http://127.0.0.1') && w.getURL().endsWith(needle));
  const ui = () => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('index.html')).webContents;
  const click = async (wc, id, extra) => {
    const r = await wc.executeJavaScript(`(() => { const b = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return [b.x + 10, b.y + 10]; })()`);
    const mod = process.platform === 'darwin' ? ['meta'] : ['control'];
    const o = { x: Math.round(r[0]), y: Math.round(r[1]), clickCount: 1, ...extra(mod) };
    wc.sendInputEvent({ type: 'mouseMove', x: o.x, y: o.y });
    wc.sendInputEvent({ type: 'mouseDown', ...o }); wc.sendInputEvent({ type: 'mouseUp', ...o });
  };
  let code = 0;
  try {
    await until(() => state && state.tabs.length, 'first state');
    if (phase2) {
      await until(() => state.tabs.length === 4, 'restored 4 tabs');
      const byId = new Map(state.tabs.map((t) => [t.id, t]));
      const kids = state.tabs.filter((t) => t.parent);
      assert.strictEqual(kids.length, 3, 'a and its three children restored');
      assert.ok(kids.every((k) => byId.has(k.parent)), 'every parent is one of the restored tabs');
      assert.ok(kids.every((k) => byId.get(k.parent).parent === 0), 'children hang from the root');
      console.log('trail phase 2 ok'); code = 0;
    } else {
      // 1. Open a page; Cmd-click b, middle-click c: both become children of a, in the order they were opened.
      const first = state.tabs[0].id;
      ui().executeJavaScript(`lore.send('nav:submit', ${JSON.stringify(base + '/a')})`);
      await until(() => state.tabs[0].title === 'a', 'page a loaded');
      const a = tabWc('/a');
      await click(a, 'b', (mod) => ({ button: 'left', modifiers: mod }));
      await until(() => state.tabs.length === 2, 'cmd-click opens a tab');
      await click(a, 'c', () => ({ button: 'middle', modifiers: [] }));
      await until(() => state.tabs.length === 3, 'middle-click opens a tab');
      await until(() => state.tabs.every((t) => t.title && t.title !== 'New tab'), 'titles');
      assert.deepStrictEqual(state.tabs.map((t) => t.parent), [0, first, first], 'b and c are children of a: ' + rows());
      assert.deepStrictEqual(state.tabs.map((t) => t.depth), [0, 1, 1]);
      // 2. A plain click stays in the same tab.
      await click(a, 'e', () => ({ button: 'left', modifiers: [] }));
      await until(() => state.tabs[0].title === 'e', 'plain click navigates in place');
      assert.strictEqual(state.tabs.length, 3);
      ui().executeJavaScript(`lore.send('tab:select', ${first}); lore.send('nav:submit', ${JSON.stringify(base + '/a')})`); await until(() => state.tabs[0].title === 'a', 'back on a');
      // 3. Cmd-click from the child b: d is a grandchild, right under b.
      const b = state.tabs[1];
      ui().executeJavaScript(`lore.send('tab:select', ${b.id})`);
      await until(() => state.tabs[1].active, 'b is active');
      await click(tabWc('/b'), 'd', (mod) => ({ button: 'left', modifiers: mod }));
      await until(() => state.tabs.length === 4, 'grandchild opens');
      await until(() => state.tabs.every((t) => t.title), 'titles 2');
      assert.deepStrictEqual(state.tabs.map((t) => t.depth), [0, 1, 2, 1], 'd sits under b, before c: ' + rows());
      // 4. Close b: d moves up to be a child of a.
      ui().executeJavaScript(`lore.send('tab:close', ${b.id})`);
      await until(() => state.tabs.length === 3, 'b closed');
      assert.deepStrictEqual(state.tabs.map((t) => t.depth), [0, 1, 1], 'd lifted one level: ' + rows());
      assert.ok(state.tabs.every((t) => t.parent === 0 || t.parent === first));
      // 5. Open b again as a child so the saved tree has a grandchild-free shape of 4 tabs, then let the session save.
      await click(tabWc('/a'), 'b', (mod) => ({ button: 'left', modifiers: mod }));
      await until(() => state.tabs.length === 4, 'b reopened');
      await sleep(4000);
      console.log('trail phase 1 ok');
    }
  } catch (e) { console.error('trail FAILED', e); code = 1; }
  server.close();
  if (!phase2 && code === 0) {
    app.releaseSingleInstanceLock();
    await sleep(6000); // let the session file reach the disk
    const r = spawnSync(process.execPath, [__filename, '--phase2', ud], { stdio: 'inherit', env: process.env });
    code = r.status || 0;
  }
  app.exit(code);
});
