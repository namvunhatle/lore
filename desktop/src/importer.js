// Bringing data over from another browser (BRW-14). Reads, never writes: bookmarks and history from Chrome, Edge, Brave,
// Vivaldi, Cốc Cốc, Arc, Dia, Helium and Firefox on this computer, or from a bookmarks file any browser can export. Passwords are not
// imported (they sit in each system's keychain and are encrypted with keys Lore cannot, and should not, reach).
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_BOOKMARKS = 5000;
const MAX_HISTORY = 3000;
const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= 2000;

// ---- Where each browser keeps its data ------------------------------------------------------------------------------
const CHROMIUM = [
  { id: 'chrome', name: 'Google Chrome', mac: 'Google/Chrome', win: 'Google/Chrome/User Data', linux: 'google-chrome' },
  { id: 'edge', name: 'Microsoft Edge', mac: 'Microsoft Edge', win: 'Microsoft/Edge/User Data', linux: 'microsoft-edge' },
  { id: 'brave', name: 'Brave', mac: 'BraveSoftware/Brave-Browser', win: 'BraveSoftware/Brave-Browser/User Data', linux: 'BraveSoftware/Brave-Browser' },
  { id: 'vivaldi', name: 'Vivaldi', mac: 'Vivaldi', win: 'Vivaldi/User Data', linux: 'vivaldi' },
  { id: 'coccoc', name: 'Cốc Cốc', mac: 'Coccoc', win: 'CocCoc/Browser/User Data', linux: 'coccoc' },
  // Arc on Windows is a Store (MSIX) app, so its data sits inside the package folder. Arc keeps its sidebar outside
  // Chromium's Bookmarks file, so it brings history alone. Dia's Windows folder is not known yet; neither has Linux.
  { id: 'arc', name: 'Arc', mac: 'Arc/User Data', win: 'Packages/TheBrowserCompany.Arc_ttt1ap7aakyb4/LocalCache/Local/Arc/User Data' },
  { id: 'dia', name: 'Dia', mac: 'Dia/User Data' },
  { id: 'helium', name: 'Helium', mac: 'net.imput.helium', win: 'imput/Helium/User Data', linux: 'net.imput.helium' }
];

function roots({ platform, home, env }) {
  if (platform === 'darwin') return { chromium: path.join(home, 'Library', 'Application Support'), firefox: path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles') };
  if (platform === 'win32') return { chromium: env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), firefox: path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Mozilla', 'Firefox', 'Profiles') };
  return { chromium: path.join(home, '.config'), firefox: path.join(home, '.mozilla', 'firefox') };
}

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const dirs = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };

// Browsers that have data worth importing on this computer.
function detect({ platform = process.platform, home = process.env.LORE_IMPORT_HOME || os.homedir(), env = process.env } = {}) {
  const r = roots({ platform, home, env });
  const key = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : 'linux';
  const found = [];
  for (const b of CHROMIUM) {
    if (!b[key]) continue;
    const base = path.join(r.chromium, b[key]);
    const local = readJson(path.join(base, 'Local State'));
    const names = (local && local.profile && local.profile.info_cache) || {};
    const profiles = dirs(base).filter((d) => /^(Default|Profile \d+)$/.test(d) && (fs.existsSync(path.join(base, d, 'Bookmarks')) || fs.existsSync(path.join(base, d, 'History'))))
      .map((d) => ({ id: d, name: (names[d] && names[d].name) || d, dir: path.join(base, d) }))
      .filter((p) => !p.name.startsWith('__')); // a browser's own internal profile, such as Arc's __ARC_SYSTEM_PROFILE
    // Arc has no Bookmarks file at all, so the window should not offer them.
    const bookmarks = profiles.some((p) => fs.existsSync(path.join(p.dir, 'Bookmarks')));
    if (profiles.length) found.push({ id: b.id, name: b.name, kind: 'chromium', bookmarks, profiles });
  }
  const ff = dirs(r.firefox).filter((d) => fs.existsSync(path.join(r.firefox, d, 'places.sqlite')))
    .map((d) => ({ id: d, name: d.replace(/^[a-z0-9]{8}\./i, ''), dir: path.join(r.firefox, d) }));
  if (ff.length) found.push({ id: 'firefox', name: 'Firefox', kind: 'firefox', bookmarks: true, profiles: ff });
  return found;
}

