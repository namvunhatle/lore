// What the New tab page shows (start page). It is built from what is on this computer each time a tab opens, so it changes:
// where you left off, the AI chat you were in, sites you use, a reading list, and one or two hints that fit the moment.
// Nothing here leaves the computer; the page only receives the result.
const DAY = 86400000;

const periodOf = (hour) => (hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night');
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Things to try, when there is nothing else to say. A few are chosen each day, so the page does not repeat itself.
const IDEAS = ['ask', 'compare', 'memory', 'summary', 'translate', 'write', 'download', 'bill'];
function ideasFor(day, n = 2) {
  const out = [];
  for (let i = 0; out.length < n && i < IDEAS.length * 2; i++) { const k = IDEAS[(day * 3 + i * 5) % IDEAS.length]; if (!out.includes(k)) out.push(k); }
  return out;
}

function build(d, now = Date.now()) {
  const hour = new Date(now).getHours();
  const day = Math.floor(now / DAY);
  const out = { period: periodOf(hour), cards: [], tiles: [], tips: [], placeholder: '', private: !!d.private, empty: false };
  if (d.private) return out;
  const seen = new Set();
  const add = (c) => { const key = c.kind + '|' + (c.url || c.key); if (!seen.has(key) && out.cards.length < 4) { seen.add(key); out.cards.push(c); } };

  const chat = (d.chats || []).find((c) => now - c.ts < 7 * DAY);
  if (chat) add({ kind: 'chat', key: chat.key, title: chat.title || chat.preview || chat.host, host: chat.host, ts: chat.ts, count: chat.count });
  for (const p of (d.recent || []).slice(0, 2)) add({ kind: 'page', url: p.url, title: p.title, host: p.host || hostOf(p.url), ts: p.ts });
  const read = (d.reading || [])[0];
  if (read) add({ kind: 'read', url: read.url, title: read.title, host: hostOf(read.url) });
  const closed = (d.closed || [])[0];
  if (closed) add({ kind: 'closed', url: closed.url, title: closed.title, host: hostOf(closed.url) });

  out.tiles = (d.sites || []).slice(0, 8).map((s) => ({ host: s.host, url: s.url, icon: s.icon || '' }));
  out.empty = !out.cards.length && !out.tiles.length;
  out.placeholder = d.recent && d.recent[0] && d.recent[0].title ? 'about:' + d.recent[0].title.slice(0, 40) : '';

  // Hints that fit this moment, most useful first; at most two.
  const tip = (t) => { if (out.tips.length < 2) out.tips.push(t); };
  if (!d.modelReady) tip({ kind: 'setup' });
  if ((d.tabs || 0) >= 8) tip({ kind: 'organize', n: d.tabs });
  if ((d.readingCount || 0) >= 4) tip({ kind: 'reading', n: d.readingCount });
  if (d.download) tip({ kind: 'download', name: d.download });
  if (d.week && d.week.blocked >= 50 && hour >= 17) tip({ kind: 'week', n: d.week.blocked });
  if (out.empty) for (const k of ideasFor(day, 3)) tip({ kind: 'idea', idea: k });
  else if (!out.tips.length) for (const k of ideasFor(day, 1)) tip({ kind: 'idea', idea: k });
  return out;
}

// The sites visited most over the last month, one per host. Items are { url, title, ts }.
function topSites(items, now = Date.now(), n = 8) {
  const m = new Map();
  for (const it of items) {
    if (now - it.ts > 30 * DAY) continue;
    const h = hostOf(it.url);
    if (!h) continue;
    const e = m.get(h) || { host: h, count: 0, ts: 0, url: '' };
    e.count++;
    if (it.ts > e.ts) { e.ts = it.ts; try { e.url = new URL(it.url).origin + '/'; } catch { e.url = it.url; } }
    m.set(h, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.ts - a.ts).slice(0, n);
}

module.exports = { build, topSites, periodOf, ideasFor, IDEAS };
