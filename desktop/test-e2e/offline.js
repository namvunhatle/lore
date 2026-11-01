// The page shown when a site cannot be reached: wording by cause, the retry link, and the little game when offline.
const { app, BrowserWindow } = require('electron');
app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'lore-e2e-')));
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const page = path.join(__dirname, '..', 'src', 'ui', 'neterror.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { backgroundThrottling: false } });
  let code = 0;
  try {
    const load = async (q) => { await win.loadFile(page, { query: { lang: 'en', url: 'https://news.example/a?x=1', ...q } }); await wait(150); };
    const text = () => win.webContents.executeJavaScript('document.body.innerText');
    const vis = (id) => win.webContents.executeJavaScript(`!document.getElementById('${id}').hidden`);

    await load({ code: '-105', offline: '0' });
    assert.match(await text(), /Can't find news\.example/);
    assert.ok(await vis('search'), 'a name that does not exist can be searched for');
    assert.ok(!(await vis('game')), 'no game when only this site is missing');
    assert.match(await win.webContents.executeJavaScript("document.getElementById('retry').href"), /^lore-retry:\?u=https%3A%2F%2Fnews\.example%2Fa%3Fx%3D1$/);

    await load({ code: '-102', offline: '0' });
    assert.match(await text(), /news\.example is not responding/);
    await load({ code: '-7', offline: '0' });
    assert.match(await text(), /took too long/);

    await load({ code: '-106', offline: '1' });
    assert.match(await text(), /You are offline/);
    assert.ok(await vis('game'), 'the game is there when offline');
    assert.ok(!(await vis('search')), 'no web search when offline');

    // Play: a jump starts the run, the score counts up, and the hint changes from "start" to the score line.
    const hint = () => win.webContents.executeJavaScript("document.getElementById('hint').innerText");
    assert.match(await hint(), /Space or tap to start/);
    const press = () => win.webContents.executeJavaScript("dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))");
    await press();
    await wait(1200);
    const mid = await hint();
    assert.match(mid, /Jump over the reeds/);
    // Without jumping again the lotus hits a reed sooner or later.
    let over = false;
    for (let i = 0; i < 80 && !over; i++) { await wait(150); over = /Game over/.test(await hint()); }
    assert.ok(over, 'the run ends at a reed');
    await press();
    await wait(200);
    assert.match(await hint(), /Jump over the reeds/, 'a key press starts a new run');

    fs.writeFileSync(path.join(require('os').tmpdir(), 'lore-offline.png'), (await win.webContents.capturePage()).toPNG());
    console.log('offline ok');
  } catch (e) { console.error('offline FAILED', e); code = 1; }
  app.exit(code);
});
