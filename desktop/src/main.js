const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu, nativeTheme, safeStorage, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { classify } = require('./router');
const { createBlocker } = require('./adblock');
const { isAllowedNavigation, isGoogleSignIn, isGoogleSignInRejected } = require('./privacy');
const { hardenSession: harden } = require('./harden');
const { checkUrl, createScamList } = require('./scam');
const { extractionScript } = require('./reader');
const { cookieBannerScript } = require('./cookiebanner');
const pageai = require('./pageai');
const pageassist = require('./pageassist');
const shield = require('./shield');
const { Memory, fileStore, RANGES, isSensitiveHost } = require('./memory');
const { Favicons, toDataUrl } = require('./favicons');
const { createEmbedder } = require('./embedder');
const { answerQuery } = require('./answer');
const { createLlm, listLocalModels, pullLocalModel, isLocalHost } = require('./llm');
const { Settings } = require('./settings');
const writing = require('./writing');
const tabstate = require('./tabstate');
const { DownloadList } = require('./downloads');
const taskLib = require('./tasks');
const { t: tr, resolve } = require('./ui/i18n');
let settings;
let llm = null;
let settingsWin = null;
let memoryWin = null;
let tasksWin = null;
let taskStore;
let favicons;
const L = () => resolve(settings.get().language, app.getLocale());
const T = (k, v) => tr(L(), k, v);
// Every page we ship learns its language from the query string; this is the only place that loads them.
const loadUi = (wc, file, query = {}) => {
  const tab = tabs.find((x) => x.view.webContents === wc);
  return wc.loadFile(file, { query: { lang: L(), blocked: String(S.blocked), ...(tab && tab.private ? { private: '1' } : {}), ...query } });
};
const loadHome = (wc, query = {}) => loadUi(wc, HOME, query);
const isOurHome = (url) => url.startsWith('file:') && decodeURI(url).includes('/ui/home.html');
const { AgentRun, WORKFLOWS, match: matchWorkflow } = require('./agent');
const { PageDriver } = require('./driver');
const realWorkflows = require('./workflows').real;
const { classifyResponse, isDeniedSite } = require('./media');
const downloader = require('./downloader');

const CHROME_HEIGHT = 88;
const HOME = path.join(__dirname, 'ui', 'home.html');
const READER = path.join(__dirname, 'ui', 'reader.html');
const TAB_PRELOAD = path.join(__dirname, 'tab-preload.js');

let win;
let nextId = 1;
const tabs = [];
const closedTabs = new tabstate.ClosedTabs();
let sessionStore = null;   // encrypted record of open tabs, for "continue where I left off"
let sessionReady = false;  // false until the saved tabs were reopened, so an empty strip never overwrites them
let sessionTimer = null;
let lastSession = '';
let downloads = null;      // every file saved by the browser (BRW-04)
let downloadsWin = null;
let findView = null;       // the find-in-page bar (BRW-01)
let activeId = null;
const S = { blocked: 0, adsOn: true };
let statsFile = null;
function today() { return new Date().toISOString().slice(0, 10); }
function loadStats() {
  try { const j = JSON.parse(require('fs').readFileSync(statsFile, 'utf8')); S.blocked = j.date === today() ? j.blocked : 0; } catch { S.blocked = 0; }
}
function saveStats() { try { require('fs').writeFileSync(statsFile, JSON.stringify({ date: today(), blocked: S.blocked })); } catch { /* best effort */ } }
let memory;
let blocker;
let scamList;
const allowedScam = new Set(); // hosts the user chose to open despite a warning, for this run only
const WARNING = path.join(__dirname, 'ui', 'warning.html');
const SIGNIN = path.join(__dirname, 'ui', 'signin.html');
// Pages that sit between the user and a destination and may send them onward (warning and sign-in explainer).
const isOurWarning = (url) => url.startsWith('file:') && /\/ui\/(warning|signin)\.html/.test(decodeURI(url));
const tabForWc = (id) => tabs.find((t) => t.view.webContents.id === id);
let agentLog;
let panel;          // trusted side panel (own preload); web pages never get this bridge
let run = null;
const PANEL_W = 380;
let dl = null;      // current download session: { tab, state, options, pct, path, error, ctl }
let paSeq = 0;
let pa = null;      // page assistant session: { tab, view }
const agentOpen = () => !!run || !!dl || !!pa;

const active = () => tabs.find((t) => t.id === activeId);

function layout() {
  const t = active();
  if (!win || !t) return;
  const [w, h] = win.getContentSize();
  const pw = agentOpen() ? PANEL_W : 0;
  t.view.setBounds({ x: 0, y: CHROME_HEIGHT, width: w - pw, height: h - CHROME_HEIGHT });
  if (panel && pw) panel.setBounds({ x: w - pw, y: CHROME_HEIGHT, width: pw, height: h - CHROME_HEIGHT });
  layoutFind();
}

function isLoading(tab) {
  const wc = tab.view.webContents;
  return tab.busy || (wc.isLoading() && !wc.getURL().startsWith('file:'));
}

function paintTitleBar(priv) {
  if (process.platform === 'darwin' || !win.setTitleBarOverlay) return;
  const dark = priv || nativeTheme.shouldUseDarkColors;
  win.setTitleBarOverlay({ color: priv ? '#1A1330' : dark ? '#10151E' : '#FFFFFF', symbolColor: priv ? '#F1ECFF' : dark ? '#E9EDF3' : '#12161C', height: 40 });
}

function pushState() {
  scheduleSessionSave();
  const t = active();
  if (t) paintTitleBar(!!t.private);
  const wc = t && t.view.webContents;
  win.webContents.send('state', {
    lang: L(),
    tabs: tabs.map((x) => ({
      id: x.id, title: x.title || T(x.private ? 'tab.newPrivate' : 'tab.new'), active: x.id === activeId, favicon: x.favicon, home: x.isHome,
      loading: isLoading(x) || !!x.pending, private: x.private, pinned: !!x.pinned
    })),
    downloads: downloads ? { count: downloads.items.length, active: downloads.active } : { count: 0, active: 0 },
    // While a page is loading, keep showing what the user asked for instead of the old (or empty) address.
    url: t ? t.pending || (!t.isHome ? t.url : '') : '',
    canBack: !!wc && wc.navigationHistory.canGoBack(),
    canForward: !!wc && wc.navigationHistory.canGoForward(),
    blocked: S.blocked,
    adsOn: S.adsOn,
    media: !!t && !isDeniedSite(t.url) ? t.media.length : 0,
    reader: !!t && !t.isHome && /^https?:/.test(t.url)
  });
}

// ---- Session: reopen the tabs of the last run (BRW-05) ---------------------------------------------------------------
function writeSession() {
  if (!sessionStore || !sessionReady) return;
  const snap = tabstate.snapshot(tabs.map((t) => ({ id: t.id, url: t.lazyUrl || t.url, title: t.title, pinned: t.pinned, private: t.private })), activeId);
  const json = JSON.stringify(snap);
  if (json === lastSession) return;
  lastSession = json;
  sessionStore.save(snap);
}
function scheduleSessionSave() {
  if (!sessionReady || sessionTimer) return;
  sessionTimer = setTimeout(() => { sessionTimer = null; writeSession(); }, 1500);
}
function startTabs() {
  const saved = settings.get().startup === 'restore' && sessionStore ? tabstate.restore(sessionStore.load()) : { tabs: [], active: 0 };
  if (saved.tabs.length) {
    const made = saved.tabs.map((s) => openTab({ url: s.url }, { lazy: true, pinned: s.pinned, title: s.title }));
    selectTab(made[saved.active].id);
  } else openTab();
  sessionReady = true;
}

