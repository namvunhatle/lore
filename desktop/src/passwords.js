// Saved logins (BRW-12). Kept in a file encrypted with the operating system's keychain, one per profile. A password goes to
// a page only when the person asks to fill it, and only to the site it was saved for; it is never filled by itself.
const crypto = require('crypto');

const MAX = 2000;
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ', LOWER = 'abcdefghijkmnopqrstuvwxyz', DIGIT = '23456789', SYM = '!@#$%^&*-_=+?';

const siteOf = (host) => String(host || '').toLowerCase().replace(/^www\./, '');

class Vault {
  constructor({ load, save } = {}) {
    this._save = save || (() => {});
    const d = load ? load() : null;
    const raw = d && !Array.isArray(d) && Array.isArray(d.items) ? d.items : [];
    this.items = raw.filter((x) => x && typeof x.site === 'string' && typeof x.pass === 'string' && x.site).slice(0, MAX).map((x) => ({
      id: Number(x.id) || 0, site: siteOf(x.site).slice(0, 100), user: String(x.user || '').slice(0, 200), pass: x.pass.slice(0, 500), ts: Number(x.ts) || Date.now()
    }));
    this.seq = this.items.reduce((m, x) => Math.max(m, x.id), 0);
    for (const x of this.items) if (!x.id) x.id = ++this.seq;
    this.never = new Set(Array.isArray(d && d.never) ? d.never.filter((h) => typeof h === 'string').slice(0, 500) : []);
  }
  _persist() { this._save({ v: 1, items: this.items, never: [...this.never] }); }

  forSite(host) { const s = siteOf(host); return this.items.filter((x) => x.site === s); }
  // What a save would do: nothing (already saved), an update (same site and user, new password), or a new entry.
  classify(host, user, pass) {
    const same = this.forSite(host).find((x) => x.user === user);
    if (this.never.has(siteOf(host))) return 'never';
    if (!same) return 'new';
    return same.pass === pass ? 'same' : 'update';
  }
  save({ host, user = '', pass }) {
    if (!siteOf(host) || !pass) return null;
    const s = siteOf(host);
    const u = String(user).slice(0, 200);
    let x = this.items.find((i) => i.site === s && i.user === u);
    if (x) { x.pass = String(pass).slice(0, 500); x.ts = Date.now(); } else { x = { id: ++this.seq, site: s, user: u, pass: String(pass).slice(0, 500), ts: Date.now() }; this.items.push(x); if (this.items.length > MAX) this.items.shift(); }
    this._persist();
    return x.id;
  }
  remove(id) { const n = this.items.length; this.items = this.items.filter((x) => x.id !== id); if (n !== this.items.length) this._persist(); }
  neverFor(host) { this.never.add(siteOf(host)); this._persist(); }
  get(id) { return this.items.find((x) => x.id === id); }

  // For the list: no passwords, only whether a password is reused on another site.
  view() {
    const count = new Map();
    for (const x of this.items) count.set(x.pass, (count.get(x.pass) || new Set()).add(x.site));
    return this.items.map((x) => ({ id: x.id, site: x.site, user: x.user, ts: x.ts, reused: count.get(x.pass).size > 1, weak: weak(x.pass) })).sort((a, b) => a.site.localeCompare(b.site) || a.user.localeCompare(b.user));
  }
}

const weak = (p) => p.length < 8 || /^(.)\1+$/.test(p) || ['password', '123456', '12345678', 'qwerty', 'abc123', 'iloveyou'].includes(p.toLowerCase());

// A strong random password: at least one of each kind, never biased by modulo.
function generate(length = 20, rand = (n) => crypto.randomInt(n)) {
  const all = UPPER + LOWER + DIGIT + SYM;
  const pick = (set) => set[rand(set.length)];
  const out = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYM)];
  while (out.length < Math.max(12, Math.min(64, length))) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) { const j = rand(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

module.exports = { Vault, generate, siteOf };
