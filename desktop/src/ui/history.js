const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('hist.title');

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

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
function dayLabel(ts) {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  if (day === today) return T('hist.today');
  if (day === today - 86400000) return T('hist.yesterday');
  return new Date(ts).toLocaleDateString(lang === 'vi' ? 'vi-VN' : undefined, { weekday: 'long', day: 'numeric', month: 'long', year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
const clock = (ts) => new Date(ts).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : undefined, { hour: '2-digit', minute: '2-digit' });

function row(i) {
  const li = document.createElement('li');
  const ico = document.createElement('div'); ico.className = 'ico';
  if (i.icon) { const img = document.createElement('img'); img.alt = ''; img.src = i.icon; ico.append(img); } else ico.textContent = (i.host || '?').charAt(0);
  const body = document.createElement('div'); body.className = 'body';
  const t = document.createElement('button'); t.type = 'button'; t.className = 't'; t.textContent = i.title || i.url; t.addEventListener('click', () => browsing.go(i.url));
  const u = document.createElement('div'); u.className = 'u'; u.textContent = i.host;
  body.append(t, u);
  const time = document.createElement('span'); time.className = 'time'; time.textContent = clock(i.ts);
  const acts = document.createElement('div'); acts.className = 'acts';
  const d = document.createElement('button'); d.type = 'button'; d.className = 'del'; d.textContent = T('dl2.remove');
  d.addEventListener('click', async () => { await browsing.remove(i.url); refresh(); });
  acts.append(d);
  li.append(ico, body, time, acts);
  return li;
}

async function refresh() {
  const r = await browsing.list({ q: $('#q').value, range });
  const nodes = [];
  let last = '';
  for (const i of r.items) {
    const label = dayLabel(i.ts);
    if (label !== last) { const h = document.createElement('h2'); h.textContent = label; nodes.push(h); last = label; }
    nodes.push(row(i));
  }
  // Headings and rows share one list so the page scrolls as one piece.
  const ul = $('#list');
  ul.replaceChildren(...nodes.map((n) => { if (n.tagName === 'H2') { const li = document.createElement('li'); li.className = 'day'; li.append(n); return li; } return n; }));
  $('#empty').hidden = r.items.length > 0;
  $('#empty-t').textContent = r.total ? T('hist.noMatch') : T('hist.empty');
  $('#clear').disabled = !r.total;
}

$('#q').addEventListener('input', refresh);
$('#clear').addEventListener('click', async () => { if (await browsing.clear(range)) refresh(); });
refresh();