function openTab(target, { private: priv = false, lazy = false, pinned = false, title = '' } = {}) {
  const id = nextId++;
  // A partition without the "persist:" prefix lives in memory only, so a private tab leaves nothing on disk.
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true, contextIsolation: true, preload: TAB_PRELOAD,
      additionalArguments: settings.get().privacy.reduceFingerprint ? ['--lore-fp=1'] : [],
      ...(priv ? { partition: 'private-' + id } : {})
    }
  });
  const tab = { id, view, title: '', url: '', isHome: true, media: [], favicon: '', busy: false, private: priv, pinned, lazyUrl: '' };
  tabs.push(tab);
  if (pinned) tabs.splice(0, tabs.length, ...tabstate.setPinned(tabs, id, true));
  const wc = view.webContents;
  hardenSession(wc.session, priv);
  wc.setWebRTCIPHandlingPolicy('default_public_interface_only'); // do not leak the local network address
  wc.on('context-menu', (_e, params) => showContextMenu(tab, params));
  wireFind(wc);
  wc.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) openTab({ url }, { private: priv });
    return { action: 'deny' };
  });
  // Web pages may only send the tab to web addresses (never file:, javascript:, data: or app schemes).
  const guard = (e, url) => { if (!isAllowedNavigation(url)) e.preventDefault(); };
  wc.on('will-redirect', guard);
  // LORE_DEBUG=1 prints every top-level navigation, so a redirect loop shows up as a repeating list of addresses.
  if (process.env.LORE_DEBUG) {
    const safe = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return String(u).slice(0, 80); } };
    wc.on('did-start-navigation', (_e, url, inPlace, isMain) => { if (isMain) console.log('[nav]', inPlace ? 'in-page' : 'load', safe(url)); });
    wc.on('will-redirect', (_e, url) => console.log('[nav] redirect ->', safe(url)));
    wc.on('did-fail-load', (_e, code, desc, url, isMain) => { if (isMain) console.log('[nav] FAILED', code, desc, safe(url)); });
    wc.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') console.log('[page]', String(e.message).slice(0, 160)); });
  }
  wc.on('page-title-updated', (_e, title) => { tab.title = title; if (!tab.isHome && !priv) memory.setTitle(tab.url, title); pushState(); });
  // Cards on the New tab page navigate to lore-run:?q=..., which runs that text through the intent bar.
  // The blocked request fails with ERR_BLOCKED_BY_CLIENT; once it has, show the warning page in its place.
  wc.on('did-fail-load', (_e, _code, _desc, _url, isMainFrame) => {
    if (isMainFrame) { tab.pending = ''; pushState(); }
    if (!isMainFrame || !tab.pendingScam) return;
    const { url, v } = tab.pendingScam;
    tab.pendingScam = null;
    wc.loadFile(WARNING, { query: { lang: L(), url, reason: v.reason, brand: v.brand || '' } });
  });
  wc.on('will-navigate', (e, url) => {
    if ((url.startsWith('lore-back:') || url.startsWith('lore-proceed:') || url.startsWith('lore-external:')) && isOurWarning(wc.getURL())) {
      e.preventDefault();
      if (url.startsWith('lore-back:')) { wc.navigationHistory.canGoBack() ? wc.navigationHistory.goBack() : loadHome(wc); return; }
      const target = new URL(url).searchParams.get('u');
      // Only the sign-in page may hand an address to the system browser, and only a Google sign-in address.
      if (url.startsWith('lore-external:')) { if (target && isGoogleSignIn(target)) shell.openExternal(target); return; }
      if (target && isAllowedNavigation(target)) { allowedScam.add(new URL(target).hostname.toLowerCase()); wc.loadURL(target); }
      return;
    }
    if (url.startsWith('lore-do:')) {
      e.preventDefault();
      const a = new URL(url).searchParams.get('a');
      if (isOurHome(wc.getURL()) && tab.id === activeId) ({ private: () => openTab(undefined, { private: true }), memory: openMemory, settings: openSettings, tasks: () => openTasks() }[a] || (() => {}))();
      return;
    }
    if (!url.startsWith('lore-run:')) return guard(e, url);
    e.preventDefault();
    const q = new URL(url).searchParams.get('q');
    if (q && isOurHome(wc.getURL()) && tab.id === activeId) win.webContents.send('type-run', q);
  });
  wc.on('page-favicon-updated', (_e, icons) => { tab.favicon = icons[0] || ''; pushState(); if (!priv && !tab.isHome) saveFavicon(wc, tab.url, icons); });
  wc.on('did-start-navigation', (_e, _u, inPlace, isMain) => { if (isMain && !inPlace && tab.id === activeId) closeFind(); });
  wc.on('did-navigate', (_e, url) => { tab.pending = ''; googleRejected(url); tab.media = []; tab.favicon = ''; tab.url = url; tab.isHome = url.startsWith('file:'); if (!tab.isHome && !priv) memory.add({ url, title: tab.title }); pushState(); });
  // Cookie banners and element hiding, once the page has a DOM.
  wc.on('dom-ready', async () => {
    const url = wc.getURL();
    if (!/^https?:/.test(url)) return;
    if (settings.get().privacy.cookieBanners) wc.executeJavaScriptInIsolatedWorld(1002, [{ code: cookieBannerScript }]).catch(() => {});
    if (!S.adsOn) return;
    try {
      const dom = await wc.executeJavaScriptInIsolatedWorld(1002, [{ code: `(() => ({
        classes: [...new Set([...document.querySelectorAll('[class]')].flatMap((e) => [...e.classList]))].slice(0, 3000),
        ids: [...new Set([...document.querySelectorAll('[id]')].map((e) => e.id))].slice(0, 3000),
        hrefs: [...new Set([...document.querySelectorAll('a[href]')].map((e) => e.getAttribute('href')))].slice(0, 1500)
      }))()` }]);
      const css = blocker.cosmetics(url, dom);
      if (css) wc.insertCSS(css).catch(() => {});
    } catch { /* page navigated away */ }
  });
  wc.on('did-finish-load', () => {
    if (tab.isHome || priv || !/^https?:/.test(tab.url)) return;
    const url = tab.url;
    // Give single-page apps a moment, then keep a short text excerpt so Memory can answer by content.
    setTimeout(async () => {
      if (tab.url !== url || wc.isDestroyed()) return;
      try {
        const r = await wc.executeJavaScriptInIsolatedWorld(1002, [{ code: `(() => {
          if (document.querySelector('input[type=password]')) return null;
          const el = document.querySelector('article') || document.querySelector('main') || document.body;
          return el ? el.innerText : '';
        })()` }]);
        if (r) memory.setText(url, r);
      } catch { /* page went away */ }
    }, 1500);
  });
  // Google answers an unsupported browser with a "rejected" page (usually without a full page load).
  const googleRejected = (url) => { if (isGoogleSignInRejected(url)) setImmediate(() => wc.loadFile(SIGNIN, { query: { lang: L(), url: 'https://accounts.google.com/' } })); };
  wc.on('did-navigate-in-page', (_e, url) => { tab.url = url; googleRejected(url); pushState(); });
  wc.on('did-start-loading', pushState);
  wc.on('did-stop-loading', () => { tab.pending = ''; pushState(); });
  // Startup benchmark (docs/engine-spike.md): LORE_BENCH=1 prints time-to-first-tab and memory, then quits.
  if (process.env.LORE_BENCH && tab.id === 1) {
    wc.once('did-finish-load', () => setTimeout(() => {
      const m = app.getAppMetrics();
      console.log('BENCH ' + JSON.stringify({ startMs: Math.round(process.uptime() * 1000), memMB: Math.round(m.reduce((n, x) => n + x.memory.workingSetSize, 0) / 1024), procs: m.length }));
      app.exit(0);
    }, 800));
  }
  if (lazy && target && target.url) {
    // A restored tab does not load until it is shown: starting with thirty tabs must not mean thirty page loads.
    tab.lazyUrl = target.url; tab.url = target.url; tab.title = title; tab.isHome = false;
    return tab;
  }
  selectTab(tab.id);
  if (target && target.url) wc.loadURL(target.url);
  else loadHome(wc, target || {});
  return tab;
}

function zoomActive(step) {
  const t = active();
  if (!t) return;
  const wc = t.view.webContents;
  wc.setZoomLevel(step === null ? 0 : Math.max(-3, Math.min(5, wc.getZoomLevel() + step)));
}

function selectTab(id) {
  const prev = active();
  if (prev) win.contentView.removeChildView(prev.view);
  activeId = id;
  const t = active();
  win.contentView.addChildView(t.view);
  closeFind();
  if (t.lazyUrl) { const u = t.lazyUrl; t.lazyUrl = ''; t.view.webContents.loadURL(u); }
  layout();
  pushState();
}

function closeTab(id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  closedTabs.push({ url: t.lazyUrl || t.url, title: t.title, pinned: t.pinned, private: t.private });
  if (t.id === activeId) win.contentView.removeChildView(t.view);
  const ses = t.view.webContents.session;
  t.view.webContents.close();
  if (t.private) { ses.clearStorageData().catch(() => {}); ses.clearCache().catch(() => {}); }
  if (!tabs.length) return openTab();
  if (t.id === activeId) selectTab(tabs[Math.min(i, tabs.length - 1)].id);
  else pushState();
}

// ---- Tab operations (BRW-06) ---------------------------------------------------------------------------------------
const setOrder = (next) => { tabs.splice(0, tabs.length, ...next); pushState(); };
function reopenClosed() {
  const c = closedTabs.pop();
  if (!c) return toast({ text: T('tab.noClosed') });
  const t = openTab({ url: c.url }, { pinned: c.pinned });
  return t;
}
function duplicateTab(id) {
  const src = tabs.find((t) => t.id === id);
  const url = src && (src.lazyUrl || src.url);
  if (!src || !/^https?:/.test(url)) return openTab(undefined, { private: !!(src && src.private) });
  const t = openTab({ url }, { private: src.private });
  const rest = tabs.filter((x) => x !== t);
  const at = rest.indexOf(src) + 1;
  const pins = rest.filter((x) => x.pinned).length;
  rest.splice(Math.max(at, pins), 0, t);
  setOrder(rest);
  return t;
}
function closeOthers(id) { for (const t of tabs.slice()) if (t.id !== id && !t.pinned) closeTab(t.id); }
function closeToRight(id) { const i = tabs.findIndex((t) => t.id === id); for (const t of tabs.slice(i + 1)) if (!t.pinned) closeTab(t.id); }
function pinTab(id) { const t = tabs.find((x) => x.id === id); if (t) setOrder(tabstate.setPinned(tabs, id, !t.pinned)); }
function switchTab(next) { if (next) selectTab(next.id); }

