// Loads the New tab page in each language and checks text, titles and card links.
const { app, BrowserWindow } = require('electron');
// Own data folder, so tests never collide with a running Lore.
app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'lore-e2e-')));
const assert = require('node:assert');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  const home = path.join(__dirname, '..', 'src', 'ui', 'home.html');
  let code = 0;
  try {
    for (const [lang, h1, card] of [['en', 'What are you looking for?', 'What is Da Nang?'], ['vi', 'Bạn muốn tìm gì hôm nay?', 'Đà Nẵng là gì?']]) {
      await win.loadFile(home, { query: { lang } });
      const r = await win.webContents.executeJavaScript(`({ h1: document.getElementById('h1').textContent, title: document.title, href: document.querySelector('#c-ask').href, text: document.querySelector('#c-ask b').textContent, lang: document.documentElement.lang })`);
      assert.strictEqual(r.h1, h1);
      assert.strictEqual(r.text, card);
      assert.strictEqual(r.lang, lang);
      assert.strictEqual(new URL(r.href).searchParams.get('q'), card);
    }
    await win.loadFile(home, { query: { lang: 'vi', kind: 'memory', q: 'x', results: '[]', total: '3' } });
    const t = await win.webContents.executeJavaScript('document.title + "|" + document.querySelector("#hits").textContent');
    assert.match(t, /^Trí nhớ: x\|Chưa thấy trang nào khớp trong 3/);
    await win.loadFile(path.join(__dirname, '..', 'src', 'ui', 'warning.html'), { query: { lang: 'vi', url: 'https://vietcombank-login.xyz/', reason: 'lookalike', brand: 'Vietcombank' } });
    const w = await win.webContents.executeJavaScript('({ t: document.title, why: document.getElementById("why").textContent, addr: document.getElementById("addr").textContent, go: document.getElementById("go").href })');
    assert.strictEqual(w.t, 'Cảnh báo trang web lừa đảo');
    assert.match(w.why, /giống Vietcombank/);
    assert.strictEqual(w.addr, 'https://vietcombank-login.xyz/');
    assert.strictEqual(new URL(w.go).searchParams.get('u'), 'https://vietcombank-login.xyz/');
    const mw = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'stub-memory-preload.js') } });
    await mw.loadFile(path.join(__dirname, '..', 'src', 'ui', 'memory.html'), { query: { lang: 'en' } });
    await new Promise((r) => setTimeout(r, 400));
    const m = await mw.webContents.executeJavaScript('({ h: document.querySelector("h1").textContent, rows: document.querySelectorAll("#list li").length, row: document.querySelector("#list li").textContent, count: document.getElementById("count").textContent, status: document.getElementById("status").textContent, hosts: document.getElementById("host").options.length })');
    assert.strictEqual(m.h, 'Memory');
    assert.strictEqual(m.rows, 1);
    assert.match(m.row, /Giữ nguyên lãi suất/);
    assert.match(m.row, /yesterday/);
    assert.match(m.count, /1 pages \/ 5/);
    assert.match(m.status, /Keyword search only/);
    assert.strictEqual(m.hosts, 2);
    await win.loadFile(path.join(__dirname, '..', 'src', 'ui', 'signin.html'), { query: { lang: 'en', url: 'https://accounts.google.com/signin?x=1' } });
    const sg = await win.webContents.executeJavaScript('({ t: document.title, h: document.querySelector("h1").textContent, open: document.getElementById("open").href, back: document.querySelector("a[href^=lore-back]").textContent })');
    assert.strictEqual(sg.h, "Google didn't accept sign-in here");
    assert.strictEqual(new URL(sg.open).protocol, 'lore-external:');
    assert.strictEqual(new URL(sg.open).searchParams.get('u'), 'https://accounts.google.com/signin?x=1');
    assert.strictEqual(sg.back, 'Back to safety');
    for (const [st, checks] of [['summarize', /Lãi suất giữ nguyên.*Những câu chính lấy nguyên văn/s], ['ask', /Giữ nguyên.*From the page.*Ngân hàng Nhà nước.*Show in page.*m1.*Sent to api\.example\.com/s], ['translate', /Translated 12 paragraphs into Vietnamese.*Both.*Translation.*Original/s]]) {
      const pw = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'stub-panel-preload.js') } });
      await pw.loadFile(path.join(__dirname, '..', 'src', 'ui', 'panel.html'), { query: { s: st } });
      await new Promise((r) => setTimeout(r, 300));
      const txt = await pw.webContents.executeJavaScript('document.getElementById("thread").innerText.replace(/\\s+/g, " ")');
      assert.match(txt, checks, st + ': ' + txt);
    }
    console.log('pages ok');
  } catch (e) { console.error('pages FAILED', e); code = 1; }
  app.exit(code);
});
