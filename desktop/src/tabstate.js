// Pure tab logic, kept free of Electron so it can be unit tested: what is saved for "continue where I left off",
// the stack of closed tabs, and how a tab moves in the strip. Private tabs and the New tab page are never saved.
const MAX_SAVED = 60;
const MAX_CLOSED = 25;

const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

// Turns the live tab list into what is written to disk.
function snapshot(tabs, activeId, groups = []) {
  const kept = tabs.filter((t) => !t.private && isWeb(t.url)).slice(0, MAX_SAVED);
  const i = kept.findIndex((t) => t.id === activeId);
  const used = new Set(kept.map((t) => t.group).filter(Boolean));
  const at = new Map(kept.map((t, n) => [t.id, n]));
  return {
    v: 2,
    active: i < 0 ? 0 : i,
    groups: groups.filter((g) => used.has(g.id)).map((g) => ({ id: g.id, name: String(g.name || '').slice(0, 30), color: String(g.color || ''), collapsed: !!g.collapsed })),
    tabs: kept.map((t) => ({ url: t.url.slice(0, 2000), title: String(t.title || '').slice(0, 200), pinned: !!t.pinned, group: t.group || 0, parent: t.pinned || !at.has(t.parent) ? -1 : at.get(t.parent) }))
  };
}

// Reads what was written, never trusting it: wrong shapes and non-web addresses are dropped.
function restore(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.tabs)) return { tabs: [], groups: [], active: 0 };
  const groups = (Array.isArray(data.groups) ? data.groups : [])
    .filter((g) => g && Number.isInteger(g.id) && g.id > 0)
    .map((g) => ({ id: g.id, name: typeof g.name === 'string' ? g.name.slice(0, 30) : '', color: typeof g.color === 'string' ? g.color.slice(0, 12) : '', collapsed: !!g.collapsed }));
  const known = new Set(groups.map((g) => g.id));
  const tabs = data.tabs
    .filter((t) => t && isWeb(t.url))
    .slice(0, MAX_SAVED)
    .map((t) => ({ url: t.url.slice(0, 2000), title: typeof t.title === 'string' ? t.title.slice(0, 200) : '', pinned: !!t.pinned, group: known.has(t.group) ? t.group : 0, parent: t.parent }));
  // A parent must be an earlier, unpinned tab: that rules out itself and loops.
  tabs.forEach((t, n) => { const p = t.parent; t.parent = !t.pinned && Number.isInteger(p) && p >= 0 && p < n && !tabs[p].pinned ? p : -1; });
  const a = Number.isInteger(data.active) ? data.active : 0;
  return { tabs, groups, active: Math.min(Math.max(a, 0), Math.max(tabs.length - 1, 0)) };
}

// Reading trail: `parent` is the id of the tab a tab was opened from (0 = none). Normal tabs and private tabs never
// share a tree, and pinned tabs are never part of one.
const canParent = (parent, child) => !!parent && !!child && !parent.pinned && !child.pinned && !!parent.private === !!child.private;

function depth(tabs, id) {
  let d = 0;
  for (let t = tabs.find((x) => x.id === id); t && t.parent && d < 50; d++) t = tabs.find((x) => x.id === t.parent);
  return d;
}

const below = (tabs, t, id) => { for (let p = t, n = 0; p && p.parent && n < 50; n++) { if (p.parent === id) return true; p = tabs.find((x) => x.id === p.parent); } return false; };

// Where a new child of `parentId` goes: just after the last tab already below it.
function childSlot(tabs, parentId) {
  const i = tabs.findIndex((t) => t.id === parentId);
  if (i < 0) return tabs.length;
  let end = i;
  tabs.forEach((t, n) => { if (n > i && below(tabs, t, parentId)) end = n; });
  return end + 1;
}

// Before a tab goes away: its children move up one level, to its own parent.
function release(tabs, id) {
  const t = tabs.find((x) => x.id === id);
  if (t) for (const c of tabs) if (c.parent === id) c.parent = t.parent || 0;
  return tabs;
}

// Cuts a tab out of the tree (dragged elsewhere, pinned); its children stay with its former parent.
function detach(tabs, id) {
  release(tabs, id);
  const t = tabs.find((x) => x.id === id);
  if (t) t.parent = 0;
  return tabs;
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

// Keeps every group in one piece: the members of a group sit together, at the place of its first member.
// Pinned tabs stay in front and are never part of a group.
function arrange(tabs) {
  const out = [];
  const done = new Set();
  const pins = tabs.filter((t) => t.pinned);
  for (const t of pins) { t.group = 0; out.push(t); done.add(t); }
  for (const t of tabs) {
    if (done.has(t)) continue;
    out.push(t); done.add(t);
    if (t.group) for (const m of tabs) if (!done.has(m) && m.group === t.group) { out.push(m); done.add(m); }
  }
  return out;
}

// After a tab is dropped at a new place: dropped between two members of a group it joins that group; dropped away from
// its own group it leaves it.
function settle(tabs, id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i < 0) return tabs;
  const t = tabs[i];
  const l = tabs[i - 1], r = tabs[i + 1];
  if (!t.pinned) {
    if (l && r && l.group && l.group === r.group) t.group = l.group;
    else if (t.group && !((l && l.group === t.group) || (r && r.group === t.group))) t.group = 0;
  }
  return tabs;
}

// Applies a plan [{ groupId, ids }] to the tabs: those tabs join the group, then groups are gathered.
function assign(tabs, plan) {
  for (const p of plan) for (const id of p.ids) { const t = tabs.find((x) => x.id === id); if (t && !t.pinned) t.group = p.groupId; }
  return arrange(tabs);
}

module.exports = { canParent, depth, childSlot, release, detach, arrange, settle, assign, snapshot, restore, ClosedTabs, reorder, setPinned, nextAfterClose, cycle, nth, isWeb, MAX_CLOSED };