function showTabMenu(id) {
  const t = tabs.find((x) => x.id === id);
  if (!t) return;
  const web = /^https?:/.test(t.lazyUrl || t.url);
  const i = tabs.indexOf(t);
  Menu.buildFromTemplate([
    { label: T('nav.reload'), enabled: web, click: () => { if (t.lazyUrl) selectTab(t.id); else t.view.webContents.reload(); } },
    { label: T('tab.duplicate'), click: () => duplicateTab(id) },
    { label: t.pinned ? T('tab.unpin') : T('tab.pin'), click: () => pinTab(id) },
    { type: 'separator' },
    { label: T('tab.closeTab'), click: () => closeTab(id) },
    { label: T('tab.closeOthers'), enabled: tabs.some((x) => x !== t && !x.pinned), click: () => closeOthers(id) },
    { label: T('tab.closeRight'), enabled: tabs.slice(i + 1).some((x) => !x.pinned), click: () => closeToRight(id) },
    { type: 'separator' },
    { label: T('tab.reopen'), enabled: closedTabs.size > 0, accelerator: 'CmdOrCtrl+Shift+T', click: reopenClosed }
  ]).popup({ window: win });
}

function startAgent(id) {
  if (run) run.cancel();
  pa = null; dl = null;
  run = new AgentRun(id, {
    log: agentLog,
    driver: new PageDriver(active().view.webContents, T),
    t: T,
    workflows: { ...WORKFLOWS, ...realWorkflows({ demoBase: process.env.LORE_DEMO_PORTAL, t: T }) }
  });
  run.on('change', (snap) => panel.webContents.send('agent:state', snap));
  win.contentView.addChildView(panel);
  layout();
  run.start();
}

function closePanel() {
  if (run) { run.cancel(); run = null; }
  if (dl) { if (dl.ctl) dl.ctl.abort(); dl = null; }
  pa = null;
  win.contentView.removeChildView(panel);
  layout();
}

function sendDl() {
  if (!dl) return;
  const { state, options, pct, path: file, error, title } = dl;
  panel.webContents.send('dl:state', {
    title, state, pct, path: file, error,
    options: (options || []).map((o) => ({ label: o.label, size: o.size }))
  });
}

async function openDownload() {
  const tab = active();
  if (!tab || !tab.media.length || isDeniedSite(tab.url)) return;
  if (run) { run.cancel(); run = null; }
  pa = null;
  if (dl && dl.ctl) dl.ctl.abort();
  const title = tab.title || 'video';
  dl = { tab, title, state: 'loading', options: [], pct: 0 };
  win.contentView.addChildView(panel);
  layout();
  sendDl();
  const f = (u, init) => tab.view.webContents.session.fetch(u, init);
  const mine = dl;
  try {
    const lists = await Promise.all(tab.media.map((m) => downloader.options(f, m).catch(() => [])));
    if (dl !== mine) return;
    dl.options = lists.flat();
    dl.state = dl.options.length ? 'choose' : 'error';
    if (!dl.options.length) dl.error = T('dl.err.read');
  } catch {
    if (dl !== mine) return;
    dl.state = 'error';
    dl.error = T('dl.err.read');
  }
  sendDl();
}

async function startDownload(index) {
  const cur = dl;
  const opt = cur && cur.state === 'choose' && cur.options[index];
  if (!opt) return;
  cur.state = 'running';
  cur.pct = 0;
  cur.ctl = new AbortController();
  sendDl();
  const f = (u, init) => cur.tab.view.webContents.session.fetch(u, init);
  try {
    cur.path = await downloader.download(f, opt, {
      dir: app.getPath('downloads'), title: cur.title, signal: cur.ctl.signal,
      onProgress: (p) => { cur.pct = p; if (dl === cur) sendDl(); }
    });
    cur.state = 'done';
  } catch (e) {
    cur.state = 'error';
    cur.error = e.message === 'protected' ? T('dl.err.drm')
      : e.message === 'live' ? T('dl.err.live') : T('dl.err.fail');
  }
  if (dl === cur) sendDl();
}

async function runPageAction(r) {
  if (r.action === 'reader') return openReader();
  return pageAssistant(r.action, r.text);
}

// ---- Page assistant (AI-03 summary and questions, AI-04 translation) -------------------------------------------------
const pageMeta = (tab) => { let host = ''; try { host = new URL(tab.url).hostname.replace(/^www\./, ''); } catch { /* none */ } return { title: tab.title, host }; };
// Opens (or keeps) the assistant for this tab. A new tab or a new address starts a fresh conversation.
function claimPanel(tab) {
  const fresh = !pa || pa.tab !== tab || pa.url !== tab.url;
  pa = { tab, view: 'both', url: tab.url };
  win.contentView.addChildView(panel);
  layout();
  return fresh;
}
const sendPage = (s) => { if (pa) panel.webContents.send('page:state', { ...s, lang: L() }); };
const modelInfo = async () => ({ ready: !!llm && (await llm.available()), remote: !!llm && llm.remote ? llm.host : '', model: llm ? llm.model : '' });

// Everything a model reads from a page comes through here (AI-10): visible text only, invisible characters stripped,
// and a report of anything that looked like an order to the assistant.
async function pageRead(tab) {
  const wc = tab.view.webContents;
  let raw = '', hidden = {};
  try {
    const a = await wc.executeJavaScriptInIsolatedWorld(1003, [{ code: extractionScript() }]);
    if (a && a.text && a.text.length > 300) { raw = a.text; hidden = a.hidden || {}; }
  } catch { /* fall through */ }
  if (!raw) {
    try {
      const f = await wc.executeJavaScriptInIsolatedWorld(1003, [{ code: shield.fallbackScript() }]);
      if (f) { raw = f.text || ''; hidden = f.hidden || {}; }
    } catch { /* nothing readable */ }
  }
  return shield.prepare(raw, hidden);
}

async function pageAssistant(action, question = '') {
  const tab = active();
  if (!tab) return;
  if (tab.isHome || !/^https?:/.test(tab.url)) return loadHome(tab.view.webContents, { kind: 'nopage' });
  if (run) { run.cancel(); run = null; }
  if (dl) { if (dl.ctl) dl.ctl.abort(); dl = null; }
  const fresh = claimPanel(tab);
  const mine = pa;
  const live = () => pa === mine && active() === tab;
  const m = await modelInfo();
  const meta = { mode: action, question, remote: m.remote, model: m.model, seq: ++paSeq, page: pageMeta(tab) };
  sendPage({ ...meta, reset: fresh, state: 'working' });
  try {
    if (action === 'translate') return await translatePage(tab, mine, meta, m, live);
    const { text, report } = await pageRead(tab);
    const safety = shield.worthWarning(report) || report.invisible || report.hiddenChars ? report : null;
    if (!live()) return;
    if (text.length < 120) return sendPage({ ...meta, state: 'error', error: 'pg.noText' });
    const l = m.ready ? llm : null;
    if (action === 'summarize') {
      const s = await pageassist.summarize({ text, llm: l, lang: L() });
      mine.text = text;
      return live() && sendPage({ ...meta, state: 'done', bullets: s.bullets, ai: s.ai, safety });
    }
    const a = await pageassist.ask({ text, question, llm: l, lang: L() });
    mine.text = text;
    if (live()) sendPage({ ...meta, state: 'done', found: a.found, answer: a.answer, passages: a.passages, ai: a.ai, safety });
  } catch { if (live()) sendPage({ ...meta, state: 'error', error: 'pg.error' }); }
}

// Opens the page tools without running anything, so the options are visible before the user asks for one.
function openAssist() {
  const tab = active();
  if (!tab || tab.isHome || !/^https?:/.test(tab.url)) return;
  if (run) { run.cancel(); run = null; }
  if (dl) { if (dl.ctl) dl.ctl.abort(); dl = null; }
  const fresh = claimPanel(tab);
  sendPage({ mode: 'idle', question: '', state: 'idle', reset: fresh, page: pageMeta(tab) });
}

async function translatePage(tab, mine, meta, m, live) {
  if (!m.ready) return sendPage({ ...meta, state: 'error', error: 'pg.needModel' });
  const wc = tab.view.webContents;
  const { lang: pageLang, blocks } = await wc.executeJavaScriptInIsolatedWorld(1004, [{ code: pageassist.COLLECT_SCRIPT }]);
  const target = L();
  if (pageLang && pageLang.toLowerCase().startsWith(target)) return sendPage({ ...meta, state: 'error', error: 'pg.same', target: pageassist.NAME[target] });
  if (!blocks.length) return sendPage({ ...meta, state: 'error', error: 'pg.noText' });
  const chunks = pageassist.chunkBlocks(blocks);
  let done = 0;
  for (const chunk of chunks) {
    if (!live()) return;
    const map = await pageassist.translateBatch({ blocks: chunk, llm, target });
    if (Object.keys(map).length) await wc.executeJavaScriptInIsolatedWorld(1004, [{ code: pageassist.applyScript(map) }]);
    done += chunk.length;
    sendPage({ ...meta, state: 'working', done, total: blocks.length });
  }
  if (live()) sendPage({ ...meta, state: 'done', translated: blocks.length, target: pageassist.NAME[target], view: 'both' });
}

