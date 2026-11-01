// ---- Tabs in a sidebar -------------------------------------------------------------------------------------------
// Drawn in two places: docked in the window (ui.js) and sliding over pages when hidden (side-peek.js).
// Unlike the strip, the sidebar keeps its elements between renders (keyed by tab id) and only patches what changed.
// State arrives many times a second while pages load; rebuilding would drop hover and press states mid-gesture.
const sideStore = { pins: new Map(), list: new Map() };
let sideDrawn = false;
// Tabs whose outline is open, and the newest state (the outline is redrawn when one is toggled).
const tocOpen = new Set();
let lastSide = null;
let sideActive = 0;
const EASE = 'cubic-bezier(.23,1,.32,1)';
const calmSide = matchMedia('(prefers-reduced-motion: reduce)');

// Motion here only follows a pointer action: a tab arriving in the background, a click on ×, a drop, a group opened.
// Keyboard actions (Cmd+T, Cmd+W, Cmd+1…9) change the list at once; they happen too often to wait for.
let pointerIntent = 0;
const byPointer = () => performance.now() - pointerIntent < 700;
const markPointer = () => { pointerIntent = performance.now(); };

// Puts the keyed elements of `items` into `box` in order: makes the missing ones, patches the rest, drops the gone ones.
// When `animate` is on, rows that stay slide from where they were (FLIP, transform only), new rows fade in with a
// short stagger, and removed rows fade out where they stood. Exit is quicker than enter, and done before the gap closes.
// `still` names a key that must not slide: the row just dropped, which is already where the pointer left it.
let renderSeq = 0;
let lastPinSig = null;
function keyed(box, store, items, animate, still) {
  // Where each row is on screen (mid-slide included) and where the layout puts it (offsetTop ignores transforms).
  const before = new Map();
  if (animate) for (const [k, el] of store) if (el.isConnected) { const r = el.getBoundingClientRect(); before.set(k, { top: r.top, left: r.left, slot: el.offsetTop, indent: el.offsetLeft }); }
  const seen = new Set();
  const fresh = [];
  let prev = null;
  for (const it of items) {
    let el = store.get(it.key);
    const isNew = !el;
    if (isNew) { el = it.make(); el._born = renderSeq; store.set(it.key, el); }
    it.update(el, isNew);
    if (isNew && it.enter) fresh.push(el);
    seen.add(it.key);
    const want = prev ? prev.nextSibling : box.firstChild;
    if (want !== el) box.insertBefore(el, want);
    prev = el;
  }
  const gone = [];
  for (const [k, el] of store) if (!seen.has(k)) { store.delete(k); if (animate && before.has(k)) gone.push([el, before.get(k).top]); else el.remove(); }
  if (!animate) return;
  const boxTop = box.getBoundingClientRect().top;
  for (const [el, top] of gone) {
    // Taken out of the flow where it stood, under the rows that slide up over it, and gone before they arrive.
    el.style.position = 'absolute'; el.style.left = '0'; el.style.right = '0'; el.style.top = (top - boxTop) + 'px';
    el.style.zIndex = '0';
    el.style.pointerEvents = 'none';
    el.animate([{ opacity: 1 }, { opacity: 0, transform: calmSide.matches ? 'none' : 'scale(.98)' }], { duration: 100, easing: EASE }).finished.then(() => el.remove(), () => el.remove());
  }
  if (!calmSide.matches) {
    for (const [k, el] of store) {
      if (k === still || !before.has(k) || !el.isConnected) continue;
      const b = before.get(k);
      // Same slot and level as before: a slide already under way keeps going. State arrives many times a second while a page
      // loads; restarting every slide each time would cost two layouts per update and keep resetting the curve.
      if (el.offsetTop === b.slot && el.offsetLeft === b.indent) continue;
      // A new slot: stop the old slide (stacked slides fight, and the older one snaps the row back when the newer
      // ends) and start one from where the row is on screen right now.
      for (const a of el.getAnimations()) if (a.id === 'flip') a.cancel();
      // A row that changes level (its parent closed, it was dragged out of the trail) slides sideways with the same move.
      const now = el.getBoundingClientRect();
      const dx = b.left - now.left, dy = b.top - now.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { id: 'flip', duration: 200, easing: EASE });
    }
  }
  fresh.forEach((el, i) => {
    const delay = Math.min(i, 5) * 30;
    el.animate(calmSide.matches ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: el.classList.contains('kid') ? 'translateY(-8px)' : 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay, easing: EASE, fill: 'backwards' });
  });
}

