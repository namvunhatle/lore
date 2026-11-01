const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('rep.h');
const fmt = (n) => n.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let summary = '';

report.get().then((w) => {
  $('#range').textContent = T('rep.range', { a: w.days[0].day, b: w.days[6].day });
  for (const [k, label] of [['blocked', T('rep.blocked')], ['params', T('rep.params')], ['https', T('rep.https')]]) {
    const d = h('div'); d.append(h('b', '', fmt(w.total[k])), h('span', '', label)); $('#nums').append(d);
  }
  const max = Math.max(1, ...w.days.map((d) => d.blocked));
  $('#bars').setAttribute('aria-label', T('rep.chart'));
  for (const d of w.days) {
    const c = h('div'); const bar = h('i'); bar.style.height = Math.max(2, Math.round((d.blocked / max) * 72)) + 'px'; bar.title = fmt(d.blocked);
    c.append(bar, h('small', '', d.day.slice(5)));
    $('#bars').append(c);
  }
  $('#none').hidden = w.top.length > 0;
  for (const t of w.top) { const li = h('li'); li.append(h('span', '', t.host), h('span', '', fmt(t.count))); $('#top').append(li); }
  summary = T('rep.share', { blocked: fmt(w.total.blocked), params: fmt(w.total.params), https: fmt(w.total.https) });
});
$('#copy').addEventListener('click', () => { report.copy(summary); $('#done').textContent = T('rep.copied'); });
