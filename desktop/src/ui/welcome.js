const $ = (s) => document.querySelector(s);
const p = new URLSearchParams(location.search);
const lang = p.get('lang') === 'vi' ? 'vi' : 'en';
const mode = p.get('mode') === 'import' ? 'import' : 'first';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('wel.title');

const COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'grey'];
const steps = mode === 'import' ? ['import'] : ['profile', 'import', 'default'];
let at = 0;
let info = null;
let color = 'blue';

function show(i) {
  at = i;
  for (const s of ['profile', 'import', 'default']) $('#s-' + s).hidden = steps[at] !== s;
  const dots = $('#dots');
  dots.replaceChildren(...steps.map((_, k) => { const li = document.createElement('li'); if (k <= at) li.className = 'on'; return li; }));
  dots.hidden = steps.length < 2;
  const first = $('#s-' + steps[at]).querySelector('input, button.pri');
  if (first) first.focus();
}
const next = () => (at + 1 < steps.length ? show(at + 1) : welcome.done());

function swatches() {
  const box = $('#pcolors');
  box.replaceChildren();
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sw-c g-' + c; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(c === color)); b.setAttribute('aria-label', T('group.c.' + c));
    b.addEventListener('click', () => { color = c; swatches(); });
    box.append(b);
  }
}

// ---- import
const rows = [];
function listBrowsers() {
  const ul = $('#blist');
  ul.replaceChildren();
  $('#bnone').hidden = info.browsers.length > 0;
  $('#do-import').hidden = info.browsers.length === 0;
  for (const b of info.browsers) {
    const li = document.createElement('li');
    const name = document.createElement('span'); name.className = 'bname'; name.textContent = b.name;
    const sel = document.createElement('select'); sel.setAttribute('aria-label', T('wel.imp.profile'));
    for (const pr of b.profiles) { const o = document.createElement('option'); o.value = pr.id; o.textContent = pr.name; sel.append(o); }
    sel.hidden = b.profiles.length < 2;
    const opts = document.createElement('div'); opts.className = 'bopts';
    const mk = (key, label) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = true; l.append(c, document.createTextNode(label)); opts.append(l); return c; };
    const bm = mk('bookmarks', T('wel.imp.bookmarks'));
    const hi = mk('history', T('wel.imp.history'));
    li.append(name, sel, opts);
    ul.append(li);
    rows.push({ b, sel, bm, hi });
  }
}
function say(el, text, kind) { el.textContent = text; el.className = 'status' + (kind ? ' ' + kind : ''); }
const sum = (r) => T('wel.imp.done', { b: r.bookmarks, h: r.history });

$('#do-import').addEventListener('click', async () => {
  $('#do-import').disabled = true;
  say($('#istatus'), T('wel.imp.working'));
  let b = 0, h = 0, err = '';
  for (const r of rows) {
    if (!r.bm.checked && !r.hi.checked) continue;
    const res = await welcome.importFrom({ source: r.b.id, profile: r.sel.value || r.b.profiles[0].id, bookmarks: r.bm.checked, history: r.hi.checked });
    b += res.bookmarks; h += res.history;
    if (res.errors && res.errors.length) err = T('wel.imp.partial');
  }
  say($('#istatus'), err || sum({ bookmarks: b, history: h }), err ? 'err' : 'ok');
  $('#do-import').disabled = false;
  $('#skip-import').textContent = T('wel.next');
});
$('#do-file').addEventListener('click', async () => {
  const res = await welcome.importFile();
  if (res && res.cancelled) return;
  say($('#istatus'), res && !res.error ? sum(res) : T('wel.imp.fileErr'), res && !res.error ? 'ok' : 'err');
  $('#skip-import').textContent = T('wel.next');
});
$('#skip-import').addEventListener('click', () => next());

// ---- default browser
function paintDefault() {
  const d = info.def;
  $('#def-sub').textContent = d.packaged ? T('wel.def.s') : T('wel.def.dev');
  $('#do-default').disabled = !d.packaged || d.isDefault;
  say($('#dstatus'), d.isDefault ? T('wel.def.is') : '', d.isDefault ? 'ok' : '');
}
$('#do-default').addEventListener('click', async () => {
  const r = await welcome.setDefault();
  info.def = r;
  paintDefault();
  if (!r.isDefault) say($('#dstatus'), T(r.platform === 'win32' ? 'wel.def.win' : 'wel.def.check'));
});
$('#finish').addEventListener('click', () => welcome.done());
$('#to-import').addEventListener('click', async () => { await welcome.profile($('#pname').value, color); next(); });
$('#pname').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#to-import').click(); });

welcome.init().then((r) => {
  info = r;
  color = r.profile.color;
  $('#pname').value = r.profile.name === 'Personal' ? '' : r.profile.name;
  $('#pname').placeholder = T('wel.namePh');
  swatches(); listBrowsers(); paintDefault();
  if (mode === 'import') { $('#imp-h').textContent = T('wel.imp.h'); $('#skip-import').textContent = T('wel.close'); }
  show(0);
});