async function submit(text) {
  if (!text.trim()) return;
  // Typing the name of a saved task runs it.
  const saved = taskStore && taskStore.byName(text);
  if (saved) return openTasks({ select: saved.id, auto: true });
  const r = classify(text);
  const wc = active().view.webContents;
  if (r.kind === 'write') {
    openTasks({ quick: { kind: r.task === 'reply' ? 'email' : r.task, request: r.text, reply: r.task === 'reply' } });
  } else if (r.kind === 'page') {
    await runPageAction(r);
  } else if (r.kind === 'download') {
    if (active().media.length) openDownload();
    else loadHome(wc, { kind: 'download', q: r.text, novideo: '1' });
  } else if (r.kind === 'search') {
    const tab = active();
    tab.title = r.text;
    tab.isHome = true;
    loadHome(wc, { kind: 'loading', q: r.text });
    tab.busy = true;
    tab.pending = r.text;
    pushState();
    let a;
    try { a = await answerQuery(r.text, { llm, lang: L() }); } finally { tab.busy = false; tab.pending = ''; }
    if (!tabs.includes(tab)) return;
    if (a) loadHome(wc, { kind: 'answer', q: r.text, web: r.url, answer: JSON.stringify(a) });
    else { tab.pending = r.text; pushState(); wc.loadURL(r.url); }
  } else if (r.kind === 'agent' && matchWorkflow(r.text)) {
    startAgent(matchWorkflow(r.text));
  } else if (r.url) {
    active().title = '';
    active().pending = r.kind === 'url' ? r.url : r.text;
    pushState();
    wc.loadURL(r.url);
  } else {
    const query = { kind: r.kind, q: r.text };
    if (r.kind === 'memory') {
      query.results = JSON.stringify((await memory.search(r.text)).map(({ url, title, ts, snippet }) => ({ url, title, ts, snippet })));
      query.total = String(memory.size);
    }
    loadHome(wc, query);
  }
}

function createWindow() {
  tabs.length = 0;
  activeId = null;
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 720, minHeight: 480,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 13 } }
      : {
          titleBarStyle: 'hidden', autoHideMenuBar: true,
          titleBarOverlay: {
            color: nativeTheme.shouldUseDarkColors ? '#10151E' : '#FFFFFF',
            symbolColor: nativeTheme.shouldUseDarkColors ? '#E9EDF3' : '#12161C', height: 40
          }
        }),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#10151E' : '#FFFFFF',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.on('resize', layout);
  panel = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'panel-preload.js'), contextIsolation: true, sandbox: true } });
  panel.webContents.loadFile(path.join(__dirname, 'ui', 'panel.html'));
  panel.webContents.on('did-finish-load', () => panel.webContents.send('lang', L()));
  win.webContents.once('did-finish-load', startTabs);
  win.webContents.on('did-finish-load', () => pushState()); // if the browser's own window ever reloads, the tab strip comes back
}

function refreshEmbedder() {
  const l = settings.get().local;
  // Page text never leaves the computer: only a local model server may embed it.
  memory.embedder = isLocalHost(l.url) && l.embedModel ? createEmbedder({ url: l.url, model: l.embedModel }) : null;
}

// AI-06: re-renders the current article without ads, popups or clutter, with a few key points on top.
async function openReader(tab = active()) {
  if (!tab || tab.isHome || !/^https?:/.test(tab.url)) return;
  const wc = tab.view.webContents;
  let a = null;
  try { a = await wc.executeJavaScriptInIsolatedWorld(1003, [{ code: extractionScript() }]); } catch { a = null; }
  if (!a || !a.content) return loadHome(wc, { kind: 'noreader' });
  const text = a.text || '';
  const article = {
    title: a.title, byline: a.byline, siteName: a.siteName, content: a.content.slice(0, 400000),
    summary: pageai.extractiveSummary(text, 3), minutes: pageai.readingMinutes(text)
  };
  loadUi(wc, READER, { url: tab.url, d: JSON.stringify(article) });
}

function openMemory() {
  if (memoryWin && !memoryWin.isDestroyed()) return memoryWin.focus();
  memoryWin = new BrowserWindow({
    width: 860, height: 780, minWidth: 560, minHeight: 480, title: T('mem.title'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#10151E' : '#FFFFFF',
    webPreferences: { preload: path.join(__dirname, 'memory-preload.js'), contextIsolation: true, sandbox: true }
  });
  memoryWin.setMenuBarVisibility(false);
  memoryWin.loadFile(path.join(__dirname, 'ui', 'memory.html'), { query: { lang: L() } });
  memoryWin.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) { openTab({ url }); win.focus(); }
    return { action: 'deny' };
  });
  memoryWin.on('closed', () => { memoryWin = null; });
}

