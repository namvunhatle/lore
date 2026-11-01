const p = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const lang = p.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);

const kind = p.get('kind');
const q0 = p.get('q') || '';
const cut = (t) => (t.length > 40 ? t.slice(0, 39) + '…' : t);

document.title = { loading: cut(q0), answer: cut(q0), memory: T('title.memory', { q: cut(q0) }), agent: T('title.agent'), noreader: T('bar.reader'), nopage: T('title.page'), download: T('title.download') }[kind] || T(p.get('private') === '1' ? 'tab.newPrivate' : 'tab.new');

// Cards run their example through the intent bar: the main process handles lore-run: links.
const run = (q) => 'lore-run:?q=' + encodeURIComponent(q);
$('c-ask').href = run(T('card.ask.q'));
$('c-do').href = run(T('card.do.q'));
$('c-mem').href = run(T('card.mem.q'));
$('c-dl').href = run(T('card.dl.q'));
for (const [id, a] of [['t-tasks', 'tasks'], ['t-private', 'private'], ['t-memory', 'memory'], ['t-settings', 'settings']]) $(id).href = 'lore-do:?a=' + a;
if (kind) $('tools').style.display = 'none';

function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? T('ago.today') : d === 1 ? T('ago.yesterday') : T('ago.days', { n: d });
}

function noteWith(title, text) {
  $('note').style.display = 'block';
  $('msg').textContent = title;
  $('soon').textContent = text;
}

if (kind === 'memory') {
  noteWith(T('kind.memory') + ': "' + q0 + '"', T('note.memoryPrivate'));
  const results = JSON.parse(p.get('results') || '[]');
  const box = $('hits');
  if (!results.length) box.textContent = T('mem.none', { n: p.get('total') || 0 });
  for (const r of results) {
    const a = document.createElement('a');
    a.href = r.url;
    const b = document.createElement('b');
    b.textContent = r.title;
    const s = document.createElement('small');
    s.textContent = T('mem.meta', { host: new URL(r.url).hostname, when: ago(r.ts) });
    a.append(b, s);
    if (r.snippet) { const sn = document.createElement('small'); sn.textContent = r.snippet; sn.style.marginTop = '4px'; a.append(sn); }
    box.append(a);
  }
} else if (kind === 'agent') {
  noteWith(T('kind.agent') + ': "' + q0 + '"', T('note.agentNo'));
} else if (kind === 'nopage') {
  noteWith(T('title.page'), T('note.noPage'));
} else if (kind === 'noreader') {
  noteWith(T('bar.reader'), T('note.noReader'));
} else if (kind === 'download') {
  noteWith(T('kind.download') + ': "' + q0 + '"', T('note.noVideo'));
}

if (kind === 'loading' || kind === 'answer') {
  $('cards').style.display = 'none';
  $('h1').textContent = kind === 'loading' ? T('ans.thinking') : T('ans.title');
  $('sub').style.display = 'none';
  $('ans').hidden = false;
  $('ask').textContent = T('ans.asked', { q: q0 });
  $('web').style.display = 'none';
}

if (kind === 'answer') {
  const a = JSON.parse(p.get('answer'));
  if (a.claims) {
    // AI-02: every sentence links to the line of the source it came from.
    a.claims.forEach((c, k) => {
      if (k) $('lead').append(' ');
      $('lead').append(document.createTextNode(c.text));
      const sup = document.createElement('sup');
      c.cites.forEach((n) => {
        const l = document.createElement('a');
        l.href = a.sources[0].url;
        l.textContent = '[' + n + ']';
        l.title = a.evidence[n - 1] || '';
        sup.append(l);
      });
      $('lead').append(sup);
    });
  } else $('lead').textContent = a.summary;
  for (const s of a.sources) {
    const el = document.createElement('a');
    el.href = s.url;
    const t = document.createElement('span');
    t.textContent = s.title;
    const h = document.createElement('small');
    h.textContent = new URL(s.url).hostname;
    el.append(t, h);
    $('srcs').append(el);
  }
  $('meta').textContent = a.meta;
  $('web').href = p.get('web');
  $('web').style.display = 'inline-block';
}

if (!kind) $('stats').textContent = T('home.stats', { n: Number(p.get('blocked') || 0).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') });
else $('stats').hidden = true;

if (kind) $('cards').style.display = kind === 'loading' || kind === 'answer' ? 'none' : '';

// A pressed card stays highlighted while the bar types its example.
for (const c of document.querySelectorAll('.card')) c.addEventListener('click', () => c.classList.add('go'));
