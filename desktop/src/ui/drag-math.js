// The arithmetic behind dragging tabs in the sidebar, kept apart from the DOM so it can be unit tested. Loaded as a plain
// script by the sidebar pages (the functions become globals) and with require() by the tests.
const DRAG_START = 5;          // px a press must move before it counts as a drag
const RUBBER_D = 60;           // how far the rubber band reaches before it is nearly tight
const SPRING_RESPONSE = 0.35;  // seconds: a critically damped spring that settles in about this time

// Pulling past an edge: the first pixels follow the pointer, then it gets harder, and it never goes past RUBBER_D / 0.55.
const rubber = (x) => (x * RUBBER_D * 0.55) / (RUBBER_D + 0.55 * x);
const clampRubber = (pos, min, max) => (pos < min ? min - rubber(min - pos) : pos > max ? max + rubber(pos - max) : pos);

// Critically damped spring toward 0, in closed form so frames of any length give the same motion:
// x(t) = (x0 + (v0 + w*x0) t) e^(-w t), w = 2*pi / response.
function springStep(x0, v0, t) {
  const w = (2 * Math.PI) / SPRING_RESPONSE;
  const b = v0 + w * x0;
  const e = Math.exp(-w * t);
  return { x: (x0 + b * t) * e, v: (b - w * (x0 + b * t)) * e };
}
const springDone = (x, v) => Math.abs(x) < 0.5 && Math.abs(v) < 10;

// Speed at release (px per second) from the pointer samples of the last 100 ms; a pause before letting go means none.
function velocityOf(samples, now) {
  const s = samples.filter((p) => p.t >= now - 100);
  if (s.length < 2) return { x: 0, y: 0 };
  const a = s[0], b = s[s.length - 1];
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt } : { x: 0, y: 0 };
}

// Where on a target a drop lands. Rows: top and bottom thirds reorder, the middle groups. Pins sit in a row: left and right.
function zoneOf(r, x, y, pin) {
  if (pin) return (x - r.left) / r.width < 0.5 ? 'l' : 'r';
  const f = (y - r.top) / r.height;
  return f < 0.3 ? 't' : f > 0.7 ? 'b' : 'mid';
}

const isDrag = (x0, y0, x, y) => Math.hypot(x - x0, y - y0) >= DRAG_START;

if (typeof module === 'object' && module.exports) module.exports = { rubber, clampRubber, springStep, springDone, velocityOf, zoneOf, isDrag, DRAG_START, SPRING_RESPONSE };