// Pinning and unpinning move a tab between the list and the pinned grid. The new element starts at the icon of the
// old one and travels to its place, so the eye can follow it. Translation only (a row and a tile differ in shape).
function favCenters() {
  const m = new Map();
  for (const store of [sideStore.pins, sideStore.list]) {
    for (const [k, el] of store) {
      if (!el._t || !el.isConnected) continue;
      const f = el.querySelector('.fav');
      if (!f) continue;
      const r = f.getBoundingClientRect();
      m.set((k.charAt(0) === 'p' ? 'p' : 't') + el._t.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
  }
  return m;
}
function travel(old) {
  if (calmSide.matches) return;
  for (const [k, el] of [...sideStore.pins, ...sideStore.list]) {
    if (el._born !== renderSeq || !el._t) continue;
    const from = old.get((k.charAt(0) === 'p' ? 't' : 'p') + el._t.id);
    const f = el.querySelector('.fav');
    if (!from || !f) continue;
    const r = f.getBoundingClientRect();
    const dx = from.x - (r.left + r.width / 2), dy = from.y - (r.top + r.height / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: EASE });
  }
}

// The icon only changes when what it shows changes; swapping it on every state would restart the loading spinner.
function setFav(el, t) {
  const sig = [t.loading, t.private, t.home, t.favicon, (t.title || '').trim().charAt(0)].join('|');
  if (el._favSig === sig) return;
  el._favSig = sig;
  const old = el.querySelector('.fav');
  const f = icon(t);
  if (old) old.replaceWith(f); else el.prepend(f);
}

// Selecting happens on press, not release: it is the most frequent thing done here and should feel immediate.
function tabPress(el) {
  el.addEventListener('pointerdown', (e) => { if (e.button === 0 && !e.target.closest('.x')) lore.send('tab:select', el._t.id); });
  el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); markPointer(); lore.send('tab:close', el._t.id); } });
  el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); lore.send('tab:menu', el._t.id); });
}

// Drag to reorder, with the existing tab:move / tab:groupWith messages. Vertical rows: top and bottom thirds reorder,
// the middle groups. Pins sit in a row, so they use left and right halves.
let sideDragId = 0;
let droppedKey = '';
function sideZone(e, el) {
  const r = el.getBoundingClientRect();
  if (el._t.pinned) return (e.clientX - r.left) / r.width < 0.5 ? 'l' : 'r';
  const f = (e.clientY - r.top) / r.height;
  return f < 0.3 ? 't' : f > 0.7 ? 'b' : 'mid';
}
const clearOver = (el) => el.classList.remove('over-t', 'over-b', 'over-mid', 'over-l', 'over-r');
function tabDrag(el, all) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => { sideDragId = el._t.id; e.dataTransfer.setData('text/plain', String(el._t.id)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
  el.addEventListener('dragend', () => { sideDragId = 0; el.classList.remove('dragging'); for (const x of document.querySelectorAll('#side .srow,#side .pin')) clearOver(x); });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    const z = sideZone(e, el);
    clearOver(el);
    if (sideDragId !== el._t.id) el.classList.add('over-' + z);
  });
  el.addEventListener('dragleave', () => clearOver(el));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    clearOver(el);
    const id = Number(e.dataTransfer.getData('text/plain'));
    const t = el._t;
    if (!id || id === t.id) return;
    markPointer();
    droppedKey = 't' + id;
    const z = sideZone(e, el);
    if (z === 'mid') return lore.send('tab:groupWith', id, t.id);
    const list = all();
    const i = list.findIndex((x) => x.id === t.id);
    const before = z === 't' || z === 'l' ? t.id : (list[i + 1] ? list[i + 1].id : null);
    if (id !== before) lore.send('tab:move', id, before);
  });
}

function pinItem(t, all) {
  return {
    key: 'p' + t.id,
    make() {
      const el = document.createElement('div');
      el.className = 'pin';
      el.setAttribute('role', 'tab');
      tabPress(el);
      tabDrag(el, all);
      return el;
    },
    update(el) {
      el._t = t;
      el.setAttribute('aria-selected', String(t.active));
      el.setAttribute('aria-label', t.title);
      el.dataset.tip = t.title;
      setFav(el, t);
    }
  };
}

