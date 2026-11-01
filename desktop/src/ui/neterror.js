const p = new URLSearchParams(location.search);
const lang = p.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
const $ = (id) => document.getElementById(id);

const target = p.get('url') || '';
const code = Number(p.get('code')) || 0;
let host = '';
try { host = new URL(target).hostname.replace(/^www\./, ''); } catch { /* shown without a name */ }

// What went wrong, in one word. Offline wins: with no connection nothing else matters.
const offline = p.get('offline') === '1' || [-106, -21].includes(code);
const kind = p.get('code') === 'crash' ? 'crash' : offline ? 'offline' : code === -105 ? 'dns' : [-7, -118].includes(code) ? 'slow' : [-102, -101, -100, -324, -109].includes(code) ? 'down' : 'other';

document.title = T('net.' + kind + '.h', { host });
$('h').textContent = T('net.' + kind + '.h', { host });
$('sub').textContent = T('net.' + kind + '.s', { host });
$('retry').textContent = T('net.retry');
// Handled by the main process, and only when this page is the one asking.
$('retry').href = 'lore-retry:?u=' + encodeURIComponent(target);

// A name that does not exist is often a search typed without spaces, so offer it as one.
if (!offline && host) {
  const s = $('search');
  s.hidden = false;
  s.textContent = T('net.search', { q: host });
  // The address is built by the main process from the chosen search engine; only the text is filled in here.
  const tpl = p.get('search') || 'https://duckduckgo.com/?q=%s';
  s.href = /^https:\/\//.test(tpl) ? tpl.replace('%s', encodeURIComponent(host)) : 'https://duckduckgo.com/?q=' + encodeURIComponent(host);
}

// With no connection there is nothing to read, so there is a small game. Lore reconnects by itself.
if (offline) {
  $('game').hidden = false;
  window.addEventListener('online', () => $('retry').click());
}
