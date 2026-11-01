const p = new URLSearchParams(location.search);
const lang = p.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('warn.title');
const target = p.get('url') || '';
$ = (id) => document.getElementById(id);
$('why').textContent = T('warn.' + (['list', 'lookalike', 'idn'].includes(p.get('reason')) ? p.get('reason') : 'list'), { brand: p.get('brand') || '' });
$('addr').textContent = target;
// Handled by the main process, and only when this page is the one asking.
$('go').href = 'lore-proceed:?u=' + encodeURIComponent(target);
// A page that only works over plain http: the person can still open it, knowing nobody protects what they send.
if (p.get('reason') === 'insecure') {
  document.title = T('warn.insTitle');
  document.querySelector('h1').textContent = T('warn.insTitle');
  $('why').textContent = T('warn.insecure', { host: new URL(target).hostname });
  $('go').textContent = T('warn.insProceed');
  $('go').href = 'lore-proceed:?why=ins&u=' + encodeURIComponent(target);
}