// How deep a tab sits in the reading trail: shown at most 3 levels deep, so a 240px sidebar is not squeezed.
const TRAIL_MAX = 2;
const trailOf = (t) => ({ level: Math.min(t.depth || 0, TRAIL_MAX) });

function rowItem(t, g, all, trail) {
  return {
    key: 't' + t.id,
    // Only a tab that arrives in the background animates in; one opened to be used (Cmd+T, a click) is just there.
    enter: sideDrawn && !t.active,
    make() {
      const el = document.createElement('div');
      el.className = 'srow';
      el.setAttribute('role', 'tab');
      const label = document.createElement('span');
      label.className = 'ttl';
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'x';
      x.textContent = '×';
      x.addEventListener('click', (e) => { e.stopPropagation(); markPointer(); lore.send('tab:close', el._t.id); });
      // Outline toggle: only on a tab whose page has one, shown on the tab in use or under the pointer.
      const tg = document.createElement('button');
      tg.type = 'button';
      tg.className = 'tg';
      tg.innerHTML = CHEV;
      tg.addEventListener('click', (e) => {
        e.stopPropagation(); markPointer();
        const id = el._t.id;
        if (tocOpen.has(id)) tocOpen.delete(id); else tocOpen.add(id);
        if (lastSide) renderSide(lastSide);
      });
      el.append(label, tg, x);
      tabPress(el);
      tabDrag(el, all);
      return el;
    },
    update(el) {
      el._t = t;
      el.setAttribute('aria-selected', String(t.active));
      el.classList.toggle('in-g', !!g);
      el.classList.toggle('kid', trail.level > 0);
      el.style.setProperty('--lv', trail.level);
      el.classList.toggle('in-split', !!t.split);
      el.classList.toggle('is-private', !!t.private);
      const label = el.querySelector('.ttl');
      if (label.textContent !== t.title) label.textContent = t.title;
      const tg = el.querySelector('.tg');
      const open = tocOpen.has(t.id) && !!t.active;
      tg.hidden = !(t.toc >= 3);
      tg.classList.toggle('open', open);
      tg.setAttribute('aria-expanded', String(open));
      tg.setAttribute('aria-label', T(open ? 'toc.hide' : 'toc.show'));
      const x = el.querySelector('.x');
      x.setAttribute('aria-label', T('tab.close'));
      setFav(el, t);
    }
  };
}

// One heading of the open outline. Rows are keyed by position, so when the page adds sections only the text changes.
function outlineItem(t, o, i, base, lv, enter) {
  return {
    key: 'o' + t.id + ':' + i,
    enter,
    make() {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'srow oi';
      const dot = document.createElement('span');
      dot.className = 'sk';
      dot.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'ttl';
      el.append(label, dot);
      const go = (e) => { e.preventDefault(); markPointer(); lore.send(e.metaKey || e.ctrlKey || e.button === 1 ? 'outline:open' : 'outline:go', el._o.tab, el._o.i); };
      el.addEventListener('click', go);
      el.addEventListener('auxclick', (e) => { if (e.button === 1) go(e); });
      return el;
    },
    update(el) {
      el._o = { tab: t.id, i };
      const label = el.querySelector('.ttl');
      if (label.textContent !== o.text) label.textContent = o.text;
      el.style.setProperty('--oi', (lv + 1) * 14 + Math.min(o.level - base, 2) * 10);
      el.classList.toggle('skim', o.s === 1);
      if (i === t.outline.cur) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
      el.setAttribute('aria-label', o.s === 1 ? o.text + ' (' + T('toc.skimmed') + ')' : o.text);
    }
  };
}

const CHEV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function groupItem(g, edit) {
  return {
    key: 'g' + g.id,
    make() {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sgrp';
      const dot = document.createElement('i');
      const name = document.createElement('span');
      b.append(dot, name);
      b.insertAdjacentHTML('beforeend', CHEV);
      b.addEventListener('click', () => { markPointer(); lore.send('group:toggle', b._g.id); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); lore.send('group:menu', b._g.id); });
      b.addEventListener('dblclick', (e) => { e.preventDefault(); startEdit(b, b._g); });
      b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('over'); });
      b.addEventListener('dragleave', () => b.classList.remove('over'));
      b.addEventListener('drop', (e) => { e.preventDefault(); b.classList.remove('over'); markPointer(); const id = Number(e.dataTransfer.getData('text/plain')); if (id) lore.send('tab:addToGroup', id, b._g.id); });
      return b;
    },
    update(b) {
      b._g = g;
      b.className = 'sgrp g-' + g.color;
      b.setAttribute('aria-expanded', String(!g.collapsed));
      b.querySelector('span').textContent = g.name || T('group.unnamed');
      if (edit) setTimeout(() => startEdit(b, g), 0);
    }
  };
}

