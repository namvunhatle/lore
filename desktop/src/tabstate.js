// Pure tab logic, kept free of Electron so it can be unit tested: what is saved for "continue where I left off",
// the stack of closed tabs, and how a tab moves in the strip. Private tabs and the New tab page are never saved.
const MAX_SAVED = 60;
const MAX_CLOSED = 25;

const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

// Turns the live tab list into what is written to disk.
function snapshot(tabs, activeId) {
  const kept = tabs.filter((t) => !t.private && isWeb(t.url)).slice(0, MAX_SAVED);
  const i = kept.findIndex((t) => t.id === activeId);
  return {
    v: 1,
    active: i < 0 ? 0 : i,
    tabs: kept.map((t) => ({ url: t.url.slice(0, 2000), title: String(t.title || '').slice(0, 200), pinned: !!t.pinned }))
  };
}

// Reads what was written, never trusting it: wrong shapes and non-web addresses are dropped.
function restore(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.tabs)) return { tabs: [], active: 0 };
  const tabs = data.tabs
    .filter((t) => t && isWeb(t.url))
    .slice(0, MAX_SAVED)
    .map((t) => ({ url: t.url.slice(0, 2000), title: typeof t.title === 'string' ? t.title.slice(0, 200) : '', pinned: !!t.pinned }));
  const a = Number.isInteger(data.active) ? data.active : 0;
  return { tabs, active: Math.min(Math.max(a, 0), Math.max(tabs.length - 1, 0)) };
}

// Recently closed tabs, newest last. Private tabs are not remembered.
class ClosedTabs {
  constructor() { this.items = []; }
  push(t) {
    if (!t || t.private || !isWeb(t.url)) return;
    this.items.push({ url: t.url, title: t.title || '', pinned: !!t.pinned });
    if (this.items.length > MAX_CLOSED) this.items.shift();
  }
  pop() { return this.items.pop() || null; }
  get size() { return this.items.length; }
}

// Moves the tab `id` so it sits just before `beforeId` (or at the end when `beforeId` is null). Pinned tabs stay in
// front of the others: a pinned tab cannot be dropped after an unpinned one, nor the reverse.
function reorder(tabs, id, beforeId) {
  const from = tabs.findIndex((t) => t.id === id);
  if (from < 0 || id === beforeId) return tabs;
  const out = tabs.slice();
  const [t] = out.splice(from, 1);
  let to = beforeId == null ? out.length : out.findIndex((x) => x.id === beforeId);
  if (to < 0) to = out.length;
  const pins = out.filter((x) => x.pinned).length;
  to = t.pinned ? Math.min(to, pins) : Math.max(to, pins);
  out.splice(to, 0, t);
  return out;
}

// Pinning moves the tab into the pinned group (at its end); unpinning moves it just after it.
function setPinned(tabs, id, pinned) {
  const t = tabs.find((x) => x.id === id);
  if (!t || !!t.pinned === !!pinned) return tabs;
  const rest = tabs.filter((x) => x !== t);
  t.pinned = !!pinned;
  const pins = rest.filter((x) => x.pinned).length;
  rest.splice(pins, 0, t);
  return rest;
}

// The tab to show after closing the one at index `i` of the list it was removed from.
const nextAfterClose = (remaining, i) => (remaining.length ? remaining[Math.min(i, remaining.length - 1)] : null);

// Ctrl+Tab order. `n` is 1-based for Cmd/Ctrl+1..9, where 9 always means the last tab, as in other browsers.
const cycle = (tabs, id, dir) => { const i = tabs.findIndex((t) => t.id === id); return tabs.length ? tabs[(i + dir + tabs.length) % tabs.length] : null; };
const nth = (tabs, n) => (n >= 9 ? tabs[tabs.length - 1] : tabs[n - 1]) || null;

module.exports = { snapshot, restore, ClosedTabs, reorder, setPinned, nextAfterClose, cycle, nth, isWeb, MAX_CLOSED };
