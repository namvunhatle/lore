const $ = (s) => document.querySelector(s);
const val = (id) => $(id).value.trim();
let view;
let lang = 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);

function setLang(l) {
  lang = l;
  LORE_I18N.apply(lang);
  document.title = T('set.title');
  const perm = $('#perm');
  perm.replaceChildren();
  for (const [v, k] of [['ask', 'set.priv.perm.ask'], ['block', 'set.priv.perm.block']]) {
    const o = document.createElement('option'); o.value = v; o.textContent = T(k); perm.append(o);
  }
  if (view) perm.value = view.privacy.permissions;
  const sel = $('#language');
  const cur = view ? view.language : 'auto';
  sel.replaceChildren();
  for (const [v, name] of [['auto', T('set.lang.auto')], ...LORE_I18N.LANGS.map((x) => [x.code, x.name])]) {
    const o = document.createElement('option'); o.value = v; o.textContent = name; sel.append(o);
  }
  sel.value = cur;
  const ap = $('#appearance');
  ap.replaceChildren();
  for (const [v, k] of [['system', 'set.look.system'], ['light', 'set.look.light'], ['dark', 'set.look.dark']]) { const o = document.createElement('option'); o.value = v; o.textContent = T(k); ap.append(o); }
  ap.value = view ? view.appearance : 'system';
  const st = $('#startup');
  st.replaceChildren();
  for (const [v, k] of [['restore', 'set.start.restore'], ['new', 'set.start.new']]) { const o = document.createElement('option'); o.value = v; o.textContent = T(k); st.append(o); }
  st.value = view ? view.startup : 'restore';
}

const provider = () => document.querySelector('input[name="provider"]:checked').value;

function fill(v) {
  view = v;
  document.querySelector(`input[name="provider"][value="${v.provider}"]`).checked = true;
  $('#cookies').checked = v.privacy.blockThirdPartyCookies;
  $('#scam').checked = v.privacy.scamProtection;
  $('#banners').checked = v.privacy.cookieBanners;
  $('#fp').checked = v.privacy.reduceFingerprint;
  $('#perm').value = v.privacy.permissions;
  $('#local-url').value = v.local.url;
  $('#local-model').value = v.local.model;
  $('#local-embed').value = v.local.embedModel;
  $('#openai-url').value = v.openai.baseUrl;
  $('#openai-model').value = v.openai.model;
  $('#anthropic-model').value = v.anthropic.model;
  for (const k of ['openai', 'anthropic']) {
    $('#' + k + '-key').value = '';
    $('#' + k + '-key').placeholder = v[k].hasKey ? T('set.keySaved') : T('set.keyPh');
    $('#' + k + '-clear').hidden = !v[k].hasKey;
  }
  show();
}

function show() {
  const p = provider();
  $('#test').hidden = p === 'off';
  for (const k of ['local', 'openai', 'anthropic']) $('#p-' + k).hidden = p !== k;
  const w = $('#remote-warn');
  const remoteHost = p === 'anthropic' ? 'api.anthropic.com' : p === 'openai' ? safeHost($('#openai-url').value) : '';
  w.hidden = !(remoteHost && !isLocal(remoteHost));
  if (!w.hidden) w.textContent = T('set.warnRemote', { host: remoteHost });
  const h = $('#store-hint');
  h.hidden = !(view && !view.persistent && p !== 'local' && p !== 'off');
  h.textContent = T('set.noPersist');
  if (p === 'local') refreshModels();
}

function safeHost(u) { try { return new URL(u).host; } catch { return ''; } }
function isLocal(host) { return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host); }

function patch() {
  const p = provider();
  return {
    provider: p,
    language: $('#language').value,
    startup: $('#startup').value,
    appearance: $('#appearance').value,
    privacy: { blockThirdPartyCookies: $('#cookies').checked, scamProtection: $('#scam').checked, cookieBanners: $('#banners').checked, reduceFingerprint: $('#fp').checked, permissions: $('#perm').value },
    local: { url: val('#local-url'), model: val('#local-model'), embedModel: val('#local-embed') },
    openai: { baseUrl: val('#openai-url'), model: val('#openai-model'), key: $('#openai-key').value },
    anthropic: { model: val('#anthropic-model'), key: $('#anthropic-key').value }
  };
}

function say(text, err) { const s = $('#status'); s.textContent = text; s.className = err ? 'err' : ''; }

async function refreshModels() {
  const sel = $('#local-model-list');
  sel.replaceChildren();
  try {
    const names = await settings.models(val('#local-url'));
    if (!names.length) throw new Error('none');
    for (const n of names) { const o = document.createElement('option'); o.value = o.textContent = n; sel.append(o); }
    sel.value = names.includes(val('#local-model')) ? val('#local-model') : names[0];
    $('#local-hint').textContent = T('set.ollamaOk', { n: names.length });
  } catch {
    const o = document.createElement('option'); o.textContent = T('set.noModels'); o.value = ''; sel.append(o);
    $('#local-hint').textContent = T('set.ollamaNone');
  }
}

