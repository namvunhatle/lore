const $ = (s) => document.querySelector(s);
const lang = new URLSearchParams(location.search).get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('pw.h');
const say = (t) => { $('#status').textContent = t; };
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

async function paint() {
  const list = await vault.list();
  $('#empty').hidden = list.length > 0;
  const ul = $('#list');
  ul.replaceChildren();
  for (const x of list) {
    const li = h('li');
    const who = h('div', 'who'); const b = h('b', '', x.site); const s = h('small', '', x.user || T('pw.noUser'));
    if (x.reused) s.append(h('span', 'flag', T('pw.reused')));
    if (x.weak) s.append(h('span', 'flag', T('pw.weak')));
    who.append(b, s);
    const acts = h('div', 'acts');
    const btn = (label, fn, cls) => { const k = h('button', cls || '', label); k.type = 'button'; k.addEventListener('click', fn); acts.append(k); };
    btn(T('pw.copy'), async () => { say((await vault.copy(x.id)) ? T('pw.copied') : T('pw.locked')); });
    btn(T('pw.check'), async () => { say(T('pw.checking')); const r = await vault.check(x.id); say(r.error ? T('br.err') : r.n ? T('pw.breached', { n: r.n.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') }) : T('pw.notBreached')); });
    btn(T('pw.del'), async () => { await vault.remove(x.id); paint(); }, 'del');
    li.append(who, acts);
    ul.append(li);
  }
}
$('#all').addEventListener('click', async () => {
  const list = await vault.list();
  let bad = 0;
  $('#all').disabled = true;
  for (const [k, x] of list.entries()) {
    say(T('pw.checking') + ' ' + (k + 1) + '/' + list.length);
    const r = await vault.check(x.id);
    if (r.n) { bad++; const li = $('#list').children[k]; if (li) li.querySelector('small').append(Object.assign(document.createElement('span'), { className: 'flag', textContent: T('pw.breachedShort') })); }
  }
  $('#all').disabled = false;
  say(T('pw.allDone', { n: list.length, bad }));
});
$('#gen').addEventListener('click', async () => { $('#pass').value = await vault.generate(); });
$('#add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await vault.add($('#site').value, $('#user').value, $('#pass').value);
  if (!r) return say(T('pw.bad'));
  $('#site').value = $('#user').value = $('#pass').value = '';
  say(T('pw.saved'));
  paint();
});
paint();
