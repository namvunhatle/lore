const $ = (s) => document.querySelector(s);
const intent = $('#intent');
document.documentElement.classList.add(lore.platform);
if (lore.platform !== 'darwin') { $('#omni kbd').textContent = 'Ctrl+L'; document.querySelector('.nk').textContent = 'Ctrl+T'; }
let lang = 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
let focused = false;
const key = lore.platform === 'darwin' ? '⌘' : 'Ctrl+';

function icon(t) {
  if (t.private && !t.loading) {
    const p = document.createElement('span');
    p.className = 'fav priv';
    p.setAttribute('role', 'img');
    p.setAttribute('aria-label', T('tab.private'));
    p.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11c1.5-4 4.5-6 9-6s7.5 2 9 6M6 15a3 3 0 1 0 6 0M12 15a3 3 0 1 0 6 0"/></svg>';
    return p;
  }
  if (t.loading) { const sp = document.createElement('i'); sp.className = 'fav spin'; sp.setAttribute('aria-label', T('loading')); return sp; }
  if (t.home) {
    // New tab: the lotus in greys, so it reads as "Lore" without competing with real site favicons.
    const l = document.createElement('span');
    l.className = 'fav lotus';
    l.setAttribute('role', 'img');
    l.setAttribute('aria-label', 'Lore');
    l.innerHTML = '<svg width="16" height="16" viewBox="-10 -10 20 20" stroke-linejoin="round"><g transform="translate(0 7.5)"><path d="M0 0C-3.6-3.6-3.2-9.2 0-12.4 3.2-9.2 3.6-3.6 0 0Z" transform="rotate(-66) scale(.76)" fill="#9AA0AA"/><path d="M0 0C-3.6-3.6-3.2-9.2 0-12.4 3.2-9.2 3.6-3.6 0 0Z" transform="rotate(66) scale(.76)" fill="#9AA0AA"/><path d="M0 0C-3.6-3.6-3.2-9.2 0-12.4 3.2-9.2 3.6-3.6 0 0Z" transform="rotate(-33) scale(.9)" fill="#B9BEC6"/><path d="M0 0C-3.6-3.6-3.2-9.2 0-12.4 3.2-9.2 3.6-3.6 0 0Z" transform="rotate(33) scale(.9)" fill="#B9BEC6"/><path d="M0 0C-3.6-3.6-3.2-9.2 0-12.4 3.2-9.2 3.6-3.6 0 0Z" fill="#666C77"/></g></svg>';
    return l;
  }
  const wrap = document.createElement('span');
  wrap.className = 'fav';
  const letter = t.home ? 'L' : (t.title || '?').trim().charAt(0).toUpperCase();
  // No icon: a plain globe, not a letter.
  const fallback = () => { wrap.className = 'fav ph' + (t.home ? ' lore' : ''); wrap.textContent = ''; wrap.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.300 6.400-3.800 9c-2.500-2.600-3.800-5.600-3.800-9S9.500 5.600 12 3z"/></svg>'; };
  if (t.favicon && !t.home) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = t.favicon;
    img.addEventListener('error', fallback);
    wrap.append(img);
  } else fallback();
  return wrap;
}

// While a group name is being typed, the strip is not redrawn (it would throw the text box away); the latest state waits.
let editingGroup = false;
let waiting = null;

// Where on a tab a drag lands: the outer thirds reorder, the middle one makes a group with that tab.
function zone(e, r, t) {
  if (t.pinned) return (e.clientX - r.left) / r.width < 0.5 ? 'l' : 'r';
  const f = (e.clientY - r.top) / r.height;
  return f < 0.3 ? 'l' : f > 0.7 ? 'r' : 'mid';
}

