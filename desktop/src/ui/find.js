const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
const q = $('#q');
const count = $('#count');
let last = '';

function search(forward, next) {
  const text = q.value;
  if (!text) { last = ''; count.textContent = ''; count.className = ''; finder.query('', true, false); return; }
  // Typing starts a new search; Enter and the arrows move to the next match of the same text.
  finder.query(text, forward, next && text === last);
  last = text;
}

q.addEventListener('input', () => search(true, false));
$('#f').addEventListener('submit', (e) => { e.preventDefault(); search(true, true); });
q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); finder.close(); }
  else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); search(false, true); }
});
$('#next').addEventListener('click', () => { search(true, true); q.focus(); });
$('#prev').addEventListener('click', () => { search(false, true); q.focus(); });
$('#close').addEventListener('click', () => finder.close());

// A long phrase with no match, or one ending in a question mark, is probably a question: offer to ask the page.
const looksLikeQuestion = (s, total) => s.trim().split(/\s+/).length >= 3 && (total === 0 || /\?\s*$/.test(s));
$('#ask').addEventListener('click', () => finder.ask(q.value));
finder.onResult((r) => {
  const askable = !!q.value && looksLikeQuestion(q.value, r.total);
  $('#ask').hidden = !askable;
  count.hidden = askable;
  if (!q.value) { count.textContent = ''; count.className = ''; return; }
  count.textContent = r.total ? T('find.count', { i: r.active, n: r.total }) : T('find.none');
  count.className = r.total ? '' : 'none';
  $('#next').disabled = $('#prev').disabled = !r.total;
});
finder.onFocus(() => { q.focus(); q.select(); });
q.focus();
