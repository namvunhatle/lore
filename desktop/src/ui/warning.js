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
