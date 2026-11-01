// The sidebar while it is hidden. This page lives in a transparent view on top of the pages: a 6 px strip along the
// left edge when idle. When the pointer rests on the strip, the main process widens the view and the sidebar slides
// in; when the pointer leaves, it slides out and only then is the view narrowed back to the strip.
const root = document.documentElement;
const panel = $('#side');
root.classList.add('peek');
let want = false;   // should the sidebar be out?
let openTimer = 0;
let closeTimer = 0;
let lastState = null;

function render(s) {
  lastState = s;
  if (s.lang !== lang) { lang = s.lang; LORE_I18N.apply(lang); tips(); }
  if (editingGroup) { waiting = s; return; }
  renderSide(s);
}

function open() {
  clearTimeout(closeTimer);
  if (want) return;
  want = true;
  // The main process moves the view onto the screen (a move, not a resize); the slide starts right away.
  lore.send('side:peek', true);
  root.classList.add('open');
}

function close() {
  clearTimeout(openTimer);
  if (!want || editingGroup) return;
  want = false;
  root.classList.remove('open');
  // Narrow the view once the slide is over (transitionend below); this is a fallback if no transition runs.
  clearTimeout(closeTimer);
  closeTimer = setTimeout(done, 400);
}
function done() { if (!want) lore.send('side:peek', false); }
panel.addEventListener('transitionend', (e) => { if (e.target === panel && !want) { clearTimeout(closeTimer); done(); } });

// A short rest on the edge (40 ms) opens it, so sweeping the pointer past the edge does not. Leaving closes it after a beat,
// so a pointer that slips off for a moment does not make it flicker.
document.addEventListener('mousemove', (e) => {
  const r = panel.getBoundingClientRect();
  const over = !root.classList.contains('open') || e.clientX <= r.right + 2;
  if (!want) { clearTimeout(openTimer); openTimer = setTimeout(open, 40); return; }
  clearTimeout(closeTimer);
  if (!over) closeTimer = setTimeout(close, 250);
});
root.addEventListener('mouseleave', () => {
  clearTimeout(openTimer);
  if (want) { clearTimeout(closeTimer); closeTimer = setTimeout(close, 250); }
});
// Dragging a tab out of the sidebar, or a menu opened from it, must not close it under the user.
document.addEventListener('dragstart', () => clearTimeout(closeTimer));

// The main process watches the edge too (it catches quick flicks that skip over the strip) and says when to come out.
lore.onPeek((v) => {
  if (v && !want) { clearTimeout(closeTimer); clearTimeout(openTimer); want = true; root.classList.add('open'); }
  else if (!v) close();
});
lore.onState(render);
LORE_I18N.apply(lang);
tips();
