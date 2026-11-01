const p = new URLSearchParams(location.search);
const lang = p.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('certerr.title');
const target = p.get('url') || '';
const $ = (id) => document.getElementById(id);
let host = '';
try { host = new URL(target).hostname; } catch { /* shown as is */ }
const reason = ['name', 'date', 'authority', 'revoked', 'weak', 'invalid'].includes(p.get('reason')) ? p.get('reason') : 'invalid';
$('why').textContent = T('certerr.' + reason, { host });
$('addr').textContent = target;
// Handled by the main process, and only when this page is the one asking. "cert=1" allows this one host until Lore is closed.
$('go').href = 'lore-proceed:?cert=1&u=' + encodeURIComponent(target);