// ---- Reading ----------------------------------------------------------------------------------------------------------
// Chromium keeps time as microseconds since 1601 (too big for a JavaScript number in SQLite, so history is divided in the
// query); Firefox as microseconds since 1970.
const chromeTime = (us) => Math.round(Number(us) / 1000 - 11644473600000);
const firefoxTime = (us) => Math.round(Number(us) / 1000);

// Items directly on the bookmarks bar stay at the top level; items inside a folder keep that folder's name (one level).
function chromiumBookmarks(json, otherLabel) {
  const out = [];
  const walk = (node, folder) => {
    for (const c of (node && node.children) || []) {
      if (c.type === 'url' && isWeb(c.url)) out.push({ url: c.url, title: String(c.name || c.url).slice(0, 300), folder: String(folder || '').slice(0, 60), ts: chromeTime(c.date_added) });
      else if (c.type === 'folder') walk(c, folder === '' || folder === otherLabel ? String(c.name || '') : folder);
    }
  };
  const r = (json && json.roots) || {};
  walk(r.bookmark_bar, '');
  walk(r.other, otherLabel);
  walk(r.synced, otherLabel);
  return out.slice(0, MAX_BOOKMARKS);
}

function withCopy(files, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-import-'));
  try {
    const copies = files.map((f) => { if (!fs.existsSync(f)) return null; const c = path.join(tmp, path.basename(f)); fs.copyFileSync(f, c); return c; });
    return fn(copies);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function sqlite(file, run) {
  const { DatabaseSync } = require('node:sqlite'); // loaded only when needed; Electron's Node has it
  const db = new DatabaseSync(file, { readOnly: true });
  try { return run(db); } finally { db.close(); }
}

function chromiumHistory(profileDir, limit = MAX_HISTORY) {
  return withCopy([path.join(profileDir, 'History')], ([copy]) => {
    if (!copy) return [];
    return sqlite(copy, (db) => db.prepare('SELECT url, title, last_visit_time / 1000 AS t FROM urls WHERE hidden = 0 AND last_visit_time > 0 ORDER BY last_visit_time DESC LIMIT ?').all(limit * 2))
      .filter((r) => isWeb(r.url)).slice(0, limit).map((r) => ({ url: r.url, title: String(r.title || '').slice(0, 300), ts: r.t - 11644473600000 }));
  });
}

function firefoxHistory(profileDir, limit = MAX_HISTORY) {
  return withCopy([path.join(profileDir, 'places.sqlite'), path.join(profileDir, 'places.sqlite-wal')], ([db0]) => {
    if (!db0) return [];
    return sqlite(db0, (db) => db.prepare('SELECT url, title, last_visit_date AS t FROM moz_places WHERE last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT ?').all(limit * 2))
      .filter((r) => isWeb(r.url)).slice(0, limit).map((r) => ({ url: r.url, title: String(r.title || '').slice(0, 300), ts: firefoxTime(r.t) }));
  });
}

function firefoxBookmarks(profileDir, otherLabel) {
  return withCopy([path.join(profileDir, 'places.sqlite'), path.join(profileDir, 'places.sqlite-wal')], ([db0]) => {
    if (!db0) return [];
    const rows = sqlite(db0, (db) => ({
      nodes: db.prepare('SELECT id, type, parent, title, fk, dateAdded FROM moz_bookmarks').all(),
      places: new Map(db.prepare('SELECT id, url, title FROM moz_places').all().map((p) => [p.id, p]))
    }));
    const byId = new Map(rows.nodes.map((n) => [n.id, n]));
    // 1 root, 2 menu, 3 toolbar, 4 tags, 5 other, 6 mobile
    const chain = (n) => { const c = []; for (let x = n, i = 0; x && i < 20; x = byId.get(x.parent), i++) c.push(x); return c; };
    const out = [];
    for (const n of rows.nodes) {
      if (n.type !== 1 || !rows.places.has(n.fk)) continue;
      const p = rows.places.get(n.fk);
      if (!isWeb(p.url)) continue;
      const c = chain(n);
      if (c.some((x) => x.id === 4)) continue; // tags
      const top = c.find((x) => [2, 3, 5, 6].includes(x.parent) && x.type === 2); // the folder just under a root
      let folder = '';
      if (top) folder = String(top.title || '');
      else if (n.parent === 5 || n.parent === 2 || n.parent === 6) folder = otherLabel;
      out.push({ url: p.url, title: String(n.title || p.title || p.url).slice(0, 300), folder: folder.slice(0, 60), ts: Math.round(Number(n.dateAdded || 0) / 1000) });
    }
    return out.slice(0, MAX_BOOKMARKS);
  });
}

// A bookmarks file exported from any browser (the Netscape format).
function parseNetscape(html, otherLabel = '') {
  const out = [];
  const stack = [];
  const dec = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
  const re = /<(\/?)(DL|H3|A)\b([^>]*)>([^<]*)/gi;
  let m, pendingFolder = null;
  while ((m = re.exec(String(html || ''))) !== null) {
    const [, close, tag, attrs, text] = m;
    const t = tag.toUpperCase();
    if (t === 'H3' && !close) pendingFolder = dec(text).trim();
    else if (t === 'DL' && !close) { stack.push(pendingFolder); pendingFolder = null; }
    else if (t === 'DL' && close) stack.pop();
    else if (t === 'A' && !close) {
      const href = /HREF="([^"]*)"/i.exec(attrs);
      const url = href ? dec(href[1]) : '';
      if (!isWeb(url)) continue;
      const named = stack.filter(Boolean);
      // The first named folder is usually the bar or menu itself; the one under it is the folder we keep.
      const folder = named.length >= 2 ? named[1] : named.length === 1 ? '' : otherLabel;
      const add = /ADD_DATE="(\d+)"/i.exec(attrs);
      out.push({ url, title: (dec(text).trim() || url).slice(0, 300), folder: String(folder).slice(0, 60), ts: add ? Number(add[1]) * 1000 : 0 });
    }
  }
  return out.slice(0, MAX_BOOKMARKS);
}

function readFile(file, otherLabel) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.length > 20 * 1048576) throw new Error('file too large');
  return parseNetscape(text, otherLabel);
}

// Everything a source offers. `what` is { bookmarks, history }. Returns counts the window can show, and the items.
function read(source, profile, what, { otherLabel = '' } = {}) {
  const out = { bookmarks: [], history: [], errors: [] };
  const run = (key, fn) => { try { out[key] = fn(); } catch (e) { out.errors.push(key + ': ' + String(e && e.message || e).slice(0, 120)); } };
  if (source.kind === 'chromium') {
    if (what.bookmarks) run('bookmarks', () => chromiumBookmarks(readJson(path.join(profile.dir, 'Bookmarks')), otherLabel));
    if (what.history) run('history', () => chromiumHistory(profile.dir));
  } else if (source.kind === 'firefox') {
    if (what.bookmarks) run('bookmarks', () => firefoxBookmarks(profile.dir, otherLabel));
    if (what.history) run('history', () => firefoxHistory(profile.dir));
  }
  return out;
}

module.exports = { detect, read, readFile, parseNetscape, chromiumBookmarks, chromeTime, firefoxTime, isWeb, MAX_BOOKMARKS, MAX_HISTORY };