function wireMemoryIpc() {
  const trusted = (e) => memoryWin && e.sender === memoryWin.webContents;
  const reject = () => { throw new Error('untrusted sender'); };
  const from = (range) => (RANGES[range] ? Date.now() - RANGES[range] : undefined);
  const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
  ipcMain.handle('memory:list', async (e, { q = '', range = 'all', host = '' } = {}) => {
    if (!trusted(e)) return reject();
    const opts = { host: host || undefined, from: from(range) };
    const raw = q.trim() ? await memory.search(q, Date.now(), 200, opts) : memory.list(opts).slice(0, 200).map(({ url, title, ts }) => ({ url, title, ts }));
    return {
      items: raw.map((i) => ({ url: i.url, title: i.title, ts: i.ts, host: hostOf(i.url), snippet: i.snippet || '', icon: favicons.get(hostOf(i.url)) })),
      total: memory.size, hosts: memory.hosts().slice(0, 50), embedded: memory.embeddedCount
    };
  });
  ipcMain.handle('memory:remove', (e, url) => {
    if (!trusted(e)) return reject();
    const r = memory.remove(String(url));
    const h = hostOf(String(url));
    if (h && !memory.list({ host: h }).length) favicons.remove(h);
    return r;
  });
  const confirm = async (message) => (await dialog.showMessageBox(memoryWin, { type: 'warning', buttons: [T('mem.delete'), T('set.priv.cancel')], defaultId: 1, cancelId: 1, message })).response === 0;
  ipcMain.handle('memory:removeHost', async (e, host) => {
    if (!trusted(e)) return reject();
    const n = memory.list({ host: String(host) }).length;
    if (!n || !(await confirm(T('mem.confirmSite', { n, host })))) return 0;
    favicons.remove(String(host));
    return memory.removeHost(String(host));
  });
  ipcMain.handle('memory:removeRange', async (e, range) => {
    if (!trusted(e)) return reject();
    const n = range === 'all' ? memory.size : memory.list({ from: from(range) }).length;
    if (!n || !(await confirm(T('mem.confirmRange', { n })))) return 0;
    const r = memory.removeSince(String(range));
    if (!memory.size) favicons.clear();
    return r;
  });
  ipcMain.handle('memory:export', async (e) => {
    if (!trusted(e)) return reject();
    const r = await dialog.showSaveDialog(memoryWin, { defaultPath: 'lore-memory.json', filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'CSV', extensions: ['csv'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    const rows = memory.export();
    const csv = ['url,title,visited', ...rows.map((x) => [x.url, x.title, x.visited].map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(','))].join('\n');
    require('fs').writeFileSync(r.filePath, r.filePath.toLowerCase().endsWith('.csv') ? csv : JSON.stringify(rows, null, 2));
    return { ok: true, count: rows.length };
  });
}

function applyLanguage() {
  buildMenu();
  panel.webContents.send('lang', L());
  if (memoryWin && !memoryWin.isDestroyed()) { memoryWin.setTitle(T('mem.title')); memoryWin.loadFile(path.join(__dirname, 'ui', 'memory.html'), { query: { lang: L() } }); }
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.setTitle(T('set.title'));
  for (const t of tabs) {
    const wc = t.view.webContents;
    if (!isOurHome(wc.getURL())) continue;
    const u = new URL(wc.getURL());
    u.searchParams.set('lang', L());
    wc.loadURL(u.toString());
  }
  pushState();
}

// Keeps one small icon per site on this device, so Memory can show it without contacting the site again.
async function saveFavicon(wc, pageUrl, icons) {
  let host;
  try { host = new URL(pageUrl).hostname; } catch { return; }
  if (!favicons || !host || isSensitiveHost(host) || favicons.has(host) || !/^https?:/.test(pageUrl)) return;
  for (const icon of icons.slice(0, 3)) {
    try {
      if (icon.startsWith('data:')) { if (favicons.set(host, icon)) return; continue; }
      if (!/^https?:/.test(icon)) continue;
      const res = await wc.session.fetch(icon, { signal: AbortSignal.timeout(4000) });
      const data = await toDataUrl(res);
      if (data && favicons.set(host, data)) return;
    } catch { /* try the next one */ }
  }
}

// ---- Writing help: Tasks window, right-click Lore AI menu, toasts ---------------------------------------------------

const toast = (t) => { if (win && !win.isDestroyed()) win.webContents.send('toast', t); };

function openTasks(req) {
  const query = { lang: L() };
  if (req && req.quick) Object.assign(query, { quick: String(req.quick.request).slice(0, 2000), kind: req.quick.kind, reply: req.quick.reply ? '1' : '0' });
  else if (req && req.select) Object.assign(query, { select: req.select, auto: req.auto ? '1' : '0' });
  if (tasksWin && !tasksWin.isDestroyed()) {
    tasksWin.show();
    tasksWin.focus();
    if (req) tasksWin.webContents.send('tasks:open', req);
    return;
  }
  tasksWin = new BrowserWindow({
    width: 760, height: 700, minWidth: 520, minHeight: 480, title: T('task.title'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#10151E' : '#FFFFFF',
    webPreferences: { preload: path.join(__dirname, 'tasks-preload.js'), contextIsolation: true, sandbox: true }
  });
  tasksWin.setMenuBarVisibility(false);
  tasksWin.loadFile(path.join(__dirname, 'ui', 'tasks.html'), { query });
  tasksWin.on('closed', () => { tasksWin = null; });
}

// Opens an address in a new tab of the main window and brings that window to the front.
function openInLore(url) {
  if (!isAllowedNavigation(url)) throw new Error('blocked');
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  openTab({ url });
}

const clip = (v, n = 6000) => String(v == null ? '' : v).slice(0, n);

function wireTasksIpc() {
  const trusted = (e) => tasksWin && e.sender === tasksWin.webContents;
  const none = () => ({ error: 'task.err' });
  ipcMain.handle('tasks:list', async (e) => (trusted(e) ? { tasks: taskStore.list(), prefs: taskStore.prefs, ready: (await modelInfo()).ready } : none()));
  // A request typed in the Tasks box: work out whether it is an email, an event or a post.
  ipcMain.handle('tasks:classify', (e, text) => {
    if (!trusted(e)) return { kind: 'text', reply: false };
    const r = classify(String(text).slice(0, 500));
    return r.kind === 'write' ? { kind: r.task === 'reply' ? 'email' : r.task, reply: r.task === 'reply' } : { kind: 'text', reply: false };
  });
  ipcMain.handle('tasks:save', (e, t) => {
    if (!trusted(e) || !t || typeof t !== 'object') return none();
    try { return { task: taskStore.save({ id: t.id ? String(t.id) : undefined, name: t.name, kind: t.kind, instruction: t.instruction }) }; } catch (err) { return { error: String(err.message).startsWith('task.err') ? err.message : 'task.err' }; }
  });
  ipcMain.handle('tasks:remove', (e, id) => (trusted(e) ? taskStore.remove(String(id)) : false));
  // What is on the page the user came from. Shown in the form before anything is sent anywhere.
  ipcMain.handle('tasks:context', async (e, needPage) => {
    if (!trusted(e)) return {};
    const tab = active();
    if (!tab || tab.isHome || !/^https?:/.test(tab.url)) return {};
    const out = { url: clip(tab.url, 500), title: clip(tab.title, 200) };
    // A slow or busy page must not leave the form waiting: give each read a few seconds, then go on without it.
    const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(''), ms))]);
    try { out.selection = clip(await within(tab.view.webContents.executeJavaScriptInIsolatedWorld(1005, [{ code: 'String(getSelection())' }]), 2500)); } catch { /* page gone */ }
    out.selection = shield.prepare((out.selection || '').trim()).text;
    // "content" is what the user is pointing at: the selected text, or else the whole page.
    let report = shield.prepare(out.selection).report;
    if (needPage && !out.selection) {
      const r = await within(pageRead(tab), 6000);
      if (r && r.text != null) { out.page = clip(r.text, 6000); report = r.report; }
    }
    out.safety = shield.worthWarning(report) ? report : null;
    out.content = out.selection || out.page || '';
    out.source = out.selection ? 'selection' : out.page ? 'page' : '';
    return out;
  });
  ipcMain.handle('tasks:run', async (e, req) => {
    if (!trusted(e) || !req || typeof req !== 'object') return none();
    let task;
    if (req.id === 'quick') {
      if (!taskLib.KINDS.includes(req.kind)) return none();
      task = { id: 'quick', kind: req.kind, instruction: req.reply ? 'Write a reply to the message below, as I describe: {{request}}\n\nMESSAGE:\n{{content}}' : '{{request}}' };
    } else task = taskStore.get(String(req.id));
    if (!task) return none();
    const m = await modelInfo();
    if (!m.ready) return { error: 'task.noModel' };
    const values = {};
    for (const [k, v] of Object.entries(req.values || {})) if (/^\w{1,40}$/.test(k)) values[k] = clip(v);
    const lang = ['en', 'vi'].includes(req.lang) ? req.lang : 'auto';
    try {
      const raw = await llm.chat(taskLib.buildMessages(task, values, { lang, uiLang: L(), now: Date.now() }), { maxTokens: 1200, timeoutMs: 90000, temperature: 0.4 });
      const result = taskLib.parse(task.kind, raw);
      const text = result.text || result.body || result.title || '';
      if (!String(text).trim()) return { error: 'task.err.empty' };
      const platform = taskLib.platformOf(task, values);
      if (task.id !== 'quick') taskStore.remember(task.id, values);
      return { ok: true, result, platform, max: taskLib.PLATFORM[platform].max, remote: m.remote };
    } catch (err) { return { error: err && err.status === 401 ? 'llm.keyRejected' : 'task.err' }; }
  });
  // The only things Lore does with a draft: copy it, or open it in a new Lore tab (webmail, calendar, a social
  // site) or in the user's own mail or calendar app. None of them sends, posts or books anything: the user
  // reviews the draft there and confirms.
  ipcMain.handle('tasks:act', async (e, req) => {
    if (!trusted(e) || !req || typeof req !== 'object') return none();
    try {
      if (req.type === 'copy') { clipboard.writeText(clip(req.text, 20000)); return { ok: true }; }
      if (req.type === 'mail') {
        const provider = taskLib.MAIL.includes(req.provider) ? req.provider : 'gmail';
        const d = { to: clip(req.to, 500), subject: clip(req.subject, 300), body: clip(req.body, 20000) };
        taskStore.setChoice('mail', provider);
        if (provider === 'app') {
          const url = taskLib.buildMailto(d);
          if (url.length > taskLib.MAX_URL) { clipboard.writeText(d.body); return { error: 'act.tooLong' }; }
          await shell.openExternal(url);
          return { ok: true, where: 'app' };
        }
        // A very long message does not fit in an address: open the draft without it and copy the text to paste.
        let url = taskLib.webmailUrl(provider, d);
        const long = url.length > taskLib.MAX_URL;
        if (long) { url = taskLib.webmailUrl(provider, d, { withBody: false }); clipboard.writeText(d.body); }
        openInLore(url);
        return { ok: true, where: 'lore', copied: long };
      }
      if (req.type === 'cal') {
        const provider = taskLib.CAL.includes(req.provider) ? req.provider : 'google';
        const ev = { title: clip(req.event && req.event.title, 200), start: clip(req.event && req.event.start, 16), end: clip(req.event && req.event.end, 16), location: clip(req.event && req.event.location, 300), notes: clip(req.event && req.event.notes, 4000) };
        taskStore.setChoice('cal', provider);
        if (provider === 'google') { openInLore(taskLib.gcalUrl(ev)); return { ok: true, where: 'lore' }; }
        if (provider === 'outlook') { openInLore(taskLib.outlookCalUrl(ev)); return { ok: true, where: 'lore' }; }
        const file = path.join(os.tmpdir(), 'lore-event-' + Date.now().toString(36) + '.ics');
        fs.writeFileSync(file, taskLib.buildIcs(ev));
        setTimeout(() => fs.unlink(file, () => {}), 120000).unref();
        const err = await shell.openPath(file);
        return err ? { error: 'task.err' } : { ok: true, where: 'app' };
      }
      if (req.type === 'compose') {
        const text = clip(req.text, 20000);
        clipboard.writeText(text);
        openInLore(taskLib.composeUrl(String(req.platform), text));
        return { ok: true, where: 'lore', copied: true };
      }
    } catch { /* fall through */ }
    return none();
  });
  ipcMain.on('settings:open-from-tasks', (e) => { if (trusted(e)) openSettings(); });
}

