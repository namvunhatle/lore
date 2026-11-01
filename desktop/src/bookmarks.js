// Bookmarks (BRW-02): pages the user chose to keep. One level of folders is enough for most people; the bar shows the
// top level. Stored encrypted with the other local data, and exported as the HTML file every browser can import.
const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const MAX = 5000;

class Bookmarks {
  constructor({ load, save } = {}) {
    this._save = save || (() => {});
    const d = load ? load() : null;
    const raw = d && !Array.isArray(d) && Array.isArray(d.items) ? d.items : [];
    this.items = raw.filter((b) => b && isWeb(b.url)).slice(0, MAX).map((b) => ({
      id: Number(b.id) || 0, url: b.url.slice(0, 2000), title: String(b.title || '').slice(0, 300), folder: String(b.folder || '').slice(0, 60), ts: Number(b.ts) || Date.now()
    }));
    this.bar = !!(d && !Array.isArray(d) && d.bar);
    this.seq = this.items.reduce((m, b) => Math.max(m, b.id), 0);
    for (const b of this.items) if (!b.id) b.id = ++this.seq;
  }

  _persist() { this._save({ v: 1, bar: this.bar, items: this.items }); }

  find(url) { return this.items.find((b) => b.url === url) || null; }

  add({ url, title = '', folder = '' }) {
    if (!isWeb(url)) return null;
    const had = this.find(url);
    if (had) return had;
    if (this.items.length >= MAX) return null;
    const b = { id: ++this.seq, url: url.slice(0, 2000), title: String(title || url).slice(0, 300), folder: String(folder || '').slice(0, 60), ts: Date.now() };
    this.items.push(b);
    this._persist();
    return b;
  }

  // The star button: adds the page, or removes it when it is already saved.
  toggle(url, title) {
    const had = this.find(url);
    if (had) { this.remove(had.id); return { added: false, item: had }; }
    const item = this.add({ url, title });
    return { added: !!item, item };
  }

  update(id, patch) {
    const b = this.items.find((x) => x.id === id);
    if (!b) return null;
    if (typeof patch.title === 'string') b.title = patch.title.trim().slice(0, 300) || b.title;
    if (typeof patch.folder === 'string') b.folder = patch.folder.trim().slice(0, 60);
    if (typeof patch.url === 'string' && isWeb(patch.url)) b.url = patch.url.slice(0, 2000);
    this._persist();
    return b;
  }

  remove(id) {
    const n = this.items.length;
    this.items = this.items.filter((b) => b.id !== id);
    if (this.items.length !== n) this._persist();
    return this.items.length !== n;
  }

  setBar(on) { this.bar = !!on; this._persist(); }

  folders() { return [...new Set(this.items.map((b) => b.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }

  // Newest first inside a folder; a plain text match on title, address and folder.
  list({ q = '', folder } = {}) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return this.items
      .filter((b) => (folder === undefined || b.folder === folder) && words.every((w) => (b.title + ' ' + b.url + ' ' + b.folder).toLowerCase().includes(w)))
      .sort((a, b) => b.ts - a.ts);
  }

  // The bar: top-level bookmarks in the order they were added, then one entry per folder.
  barItems() {
    const top = this.items.filter((b) => !b.folder).sort((a, b) => a.ts - b.ts).map((b) => ({ type: 'link', id: b.id, title: b.title, url: b.url }));
    const dirs = this.folders().map((f) => ({ type: 'folder', title: f, count: this.items.filter((b) => b.folder === f).length }));
    return [...top, ...dirs];
  }

  // Netscape bookmark file, understood by Chrome, Edge, Firefox and Safari.
  exportHtml() {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const row = (b) => `    <DT><A HREF="${esc(b.url)}" ADD_DATE="${Math.floor(b.ts / 1000)}">${esc(b.title)}</A>`;
    const out = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">', '<TITLE>Bookmarks</TITLE>', '<H1>Bookmarks</H1>', '<DL><p>'];
    for (const b of this.items.filter((x) => !x.folder)) out.push(row(b));
    for (const f of this.folders()) {
      out.push(`    <DT><H3>${esc(f)}</H3>`, '    <DL><p>');
      for (const b of this.items.filter((x) => x.folder === f)) out.push('    ' + row(b));
      out.push('    </DL><p>');
    }
    out.push('</DL><p>');
    return out.join('\n');
  }
}

module.exports = { Bookmarks, isWeb };
