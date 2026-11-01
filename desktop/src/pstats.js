// Daily privacy counters (PRV-04): what Lore blocked or changed, per day, kept on this computer for 30 days. Only counts and
// the names of tracker hosts that were blocked; never page addresses.
const fs = require('fs');

const KEEP_DAYS = 30;
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

class PrivacyStats {
  constructor({ file } = {}) {
    this.file = file;
    this.days = {};
    this.dirty = false;
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && j.days && typeof j.days === 'object') this.days = j.days; } catch { /* first run */ }
    this.prune();
  }
  _day(now) { return (this.days[dayKey(now)] ||= { blocked: 0, params: 0, https: 0, top: {} }); }
  // kind: 'blocked' (host = the tracker), 'params' (n removed), 'https' (one upgrade)
  record(kind, host = '', n = 1, now = Date.now()) {
    if (!['blocked', 'params', 'https'].includes(kind)) return;
    const d = this._day(now);
    d[kind] += n;
    if (kind === 'blocked' && host) {
      d.top[host] = (d.top[host] || 0) + n;
      const names = Object.keys(d.top);
      if (names.length > 60) { const low = names.sort((a, b) => d.top[a] - d.top[b])[0]; delete d.top[low]; }
    }
    this.dirty = true;
  }
  today(now = Date.now()) { return { ...this._day(now) }; }
  // The last 7 days, oldest first, with totals and the busiest tracker hosts.
  week(now = Date.now()) {
    const days = [];
    const top = {};
    const total = { blocked: 0, params: 0, https: 0 };
    for (let i = 6; i >= 0; i--) {
      const k = dayKey(now - i * 86400000);
      const d = this.days[k] || { blocked: 0, params: 0, https: 0, top: {} };
      days.push({ day: k, blocked: d.blocked, params: d.params, https: d.https });
      for (const t of ['blocked', 'params', 'https']) total[t] += d[t];
      for (const [h, n] of Object.entries(d.top || {})) top[h] = (top[h] || 0) + n;
    }
    return { days, total, top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([host, count]) => ({ host, count })) };
  }
  prune(now = Date.now()) {
    const cut = dayKey(now - KEEP_DAYS * 86400000);
    for (const k of Object.keys(this.days)) if (k < cut) delete this.days[k];
  }
  save() {
    if (!this.dirty || !this.file) return;
    try { fs.writeFileSync(this.file, JSON.stringify({ v: 1, days: this.days })); this.dirty = false; } catch { /* best effort */ }
  }
  clear() { this.days = {}; this.dirty = true; this.save(); }
}

module.exports = { PrivacyStats, dayKey };
