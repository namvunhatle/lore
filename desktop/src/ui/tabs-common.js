// Shared by the window's toolbar (ui.js) and the sidebar that slides over pages (side-peek.js).
const $ = (s) => document.querySelector(s);
document.documentElement.classList.add(lore.platform);
let lang = 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
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
  const fallback = () => { wrap.className = 'fav ph' + (t.home ? ' lore' : ''); wrap.textContent = letter; };
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

function startEdit(b, g) {
  if (!b.isConnected) return;
  const input = document.createElement('input');
  input.className = 'grp-edit g-' + g.color; input.value = g.name; input.maxLength = 30; input.setAttribute('aria-label', T('org.groupName')); input.placeholder = T('group.namePh');
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    editingGroup = false;
    if (input.isConnected) input.replaceWith(b);
    if (save && input.value.trim()) lore.send('group:rename', g.id, input.value); else lore.send('group:toggle', 0);
    if (waiting) { const w = waiting; waiting = null; render(w); }
  };
  input.addEventListener('keydown', (k) => { if (k.key === 'Enter') finish(true); else if (k.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
  editingGroup = true;
  b.replaceWith(input);
  input.focus(); input.select();
}

function avatarBtn(s) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'avatar g-' + s.profile.color;
  b.textContent = (s.profile.name || '?').charAt(0).toUpperCase();
  b.setAttribute('aria-label', T('prof.menuAria', { name: s.profile.name }));
  b.dataset.tip = s.profile.name;
  b.addEventListener('click', () => { const r = b.getBoundingClientRect(); lore.send('profile:menu', Math.round(r.left), Math.round(r.bottom)); });
  return b;
}

function orgBtn(s) {
  const org = document.createElement('button');
  org.className = 'plus org';
  org.hidden = s.tabs.length < 3;
  org.setAttribute('aria-label', T('org.menu'));
  org.dataset.tip = T('org.tip', { k: key });
  org.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></svg>';
  org.addEventListener('click', () => lore.send('organize:open'));
  return org;
}

const tipEl = $('#tip');
let tipTimer;
function showTip(target) {
  const [, text, cap] = /^(.*?)(?:\s*\(([^)]+)\))?$/.exec(target.dataset.tip);
  tipEl.replaceChildren(document.createTextNode(text));
  if (cap) { const k = document.createElement('kbd'); k.textContent = cap; tipEl.append(k); }
  // A tip shown right after another one skips the delay and the animation: the user is already reading tips.
  tipEl.toggleAttribute('data-instant', !tipEl.hidden || performance.now() - tipHiddenAt < 300);
  tipFor = target;
  tipEl.removeAttribute('data-x');
  tipEl.hidden = false;
  const r = target.getBoundingClientRect();
  const w = tipEl.offsetWidth;
  // With the sidebar on, pages cover everything below the toolbar and right of the sidebar, so the tip goes beside
  // the control (on whichever side has room) instead of above it.
  const root = document.documentElement;
  if (root.classList.contains('side-tabs') || root.classList.contains('peek')) {
    const side = target.closest('#side');
    const limit = side ? side.getBoundingClientRect().right : innerWidth;
    const right = r.right + 6 + w <= limit - 4;
    tipEl.setAttribute('data-x', '');
    tipEl.style.setProperty('--tx', right ? '-3px' : '3px');
    tipEl.style.left = Math.max(4, right ? r.right + 6 : r.left - 6 - w) + 'px';
    tipEl.style.top = Math.round(r.top + r.height / 2 - tipEl.offsetHeight / 2) + 'px';
    return;
  }
  // Above the button, kept inside the window and clear of the macOS window buttons.
  const min = lore.platform === 'darwin' && r.left < 90 ? 92 : 8;
  tipEl.style.left = Math.max(min, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tipEl.style.top = '10px';
}
let tipHiddenAt = -1e9;
let tipFor = null;
function hideTip() { clearTimeout(tipTimer); tipFor = null; if (!tipEl.hidden) tipHiddenAt = performance.now(); tipEl.hidden = true; }
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  clearTimeout(tipTimer);
  if (!t) return hideTip();
  if (t === tipFor && !tipEl.hidden) return;
  tipTimer = setTimeout(() => showTip(t), !tipEl.hidden || performance.now() - tipHiddenAt < 300 ? 0 : 400);
});
document.addEventListener('mousedown', hideTip);
document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('[data-tip]:focus-visible')) showTip(e.target); });
document.addEventListener('focusout', hideTip);

// Tooltips are drawn by the page (see below) so they appear fast and can show the shortcut as a key cap.
function tips() {
  for (const e of document.querySelectorAll('[data-i18n-title]')) { e.dataset.tip = T(e.dataset.i18nTitle, { k: key }); e.removeAttribute('title'); }
}
