const test = require('node:test');
const assert = require('node:assert');
const { Vault, generate } = require('../src/passwords');

test('a login is saved once per site and user, and an update replaces the password', () => {
  let saved;
  const v = new Vault({ save: (d) => { saved = d; } });
  assert.strictEqual(v.classify('www.shop.example', 'an', 'p1'), 'new');
  v.save({ host: 'www.shop.example', user: 'an', pass: 'p1' });
  assert.strictEqual(v.classify('shop.example', 'an', 'p1'), 'same');
  assert.strictEqual(v.classify('shop.example', 'an', 'p2'), 'update');
  assert.strictEqual(v.classify('shop.example', 'binh', 'p2'), 'new');
  v.save({ host: 'shop.example', user: 'an', pass: 'p2' });
  assert.strictEqual(v.items.length, 1);
  assert.strictEqual(v.forSite('SHOP.example')[0].pass, 'p2');
  assert.strictEqual(new Vault({ load: () => saved }).items.length, 1);
});

test('"never for this site" is remembered', () => {
  const v = new Vault();
  v.neverFor('bank.example');
  assert.strictEqual(v.classify('www.bank.example', 'a', 'b'), 'never');
});

test('the list never carries passwords, and flags reuse and weak ones', () => {
  const v = new Vault();
  v.save({ host: 'a.example', user: 'u', pass: 'same-Pass-1!' });
  v.save({ host: 'b.example', user: 'u', pass: 'same-Pass-1!' });
  v.save({ host: 'c.example', user: 'u', pass: '123456' });
  const l = v.view();
  assert.ok(l.every((x) => !('pass' in x)));
  assert.deepStrictEqual(l.map((x) => [x.site, x.reused, x.weak]), [['a.example', true, false], ['b.example', true, false], ['c.example', false, true]]);
});

test('generated passwords have every kind of character and the asked length', () => {
  for (let i = 0; i < 50; i++) {
    const p = generate(20);
    assert.strictEqual(p.length, 20);
    assert.match(p, /[A-Z]/); assert.match(p, /[a-z]/); assert.match(p, /[0-9]/); assert.match(p, /[^A-Za-z0-9]/);
  }
  assert.strictEqual(generate(3).length, 12);
});

test('damaged files give an empty vault', () => {
  assert.strictEqual(new Vault({ load: () => [] }).items.length, 0);
  assert.strictEqual(new Vault({ load: () => ({ items: [null, { site: 'x.example' }, { site: 'y.example', pass: 'p' }] }) }).items.length, 1);
});
