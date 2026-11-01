const $ = (s) => document.querySelector(s);
const lang = new URLSearchParams(location.search).get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('br.h');
$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('#out');
  if (!$('#pw').value) return;
  $('#go').disabled = true;
  out.className = ''; out.textContent = T('br.wait');
  const r = await breach.check($('#pw').value);
  $('#pw').value = '';
  $('#go').disabled = false;
  if (r.error) { out.className = 'bad'; out.textContent = T('br.err'); return; }
  out.className = r.n ? 'bad' : '';
  out.textContent = r.n ? T('br.seen', { n: r.n.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') }) : T('br.clean');
});
