// Page outline in the real app: headings reach the sidebar state (not the ones in navigation), the reading line moves the
// current heading, dwell time marks sections read or skimmed, going to a heading scrolls the page, Cmd-click opens it as a
// child tab, and a short page has no outline. Runs main.js itself.
const { app, BrowserWindow, webContents } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'lore-outline-')));
process.env.LORE_NO_WELCOME = '1';
const assert = require('node:assert');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sec = (n, tag = 'h2') => `<${tag} id="s${n}">Section ${n}</${tag}><p style="height:1400px;margin:0">text ${n}</p>`;
const long = `<!doctype html><title>long</title><body style="margin:0"><nav><h2>Navigation noise</h2></nav>${sec(1)}${sec(2)}${sec('2a', 'h3')}${sec(3)}${sec(4)}${sec(5)}`;
const short = '<!doctype html><title>short</title><h1>One</h1><p>only one heading here</p>';
const server = http.createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end(req.url.startsWith('/short') ? short : long); });

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let state = null;
  const probe = new BrowserWindow({ show: false });
  const proto = Object.getPrototypeOf(probe.webContents);
  const send = proto.send;
  proto.send = function (ch, ...a) { if (ch === 'state') state = a[0]; return send.call(this, ch, ...a); };
  probe.destroy();
  require('../src/main.js');
  const until = async (f, what) => { for (let i = 0; i < 100; i++) { try { if (f()) return; } catch { /* not yet */ } await sleep(100); } throw new Error('timed out: ' + what + '\n' + JSON.stringify(state && state.tabs.map((t) => [t.id, t.title, t.toc, t.outline && t.outline.cur && t.outline.items.map((i) => i.s)]))); };
  const ui = () => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('index.html')).webContents;
  const page = (end) => webContents.getAllWebContents().find((w) => w.getURL().startsWith('http://127.0.0.1') && w.getURL().includes(end));
  const outline = () => state.tabs.find((t) => t.active).outline;
  const top = (id) => page('/long').executeJavaScript(`document.getElementById('${id}').offsetTop`);
  const scrollTo = (y) => page('/long').executeJavaScript(`window.scrollTo(0, ${y})`);
  let code = 0;
  try {
    await until(() => state && state.tabs.length, 'first state');
    ui().executeJavaScript(`lore.send('nav:submit', ${JSON.stringify(base + '/long')})`);
    await until(() => state.tabs[0].toc === 6, 'six headings reach the state (the one in nav is left out)');
    await until(() => outline(), 'outline for the active tab');
    assert.deepStrictEqual(outline().items.map((i) => i.text), ['Section 1', 'Section 2', 'Section 2a', 'Section 3', 'Section 4', 'Section 5']);
    assert.deepStrictEqual(outline().items.map((i) => i.level), [2, 2, 3, 2, 2, 2]);
    assert.strictEqual(outline().cur, 0, 'the first heading is at the reading line at the top of the page');
    // Reading: stay on section 2  for over 2 seconds, then jump to section 4 , skipping 2a and 3.
    await scrollTo((await top('s2')) - 100);
    await until(() => outline().cur === 1, 'section 2 is current');
    await sleep(2400);
    await until(() => outline().items[1].s === 2, 'section 2 counts as read after a while');
    assert.strictEqual(outline().items[0].s, 1, 'section 1 was left quickly: skimmed');
    await scrollTo((await top('s4')) - 100);
    await until(() => outline().cur === 4, 'section 4 is current');
    assert.deepStrictEqual(outline().items.slice(0, 5).map((i) => i.s), [1, 2, 1, 1, 0], 'sections jumped over are skimmed: ' + JSON.stringify(outline().items.map((i) => i.s)));
    // Going to a heading scrolls the page.
    ui().executeJavaScript(`lore.send('outline:go', ${state.tabs[0].id}, 3)`);
    await until(async () => true, 'go sent');
    await sleep(500);
    const y = await page('/long').executeJavaScript('window.scrollY');
    const want = await top('s3');
    assert.ok(Math.abs(y - want) < 40, 'scrolled to section 3 (' + want + '), got ' + y);
    // Cmd-click: that heading as a child tab, at its own address.
    ui().executeJavaScript(`lore.send('outline:open', ${state.tabs[0].id}, 1)`);
    await until(() => state.tabs.length === 2, 'child tab opened');
    assert.strictEqual(state.tabs[1].parent, state.tabs[0].id);
    await until(() => page('#s2'), 'child tab is at #s2');
    // A page with fewer than three headings has no outline.
    ui().executeJavaScript(`lore.send('tab:select', ${state.tabs[1].id}); lore.send('nav:submit', ${JSON.stringify(base + '/short')})`);
    await until(() => state.tabs[1].title === 'short', 'short page loaded');
    await sleep(600);
    assert.strictEqual(state.tabs[1].outline, null);
    console.log('outline ok');
  } catch (e) { console.error('outline FAILED', e); code = 1; }
  server.close();
  app.exit(code);
});
