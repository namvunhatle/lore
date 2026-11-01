const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { ProfileList, dirFor, partitionFor, DEFAULT_ID } = require('../src/profiles');

const make = (data) => { const saved = []; const l = new ProfileList({ load: () => data, save: (d) => saved.push(JSON.parse(JSON.stringify(d))) }); return { l, saved }; };

test('a fresh list has one profile, and it is the active one', () => {
  const { l } = make(null);
  assert.strictEqual(l.items.length, 1);
  assert.strictEqual(l.active, DEFAULT_ID);
});

test('profiles are created, renamed, recoloured and saved', () => {
  const { l, saved } = make(null);
  const p = l.create('  Công   việc ', 'green');
  assert.strictEqual(p.name, 'Công việc');
  assert.strictEqual(p.color, 'green');
  l.update(p.id, { name: 'Work', color: 'nope' });
  assert.strictEqual(l.get(p.id).name, 'Work');
  assert.strictEqual(l.get(p.id).color, 'green');
  assert.ok(saved.length >= 2);
});

test('bad saved data is dropped and the first profile always exists', () => {
  const { l } = make({ active: 'ghost', items: [{ id: '../evil' }, { id: 'ok1', name: '<b>x</b>' }, null] });
  assert.ok(l.get(DEFAULT_ID));
  assert.ok(l.get('ok1'));
  assert.ok(!l.items.some((p) => p.id.includes('.')));
  assert.strictEqual(l.get('ok1').name, 'bx/b');
  assert.strictEqual(l.active, DEFAULT_ID);
});

test('the last profile cannot be removed, and removing the active one moves on', () => {
  const { l } = make(null);
  assert.strictEqual(l.remove(DEFAULT_ID), false);
  const p = l.create('Work');
  l.setActive(p.id);
  assert.ok(l.remove(p.id));
  assert.strictEqual(l.active, DEFAULT_ID);
  assert.strictEqual(l.setActive('nope'), false);
});

test('the number of profiles is capped', () => {
  const { l } = make(null);
  let made = 0;
  while (l.create('x')) made++;
  assert.strictEqual(l.items.length, 12);
  assert.strictEqual(made, 11);
});

test('the first profile keeps the old folder and the default session', () => {
  assert.strictEqual(dirFor('/data', DEFAULT_ID), '/data');
  assert.strictEqual(dirFor('/data', 'p1'), path.join('/data', 'profiles', 'p1'));
  assert.strictEqual(partitionFor(DEFAULT_ID), '');
  assert.strictEqual(partitionFor('p1'), 'persist:profile-p1');
});