document.querySelectorAll('input[name="provider"]').forEach((r) => r.addEventListener('change', show));
$('#openai-url').addEventListener('input', show);
$('#local-url').addEventListener('change', refreshModels);
$('#local-model-list').addEventListener('change', (e) => { if (e.target.value) $('#local-model').value = e.target.value; });
$('#clear').addEventListener('click', async () => {
  const r = await settings.clear();
  if (r.ok) say(T('set.priv.cleared'));
});
$('#site').addEventListener('click', () => settings.ollamaSite());

$('#save').addEventListener('click', async () => {
  const r = await settings.save(patch());
  if (r.error) return say(r.error, true);
  fill(r.view);
  setLang(r.lang);
  say(T('set.saved'));
});

$('#test').addEventListener('click', async () => {
  $('#test').disabled = true;
  say(T('set.testing'));
  const r = await settings.test(patch());
  $('#test').disabled = false;
  say(r.ok ? T('set.testOk') : r.message, !r.ok);
});

for (const k of ['openai', 'anthropic']) {
  $('#' + k + '-clear').addEventListener('click', async () => {
    const r = await settings.save({ clearKey: [k], provider: 'off' });
    if (r.error) return say(r.error, true);
    fill(r.view);
    say(T('set.keyRemoved'));
  });
}

async function pull(model, btn) {
  if (!model) return say(T('set.enterModel'), true);
  const bar = $('#pull-bar');
  bar.hidden = false;
  btn.disabled = true;
  say(T('set.downloading', { m: model }));
  const r = await settings.pull(val('#local-url'), model);
  btn.disabled = false;
  bar.hidden = true;
  say(r.ok ? T('set.ready', { m: model }) : r.message, !r.ok);
  if (r.ok) refreshModels();
}
$('#pull').addEventListener('click', () => pull(val('#local-model'), $('#pull')));
$('#pull-embed').addEventListener('click', () => pull(val('#local-embed'), $('#pull-embed')));
settings.onPull((p) => { $('#pull-bar i').style.width = Math.round(p * 100) + '%'; });

// ---- Profiles ----------------------------------------------------------------------------------------------------------
const COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'grey'];
let pcolor = 'blue';
function swatches(box, current, onPick) {
  box.replaceChildren();
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sw-c g-' + c; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(c === current)); b.setAttribute('aria-label', T('group.c.' + c));
    b.addEventListener('click', () => onPick(c));
    box.append(b);
  }
}
function paintProfiles(r) {
  const list = $('#plist');
  list.replaceChildren();
  for (const p of r.items) {
    const row = document.createElement('div'); row.className = 'prow';
    const dot = document.createElement('span'); dot.className = 'pdot g-' + p.color; dot.textContent = (p.name || '?').charAt(0).toUpperCase();
    const name = document.createElement('input'); name.type = 'text'; name.value = p.name; name.maxLength = 30; name.setAttribute('aria-label', T('prof.name'));
    name.addEventListener('change', async () => paintProfiles(await settings.profiles.update(p.id, { name: name.value })));
    const sw = document.createElement('div'); sw.className = 'swatches';
    swatches(sw, p.color, async (c) => paintProfiles(await settings.profiles.update(p.id, { color: c })));
    const act = document.createElement('div'); act.className = 'pacts';
    if (p.id === r.active) { const t = document.createElement('span'); t.className = 'pcur'; t.textContent = T('prof.current'); act.append(t); }
    else { const b = document.createElement('button'); b.type = 'button'; b.className = 'link'; b.textContent = T('prof.switch'); b.addEventListener('click', async () => paintProfiles(await settings.profiles.switch(p.id))); act.append(b); }
    if (r.items.length > 1) { const d = document.createElement('button'); d.type = 'button'; d.className = 'link del'; d.textContent = T('prof.delete'); d.addEventListener('click', async () => paintProfiles(await settings.profiles.remove(p.id))); act.append(d); }
    row.append(dot, name, sw, act);
    list.append(row);
  }
}
function pickColor(c) { pcolor = c; swatches($('#pcolors'), pcolor, pickColor); }
swatches($('#pcolors'), pcolor, pickColor);
$('#padd').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await settings.profiles.create($('#pname').value, pcolor);
  $('#pname').value = '';
  paintProfiles(r);
});
settings.profiles.list().then(paintProfiles);
settings.onPane((id) => go(id));

settings.get().then((r) => { view = r.view; setLang(r.lang); fill(r.view); });

// Left-hand navigation: one pane at a time, arrow keys move between them.
const navs = [...document.querySelectorAll('.nav')];
function go(id) {
  for (const n of navs) { const on = n.dataset.pane === id; n.classList.toggle('on', on); n.setAttribute('aria-selected', String(on)); n.tabIndex = on ? 0 : -1; }
  for (const p of document.querySelectorAll('.pane')) p.classList.toggle('on', p.id === 'pane-' + id);
  $('#test').style.visibility = id === 'ai' ? '' : 'hidden';
  try { sessionStorage.setItem('pane', id); } catch { /* optional */ }
}
navs.forEach((n, i) => {
  n.addEventListener('click', () => go(n.dataset.pane));
  n.addEventListener('keydown', (e) => {
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const t = navs[(i + d + navs.length) % navs.length]; t.focus(); go(t.dataset.pane);
  });
});
let start = new URLSearchParams(location.search).get('pane') || 'general';
try { start = new URLSearchParams(location.search).get('pane') || sessionStorage.getItem('pane') || start; } catch { /* optional */ }
go(start);