// Hide or show the sidebar. Hidden, it slides over the page when the pointer reaches the left edge.
const PANEL_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>';
function sideToggleBtn(s) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'plus sidetoggle';
  b.innerHTML = PANEL_ICON;
  const label = T(s.sideOpen ? 'side.hide' : 'side.show', { k: key });
  b.setAttribute('aria-label', label.replace(/\s*\(.*\)$/, ''));
  b.setAttribute('aria-pressed', String(!!s.sideOpen));
  b.dataset.tip = label;
  b.addEventListener('click', () => lore.send('side:toggle'));
  return b;
}

function renderSide(s) {
  lastSide = s;
  // The top row is rebuilt only when what it shows changes, so a button under the pointer keeps its hover and press.
  const topSig = [lang, s.sideOpen, s.tabs.length >= 3, s.profiles && s.profiles.length > 1 && s.profile ? s.profile.id + s.profile.name + s.profile.color : ''].join('|');
  const top = $('#side-top');
  if (top._sig !== topSig) {
    top._sig = topSig;
    top.replaceChildren(sideToggleBtn(s));
    const spacer = document.createElement('i');
    spacer.className = 'grow';
    top.append(spacer);
    if (s.profiles && s.profiles.length > 1 && s.profile) top.append(avatarBtn(s));
    top.append(orgBtn(s));
  }

  renderSeq++;
  // Icon positions are only needed when a tab moves between the list and the pinned grid; measuring on every state
  // would force a layout each time a page reports progress.
  const pinSig = s.tabs.filter((t) => t.pinned).map((t) => t.id).join(',');
  const old = sideDrawn && pinSig !== lastPinSig ? favCenters() : null;
  lastPinSig = pinSig;
  const animate = sideDrawn && byPointer();
  const pinned = s.tabs.filter((t) => t.pinned);
  const rest = s.tabs.filter((t) => !t.pinned);
  keyed($('#pins'), sideStore.pins, pinned.map((t) => pinItem(t, () => pinned)), false);

  const gmap = new Map((s.groups || []).map((g) => [g.id, g]));
  const items = [];
  let lastGroup = 0;
  for (const t of rest) {
    const g = t.group ? gmap.get(t.group) : null;
    if (g && g.id !== lastGroup) items.push(groupItem(g, s.editGroup === g.id));
    lastGroup = g ? g.id : 0;
    // A collapsed group shows only its header, unless the tab being used is inside it.
    if (g && g.collapsed && !t.active) continue;
    const it = rowItem(t, g, () => rest, trailOf(t));
    // Rows revealed by opening a group come in one after another, so they read as belonging to it.
    if (animate) it.enter = it.enter || !!g;
    items.push(it);
    // The outline of the tab in use, when its toggle is open: one row per heading, under the tab.
    if (t.active && t.outline && tocOpen.has(t.id)) {
      const base = Math.min(...t.outline.items.map((o) => o.level));
      t.outline.items.forEach((o, i) => items.push(outlineItem(t, o, i, base, trailOf(t).level, !!animate)));
    }
  }
  const anyEnter = items.some((it) => it.enter && !sideStore.list.has(it.key));
  keyed($('#slist'), sideStore.list, items, animate || (sideDrawn && anyEnter), animate ? droppedKey : '');
  if (!animate) droppedKey = '';
  if (old) travel(old);

  // Keep the tab in use in view when it changes (Cmd+1…9, Ctrl+Tab). No smooth scroll: that would delay a keyboard action.
  const act = s.tabs.find((t) => t.active);
  if (act && act.id !== sideActive) {
    sideActive = act.id;
    const el = sideStore.list.get('t' + act.id);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  sideEdges();
  sideDrawn = true;
}

const sscroll = $('#sscroll');
function sideEdges() {
  sscroll.toggleAttribute('data-top', sscroll.scrollTop > 1);
  sscroll.toggleAttribute('data-bot', sscroll.scrollTop + sscroll.clientHeight < sscroll.scrollHeight - 1);
}
sscroll.addEventListener('scroll', sideEdges, { passive: true });
addEventListener('resize', sideEdges);
$('#snew').addEventListener('click', () => lore.send('tab:new'));
