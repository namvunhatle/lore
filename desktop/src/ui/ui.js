const $ = (s) => document.querySelector(s);
const intent = $('#intent');
document.documentElement.classList.add(lore.platform);
if (lore.platform !== 'darwin') document.querySelector('kbd').textContent = 'Ctrl+L';
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

function render(s) {
  if (s.lang !== lang) { lang = s.lang; LORE_I18N.apply(lang); tips(); resetPh(); }
  const active = s.tabs.find((t) => t.active);
  document.documentElement.toggleAttribute('data-private', !!(active && active.private));
  $('#bar').classList.toggle('loading', !!(active && active.loading));
  const tabs = $('#tabs');
  tabs.replaceChildren();
  for (const t of s.tabs) {
    const el = document.createElement('div');
    el.className = 'tab';
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(t.active));
    if (t.private) el.classList.add('is-private');
    el.addEventListener('click', () => lore.send('tab:select', t.id));
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
  const plus = document.createElement('button');
  plus.className = 'plus';
  plus.textContent = '+';
  plus.setAttribute('aria-label', T('tab.open'));
  plus.dataset.tip = T('tip.newTab', { k: key });
  plus.addEventListener('click', () => lore.send('tab:new'));
  tabs.append(plus);

  $('#reader').hidden = !s.reader;
  $('#media').hidden = !s.media;
  $('#media .badge').textContent = s.media;
  $('#back').disabled = !s.canBack;
  $('#fwd').disabled = !s.canForward;
  $('#badge').textContent = s.blocked.toLocaleString('vi-VN');
  $('#shield').setAttribute('aria-pressed', String(s.adsOn));
  $('#assist').disabled = !/^https?:/.test(s.url);
  if (!focused) intent.value = s.url;
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
    intent.value = text.slice(0, ++i);
    if (i < text.length) setTimeout(step, Math.max(12, Math.min(40, 700 / text.length)));
    else setTimeout(done, 220);
  };
  step();
}
lore.onTypeRun(typeRun);
$('#omni').addEventListener('click', () => intent.focus());
intent.addEventListener('input', () => { typing++; $('#omni').classList.remove('typing'); });

const tipEl = $('#tip');
let tipTimer;
function showTip(target) {
  const [, text, cap] = /^(.*?)(?:\s*\(([^)]+)\))?$/.exec(target.dataset.tip);
  tipEl.replaceChildren(document.createTextNode(text));
  if (cap) { const k = document.createElement('kbd'); k.textContent = cap; tipEl.append(k); }
  tipEl.hidden = false;
  const r = target.getBoundingClientRect();
  const w = tipEl.offsetWidth;
  // Above the button, kept inside the window and clear of the macOS window buttons.
  const min = lore.platform === 'darwin' && r.left < 90 ? 92 : 8;
  tipEl.style.left = Math.max(min, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tipEl.style.top = '10px';
}
function hideTip() { clearTimeout(tipTimer); tipEl.hidden = true; }
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
intent.addEventListener('blur', () => { focused = false; });
$('#omni').addEventListener('submit', (e) => {
  e.preventDefault();
  lore.send('nav:submit', intent.value);
  intent.blur();
});
document.querySelector('kbd').textContent = key + 'L';
tips();
// Tooltips are drawn by the page (see below) so they appear fast and can show the shortcut as a key cap.
function tips() {
  for (const e of document.querySelectorAll('[data-i18n-title]')) { e.dataset.tip = T(e.dataset.i18nTitle, { k: key }); e.removeAttribute('title'); }
}
$('#assist').addEventListener('click', () => lore.send('assist:open'));
$('#more').addEventListener('click', () => { const r = $('#more').getBoundingClientRect(); lore.send('menu:more', Math.round(r.left), Math.round(r.bottom)); });
$('#back').addEventListener('click', () => lore.send('nav:back'));
$('#fwd').addEventListener('click', () => lore.send('nav:forward'));
$('#reload').addEventListener('click', () => lore.send('nav:reload'));
$('#shield').addEventListener('click', () => lore.send('shield:toggle'));
$('#reader').addEventListener('click', () => lore.send('reader:open'));
$('#memory').addEventListener('click', () => lore.send('memory:open'));
$('#settings').addEventListener('click', () => lore.send('settings:open'));
$('#media').addEventListener('click', () => lore.send('media:open'));
