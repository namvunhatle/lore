// Profiles (PRV-14): separate worlds for work, personal and the rest. A profile has its own logins and site data, open tabs,
// memory, bookmarks and favicons. Settings, tasks and the AI model are shared. Pure code: the folder layout and the list
// of profiles, so it can be tested without Electron.
const path = require('path');

const COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'grey'];
const DEFAULT_ID = 'default';
const MAX = 12;

const clean = (name) => String(name == null ? '' : name).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);

class ProfileList {
  constructor({ load, save } = {}) {
    this._save = save || (() => {});
    const d = load ? load() : null;
    const raw = d && Array.isArray(d.items) ? d.items : [];
    this.items = raw.filter((p) => p && typeof p.id === 'string' && /^[a-z0-9-]{1,24}$/.test(p.id))
      .slice(0, MAX).map((p, i) => ({ id: p.id, name: clean(p.name) || 'Profile', color: COLORS.includes(p.color) ? p.color : COLORS[i % COLORS.length] }));
    if (!this.items.some((p) => p.id === DEFAULT_ID)) this.items.unshift({ id: DEFAULT_ID, name: 'Personal', color: COLORS[0] });
    this.active = this.items.some((p) => p.id === (d && d.active)) ? d.active : DEFAULT_ID;
  }

  persist() { this._save({ v: 1, active: this.active, items: this.items }); }
  get(id) { return this.items.find((p) => p.id === id) || null; }
  get current() { return this.get(this.active); }

  create(name, color) {
    if (this.items.length >= MAX) return null;
    let id;
    do { id = 'p' + Math.random().toString(36).slice(2, 8); } while (this.get(id));
    const p = { id, name: clean(name) || 'Profile ' + (this.items.length + 1), color: COLORS.includes(color) ? color : COLORS[this.items.length % COLORS.length] };
    this.items.push(p);
    this.persist();
    return p;
  }

  update(id, patch) {
    const p = this.get(id);
    if (!p) return null;
    if (typeof patch.name === 'string' && clean(patch.name)) p.name = clean(patch.name);
    if (COLORS.includes(patch.color)) p.color = patch.color;
    this.persist();
    return p;
  }

  setActive(id) { if (!this.get(id)) return false; this.active = id; this.persist(); return true; }

  // The last profile cannot be removed. Removing the active one moves to the first that is left.
  remove(id) {
    if (this.items.length <= 1 || !this.get(id)) return false;
    this.items = this.items.filter((p) => p.id !== id);
    if (this.active === id) this.active = this.items[0].id;
    this.persist();
    return true;
  }
}

// Where a profile keeps its files. The first profile keeps using the app's own folder, so nothing moves for people who
// already have data.
const dirFor = (root, id) => (id === DEFAULT_ID ? root : path.join(root, 'profiles', id));
const partitionFor = (id) => (id === DEFAULT_ID ? '' : 'persist:profile-' + id);

module.exports = { ProfileList, dirFor, partitionFor, COLORS, DEFAULT_ID, MAX };