function groupChip(g, edit) {
  const b = document.createElement('div');
  b.className = 'grp g-' + g.color + (g.collapsed ? ' collapsed' : '');
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.setAttribute('aria-expanded', String(!g.collapsed));
  const dot = document.createElement('i');
  const label = document.createElement('span');
  label.className = 'gn';
  label.textContent = g.name || T('group.unnamed');
  const count = document.createElement('em');
  count.className = 'gc';
  count.textContent = String(g.count || '');
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'gplus';
  plus.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  plus.setAttribute('aria-label', T('group.newTab', { name: g.name }));
  plus.dataset.tip = T('group.newTab', { name: g.name });
  plus.addEventListener('click', (e) => { e.stopPropagation(); lore.send('group:newTab', g.id); });
  const chev = document.createElement('span');
  chev.className = 'chev';
  chev.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  chev.setAttribute('aria-hidden', 'true');
  b.append(dot, label, count, plus, chev);
  b.dataset.tip = T(g.collapsed ? 'group.expandTip' : 'group.collapseTip');
  b.addEventListener('click', () => lore.send('group:toggle', g.id));
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lore.send('group:toggle', g.id); } });
  b.addEventListener('contextmenu', (e) => { e.preventDefault(); lore.send('group:menu', g.id); });
  b.addEventListener('dblclick', (e) => { e.preventDefault(); startEdit(b, g); });
  // Drop a tab on the group's name to add it.
  b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('over'); });
  b.addEventListener('dragleave', () => b.classList.remove('over'));
  b.addEventListener('drop', (e) => { e.preventDefault(); b.classList.remove('over'); const id = Number(e.dataTransfer.getData('text/plain')); if (id) lore.send('tab:addToGroup', id, g.id); });
  if (edit) setTimeout(() => startEdit(b, g), 0);
  return b;
}

