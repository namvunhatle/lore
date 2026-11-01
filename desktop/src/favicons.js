// Small site icons kept on this device so the Memory list can show them without contacting any site.
// An icon is saved once per host while the user browses (the page already loaded it), as a data URL in an encrypted file.
const MAX_BYTES = 24 * 1024;
const MAX_HOSTS = 500;
const TYPES = /^image\/(png|x-icon|vnd\.microsoft\.icon|jpeg|gif|webp)$/i;

const valid = (u) => typeof u === 'string' && /^data:image\/(png|x-icon|vnd\.microsoft\.icon|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(u) && u.length <= MAX_BYTES * 1.4;

class Favicons {
  constructor(store) {
    const raw = store.load();
    this.store = store;
    this.map = raw && !Array.isArray(raw) && typeof raw === 'object' ? Object.fromEntries(Object.entries(raw).filter(([, v]) => valid(v))) : {};
  }
  get(host) { return this.map[host] || ''; }
  has(host) { return !!this.map[host]; }
  set(host, dataUrl) {
    if (!host || !valid(dataUrl)) return false;
    delete this.map[host];
    this.map[host] = dataUrl; // most recent last
    const keys = Object.keys(this.map);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_HOSTS))) delete this.map[k];
    this.store.save(this.map);
    return true;
  }
  remove(host) { if (host in this.map) { delete this.map[host]; this.store.save(this.map); } }
  clear() { this.map = {}; this.store.save(this.map); }
}

// Reads an icon response into a data URL, or '' when it is not a small raster image.
async function toDataUrl(res) {
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!res.ok || !TYPES.test(type)) return '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return '';
  return 'data:' + type.toLowerCase() + ';base64,' + buf.toString('base64');
}

module.exports = { Favicons, toDataUrl, valid, MAX_BYTES };