// Right-click: what the page offers (links, images, selected text, text boxes) plus the Lore AI actions (BRW-23).
function showContextMenu(tab, params) {
  if (tab.isHome && !params.isEditable) return;
  const wc = tab.view.webContents;
  const sel = (params.selectionText || '').trim();
  const edit = params.isEditable;
  const link = isAllowedNavigation(params.linkURL || '') && params.linkURL;
  const img = params.mediaType === 'image' && isAllowedNavigation(params.srcURL || '') ? params.srcURL : '';
  const items = [];
  const sep = () => { if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' }); };
  if (link) {
    items.push(
      { label: T('ctx.openTab'), click: () => openTab({ url: link }, { private: tab.private }) },
      { label: T('ctx.openPrivate'), click: () => openTab({ url: link }, { private: true }) },
      { label: T('ctx.copyLink'), click: () => clipboard.writeText(link) }
    );
    sep();
  }
  if (img) {
    items.push(
      { label: T('ctx.openImage'), click: () => openTab({ url: img }, { private: tab.private }) },
      { label: T('ctx.saveImage'), click: () => { tab.saveAs = true; wc.downloadURL(img); } },
      { label: T('ctx.copyImage'), click: () => wc.copyImageAt(params.x, params.y) },
      { label: T('ctx.copyImageUrl'), click: () => clipboard.writeText(img) }
    );
    sep();
  }
  if (edit) items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut', enabled: !!sel }, { role: 'copy', enabled: !!sel }, { role: 'paste' }, { role: 'selectAll' });
  else if (sel) items.push({ role: 'copy' });
  if (sel && !edit) {
    const q = sel.replace(/\s+/g, ' ').slice(0, 200);
    items.push({ label: T('ctx.search', { q: q.length > 30 ? q.slice(0, 30) + '…' : q }), click: () => openTab({ url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) }, { private: tab.private }) });
  }
  if (sel || edit) {
    const A = (action, label, extra) => ({ label, click: () => runWriting(tab, action, params, extra) });
    const other = L() === 'vi' ? 'en' : 'vi';
    const ai = [
      ...(edit ? [A('rewrite', T('ai.rewrite')), A('fix', T('ai.fix')), A('shorten', T('ai.shorten')), A('expand', T('ai.expand')), A('formal', T('ai.formal')), A('friendly', T('ai.friendly')), { type: 'separator' }] : []),
      A('translate', T('ai.translate', { lang: writing.targetName(L()) }), { target: L() }),
      ...(edit ? [A('translate', T('ai.translate', { lang: writing.targetName(other) }), { target: other })] : []),
      A('explain', T('ai.explain')), A('summarize', T('ai.summarize')),
      ...(sel && !edit ? [{ type: 'separator' }, { label: T('ai.reply'), click: () => openTasks({ quick: { kind: 'email', request: '', reply: true } }) }] : [])
    ];
    sep();
    items.push({ label: T('ai.menu'), submenu: ai });
  }
  if (!sel && !edit && !link && !img) {
    const nav = wc.navigationHistory;
    items.push(
      { label: T('nav.back'), enabled: nav.canGoBack(), click: () => nav.goBack() },
      { label: T('nav.forward'), enabled: nav.canGoForward(), click: () => nav.goForward() },
      { label: T('nav.reload'), click: () => wc.reload() },
      { type: 'separator' },
      { label: T('menu.find'), accelerator: 'CmdOrCtrl+F', click: () => openFind() }
    );
  }
  sep();
  items.push({ label: T('ctx.inspect'), click: () => { wc.inspectElement(params.x, params.y); if (wc.isDevToolsOpened()) wc.devToolsWebContents.focus(); } });
  Menu.buildFromTemplate(items).popup({ window: win });
}

async function fieldText(wc) {
  try {
    return await wc.executeJavaScriptInIsolatedWorld(1005, [{ code: '(() => { const e = document.activeElement; if (!e) return ""; if ("value" in e) return String(e.value); return e.isContentEditable ? e.innerText : ""; })()' }]);
  } catch { return ''; }
}

async function runWriting(tab, action, params, { target } = {}) {
  const wc = tab.view.webContents;
  const m = await modelInfo();
  if (!m.ready) return toast({ text: T('ai.noModel'), action: 'settings', actionLabel: T('task.openSettings') });
  const a = writing.ACTIONS[action];
  const selected = (params.selectionText || '').trim();
  const whole = !selected && params.isEditable;
  const prep = shield.prepare(selected || (whole ? String(await fieldText(wc)).trim() : ''));
  const text = prep.text;
  if (!text) return toast({ text: T('ai.nothing') });
  const label = action === 'translate' ? T('ai.translate', { lang: writing.targetName(target || L()) }) : T('ai.' + action);
  toast({ text: T('ai.working', { a: label }), busy: true });
  let out;
  try { out = await writing.run(action, text, { llm, lang: L(), target: target || L() }); } catch { return toast({ text: T('ai.fail') }); }
  const replace = a.mode === 'replace' && params.isEditable;
  if (replace) {
    if (active() !== tab || wc.isDestroyed()) { clipboard.writeText(out); return toast({ text: T('ai.moved') }); }
    if (whole) wc.selectAll();
    wc.insertText(out);
    return toast({ text: T('ai.done', { k: process.platform === 'darwin' ? '⌘' : 'Ctrl+' }) });
  }
  toast(null);
  if (active() !== tab) return;
  const fresh = claimPanel(tab);
  sendPage({ mode: 'sel', state: 'done', question: label, answer: out, ai: true, safety: shield.worthWarning(prep.report) ? prep.report : null, model: m.model, remote: m.remote, seq: ++paSeq, reset: fresh, page: pageMeta(tab) });
}

// ---- Find in page (BRW-01) ------------------------------------------------------------------------------------------
const FIND_W = 380;
function layoutFind() {
  if (!findView || !win) return;
  const [w] = win.getContentSize();
  const pw = agentOpen() ? PANEL_W : 0;
  findView.setBounds({ x: Math.max(0, w - pw - FIND_W - 12), y: CHROME_HEIGHT + 8, width: FIND_W, height: 46 });
}
function openFind() {
  const t = active();
  if (!t || t.isHome || !/^https?:/.test(t.url)) return;
  if (!findView) {
    findView = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'find-preload.js'), contextIsolation: true, sandbox: true } });
    findView.setBackgroundColor('#00000000');
    findView.webContents.loadFile(path.join(__dirname, 'ui', 'find.html'), { query: { lang: L() } });
  }
  win.contentView.addChildView(findView);
  layoutFind();
  findView.webContents.focus();
  findView.webContents.send('find:focus');
}
function closeFind() {
  if (!findView) return;
  const t = active();
  for (const x of tabs) { try { x.view.webContents.stopFindInPage('clearSelection'); } catch { /* tab gone */ } }
  if (win && !win.isDestroyed()) win.contentView.removeChildView(findView);
  if (t) t.view.webContents.focus();
}
function wireFind(wc) {
  wc.on('found-in-page', (_e, r) => {
    if (findView && active() && active().view.webContents === wc) findView.webContents.send('find:result', { active: r.activeMatchOrdinal, total: r.matches });
  });
}
function wireFindIpc() {
  const ok = (e) => findView && e.sender === findView.webContents;
  ipcMain.on('find:query', (e, text, forward, next) => {
    if (!ok(e)) return;
    const t = active();
    if (!t) return;
    const q = String(text || '').slice(0, 200);
    if (!q) { t.view.webContents.stopFindInPage('clearSelection'); findView.webContents.send('find:result', { active: 0, total: 0 }); return; }
    t.view.webContents.findInPage(q, { forward: forward !== false, findNext: !!next });
  });
  ipcMain.on('find:close', (e) => { if (ok(e)) closeFind(); });
}

