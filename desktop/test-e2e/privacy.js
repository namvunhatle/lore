// Real Electron sessions against local servers: ad blocking, third-party cookies, private isolation, permissions.
const { app, BrowserWindow, session } = require('electron');
// Own data folder, so tests never collide with a running Lore.
app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'lore-e2e-')));
const assert = require('node:assert');
const http = require('http');
const { FiltersEngine } = require('@ghostery/adblocker');
const { hardenSession } = require('../src/harden');
const { createBlocker } = require('../src/adblock');
const { checkUrl } = require('../src/scam');

const listen = (handler) => new Promise((r) => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => r(s)); });

app.whenReady().then(async () => {
  const seen = { trackerCookie: undefined, trackerGPC: undefined, adHits: 0 };
  // "tracker" runs on localhost, the site on 127.0.0.1: different registrable domains, so it is third-party.
  const tracker = await listen((req, res) => {
    if (req.url.startsWith('/ad')) { seen.adHits++; res.end('x'); return; }
    if (req.url.startsWith('/api')) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*'); res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Set-Cookie', 'sid=1; Path=/; SameSite=None; Secure'); res.end('{}'); return;
    }
    seen.trackerCookie = req.headers.cookie; seen.trackerGPC = req.headers['sec-gpc'];
    res.setHeader('Set-Cookie', 'uid=1; Path=/; SameSite=None; Secure');
    res.setHeader('content-type', 'image/gif'); res.end('GIF89a');
  });
  const tp = `http://localhost:${tracker.address().port}`;
  const site = await listen((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(`<img src="${tp}/pixel.gif?a"><img src="${tp}/pixel.gif?b"><script src="${tp}/ads/banner.js"></script><p id="ok">hi</p>`);
  });
  const siteUrl = `http://127.0.0.1:${site.address().port}/`;

  const blocker = createBlocker();
  blocker.use(FiltersEngine.parse('/ads/banner.js'));
  const asked = [];
  let cfg = { blockThirdPartyCookies: true, permissions: 'ask' };
  let currentSite = siteUrl;
  const deps = (isPrivate) => ({
    isPrivate, blocker, adsOn: () => true, privacy: () => cfg, siteOf: () => currentSite, onBlocked() {}, onResponse() {},
    ask: async (origin, p) => { asked.push(p); return true; },
    scam: (u) => checkUrl(u), onScam: (d, v) => scams.push(v)
  });
  const scams = [];

  let code = 0;
  try {
    // --- normal session
    const ses = session.fromPartition('persist:test-normal');
    hardenSession(ses, deps(false));
    const win = new BrowserWindow({ show: false, webPreferences: { session: ses } });
    await win.loadURL(siteUrl);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(seen.adHits, 0, 'ad script should be blocked');
    assert.strictEqual(seen.trackerGPC, '1', 'GPC header sent');
    const cookies = await ses.cookies.get({});
    assert.strictEqual(cookies.filter((c) => c.name === 'uid').length, 0, 'third-party Set-Cookie dropped');
    assert.strictEqual(seen.trackerCookie, undefined);
    // Fetch keeps its cookies: an embedded app or a sign-in flow needs its session (otherwise the page reloads forever).
    await win.webContents.executeJavaScript(`fetch('${tp}/api', { credentials: 'include' }).then((r) => r.text())`);
    assert.ok((await ses.cookies.get({})).some((c) => c.name === 'sid'), 'cookie set by a third-party fetch is kept');
    const ua = await win.webContents.executeJavaScript('navigator.userAgent');
    assert.ok(/Electron\//.test(ua), 'user agent is left honest (Google rejects browsers that pose as Chrome): ' + ua);

    // --- scam interception: a look-alike bank address never reaches the network
    const failure = new Promise((r) => win.webContents.once('did-fail-load', (_e, code, _d, _u, main) => r({ code, main })));
    win.loadURL('https://vietcombank-login.xyz/').catch(() => {});
    const f = await failure;
    assert.strictEqual(f.code, -20, 'blocked by client');
    assert.strictEqual(scams.length, 1);
    assert.strictEqual(scams[0].brand, 'Vietcombank');
    await win.loadURL(siteUrl);

    // --- toggle off: cookies are allowed again
    cfg = { ...cfg, blockThirdPartyCookies: false };
    await win.loadURL(siteUrl + '?again');
    await new Promise((r) => setTimeout(r, 400));
    assert.ok((await ses.cookies.get({})).some((c) => c.name === 'uid'), 'cookie stored when blocking is off');

    // --- private partitions are isolated and in memory
    cfg = { ...cfg, blockThirdPartyCookies: true };
    const priv = session.fromPartition('private-1');
    hardenSession(priv, deps(true));
    const pwin = new BrowserWindow({ show: false, webPreferences: { session: priv } });
    await pwin.loadURL(siteUrl);
    assert.ok(!(await priv.cookies.get({})).some((c) => c.name === 'uid'), 'private session does not see the normal session cookies');
    assert.ok(!priv.storagePath, 'private session has no storage path on disk');

    // --- permissions: risky asks (normal), is denied (private); unknown is denied
    const geo = await win.webContents.executeJavaScript(`new Promise(r => { setTimeout(() => r('timeout'), 2500); navigator.geolocation.getCurrentPosition(() => r('granted'), (e) => r('code' + e.code)); })`);
    assert.ok(asked.includes('geolocation'), 'normal session asked about geolocation (got ' + geo + ')');
    asked.length = 0;
    const geoP = await pwin.webContents.executeJavaScript(`new Promise(r => { setTimeout(() => r('timeout'), 2500); navigator.geolocation.getCurrentPosition(() => r('granted'), (e) => r('code' + e.code)); })`);
    assert.strictEqual(asked.length, 0, 'private tab never asks');
    assert.strictEqual(geoP, 'code1', 'private tab is denied (PERMISSION_DENIED)');
    console.log('privacy ok');
  } catch (e) { console.error('privacy FAILED', e); code = 1; }
  app.exit(code);
});