function startEdit(b, g) {
  if (!b.isConnected) return;
  const input = document.createElement('input');
  input.className = 'grp-edit g-' + g.color; input.value = g.name; input.maxLength = 30; input.setAttribute('aria-label', T('org.groupName')); input.placeholder = T('group.namePh');
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    editingGroup = false;
    if (save && input.value.trim()) lore.send('group:rename', g.id, input.value); else lore.send('group:toggle', 0);
    if (waiting) { const w = waiting; waiting = null; render(w); }
  };
  input.addEventListener('keydown', (k) => { if (k.key === 'Enter') finish(true); else if (k.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
  editingGroup = true;
  b.replaceWith(input);
  input.focus(); input.select();
}

function render(s) {
  if (editingGroup) { waiting = s; return; }
  if (s.lang !== lang) { lang = s.lang; LORE_I18N.apply(lang); tips(); resetPh(); }
  const active = s.tabs.find((t) => t.active);
  document.documentElement.toggleAttribute('data-private', !!(active && active.private));
  $('#bar').classList.toggle('loading', !!(active && active.loading));
  document.documentElement.dataset.side = s.side === 'rail' ? 'rail' : 'full';
  const tabs = $('#tabs');
  tabs.replaceChildren();
  const who = $('#who');
  who.replaceChildren();
  let pins = null;
  if (s.profiles && s.profiles.length > 1 && s.profile) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'avatar g-' + s.profile.color;
    b.textContent = (s.profile.name || '?').charAt(0).toUpperCase();
    b.setAttribute('aria-label', T('prof.menuAria', { name: s.profile.name }));
    b.dataset.tip = s.profile.name;
    b.addEventListener('click', () => { const r = b.getBoundingClientRect(); lore.send('profile:menu', Math.round(r.left), Math.round(r.bottom)); });
    who.append(b);
  }
  const gmap = new Map((s.groups || []).map((g) => [g.id, g]));
  let lastGroup = 0;
  let box = null;
  const sizes = new Map();
  for (const t of s.tabs) if (t.group) sizes.set(t.group, (sizes.get(t.group) || 0) + 1);
  for (const t of s.tabs) {
    const g = t.group ? gmap.get(t.group) : null;
    // A group is one block: its header and its tabs sit together in a tinted box.
    if (g && g.id !== lastGroup) { box = document.createElement('div'); box.className = 'gbox g-' + g.color; box.append(groupChip({ ...g, count: sizes.get(g.id) }, s.editGroup === g.id)); tabs.append(box); }
    if (!g) box = null;
    lastGroup = g ? g.id : 0;
    // A collapsed group shows only its header, unless the tab being used is inside it.
    if (g && g.collapsed && !t.active) continue;
    const el = document.createElement('div');
    el.className = 'tab' + (g ? ' grouped g-' + g.color : '');
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(t.active));
    if (t.private) el.classList.add('is-private');
    if (t.pinned) el.classList.add('pinned');
    if (t.split) el.classList.add('in-split', 'split-' + t.split);
    el.addEventListener('click', () => lore.send('tab:select', t.id));
    el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); lore.send('tab:close', t.id); } });
    el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); lore.send('tab:menu', t.id); });
    // Drag to reorder: dropping on the left half of a tab puts the dragged tab before it, on the right half after it.
    el.draggable = true;
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); for (const x of tabs.querySelectorAll('.tab')) x.classList.remove('over-t', 'over-b', 'over-l', 'over-r', 'over-mid'); });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const z = zone(e, r, t);
      const vertical = !t.pinned;
      el.classList.toggle(vertical ? 'over-t' : 'over-l', z === 'l');
      el.classList.toggle(vertical ? 'over-b' : 'over-r', z === 'r');
      el.classList.toggle('over-mid', z === 'mid');
    });
    el.addEventListener('dragleave', () => el.classList.remove('over-t', 'over-b', 'over-l', 'over-r', 'over-mid'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = Number(e.dataTransfer.getData('text/plain'));
      const z = zone(e, el.getBoundingClientRect(), t);
      const i = s.tabs.findIndex((x) => x.id === t.id);
      const before = z === 'l' ? t.id : (s.tabs[i + 1] ? s.tabs[i + 1].id : null);
      el.classList.remove('over-t', 'over-b', 'over-l', 'over-r', 'over-mid');
      if (!id || id === t.id) return;
      if (z === 'mid') lore.send('tab:groupWith', id, t.id);
      else if (id !== before) lore.send('tab:move', id, before);
    });
    el.append(icon(t));
    const label = document.createElement('span');
    label.textContent = t.title;
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '×';
    x.setAttribute('aria-label', T('tab.close'));
    x.dataset.tip = T('tab.close') + ' (' + key + 'W)';
    x.addEventListener('click', (e) => { e.stopPropagation(); lore.send('tab:close', t.id); });
    el.append(label, x);
    if (t.pinned) { if (!pins) { pins = document.createElement('div'); pins.className = 'pins'; tabs.prepend(pins); } pins.append(el); } else (box || tabs).append(el);
  }
  // A small heading over the list says how many tabs there are.
  const firstRow = tabs.querySelector(':scope > .tab, :scope > .gbox');
  if (firstRow) { const lab = document.createElement('div'); lab.className = 'tlabel'; lab.textContent = T('side.tabs', { n: s.tabs.filter((x) => !x.pinned).length }); tabs.insertBefore(lab, firstRow); }
  // The tool open over the page is marked in the side bar.
  for (const [id, name] of [['memory', 'memory'], ['gear', 'settings'], ['downloads', 'downloads'], ['org', 'organize']]) $('#' + id).classList.toggle('on', s.sheet === name);
  $('#org').hidden = s.tabs.length < 3;

  const dlb = $('#downloads');
  dlb.hidden = !s.downloads || !s.downloads.count;
  dlb.classList.toggle('busy', !!(s.downloads && s.downloads.active));
  $('#downloads .badge').textContent = s.downloads ? s.downloads.active : 0;
  $('#downloads .badge').hidden = !(s.downloads && s.downloads.active);

  // Lock area: what kind of connection this page has. Plain http and an ignored certificate error are called out.
  const sec = $('#sec');
  const st = s.security === 'local' ? '' : s.security;
  sec.hidden = !st;
  sec.dataset.state = st;
  sec.replaceChildren();
  if (st) {
    sec.insertAdjacentHTML('beforeend', st === 'https'
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/></svg>');
    if (st !== 'https') { const l = document.createElement('span'); l.textContent = T(st === 'cert' ? 'sec.certShort' : 'sec.httpShort'); sec.append(l); }
    sec.dataset.tip = T('sec.' + st);
  }
  const star = $('#star');
  star.hidden = !s.web;
  star.setAttribute('aria-pressed', String(!!s.starred));
  star.dataset.tip = T(s.starred ? 'bm.remove' : 'tip.star', { k: key });

  // Bookmarks bar
  const barOn = !!(s.bar && s.bar.on);
  document.documentElement.classList.toggle('with-bar', barOn);
  const bar = $('#bmbar');
  bar.hidden = !barOn;
  bar.replaceChildren();
  if (barOn) {
    for (const b of s.bar.items) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'bm' + (b.type === 'folder' ? ' dir' : '');
      if (b.type === 'link') {
        const f = document.createElement('span'); f.className = 'fav';
        if (b.icon) { const img = document.createElement('img'); img.alt = ''; img.src = b.icon; f.append(img); } else { f.classList.add('ph'); f.textContent = (b.title || '?').trim().charAt(0).toUpperCase(); }
        const t = document.createElement('span'); t.textContent = b.title;
        x.append(f, t);
        x.addEventListener('click', (e) => lore.send('bookmark:open', b.id, e.metaKey || e.ctrlKey));
        x.addEventListener('auxclick', (e) => { if (e.button === 1) lore.send('bookmark:open', b.id, true); });
      } else {
        const t = document.createElement('span'); t.textContent = b.title + ' ▾';
        x.append(t);
        x.addEventListener('click', () => { const r = x.getBoundingClientRect(); lore.send('bookmark:folder', b.title, Math.round(r.left), Math.round(r.bottom)); });
      }
      bar.append(x);
    }
    if (!s.bar.items.length) { const h = document.createElement('span'); h.className = 'hint'; h.textContent = T('bm.barEmpty'); bar.append(h); }
  }

  $('#media').hidden = !s.media;
  $('.sep').hidden = $('#media').hidden;
  $('#media .badge').textContent = s.media;
  $('#back').disabled = !s.canBack;
  $('#fwd').disabled = !s.canForward;
  $('#badge').textContent = s.blocked.toLocaleString('vi-VN');
  $('#shield').setAttribute('aria-pressed', String(s.adsOn));
  $('#assist').disabled = !/^https?:/.test(s.url);
  $('#assist').classList.toggle('open', !!s.panel);
  if (!focused) { intent.value = s.url; edited = false; updateChip(); }
}

