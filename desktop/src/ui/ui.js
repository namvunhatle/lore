const intent = $('#intent');
if (lore.platform !== 'darwin') document.querySelector('kbd').textContent = 'Ctrl+L';
let focused = false;

// Where on a tab a drag lands: the outer thirds reorder, the middle one makes a group with that tab.
function zone(e, r, t) {
  const f = (e.clientX - r.left) / r.width;
  if (t.pinned) return f < 0.5 ? 'l' : 'r';
  return f < 0.3 ? 'l' : f > 0.7 ? 'r' : 'mid';
}

// A small + at the end of a group opens a new tab inside it.
function groupPlus(g) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gplus g-' + g.color;
  b.textContent = '+';
  b.setAttribute('aria-label', T('group.newTab', { name: g.name }));
  b.dataset.tip = T('group.newTab', { name: g.name });
  b.addEventListener('click', () => lore.send('group:newTab', g.id));
  return b;
}

function groupChip(g, edit) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'grp g-' + g.color + (g.collapsed ? ' collapsed' : '');
  b.setAttribute('aria-expanded', String(!g.collapsed));
  const dot = document.createElement('i');
  const label = document.createElement('span');
  label.textContent = g.name || T('group.unnamed');
  const chev = document.createElement('em');
  chev.textContent = g.collapsed ? '▸' : '▾';
  chev.setAttribute('aria-hidden', 'true');
  b.append(dot, label, chev);
  b.dataset.tip = T(g.collapsed ? 'group.expandTip' : 'group.collapseTip');
  b.addEventListener('click', () => lore.send('group:toggle', g.id));
  b.addEventListener('contextmenu', (e) => { e.preventDefault(); lore.send('group:menu', g.id); });
  b.addEventListener('dblclick', (e) => { e.preventDefault(); startEdit(b, g); });
  // Drop a tab on the group's name to add it.
  b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('over'); });
  b.addEventListener('dragleave', () => b.classList.remove('over'));
  b.addEventListener('drop', (e) => { e.preventDefault(); b.classList.remove('over'); const id = Number(e.dataTransfer.getData('text/plain')); if (id) lore.send('tab:addToGroup', id, g.id); });
  if (edit) setTimeout(() => startEdit(b, g), 0);
  return b;
}

function render(s) {
  if (editingGroup) { waiting = s; return; }
  if (s.lang !== lang) { lang = s.lang; LORE_I18N.apply(lang); tips(); resetPh(); }
  const active = s.tabs.find((t) => t.active);
  document.documentElement.toggleAttribute('data-private', !!(active && active.private));
  $('#bar').classList.toggle('loading', !!(active && active.loading));
  const tabs = $('#tabs');
  tabs.replaceChildren();
  const side = s.layout === 'side';
  document.documentElement.classList.toggle('side-tabs', side);
  document.documentElement.classList.toggle('side-closed', side && !s.sideOpen);
  renderChrome(s);
  // With the sidebar hidden, the toolbar carries the button that brings it back (the sidebar itself is in side.html).
  const nt = $('#navtoggle');
  const ntSig = lang + '|' + (side && !s.sideOpen);
  if (nt._sig !== ntSig) { nt._sig = ntSig; nt.replaceChildren(); if (side && !s.sideOpen) nt.append(sideToggleBtn(s)); }
  if (side) { if (s.sideOpen) renderSide(s); return; }
  if (s.profiles && s.profiles.length > 1 && s.profile) tabs.append(avatarBtn(s));
  const gmap = new Map((s.groups || []).map((g) => [g.id, g]));
  let lastGroup = 0;
  for (const t of s.tabs) {
    const g = t.group ? gmap.get(t.group) : null;
    if (lastGroup && (!g || g.id !== lastGroup) && gmap.get(lastGroup)) tabs.append(groupPlus(gmap.get(lastGroup)));
    if (g && g.id !== lastGroup) tabs.append(groupChip(g, s.editGroup === g.id));
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
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); for (const x of tabs.children) x.classList.remove('over-l', 'over-r', 'over-mid'); });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const z = zone(e, r, t);
      el.classList.toggle('over-l', z === 'l');
      el.classList.toggle('over-r', z === 'r');
      el.classList.toggle('over-mid', z === 'mid');
    });
    el.addEventListener('dragleave', () => el.classList.remove('over-l', 'over-r', 'over-mid'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = Number(e.dataTransfer.getData('text/plain'));
      const z = zone(e, el.getBoundingClientRect(), t);
      const i = s.tabs.findIndex((x) => x.id === t.id);
      const before = z === 'l' ? t.id : (s.tabs[i + 1] ? s.tabs[i + 1].id : null);
      el.classList.remove('over-l', 'over-r', 'over-mid');
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
    tabs.append(el);
  }
  if (lastGroup && gmap.get(lastGroup)) tabs.append(groupPlus(gmap.get(lastGroup)));
  const plus = document.createElement('button');
  plus.className = 'plus';
  plus.textContent = '+';
  plus.setAttribute('aria-label', T('tab.open'));
  plus.dataset.tip = T('tip.newTab', { k: key });
  plus.addEventListener('click', () => lore.send('tab:new'));
  tabs.append(plus, orgBtn(s));
}

// Everything outside the tabs: toolbar, lock, star, bookmarks bar. Same in both layouts.
function renderChrome(s) {
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
  $('.sep').hidden = $('#media').hidden && $('#downloads').hidden;
  $('#media .badge').textContent = s.media;
  $('#back').disabled = !s.canBack;
  $('#fwd').disabled = !s.canForward;
  $('#badge').textContent = s.blocked.toLocaleString('vi-VN');
  $('#shield').setAttribute('aria-pressed', String(s.adsOn));
  $('#assist').disabled = !/^https?:/.test(s.url);
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
document.querySelector('kbd').textContent = key + 'L';
LORE_I18N.apply(lang);
tips();
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
