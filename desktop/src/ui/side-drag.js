// Dragging tabs in the sidebar with the pointer. A press that moves 5 px lifts a copy of the row (the ghost) that follows
// the pointer, keeping the spot that was grabbed; the original stays as a faint placeholder. Past the edge of the sidebar
// the ghost resists like a rubber band. Where it would land is shown on the row under the pointer; letting go sends the same
// messages as before (tab:move, tab:groupWith, tab:addToGroup) plus tab:setPinned, and the ghost settles into its new
// place on a spring that keeps the speed it was let go with. Grabbing it again mid-settle carries on from where it is.
// Keyboard users have the tab's context menu, which never animates. The arithmetic is in drag-math.js.
let D = null;   // the press or drag in progress: { el, id, pid, x0, y0, started, ghost, base, grab, samples, target, all }
let G = null;   // a ghost that is settling: { ghost, el, x, y, vx, vy, t0, x0, y0, raf }
let pendingSettle = null;
const calmDrag = matchMedia('(prefers-reduced-motion: reduce)');

const DROP_SEL = '.srow:not(.oi):not(.snew), .pin, .sgrp, .pins';
// Where the drop would land is drawn by one overlay element above the ghost (a mark inside the target row would be hidden
// under it): a line between rows, a frame to group, join a group or pin.
let ind = null;
const clearOver = () => { if (ind) ind.hidden = true; };
const keyOf = (el) => (el._t.pinned ? 'p' : 't') + el._t.id;

function tabDrag(el, all) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || D || e.target.closest('.x, .tg')) return;
    D = { el, id: el._t.id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, started: false, all, samples: [], target: null, lastX: e.clientX, lastY: e.clientY };
    try { el.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
  });
}

