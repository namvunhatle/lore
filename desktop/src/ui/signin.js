const p = new URLSearchParams(location.search);
const lang = p.get('lang') === 'vi' ? 'vi' : 'en';
LORE_I18N.apply(lang);
document.title = LORE_I18N.t(lang, 'sign.title');
const target = p.get('url') || 'https://accounts.google.com/';
// Both links are handled by the main process, and only when this page sends them.
document.getElementById('open').href = 'lore-external:?u=' + encodeURIComponent(target);
