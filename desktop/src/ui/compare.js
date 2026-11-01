const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('cmp.h');
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const MAX = 4;
let boxes = [];

function pick(list, pre) {
  const main = $('#main');
  main.replaceChildren();
  $('#go').hidden = false;
  if (list.length < 2) { main.append(h('p', 'empty', T('cmp.few'))); $('#go').disabled = true; return; }
  const ul = h('ul', 'pick');
  boxes = [];
  for (const t of list) {
    const li = h('li', t.loaded ? '' : 'off');
    const l = h('label');
    const c = h('input'); c.type = 'checkbox'; c.disabled = !t.loaded; c.checked = t.loaded && pre.includes(t.id); c.dataset.id = t.id;
    c.addEventListener('change', sync);
    l.append(c, h('span', 't', t.title), h('span', 'h', t.loaded ? t.host : T('cmp.notLoaded')));
    li.append(l);
    ul.append(li);
    boxes.push(c);
  }
  main.append(ul);
  sync();
}
function sync() {
  const n = boxes.filter((b) => b.checked).length;
  for (const b of boxes) if (!b.checked && !b.parentElement.parentElement.classList.contains('off')) b.disabled = n >= MAX;
  $('#go').disabled = n < 2;
  $('#note').textContent = T('cmp.pickNote', { n, max: MAX });
}

function table(r) {
  const main = $('#main');
  main.replaceChildren();
  const t = h('table');
  const head = h('tr');
  head.append(h('th'));
  for (const p of r.pages) { const th = h('th', '', p.title); th.append(h('small', '', p.host)); head.append(th); }
  t.append(h('thead')).firstChild.append(head);
  const body = h('tbody');
  for (const row of r.rows) {
    const tr = h('tr');
    tr.append(h('th', '', row.aspect));
    row.cells.forEach((c, i) => { const td = h('td', row.flags[i] ? 'flag' : '', c); if (row.flags[i]) td.title = T('cmp.flag'); tr.append(td); });
    body.append(tr);
  }
  t.append(body);
  main.append(t);
  $('#note').textContent = (r.remote ? T('cmp.remote', { host: r.remote }) : T('cmp.local')) + ' ' + T('cmp.flagNote');
  $('#go').hidden = true;
}

$('#go').addEventListener('click', async () => {
  const ids = boxes.filter((b) => b.checked).map((b) => Number(b.dataset.id));
  const main = $('#main');
  main.replaceChildren();
  const w = h('div', 'wait'); const d = h('span', 'dots'); d.append(h('i'), h('i'), h('i')); w.append(d, h('span', '', T('cmp.working')));
  main.append(w);
  $('#go').disabled = true;
  const r = await compare.run(ids);
  if (r && r.rows) return table(r);
  main.replaceChildren(h('p', 'err', T(r && r.error === 'noModel' ? 'cmp.noModel' : 'cmp.failed')));
  $('#go').hidden = false; $('#go').disabled = false;
});
$('#close').addEventListener('click', () => window.close());
compare.tabs().then((r) => pick(r.tabs, r.preselect));