// ---- Downloads window (BRW-04) ---------------------------------------------------------------------------------------
function openDownloads() {
  if (downloadsWin && !downloadsWin.isDestroyed()) return downloadsWin.focus();
  downloadsWin = new BrowserWindow({
    width: 640, height: 560, minWidth: 460, minHeight: 360, title: T('dl2.title'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#10151E' : '#FFFFFF',
    webPreferences: { preload: path.join(__dirname, 'downloads-preload.js'), contextIsolation: true, sandbox: true }
  });
  downloadsWin.setMenuBarVisibility(false);
  downloadsWin.loadFile(path.join(__dirname, 'ui', 'downloads.html'), { query: { lang: L() } });
  downloadsWin.on('closed', () => { downloadsWin = null; });
}
function wireDownloadsIpc() {
  const trusted = (e) => downloadsWin && e.sender === downloadsWin.webContents;
  ipcMain.handle('downloads:list', (e) => (trusted(e) ? downloads.view() : []));
  ipcMain.handle('downloads:act', async (e, id, action) => {
    if (!trusted(e)) return false;
    const r = downloads.get(Number(id));
    if (!r) return false;
    if (action === 'pause') downloads.pause(r.id);
    else if (action === 'resume') downloads.resume(r.id);
    else if (action === 'cancel') downloads.cancel(r.id);
    else if (action === 'remove') downloads.remove(r.id);
    else if (action === 'reveal' && r.path) shell.showItemInFolder(r.path);
    else if (action === 'open' && r.state === 'done' && r.path && fs.existsSync(r.path)) {
      if (r.risky) {
        const ask = await dialog.showMessageBox(downloadsWin, { type: 'warning', buttons: [T('dl2.openAnyway'), T('set.priv.cancel')], defaultId: 1, cancelId: 1, message: T('dl2.riskyAsk', { name: r.name }), detail: T('dl2.riskyDetail', { host: r.host || '?' }) });
        if (ask.response !== 0) return false;
      }
      shell.openPath(r.path);
    }
    return true;
  });
  ipcMain.handle('downloads:clear', (e) => { if (trusted(e)) downloads.clearFinished(); return true; });
  ipcMain.on('downloads:open', (e) => { if (e.sender === win.webContents) openDownloads(); });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 820, height: 680, minWidth: 620, minHeight: 520, title: T('set.title'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#10151E' : '#FFFFFF',
    webPreferences: { preload: path.join(__dirname, 'settings-preload.js'), contextIsolation: true, sandbox: true }
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'ui', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

function wireSettingsIpc() {
  // Only the settings window may read or change settings; web pages have no bridge to these channels.
  const trusted = (e) => settingsWin && e.sender === settingsWin.webContents;
  const reject = () => { throw new Error('untrusted sender'); };
  const msg = (e) => (e && e.name === 'TimeoutError' ? T('set.err.timeout') : e && /^(llm|set)\./.test(e.message) ? T(e.message, { status: e.status, detail: e.detail ? ': ' + e.detail : '' }) : e && e.message ? e.message : T('set.err.connect'));
  ipcMain.handle('settings:get', (e) => (trusted(e) ? { view: settings.view(), lang: L() } : reject()));
  ipcMain.handle('settings:save', (e, patch) => {
    if (!trusted(e)) return reject();
    const before = L();
    try {
      const view = settings.update(patch);
      llm = createLlm(settings.get());
      refreshEmbedder();
      if (L() !== before) applyLanguage();
      return { view, lang: L() };
    } catch (err) { return { error: msg(err) }; }
  });
  ipcMain.handle('settings:test', async (e, patch) => {
    if (!trusted(e)) return reject();
    try {
      const m = createLlm(settings.preview(patch));
      if (!m) return { ok: false, message: T('set.err.off') };
      if (!(await m.available())) return { ok: false, message: m.remote ? T('set.err.needKey') : T('set.err.notInstalled') };
      const reply = await m.chat([{ role: 'user', content: 'Reply with the single word: ok' }], { timeoutMs: 20000 });
      return reply ? { ok: true } : { ok: false, message: T('set.err.empty') };
    } catch (err) { return { ok: false, message: msg(err) }; }
  });
  ipcMain.handle('settings:clear', async (e) => {
    if (!trusted(e)) return reject();
    const r = await dialog.showMessageBox(settingsWin, {
      type: 'warning', buttons: [T('set.priv.clearBtn'), T('set.priv.cancel')], defaultId: 1, cancelId: 1, message: T('set.priv.confirm')
    });
    if (r.response !== 0) return { ok: false };
    await session.defaultSession.clearStorageData();
    await session.defaultSession.clearCache();
    memory.clear();
    favicons.clear();
    return { ok: true };
  });
  ipcMain.handle('settings:models', async (e, url) => (trusted(e) ? listLocalModels(String(url)) : reject()));
  ipcMain.handle('settings:pull', async (e, url, model) => {
    if (!trusted(e)) return reject();
    try {
      await pullLocalModel(String(url), String(model), (p, status) => e.sender.send('settings:pull-progress', p, status));
      return { ok: true };
    } catch (err) { return { ok: false, message: T('set.err.pull', { e: msg(err) }) }; }
  });
  ipcMain.on('settings:ollama-site', (e) => { if (trusted(e)) shell.openExternal('https://ollama.com/download'); });
}

function wireIpc() {
  ipcMain.on('tab:new', () => openTab());
  ipcMain.on('tab:select', (_e, id) => selectTab(id));
  ipcMain.on('tab:close', (_e, id) => closeTab(id));
  ipcMain.on('tab:menu', (e, id) => { if (e.sender === win.webContents) showTabMenu(Number(id)); });
  ipcMain.on('tab:move', (e, id, beforeId) => { if (e.sender === win.webContents) setOrder(tabstate.reorder(tabs, Number(id), beforeId == null ? null : Number(beforeId))); });
  ipcMain.on('nav:submit', (_e, text) => submit(String(text)));
  ipcMain.on('nav:back', () => active().view.webContents.navigationHistory.goBack());
  ipcMain.on('nav:forward', () => active().view.webContents.navigationHistory.goForward());
  ipcMain.on('nav:reload', () => active().view.webContents.reload());
  // Decisions count only when they come from the trusted panel's own webContents.
  ipcMain.on('agent:decide', (e, approved) => { if (run && e.sender === panel.webContents) run.decide(approved); });
  ipcMain.on('agent:close', (e) => { if (e.sender === panel.webContents) closePanel(); });
  ipcMain.on('media:open', () => openDownload());
  // Page assistant: only the trusted panel may drive it.
  ipcMain.on('page:do', (e, action, arg) => {
    if (e.sender !== panel.webContents || !['summarize', 'translate', 'ask', 'reader', 'tasks', 'task'].includes(action)) return;
    if (action === 'reader') return openReader();
    if (action === 'tasks') return openTasks();
    if (action === 'task') return taskLib.BUILTIN.some((t) => t.id === arg && t.group === 'page') ? openTasks({ select: String(arg), auto: true }) : undefined;
    pageAssistant(action, String(arg || ''));
  });
  ipcMain.on('panel:copy', (e, text) => { if (e.sender === panel.webContents && typeof text === 'string') clipboard.writeText(text.slice(0, 20000)); });
  ipcMain.on('page:view', (e, view) => {
    if (e.sender !== panel.webContents || !pa || !['both', 'translation', 'original'].includes(view)) return;
    pa.tab.view.webContents.executeJavaScriptInIsolatedWorld(1004, [{ code: pageassist.viewScript(view) }]).catch(() => {});
  });
  ipcMain.on('page:show', (e, text) => {
    if (e.sender !== panel.webContents || !pa || typeof text !== 'string') return;
    pa.tab.view.webContents.findInPage(text.slice(0, 80));
  });
  ipcMain.on('assist:open', (e) => { if (e.sender === win.webContents) openAssist(); });
  ipcMain.on('menu:more', (e, x, y) => {
    if (e.sender !== win.webContents) return;
    const web = (() => { const t = active(); return !!t && !t.isHome && /^https?:/.test(t.url); })();
    Menu.buildFromTemplate([
      { label: T('menu.newTab'), accelerator: 'CmdOrCtrl+T', click: () => openTab() },
      { label: T('more.private'), accelerator: 'CmdOrCtrl+Shift+N', click: () => openTab(undefined, { private: true }) },
      { type: 'separator' },
      { label: T('more.assist'), enabled: web, accelerator: 'CmdOrCtrl+Alt+A', click: openAssist },
      { label: T('pg.summarize'), enabled: web, accelerator: 'CmdOrCtrl+Alt+S', click: () => pageAssistant('summarize') },
      { label: T('pg.translate'), enabled: web, accelerator: 'CmdOrCtrl+Alt+T', click: () => pageAssistant('translate') },
      { label: T('menu.reader'), enabled: web, accelerator: 'CmdOrCtrl+Alt+R', click: () => openReader() },
      { label: T('menu.openExternal'), enabled: web, accelerator: 'CmdOrCtrl+Shift+O', click: () => { const t = active(); if (t) shell.openExternal(t.url); } },
      { type: 'separator' },
      { label: T('menu.tasks'), accelerator: 'CmdOrCtrl+Shift+K', click: () => openTasks() },
      { label: T('menu.memory'), accelerator: 'CmdOrCtrl+Shift+Y', click: openMemory },
      { label: T('menu.downloads'), accelerator: 'CmdOrCtrl+J', click: openDownloads },
      { label: T('menu.find'), enabled: web, accelerator: 'CmdOrCtrl+F', click: openFind },
      { label: T('menu.settings'), accelerator: 'CmdOrCtrl+,', click: openSettings },
      { type: 'separator' },
      { label: T('more.shortcuts', { k: process.platform === 'darwin' ? '⌘' : 'Ctrl+' }), enabled: false }
    ]).popup({ window: win, x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) });
  });
  ipcMain.on('reader:open', (e) => { if (e.sender === win.webContents) openReader(); });
  ipcMain.on('memory:open', (e) => { if (e.sender === win.webContents) openMemory(); });
  ipcMain.on('settings:open', (e) => { if (e.sender === win.webContents) openSettings(); });
  ipcMain.on('dl:start', (e, i) => { if (e.sender === panel.webContents) startDownload(Number(i)); });
  ipcMain.on('dl:reveal', (e) => { if (e.sender === panel.webContents && dl && dl.path) shell.showItemInFolder(dl.path); });
  ipcMain.on('shield:toggle', () => { S.adsOn = !S.adsOn; pushState(); });
}

const downloadHooked = new WeakSet();
function hookDownloads(ses, isPrivate) {
  if (downloadHooked.has(ses)) return;
  downloadHooked.add(ses);
  ses.on('will-download', (_e, item, wc) => {
    if (!downloads) return;
    const tab = wc ? tabForWc(wc.id) : null;
    const askWhere = !!(tab && tab.saveAs);
    if (tab) tab.saveAs = false;
    const rec = downloads.track(item, { askWhere, private: isPrivate });
    if (!askWhere) toast({ text: T('dl2.started', { name: rec.name }), action: 'downloads', actionLabel: T('dl2.show') });
  });
}

// Applied to every session: the normal one and each private tab's own.
function hardenSession(ses, isPrivate = false) {
  hookDownloads(ses, isPrivate);
  harden(ses, {
    isPrivate, blocker,
    adsOn: () => S.adsOn,
    privacy: () => settings.get().privacy,
    siteOf: (details) => { const t = tabForWc(details.webContentsId); return t && /^https?:/.test(t.url) ? t.url : ''; },
    onBlocked: () => { S.blocked++; if (S.blocked % 5 === 0 || S.blocked < 10) pushState(); if (S.blocked % 25 === 0) saveStats(); },
    onResponse: detectMedia,
    scam: (url) => {
      if (!settings.get().privacy.scamProtection) return null;
      const v = checkUrl(url, { listHas: scamList.has });
      return v && !allowedScam.has(v.host) ? v : null;
    },
    onScam: (details, v) => { const t = tabForWc(details.webContentsId); if (t) t.pendingScam = { url: details.url, v }; },
    ask: async (origin, permission) => {
      const r = await dialog.showMessageBox(win, {
        type: 'question', buttons: [T('perm.allow'), T('perm.block')], defaultId: 1, cancelId: 1,
        message: T('perm.ask', { origin: origin || 'This page', what: T('perm.' + permission) })
      });
      return r.response === 0;
    }
  });
}

// Feeds the toolbar's download button: remembers video responses seen by each tab.
function detectMedia(details) {
  if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') return;
  const tab = tabForWc(details.webContentsId);
  if (!tab || tab.isHome) return;
  const h = (n) => { const k = Object.keys(details.responseHeaders || {}).find((x) => x.toLowerCase() === n); return k ? details.responseHeaders[k][0] : undefined; };
  const m = classifyResponse({ url: details.url, status: details.statusCode, contentType: h('content-type'), contentLength: h('content-length'), contentRange: h('content-range') });
  if (m && !tab.media.some((x) => x.url === m.url)) { tab.media.push(m); pushState(); }
}

function buildMenu() {
  const focus = () => win.webContents.send('focus-intent');
  const settingsItem = { label: T('menu.settings'), accelerator: 'CmdOrCtrl+,', click: openSettings };
  const first = process.platform === 'darwin'
    ? { label: app.name, submenu: [
        { role: 'about' }, { type: 'separator' }, settingsItem,
        { type: 'separator' }, { role: 'services' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }
      ] }
    : { label: app.name, submenu: [settingsItem, { type: 'separator' }, { role: 'quit' }] };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    first,
    { label: T('menu.tab'), submenu: [
      { label: T('menu.newTab'), accelerator: 'CmdOrCtrl+T', click: () => openTab() },
      { label: T('pg.summarize'), accelerator: 'CmdOrCtrl+Alt+S', click: () => pageAssistant('summarize') },
      { label: T('pg.translate'), accelerator: 'CmdOrCtrl+Alt+T', click: () => pageAssistant('translate') },
      { label: T('more.assist'), accelerator: 'CmdOrCtrl+Alt+A', click: openAssist },
      { label: T('menu.reader'), accelerator: 'CmdOrCtrl+Alt+R', click: () => openReader() },
      { label: T('menu.openExternal'), accelerator: 'CmdOrCtrl+Shift+O', click: () => { const t = active(); if (t && /^https?:/.test(t.url)) shell.openExternal(t.url); } },
      { label: T('menu.tasks'), accelerator: 'CmdOrCtrl+Shift+K', click: () => openTasks() },
      { label: T('menu.memory'), accelerator: 'CmdOrCtrl+Shift+Y', click: openMemory },
      { label: T('menu.newPrivate'), accelerator: 'CmdOrCtrl+Shift+N', click: () => openTab(undefined, { private: true }) },
      { label: T('menu.closeTab'), accelerator: 'CmdOrCtrl+W', click: () => active() && closeTab(activeId) },
      { label: T('tab.reopen'), accelerator: 'CmdOrCtrl+Shift+T', click: reopenClosed },
      { label: T('tab.next'), accelerator: 'Ctrl+Tab', click: () => switchTab(tabstate.cycle(tabs, activeId, 1)) },
      { label: T('tab.prev'), accelerator: 'Ctrl+Shift+Tab', click: () => switchTab(tabstate.cycle(tabs, activeId, -1)) },
      { label: T('tab.goTo'), submenu: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ label: n === 9 ? T('tab.last') : T('tab.nth', { n }), accelerator: 'CmdOrCtrl+' + n, click: () => switchTab(tabstate.nth(tabs, n)) })) },
      { type: 'separator' },
      { label: T('menu.find'), accelerator: 'CmdOrCtrl+F', click: openFind },
      { label: T('menu.downloads'), accelerator: 'CmdOrCtrl+J', click: openDownloads },
      { label: T('menu.focus'), accelerator: 'CmdOrCtrl+L', click: focus }
    ] },
    { role: 'editMenu' },
    // Not the stock viewMenu: its Reload (Cmd/Ctrl+R) reloads the browser's own window, which empties the tab strip.
    { label: T('menu.view'), submenu: [
      { label: T('nav.reload'), accelerator: 'CmdOrCtrl+R', click: () => { const t = active(); if (t) t.view.webContents.reload(); } },
      { label: T('menu.hardReload'), accelerator: 'CmdOrCtrl+Shift+R', click: () => { const t = active(); if (t) t.view.webContents.reloadIgnoringCache(); } },
      { type: 'separator' },
      { label: T('menu.zoomIn'), accelerator: 'CmdOrCtrl+=', click: () => zoomActive(0.5) },
      { label: T('menu.zoomOut'), accelerator: 'CmdOrCtrl+-', click: () => zoomActive(-0.5) },
      { label: T('menu.zoomReset'), accelerator: 'CmdOrCtrl+0', click: () => zoomActive(null) },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { label: T('menu.devtools'), accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => { const t = active(); if (t) t.view.webContents.toggleDevTools(); } }
    ] },
    { role: 'windowMenu' }
  ]));
}