// Placeholder: an overlay that slides between examples. It is only a hint: clicks go to the input, never to an example.
const ph = $('#ph');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EXAMPLES = 6;
let ex = 0;
function setPh(text, animate) {
  if (!animate || calm) { ph.textContent = text; return; }
  ph.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
    ph.textContent = text;
    ph.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out', fill: 'forwards' });
  }).catch(() => { ph.textContent = text; });
}
function resetPh() { ex = 0; setPh(T('bar.placeholder'), false); }
resetPh();
setInterval(() => {
  if (intent.value || focused) return;
  ex = (ex % EXAMPLES) + 1;
  setPh(T('bar.ex.' + ex), true);
}, 4000);

// Types text into the bar one letter at a time, then runs it, so a click on a card shows what is happening.
let typing = 0;
function typeRun(text) {
  const id = ++typing;
  intent.focus();
  intent.value = '';
  $('#omni').classList.add('typing');
  const done = () => { if (id !== typing) return; $('#omni').classList.remove('typing'); lore.send('nav:submit', intent.value); intent.blur(); };
  if (calm) { intent.value = text; return done(); }
  let i = 0;
  const step = () => {
    if (id !== typing) return;
    intent.value = text.slice(0, ++i); edited = true; updateChip();
    if (i < text.length) setTimeout(step, Math.max(12, Math.min(40, 700 / text.length)));
    else setTimeout(done, 220);
  };
  step();
}
lore.onTypeRun(typeRun);
$('#omni').addEventListener('click', () => intent.focus());
intent.addEventListener('input', () => { typing++; $('#omni').classList.remove('typing'); edited = true; updateChip(); });

// While you type, a small label says what Enter will do with it: open a site, ask Lore, write, search memory…
const chip = $('#ichip');
let edited = false;
let chipTimer;
function updateChip() {
  clearTimeout(chipTimer);
  const v = intent.value.trim();
  const show = edited && !!v;
  $('#omni').classList.toggle('has-text', show);
  if (!show) { chip.hidden = true; return; }
  chipTimer = setTimeout(async () => {
    let kind = '';
    try { kind = await lore.classify(v); } catch { /* no label */ }
    if (intent.value.trim() !== v || !edited) return;
    chip.hidden = !kind;
    chip.dataset.kind = kind;
    chip.textContent = kind ? T('ichip.' + kind) + '  ↵' : '';
  }, 50);
}

