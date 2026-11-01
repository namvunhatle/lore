const test = require('node:test');
const assert = require('node:assert');
const m = require('../src/ui/drag-math');

test('rubber band: nothing at zero, always less than the pull, and it never passes its limit', () => {
  assert.strictEqual(m.rubber(0), 0);
  let last = 0;
  for (const x of [1, 10, 50, 200, 1000, 100000]) {
    const r = m.rubber(x);
    assert.ok(r > last, 'keeps growing');
    assert.ok(r < x, 'resists the pull');
    assert.ok(r < 60 / 0.55, 'bounded by d / 0.55');
    last = r;
  }
  assert.ok(Math.abs(m.rubber(10) - (10 * 60 * 0.55) / (60 + 0.55 * 10)) < 1e-9, 'the documented formula');
});

test('clampRubber leaves positions inside the box alone and resists outside it, on both ends', () => {
  assert.strictEqual(m.clampRubber(50, 0, 100), 50);
  assert.strictEqual(m.clampRubber(0, 0, 100), 0);
  const lo = m.clampRubber(-40, 0, 100), hi = m.clampRubber(140, 0, 100);
  assert.ok(lo < 0 && lo > -40);
  assert.ok(hi > 100 && hi < 140);
  assert.ok(Math.abs(-lo - (hi - 100)) < 1e-9, 'symmetric');
});

test('the spring starts where it was released, settles, and does not overshoot when let go at rest', () => {
  assert.deepStrictEqual(m.springStep(40, 0, 0), { x: 40, v: 0 });
  let prev = 40;
  for (let t = 0.02; t <= 1; t += 0.02) {
    const { x } = m.springStep(40, 0, t);
    assert.ok(x >= 0 && x <= prev + 1e-9, 'moves monotonically toward 0 at ' + t);
    prev = x;
  }
  assert.ok(Math.abs(m.springStep(40, 0, 0.5).x) < 1, 'close within half a second');
  assert.ok(Math.abs(m.springStep(40, 0, 1).x) < 0.01);
});

test('a spring released with speed keeps that speed at first and then still settles', () => {
  const s = m.springStep(0, 800, 0.01);
  assert.ok(s.x > 5, 'carries on in the direction it was thrown');
  assert.ok(s.v > 500 && s.v < 800, 'speed decays smoothly, it does not jump');
  assert.ok(Math.abs(m.springStep(0, 800, 1.2).x) < 0.05);
  assert.strictEqual(m.springDone(0.2, 3), true);
  assert.strictEqual(m.springDone(0.2, 80), false);
  assert.strictEqual(m.springDone(5, 0), false);
});

test('release speed comes from the last 100ms of pointer samples only', () => {
  const s = [{ t: 0, x: 0, y: 0 }, { t: 400, x: 100, y: 0 }, { t: 450, x: 110, y: 5 }, { t: 500, x: 130, y: 15 }];
  const v = m.velocityOf(s, 500);
  assert.ok(Math.abs(v.x - 300) < 1e-9 && Math.abs(v.y - 150) < 1e-9, JSON.stringify(v));
  assert.deepStrictEqual(m.velocityOf([], 500), { x: 0, y: 0 });
  assert.deepStrictEqual(m.velocityOf([{ t: 100, x: 5, y: 5 }], 500), { x: 0, y: 0 }, 'one stale sample means it was held still');
  assert.deepStrictEqual(m.velocityOf([{ t: 0, x: 0, y: 0 }, { t: 100, x: 50, y: 0 }], 600), { x: 0, y: 0 }, 'a pause before letting go means no speed');
});

test('drop zones: rows reorder at the edges and group in the middle, pins use left and right halves', () => {
  const r = { left: 0, top: 100, width: 200, height: 30 };
  assert.strictEqual(m.zoneOf(r, 100, 102, false), 't');
  assert.strictEqual(m.zoneOf(r, 100, 115, false), 'mid');
  assert.strictEqual(m.zoneOf(r, 100, 128, false), 'b');
  assert.strictEqual(m.zoneOf(r, 40, 115, true), 'l');
  assert.strictEqual(m.zoneOf(r, 160, 115, true), 'r');
});

test('a press only becomes a drag after it has moved a few pixels', () => {
  assert.strictEqual(m.isDrag(0, 0, 3, 3), false);
  assert.strictEqual(m.isDrag(0, 0, 5, 0), true);
  assert.strictEqual(m.isDrag(10, 10, 10, 4), true);
  assert.strictEqual(m.isDrag(10, 10, 12, 13), false);
});
