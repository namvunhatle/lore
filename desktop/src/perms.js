// Site permissions (BRW-18): what the person answered when a site asked for the camera, microphone, location and so on.
// Remembered per profile, listed in Settings, and removable one by one or all at once.
const MAX = 500;

class SitePerms {
  constructor({ load, save } = {}) {
    this._save = save || (() => {});
    const d = load ? load() : null;
    this.map = new Map();
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      for (const [k, v] of Object.entries(d)) if (/^https?:\/\/[^|]+\|[a-zA-Z-]+$/.test(k) && typeof v === 'boolean') this.map.set(k, v);
    }
  }
  _persist() { this._save(Object.fromEntries(this.map)); }
  has(origin, permission) { return this.map.has(origin + '|' + permission); }
  get(origin, permission) { return this.map.get(origin + '|' + permission); }
  set(origin, permission, allowed) {
    if (!/^https?:\/\//.test(origin)) return;
    this.map.set(origin + '|' + permission, !!allowed);
    if (this.map.size > MAX) this.map.delete(this.map.keys().next().value);
    this._persist();
  }
  remove(origin, permission) { if (this.map.delete(origin + '|' + permission)) this._persist(); }
  reset() { this.map.clear(); this._persist(); }
  list() {
    return [...this.map].map(([k, allowed]) => { const i = k.lastIndexOf('|'); return { origin: k.slice(0, i), permission: k.slice(i + 1), allowed }; })
      .sort((a, b) => a.origin.localeCompare(b.origin) || a.permission.localeCompare(b.permission));
  }
}

module.exports = { SitePerms };
