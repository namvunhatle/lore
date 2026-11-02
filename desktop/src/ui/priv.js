const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function row(key, title, note, on, enabled = true) {
  const li = h('li', on ? '' : 'off');
  const t = h('div', 't'); t.append(h('b', '', title), h('small', '', note));
  const sw = h('button', 'sw'); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(on)); sw.setAttribute('aria-label', title); sw.disabled = !enabled;
  sw.addEventListener('click', async () => { await priv.set(key, sw.getAttribute('aria-checked') !== 'true'); paint(); });
  li.append(t, sw);
  return li;
}

async function paint() {
  const s = await priv.get();
  $('#host').textContent = s.host || T('priv.noSite');
  $('#sub').textContent = T('priv.sub');
  const rows = $('#rows');
  rows.replaceChildren(
    row('ads', T('priv.ads'), T('priv.adsNote', { n: s.today.blocked }), s.ads),
    row('clean', T('priv.clean'), s.site ? T('priv.cleanNote', { n: s.today.params }) : T('priv.siteOnly'), s.clean, !!s.site && s.stripOn),
    row('https', T('priv.https'), T('priv.httpsNote', { n: s.today.https }), s.https),
    row('memory', T('priv.memory'), T('priv.memoryNote'), s.memory),
    row('ai', T('priv.ai'), s.site ? T('priv.aiNote') : T('priv.siteOnly'), s.ai, !!s.site)
  );
  const never = h('li', '');
  const t = h('div', 't'); t.append(h('b', '', T('priv.share')), h('small', '', T('priv.shareNote')));
  never.append(t, h('span', 'never', T('priv.never')));
  rows.append(never);
  setTimeout(() => priv.size(document.getElementById("box").offsetHeight + 4), 30);
}
$('#rep').addEventListener('click', () => priv.report());
$('#set').addEventListener('click', () => priv.settings());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') priv.close(); });
priv.onRefresh(paint);
paint();