app.whenReady().then(() => {
  // A packaged app already carries its icon; this is only for `npm start`. A missing icon must never stop the window opening.
  if (process.platform === 'darwin' && app.dock && !app.isPackaged) { try { app.dock.setIcon(path.join(__dirname, '..', 'build', 'icon.png')); } catch { /* keep the default icon */ } }
  settings = new Settings({
    ...fileStore(path.join(app.getPath('userData'), 'settings.bin'), safeStorage),
    persistent: safeStorage.isEncryptionAvailable()
  });
  llm = createLlm(settings.get());
  memory = new Memory(fileStore(path.join(app.getPath('userData'), 'memory.bin'), safeStorage));
  favicons = new Favicons(fileStore(path.join(app.getPath('userData'), 'favicons.bin'), safeStorage));
  taskStore = new taskLib.TaskStore(fileStore(path.join(app.getPath('userData'), 'tasks.bin'), safeStorage));
  sessionStore = fileStore(path.join(app.getPath('userData'), 'session.bin'), safeStorage);
  downloads = new DownloadList({ dir: app.getPath('downloads'), onChange: (rec, isNew) => {
    pushState();
    if (downloadsWin && !downloadsWin.isDestroyed()) downloadsWin.webContents.send('downloads:update', downloads.view());
    if (rec && rec.state === 'done' && !isNew) toast({ text: T('dl2.done', { name: rec.name }), action: 'downloads', actionLabel: T('dl2.show') });
    if (rec && rec.state === 'failed') toast({ text: T('dl2.failed', { name: rec.name }), action: 'downloads', actionLabel: T('dl2.show') });
  } });
  refreshEmbedder();
  const logStore = fileStore(path.join(app.getPath('userData'), 'agent-log.bin'), safeStorage);
  const entries = logStore.load();
  agentLog = { append: (e) => { entries.push(e); logStore.save(entries); } };
  wireIpc();
  wireSettingsIpc();
  wireMemoryIpc();
  wireTasksIpc();
  wireFindIpc();
  wireDownloadsIpc();
  statsFile = path.join(app.getPath('userData'), 'stats.json');
  loadStats();
  blocker = createBlocker({ bundledPath: path.join(__dirname, 'filters', 'engine.bin'), cachePath: path.join(app.getPath('userData'), 'filters.bin') });
  blocker.load();
  scamList = createScamList({ cachePath: path.join(app.getPath('userData'), 'phishing.txt') });
  scamList.load();
  scamList.refresh().catch(() => {});
  blocker.refresh().catch(() => {}); // weekly list update in the background
  hardenSession(session.defaultSession);
  buildMenu();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('before-quit', () => { if (memory) memory.flush(); saveStats(); writeSession(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