function lift(e) {
  const r = D.el.getBoundingClientRect();
  const ghost = D.el.cloneNode(true);
  ghost.classList.add('sghost');
  ghost.removeAttribute('role'); ghost.removeAttribute('aria-label'); ghost.setAttribute('aria-hidden', 'true'); delete ghost.dataset.tip;
  ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;`;
  document.body.append(ghost);
  D.ghost = ghost; D.base = { x: r.left, y: r.top, w: r.width, h: r.height };
  D.grab = { x: D.x0 - r.left, y: D.y0 - r.top };
  D.el.classList.add('sdrag');
  document.documentElement.classList.add('dragging-tab');
  scrollLoop();
}

// Where the ghost is for a pointer position: it keeps the grabbed spot, and resists at the edges of the sidebar.
function ghostAt(x, y) {
  const p = document.querySelector('#side').getBoundingClientRect();
  const gx = clampRubber(x - D.grab.x, p.left, p.right - D.base.w);
  const gy = clampRubber(y - D.grab.y, p.top, p.bottom - D.base.h);
  D.gx = gx; D.gy = gy;
  D.ghost.style.transform = `translate(${gx - D.base.x}px, ${gy - D.base.y}px)`;
}

function targetAt(x, y) {
  for (const n of document.elementsFromPoint(x, y)) {
    const hit = n.closest && n.closest(DROP_SEL);
    if (!hit || hit === D.el || hit === D.ghost) continue;
    if (hit.classList.contains('sgrp')) return D.el._t.pinned ? null : { kind: 'group', el: hit };
    if (hit.classList.contains('pins')) return D.el._t.pinned ? null : { kind: 'pins', el: hit };
    if (!hit._t) continue;
    return { kind: 'tab', el: hit, t: hit._t, zone: zoneOf(hit.getBoundingClientRect(), x, y, !!hit._t.pinned) };
  }
  return null;
}
function showTarget() {
  clearOver();
  const t = D.target;
  if (!t) return;
  if (!ind) { ind = document.createElement('i'); ind.className = 'sdrop'; ind.setAttribute('aria-hidden', 'true'); document.body.append(ind); }
  const r = t.el.getBoundingClientRect();
  const z = t.kind === 'tab' ? t.zone : 'box';
  const box = { left: r.left, top: r.top, width: r.width, height: r.height };
  const at = z === 't' ? { left: r.left + 8, top: r.top - 2, width: r.width - 16, height: 2 }
    : z === 'b' ? { left: r.left + 8, top: r.bottom, width: r.width - 16, height: 2 }
    : z === 'l' ? { left: r.left - 4, top: r.top + 4, width: 2, height: r.height - 8 }
    : z === 'r' ? { left: r.right + 2, top: r.top + 4, width: 2, height: r.height - 8 }
    : box;
  ind.className = 'sdrop' + (z === 'mid' || z === 'box' ? ' frame' : '');
  ind.style.cssText = `left:${at.left}px;top:${at.top}px;width:${at.width}px;height:${at.height}px;`;
  ind.hidden = false;
}

// While the pointer is near the top or bottom of the list, the list scrolls (the ghost is fixed, so it stays under the pointer).
function scrollLoop() {
  if (!D || !D.started) return;
  const sc = document.querySelector('#sscroll');
  const r = sc.getBoundingClientRect();
  const edge = 36;
  const y = D.lastY;
  const dir = y < r.top + edge ? -(1 - Math.max(y - r.top, 0) / edge) : y > r.bottom - edge ? 1 - Math.max(r.bottom - y, 0) / edge : 0;
  if (dir && D.lastX >= r.left && D.lastX <= r.right) { sc.scrollTop += dir * 14; D.target = targetAt(D.lastX, D.lastY); showTarget(); }
  D.raf = requestAnimationFrame(scrollLoop);
}

document.addEventListener('pointermove', (e) => {
  if (!D || e.pointerId !== D.pid) return;
  if (!D.started) {
    if (!isDrag(D.x0, D.y0, e.clientX, e.clientY)) return;
    D.started = true;
    lift(e);
  }
  D.lastX = e.clientX; D.lastY = e.clientY;
  D.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
  if (D.samples.length > 12) D.samples.shift();
  ghostAt(e.clientX, e.clientY);
  D.target = targetAt(e.clientX, e.clientY);
  showTarget();
});

document.addEventListener('pointerup', (e) => { if (D && e.pointerId === D.pid) finish(false); });
document.addEventListener('pointercancel', (e) => { if (D && e.pointerId === D.pid) finish(true); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && D && D.started) finish(true); });

function finish(cancel) {
  const d = D;
  D = null;
  if (!d.started) return;
  cancelAnimationFrame(d.raf);
  clearOver();
  document.documentElement.classList.remove('dragging-tab');
  const v = velocityOf(d.samples, performance.now());
  const sent = !cancel && d.target && d.el.isConnected ? drop(d) : false;
  // Without a drop the ghost goes back to the row it came from.
  const g = { ghost: d.ghost, el: d.el, all: d.all, x: d.gx, y: d.gy, vx: v.x, vy: v.y };
  if (sent) {
    markPointer();
    droppedKey = keyOf(d.el);
    d.el.classList.add('sland');
    pendingSettle = g;
    // If the new state changes nothing on screen, renderSide is not needed to start the settle.
    setTimeout(() => { if (pendingSettle === g) startSettle(); }, 90);
  } else { pendingSettle = g; startSettle(); }
}

// Sends what the drop means. Returns false when it means nothing (a drop on itself, or somewhere that takes no tab).
function drop(d) {
  const t = d.target, me = d.el._t;
  // The rows as they are on screen now (the list a row was made with would be out of date).
  const list = [...document.querySelectorAll(me.pinned && t.t && t.t.pinned ? '#pins .pin' : '#slist .srow:not(.oi):not(.snew)')].map((x) => x._t);
  const next = (x) => { const i = list.findIndex((y) => y.id === x.id); return list[i + 1] ? list[i + 1].id : null; };
  if (t.kind === 'group') { lore.send('tab:addToGroup', me.id, t.el._g.id); return true; }
  if (t.kind === 'pins') { lore.send('tab:setPinned', me.id, true); return true; }
  const o = t.t;
  if (o.id === me.id) return false;
  if (!me.pinned && o.pinned) {
    // Onto a pinned tab: it becomes pinned, next to that one.
    lore.send('tab:setPinned', me.id, true);
    const pins = [...document.querySelectorAll('#pins .pin')].map((x) => x._t);
    const after = pins[pins.findIndex((y) => y.id === o.id) + 1];
    // It already sits at the end of the pins, so only a drop before a pin (or between two) needs a move.
    if (t.zone === 'l') lore.send('tab:move', me.id, o.id);
    else if (after) lore.send('tab:move', me.id, after.id);
    return true;
  }
  if (me.pinned && !o.pinned) {
    // A pinned tab dropped among the others comes off the pins and lands there.
    lore.send('tab:setPinned', me.id, false);
    if (t.zone === 't') lore.send('tab:move', me.id, o.id);
    else if (t.zone === 'b') lore.send('tab:move', me.id, next(o));
    return true;
  }
  if (t.zone === 'mid' && !me.pinned) { lore.send('tab:groupWith', me.id, o.id); return true; }
  const before = t.zone === 't' || t.zone === 'l' ? o.id : next(o);
  if (me.id !== before) lore.send('tab:move', me.id, before);
  return true;
}

// Called when the list has been redrawn after a drop: the row is in its new place, so the ghost can fly there.
function dragRendered() { if (pendingSettle) startSettle(); }

function startSettle() {
  const g = pendingSettle;
  pendingSettle = null;
  if (!g) return;
  const el = g.el;
  if (!el.isConnected) { g.ghost.remove(); return; }
  // Where the row really is now, and how far from it the ghost is.
  const r = el.getBoundingClientRect();
  Object.assign(g.ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const x0 = g.x - r.left, y0 = g.y - r.top;
  g.x0 = x0; g.y0 = y0; g.t0 = performance.now();
  if (calmDrag.matches || (Math.abs(x0) < 0.5 && Math.abs(y0) < 0.5 && Math.abs(g.vx) < 10 && Math.abs(g.vy) < 10)) { g.ghost.remove(); landed(el); return; }
  g.ghost.classList.add('settling');
  g.ghost.addEventListener('pointerdown', (e) => resume(g, e));
  G = g;
  // A window that is hidden or minimized does not run animation frames: the ghost must not stay behind.
  g.guard = setTimeout(() => { if (G === g) { cancelAnimationFrame(g.raf); G = null; g.ghost.remove(); landed(el); } }, 1500);
  const tick = () => {
    if (G !== g) return;
    const t = (performance.now() - g.t0) / 1000;
    const sx = springStep(g.x0, g.vx, t), sy = springStep(g.y0, g.vy, t);
    g.cx = sx.x; g.cy = sy.x;
    g.ghost.style.transform = `translate(${sx.x}px, ${sy.x}px)`;
    if (springDone(sx.x, sx.v) && springDone(sy.x, sy.v)) { clearTimeout(g.guard); G = null; g.ghost.remove(); landed(el); return; }
    g.raf = requestAnimationFrame(tick);
  };
  g.raf = requestAnimationFrame(tick);
}
// Grabbing the ghost while it is still settling: the drag carries on from where it is shown, not from where it was going.
function resume(g, e) {
  if (G !== g || D || e.button !== 0) return;
  cancelAnimationFrame(g.raf); clearTimeout(g.guard);
  G = null;
  const r = g.ghost.getBoundingClientRect();
  g.ghost.classList.remove('settling');
  D = { el: g.el, id: g.el._t.id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, started: true, all: g.all, samples: [], target: null, lastX: e.clientX, lastY: e.clientY,
    ghost: g.ghost, base: { x: parseFloat(g.ghost.style.left), y: parseFloat(g.ghost.style.top), w: r.width, h: r.height }, grab: { x: e.clientX - r.left, y: e.clientY - r.top }, gx: r.left, gy: r.top };
  try { g.ghost.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
  document.documentElement.classList.add('dragging-tab');
  scrollLoop();
}
function landed(el) { el.classList.remove('sdrag', 'sland'); droppedKey = ''; }
function endSettle() { if (!G) return; cancelAnimationFrame(G.raf); clearTimeout(G.guard); G.ghost.remove(); landed(G.el); G = null; }
