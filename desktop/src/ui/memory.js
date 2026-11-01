const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('mem.title');

// Time range chips: one is always pressed; "all" is the default.
const RANGES = ['all', 'hour', 'day', 'week', 'month'];
let range = 'all';
for (const r of RANGES) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.dataset.r = r; b.textContent = T('mem.r.' + r);
  b.addEventListener('click', () => { range = r; paint(); refresh(); });
  $('#ranges').append(b);
}
function paint() { for (const b of $('#ranges').children) b.setAttribute('aria-pressed', String(b.dataset.r === range)); }
paint();

// Wraps the words of the query in <mark> without ever touching innerHTML.
function mark(el, text, q) {
  const words = q.trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return void (el.textContent = text);
  let last = 0;
  for (const m of text.matchAll(new RegExp(words.join('|'), 'gi'))) {
    el.append(text.slice(last, m.index));
    const k = document.createElement('mark'); k.textContent = m[0]; el.append(k);
    last = m.index + m[0].length;
  }
  el.append(text.slice(last));
}

function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? LORE_I18N.t(lang, 'ago.today') : d === 1 ? LORE_I18N.t(lang, 'ago.yesterday') : LORE_I18N.t(lang, 'ago.days', { n: d });
}

// Topics: pages grouped by the words their titles share. Pressing one narrows the list to its pages.
let topicList = [];
let topic = -1;
function paintTopics() {
  const box = $('#topics');
  box.replaceChildren();
  box.hidden = !topicList.length;
  topicList.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = t.name + ' · ' + t.count;
    b.setAttribute('aria-pressed', String(i === topic));
    b.addEventListener('click', () => { topic = topic === i ? -1 : i; paintTopics(); refresh(); });
    box.append(b);
  });
}
memory.topics().then((t) => { topicList = t; paintTopics(); });

$('#sum').addEventListener('click', async () => {
  const btn = $('#sum');
  btn.disabled = true;
  $('#digest').hidden = false;
  $('#dg-k').textContent = T('mem.sumK');
  $('#dg-t').textContent = T('mem.sumWait');
  $('#dg-m').textContent = '';
  const r = await memory.digest();
  btn.disabled = false;
  if (!r.pages) { $('#dg-t').textContent = T('mem.sumNone'); return; }
  $('#dg-t').textContent = r.text || T('mem.sumPlain', { n: r.pages });
  const names = r.topics.slice(0, 4).map((t) => t.name).join(', ');
  $('#dg-m').textContent = (names ? names + '. ' : '') + (r.text ? (r.remote ? T('mem.sumRemote', { host: r.remote }) : T('mem.sumLocal')) : '');
});

let timer;
async function refresh() {
  const host = $('#host').value;
  const r = await memory.list({ q: $('#q').value, range, host });
  if (topic >= 0 && topicList[topic]) { const set = new Set(topicList[topic].urls); r.items = r.items.filter((i) => set.has(i.url)); }
  // site filter
  const cur = $('#host').value;
  $('#host').replaceChildren();
  const all = document.createElement('option'); all.value = ''; all.textContent = T('mem.allSites'); $('#host').append(all);
  for (const h of r.hosts) { const o = document.createElement('option'); o.value = h.host; o.textContent = h.host + ' (' + h.count + ')'; $('#host').append(o); }
  $('#host').value = r.hosts.some((h) => h.host === cur) ? cur : '';

  $('#count').textContent = T('mem.count', { n: r.items.length }) + (r.total !== r.items.length ? ' / ' + r.total : '');
  const ds = $('#del-site');
  ds.hidden = !$('#host').value;
  ds.textContent = T('mem.deleteSite', { host: $('#host').value });
  $('#status').textContent = r.embedded ? T('mem.meaning', { n: r.embedded }) : T('mem.keywordOnly');

  $('#clr').hidden = !$('#q').value;
  const ul = $('#list');
  ul.replaceChildren();
  const empty = $('#empty');
  empty.hidden = r.items.length > 0;
  $('#count').hidden = !r.items.length;
  $('.dot').hidden = !r.items.length;
  if (!r.items.length) {
    $('#empty-t').textContent = r.total ? T('mem.noMatch') : T('mem.empty');
    const ex = $('#examples');
    ex.replaceChildren();
    // With nothing stored yet there is nothing to suggest; with no match, suggest clearing the filters.
    if (r.total) for (const [label, fn] of [[T('mem.reset'), () => { $('#q').value = ''; range = 'all'; $('#host').value = ''; paint(); refresh(); }]]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label; b.addEventListener('click', fn); ex.append(b);
    }
    return;
  }
  for (const it of r.items) {
    const li = document.createElement('li');
    const ico = document.createElement('span'); ico.className = 'ico'; ico.textContent = (it.host || '?').replace(/^www\./, '')[0];
    if (it.icon) {
      const img = document.createElement('img');
      img.alt = ''; img.src = it.icon;
      img.addEventListener('load', () => { ico.textContent = ''; ico.classList.add('has'); ico.append(img); });
    }
    const body = document.createElement('div'); body.className = 'body';
    const a = document.createElement('a'); a.href = it.url; a.target = '_blank'; mark(a, it.title, $('#q').value);
    const s = document.createElement('small'); s.textContent = T('mem.visited', { host: it.host, when: ago(it.ts) });
    body.append(a, s);
    if (it.snippet) { const p = document.createElement('p'); mark(p, it.snippet, $('#q').value); body.append(p); }
    const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', T('mem.remove'));
    x.addEventListener('click', async () => { await memory.remove(it.url); refresh(); });
    li.append(ico, body, x);
    ul.append(li);
  }
}

$('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 200); });
$('#clr').addEventListener('click', () => { $('#q').value = ''; $('#q').focus(); refresh(); });
$('#host').addEventListener('change', refresh);
$('#del-range').addEventListener('click', async () => { await memory.removeRange(range); refresh(); });
$('#del-site').addEventListener('click', async () => { await memory.removeHost($('#host').value); $('#host').value = ''; refresh(); });
$('#export').addEventListener('click', async () => { const r = await memory.export(); if (r.ok) $('#status').textContent = T('mem.exported', { n: r.count }); });
refresh();
