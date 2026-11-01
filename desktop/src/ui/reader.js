const p = new URLSearchParams(location.search);
const lang = p.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
const $ = (id) => document.getElementById(id);

let a = {};
try { a = JSON.parse(p.get('d') || '{}'); } catch { /* empty reader */ }
const url = p.get('url') || '';

document.title = a.title || T('bar.reader');
$('site').textContent = a.siteName || '';
$('title').textContent = a.title || '';
$('meta').textContent = [a.byline, a.minutes ? T('reader.minutes', { n: a.minutes }) : ''].filter(Boolean).join(' · ');
$('content').append(LORE_SANITIZE(a.content || '', url));
if (a.summary && a.summary.length) {
  $('points').hidden = false;
  for (const s of a.summary) { const li = document.createElement('li'); li.textContent = s; $('pts').append(li); }
}
if (/^https?:/.test(url)) $('orig').href = url; else $('orig').hidden = true;
