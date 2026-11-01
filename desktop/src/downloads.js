// Downloads manager (BRW-04): every file the browser saves, not only media. The list lives in memory for this run; the
// files are in the user's Downloads folder. Electron's DownloadItem is wrapped so the window sees plain data.
const fs = require('fs');
const path = require('path');

// Files that run code when opened. Not blocked (people do download installers), but never opened without asking.
const RISKY = new Set(['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'jse', 'wsf', 'jar', 'sh', 'command', 'app', 'dmg', 'pkg', 'apk', 'deb', 'rpm', 'appimage', 'lnk', 'reg', 'hta', 'dll', 'iso']);
const extOf = (name) => path.extname(String(name || '')).slice(1).toLowerCase();
const isRisky = (name) => RISKY.has(extOf(name));

// A file name that is safe on every system and cannot climb out of the Downloads folder.
function safeName(name) {
  const base = path.basename(String(name || '').replace(/[\\/]+/g, '/')).replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim();
  return (base || 'download').slice(0, 180);
}

// "report.pdf" -> "report (1).pdf" -> "report (2).pdf" when the name is already taken.
function uniquePath(dir, name, exists = fs.existsSync) {
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name);
  for (let i = 1; exists(p) && i < 1000; i++) p = path.join(dir, `${stem} (${i})${ext}`);
  return p;
}

class DownloadList {
  constructor({ dir, onChange = () => {}, exists = fs.existsSync } = {}) {
    this.dir = dir;
    this.onChange = onChange;
    this.exists = exists;
    this.items = [];   // newest first
    this.live = new Map(); // id -> Electron DownloadItem
    this.seq = 0;
  }

  // Called from the session's 'will-download'. `askWhere` leaves the save dialog to Electron ("Save image as…").
  track(item, { askWhere = false, private: priv = false } = {}) {
    const id = ++this.seq;
    const name = safeName(item.getFilename());
    const rec = { id, name, url: safeUrl(item.getURL()), host: hostOf(item.getURL()), state: 'progressing', received: 0, total: item.getTotalBytes() || 0, path: '', risky: isRisky(name), paused: false, started: Date.now(), private: !!priv };
    if (!askWhere) { rec.path = uniquePath(this.dir, name, this.exists); item.setSavePath(rec.path); rec.name = path.basename(rec.path); }
    this.items.unshift(rec);
    this.live.set(id, item);
    const sync = () => {
      rec.received = item.getReceivedBytes();
      rec.total = item.getTotalBytes() || rec.total;
      rec.paused = item.isPaused();
      const p = item.getSavePath && item.getSavePath();
      if (p) { rec.path = p; rec.name = path.basename(p); rec.risky = isRisky(rec.name); }
      this.onChange(rec);
    };
    item.on('updated', (_e, state) => { rec.state = state === 'interrupted' ? 'interrupted' : 'progressing'; sync(); });
    item.once('done', (_e, state) => {
      rec.state = state === 'completed' ? 'done' : state === 'cancelled' ? 'cancelled' : 'failed';
      this.live.delete(id);
      sync();
    });
    this.onChange(rec, true);
    return rec;
  }

  get(id) { return this.items.find((r) => r.id === id); }
  pause(id) { const i = this.live.get(id); if (i && !i.isPaused()) i.pause(); }
  resume(id) { const i = this.live.get(id); if (i && i.canResume()) i.resume(); }
  cancel(id) { const i = this.live.get(id); if (i) i.cancel(); }
  remove(id) { this.cancel(id); this.items = this.items.filter((r) => r.id !== id); this.onChange(null); }
  clearFinished() { this.items = this.items.filter((r) => r.state === 'progressing' || r.state === 'interrupted'); this.onChange(null); }
  get active() { return this.items.filter((r) => r.state === 'progressing').length; }

  // What the window and the toolbar need: no Electron objects, no private-tab file names unless asked.
  view() { return this.items.map((r) => ({ ...r })); }
}

function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }
// Only the address up to the query, so tokens in a download link never reach the window.
function safeUrl(u) { try { const x = new URL(u); return x.origin + x.pathname; } catch { return ''; } }

module.exports = { DownloadList, safeName, uniquePath, isRisky, extOf };
