// "Khám phá tiếp" in the real app: reading an article for a few seconds makes the model write queries from its title and
// summary, a search returns pages, and the list reaches the sidebar state, without the address or the full text going to the
// model. A short page, a search page and a private tab get nothing. Runs main.js itself; the model and the search are stubs.
const { app, BrowserWindow, webContents } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'lore-suggest-')));
process.env.LORE_NO_WELCOME = '1';
const assert = require('node:assert');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const body = Array.from({ length: 14 }, (_, i) => `<p>Paragraph ${i}. Electric cars are changing how people travel across Vietnam, and charging networks keep growing every month.</p>`).join('');
const article = `<!doctype html><title>Electric cars in Vietnam</title><body><article><h1>Electric cars in Vietnam</h1>${body}</article>`;
const short = '<!doctype html><title>short</title><p>tiny</p>';
const pages = http.createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end(req.url.startsWith('/short') ? short : article); });

// A model that records what it was sent.
const sent = [];
const model = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/api/tags')) return res.end(JSON.stringify({ models: [{ name: 'qwen2.5:3b' }] }));
    sent.push(b);
    res.end(JSON.stringify({ message: { content: '["electric cars vietnam comparison","charging stations vietnam"]' }, done: true }));
  });
});

const ddg = (n) => '<html>' + [1, 2, 3, 4].map((i) => `<a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(`https://site${i}.example/${n}`)}&amp;rut=x">Result ${i}</a>`).join('') + '</html>';
let searches = 0;
const realFetch = global.fetch;
global.fetch = (u, o) => {
  if (String(u).includes('duckduckgo.com')) { searches++; return Promise.resolve(new Response(ddg(searches), { status: 200 })); }
  return realFetch(u, o);
};

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  await new Promise((r) => pages.listen(0, '127.0.0.1', r));
  await new Promise((r) => model.listen(0, '127.0.0.1', r));
  process.env.LORE_LLM_URL = 'http://127.0.0.1:' + model.address().port;
  const base = `http://127.0.0.1:${pages.address().port}`;
  let state = null;
  const probe = new BrowserWindow({ show: false });
  const proto = Object.getPrototypeOf(probe.webContents);
  const send = proto.send;
  proto.send = function (ch, ...a) { if (ch === 'state') state = a[0]; return send.call(this, ch, ...a); };
  probe.destroy();
  require('../src/main.js');
  const until = async (f, what, n = 200) => { for (let i = 0; i < n; i++) { try { if (f()) return; } catch { /* not yet */ } await sleep(100); } throw new Error('timed out: ' + what + '\n' + JSON.stringify(state && { tabs: state.tabs.map((t) => [t.id, t.title, t.loading]), suggest: state.suggest }) + '\nmodel calls: ' + sent.length + ', searches: ' + searches); };
  const ui = () => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('index.html')).webContents;
  let code = 0;
  try {
    await until(() => state && state.tabs.length, 'first state');
    assert.deepStrictEqual(state.suggest, [], 'nothing on the home page');
    ui().executeJavaScript(`lore.send('nav:submit', ${JSON.stringify(base + '/article')})`);
    await until(() => state.suggest && state.suggest.length === 3, 'three suggestions reach the sidebar state', 150);
    assert.deepStrictEqual(state.suggest.map((s) => s.host), ['site1.example', 'site2.example', 'site3.example']);
    assert.strictEqual(sent.length, 1, 'one model call');
    assert.ok(/Electric cars in Vietnam/.test(sent[0]), 'the title is sent');
    assert.ok(!/127\.0\.0\.1:\d+\/article/.test(sent[0]), 'the address is not sent');
    assert.ok(sent[0].length < 2500, 'a few sentences, not the whole page');

    // What the person sees: tabs in the sidebar, the sidebar slid out, the section drawn at its foot.
    await until(() => webContents.getAllWebContents().some((w) => w.getURL().includes('side.html')), 'the sidebar view exists');
    const side = webContents.getAllWebContents().find((w) => w.getURL().includes('side.html'));
    await sleep(500);
    side.executeJavaScript("lore.send('side:peek', true)");
    await until(() => state.layout === 'side' && state.suggest.length === 3, 'side layout');
    await sleep(800);
    const seen = await side.executeJavaScript(`(() => {
      const box = document.querySelector('#sug'), r = box.getBoundingClientRect(), side = document.querySelector('.side').getBoundingClientRect();
      return { hidden: box.hidden, display: getComputedStyle(box).display, rows: box.querySelectorAll('.sug-row').length, top: r.top, bottom: r.bottom, h: r.height, sideBottom: side.bottom, title: box.querySelector('h2').textContent, first: box.querySelector('.tt').textContent };
    })()`);
    assert.ok(!seen.hidden && seen.display !== 'none', 'the section is shown: ' + JSON.stringify(seen));
    assert.strictEqual(seen.rows, 3, 'three rows: ' + JSON.stringify(seen));
    assert.ok(seen.h > 60 && seen.bottom <= seen.sideBottom + 1, 'it sits at the foot of the sidebar: ' + JSON.stringify(seen));
    assert.strictEqual(seen.title, 'Keep exploring');

    // Margins: the heading, the titles and the domains of the suggestions start where the titles of the tabs start, with no
    // icon in front of them; the refresh button ends where the close buttons of the tabs end.
    const m = await side.executeJavaScript(`(() => {
      const L = (q) => { const e = document.querySelector(q); return e ? Math.round(e.getBoundingClientRect().left * 10) / 10 : null; };
      const R = (q) => { const e = document.querySelector(q); return e ? Math.round(e.getBoundingClientRect().right * 10) / 10 : null; };
      return { tab: L('#slist .srow .ttl'), head: L('#sug-h'), title: L('.sug-row .tt'), domain: L('.sug-row .dm'), icons: document.querySelectorAll('.sug-row .fav').length, refresh: R('#sug-r'), close: R('#slist .srow .x') };
    })()`);
    assert.ok(m.tab !== null, 'a tab title to compare with: ' + JSON.stringify(m));
    assert.strictEqual(m.icons, 0, 'no icon in front of a suggestion: ' + JSON.stringify(m));
    for (const k of ['head', 'title', 'domain']) assert.ok(Math.abs(m[k] - m.tab) <= 0.5, k + ' starts where the tab titles start: ' + JSON.stringify(m));
    if (m.close !== null) assert.ok(Math.abs(m.refresh - m.close) <= 0.5, 'the refresh button ends where the close buttons end: ' + JSON.stringify(m));

    // Opening one: a child tab of the page being read, at that address.
    const n = state.tabs.length;
    ui().executeJavaScript(`lore.send('suggest:open', ${JSON.stringify(state.suggest[0].url)})`);
    await until(() => state.tabs.length === n + 1, 'the suggestion opens in a new tab');
    assert.strictEqual(state.tabs[n].parent, state.tabs[0].id);
    // An address that was not suggested is ignored.
    ui().executeJavaScript(`lore.send('suggest:open', 'https://evil.example/')`);
    await sleep(400);
    assert.strictEqual(state.tabs.length, n + 1, 'only suggested addresses open');

    // Back on the article, the list returns at once from the cache, with no new model call.
    ui().executeJavaScript(`lore.send('tab:select', ${state.tabs[0].id})`);
    await until(() => state.suggest.length === 3, 'cached list is back');
    assert.strictEqual(sent.length, 1, 'no second model call');

    // Refresh: different pages, none of the ones shown before.
    const before = state.suggest.map((s) => s.url);
    ui().executeJavaScript(`lore.send('suggest:refresh')`);
    await until(() => state.suggest.length && state.suggest[0].url !== before[0], 'refresh brings other pages');
    assert.strictEqual(sent.length, 2);

    // A short page gets nothing.
    ui().executeJavaScript(`lore.send('tab:select', ${state.tabs[0].id}); lore.send('nav:submit', ${JSON.stringify(base + '/short')})`);
    await until(() => state.tabs[0].title === 'short', 'short page loaded');
    await sleep(4500);
    assert.deepStrictEqual(state.suggest, [], 'a short page has no suggestions');
    console.log('suggest ok');
  } catch (e) { console.error('suggest FAILED', e); code = 1; }
  pages.close(); model.close();
  app.exit(code);
});
