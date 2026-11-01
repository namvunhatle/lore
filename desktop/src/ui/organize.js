const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const source = params.get('source') === 'bookmarks' ? 'bookmarks' : 'tabs';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
const noun = (n) => T('org.' + source + (n === 1 ? '1' : 'N'), { n });
document.title = T('org.title.' + source);
$('#h').textContent = T('org.title.' + source);
$('#lead').textContent = T('org.lead.' + source);
$('#wait-t').textContent = T('org.reading.' + source);

let data = null;
const state = { groups: [], dupes: true };

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function card(g) {
  const c = h('div', 'card' + (g.on ? '' : ' off'));
  const head = h('div', 'ch');
  const cb = h('input'); cb.type = 'checkbox'; cb.checked = g.on; cb.setAttribute('aria-label', T('org.include'));
  cb.addEventListener('change', () => { g.on = cb.checked; paint(); });
  const name = h('input'); name.type = 'text'; name.value = g.name; name.maxLength = 30; name.setAttribute('aria-label', T('org.groupName'));
  name.addEventListener('input', () => { g.name = name.value; });
  head.append(cb, name, h('span', 'count', String(g.items.length)));
  const ul = h('ul');
  for (const it of g.items) {
    const li = h('li');
    const x = h('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', T('org.leave'));
    x.addEventListener('click', () => { g.items = g.items.filter((i) => i !== it); if (g.items.length < 2) g.on = false; paint(); });
    li.append(h('span', 't', it.title), h('span', 'h', it.host), x);
    ul.append(li);
  }
  c.append(head, ul);
  return c;
}

function paint() {
  const main = $('#main');
  main.replaceChildren();
  const how = h('div', 'how' + (data.ai ? '' : ' warn'));
  if (data.ai) how.textContent = data.remote ? T('org.byRemote', { host: data.remote }) : T('org.byLocal', { model: data.model });
  else if (!data.modelReady) { how.append(document.createTextNode(T('org.noModel') + ' ')); const b = h('button', '', T('task.openSettings')); b.type = 'button'; b.addEventListener('click', () => organize.settings()); how.append(b); }
  else how.textContent = T('org.fallback');
  main.append(how);
  if (data.skipped) main.append(h('div', 'sub', T('org.skipped', { n: data.skipped })));
  for (const g of state.groups) main.append(card(g));
  if (!state.groups.length) main.append(h('p', 'sub', T('org.nothing.' + source)));
  if (data.duplicates.length) {
    const sec = h('div', 'card' + (state.dupes ? '' : ' off'));
    const head = h('div', 'ch');
    const cb = h('input'); cb.type = 'checkbox'; cb.checked = state.dupes;
    cb.addEventListener('change', () => { state.dupes = cb.checked; paint(); });
    head.append(cb, h('b', '', T(data.duplicates.length === 1 ? 'org.dupes1' : 'org.dupes', { n: data.duplicates.length })));
    const ul = h('ul');
    for (const d of data.duplicates) { const li = h('li'); li.append(h('span', 't', d.title), h('span', 'h', d.host)); ul.append(li); }
    sec.append(head, h('div', 'sub', T('org.dupesNote', { k: /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl+' })), ul);
    main.append(sec);
  }
  if (data.ungrouped.length) main.append(h('div', 'sub', T('org.ungrouped', { n: data.ungrouped.length })));
  const n = state.groups.filter((g) => g.on && g.items.length >= 2).reduce((a, g) => a + g.items.length, 0);
  const d = state.dupes ? data.duplicates.length : 0;
  $('#apply').textContent = T('org.apply');
  $('#apply').disabled = !n && !d;
  $('#note').textContent = T('org.summary.' + source, { n, d });
}

function done(r) {
  const main = $('#main');
  main.replaceChildren();
  const box = h('div', 'done');
  box.append(h('b', '', T('org.done.' + source, { n: r.moved })), h('p', '', r.closed ? T('org.closed', { n: r.closed }) : ''));
  const row = h('div', 'row');
  const undo = h('button', 'btn', T('org.undo')); undo.type = 'button';
  undo.addEventListener('click', async () => { await organize.undo(); window.close(); });
  const ok = h('button', 'btn pri', T('org.close')); ok.type = 'button'; ok.addEventListener('click', () => window.close());
  row.append(undo, ok);
  box.append(row);
  main.append(box);
  $('#foot').hidden = true;
}

$('#cancel').addEventListener('click', () => window.close());
$('#apply').addEventListener('click', async () => {
  $('#apply').disabled = true;
  const plan = {
    groups: state.groups.filter((g) => g.on && g.items.length >= 2 && g.name.trim()).map((g) => ({ name: g.name, ids: g.items.map((i) => i.id) })),
    closeDuplicates: state.dupes ? data.duplicates.map((d) => d.id) : []
  };
  const r = await organize.apply(plan);
  if (r && r.ok) done(r); else $('#note').textContent = T('org.failed');
});

organize.propose().then((r) => {
  if (!r) return;
  data = r;
  state.groups = r.groups.map((g) => ({ name: g.name, items: g.items, on: true }));
  $('#foot').hidden = false;
  paint();
}).catch(() => { $('#wait-t').textContent = T('org.failed'); });