const tipEl = $('#tip');
let tipTimer;
function showTip(target) {
  const [, text, cap] = /^(.*?)(?:\s*\(([^)]+)\))?$/.exec(target.dataset.tip);
  tipEl.replaceChildren(document.createTextNode(text));
  if (cap) { const k = document.createElement('kbd'); k.textContent = cap; tipEl.append(k); }
  const r = target.getBoundingClientRect();
  // Drawn by the main process in a view above the page, so nothing can hide it.
  lore.send('tip:show', { text, cap: cap || '', x: r.left, y: r.top, w: r.width, h: r.height, place: target.closest('#side') ? 'right' : 'below' });
  return;
  tipEl.hidden = false;
  const w = tipEl.offsetWidth;
  // Above the button, kept inside the window and clear of the macOS window buttons.
  if (target.closest('#side')) {
    // Beside the tab list, not above it.
    const rail = document.documentElement.dataset.side === 'rail';
    tipEl.style.left = (rail || target.closest('.side-foot') ? r.right + 8 : Math.min(r.left + 24, innerWidth - w - 8)) + 'px';
    tipEl.style.top = Math.max(8, r.top + r.height / 2 - tipEl.offsetHeight / 2) + 'px';
    return;
  }
  // The page card is drawn over everything below the bar, so a tip for the bar goes beside its button, never under it.
  const left = r.left + r.width / 2 < innerWidth / 2;
  tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, left ? r.right + 8 : r.left - w - 8)) + 'px';
  tipEl.style.top = Math.max(6, r.top + r.height / 2 - tipEl.offsetHeight / 2) + 'px';
}
function hideTip() { clearTimeout(tipTimer); tipEl.hidden = true; lore.send('tip:hide'); }
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  clearTimeout(tipTimer);
  if (!t) return hideTip();
  tipTimer = setTimeout(() => showTip(t), tipEl.hidden ? 400 : 80);
});
document.addEventListener('mousedown', hideTip);
document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('[data-tip]:focus-visible')) showTip(e.target); });
document.addEventListener('focusout', hideTip);

// Short messages from the main process: progress of a writing action, or why it could not run.
const toastEl = $('#toast');
let toastTimer;
lore.onToast((t) => {
  clearTimeout(toastTimer);
  if (!t) { toastEl.hidden = true; return; }
  toastEl.replaceChildren();
  if (t.busy) { const s = document.createElement('i'); s.className = 'fav spin'; toastEl.append(s); }
  toastEl.append(document.createTextNode(t.text));
  if (t.action) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t.actionLabel;
    b.addEventListener('click', () => { toastEl.hidden = true; lore.send(t.action + ':open'); });
    toastEl.append(b);
  }
  toastEl.hidden = false;
  if (!t.busy) toastTimer = setTimeout(() => { toastEl.hidden = true; }, t.action ? 8000 : 4500);
});

lore.onState(render);
lore.focusIntent(() => { intent.focus(); intent.select(); });
intent.addEventListener('focus', () => { focused = true; });
intent.addEventListener('blur', () => { focused = false; edited = false; updateChip(); });
$('#omni').addEventListener('submit', (e) => {
  e.preventDefault();
  lore.send('nav:submit', intent.value);
  intent.blur();
});
$('#omni kbd').textContent = key + 'L';
document.querySelector('.nk').textContent = key + 'T';
LORE_I18N.apply(lang);
tips();
// Tooltips are drawn by the page (see below) so they appear fast and can show the shortcut as a key cap.
function tips() {
  for (const e of document.querySelectorAll('[data-i18n-title]')) { e.dataset.tip = T(e.dataset.i18nTitle, { k: key }); e.removeAttribute('title'); }
}
$('#newtab').addEventListener('click', () => lore.send('tab:new'));
$('#org').addEventListener('click', () => lore.send('organize:open'));
$('#sidetoggle').addEventListener('click', () => lore.send('side:toggle'));
$('#gear').addEventListener('click', () => lore.send('settings:open'));
$('#assist').addEventListener('click', () => lore.send('assist:open'));
$('#more').addEventListener('click', () => { const r = $('#more').getBoundingClientRect(); lore.send('menu:more', Math.round(r.left), Math.round(r.bottom)); });
$('#back').addEventListener('click', () => lore.send('nav:back'));
$('#fwd').addEventListener('click', () => lore.send('nav:forward'));
$('#reload').addEventListener('click', () => lore.send('nav:reload'));
$('#shield').addEventListener('click', () => lore.send('priv:open'));
$('#memory').addEventListener('click', () => lore.send('memory:open'));
$('#media').addEventListener('click', () => lore.send('media:open'));
$('#downloads').addEventListener('click', () => lore.send('downloads:open'));
$('#star').addEventListener('click', () => lore.send('bookmark:toggle'));
$('#sec').addEventListener('click', () => { const r = $('#sec').getBoundingClientRect(); lore.send('security:menu', Math.round(r.left), Math.round(r.bottom)); });
