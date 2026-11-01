const test = require('node:test');
const assert = require('node:assert');
const { Outline, sanitize, READ_MS } = require('../src/outline');

const heads = (n) => Array.from({ length: n }, (_, i) => 'H' + i);

test('a page starts with nothing seen and nothing current', () => {
  const o = new Outline(heads(3));
  assert.deepStrictEqual(o.view(0), { cur: -1, status: [0, 0, 0] });
});

test('the section being read counts as read once it has been on screen long enough', () => {
  const o = new Outline(heads(3));
  o.at(0, 1000);
  assert.strictEqual(o.view(1000 + READ_MS - 1).status[0], 0);
  assert.strictEqual(o.view(1000 + READ_MS).status[0], 2);
  assert.strictEqual(o.view(1000 + READ_MS).cur, 0);
});

test('leaving a section quickly marks it skimmed, leaving it after a while marks it read', () => {
  const o = new Outline(heads(3));
  o.at(0, 0); o.at(1, 400);
  assert.deepStrictEqual(o.view(400).status, [1, 0, 0]);
  o.at(2, 400 + READ_MS + 50);
  assert.deepStrictEqual(o.view(400 + READ_MS + 50).status, [1, 2, 0]);
});

test('sections jumped over are skimmed, and going back does not change what was seen', () => {
  const o = new Outline(heads(5));
  o.at(0, 0); o.at(4, 5000);
  assert.deepStrictEqual(o.view(5000).status, [2, 1, 1, 1, 0]);
  o.at(2, 5100);
  assert.deepStrictEqual(o.view(5100).status, [2, 1, 1, 1, 1]);
  assert.strictEqual(o.view(5100 + READ_MS).status[2], 2, 'a skimmed section that is then read properly becomes read');
});

test('reading never goes back from read to skimmed', () => {
  const o = new Outline(heads(2));
  o.at(0, 0); o.at(1, 3000); o.at(0, 3100); o.at(1, 3200);
  assert.strictEqual(o.view(3200).status[0], 2);
});

test('above the first heading nothing is current', () => {
  const o = new Outline(heads(2));
  o.at(0, 0); o.at(-1, 100);
  assert.strictEqual(o.view(100).cur, -1);
  assert.strictEqual(o.view(100).status[0], 1);
});

test('when the page adds sections, what was seen is kept for headings that are still there', () => {
  const o = new Outline(['A', 'B']);
  o.at(0, 0); o.at(1, 3000);
  o.setTexts(['A', 'B', 'C']);
  assert.deepStrictEqual(o.view(3000).status, [2, 0, 0]);
  assert.strictEqual(o.view(3000).cur, 1);
  o.setTexts(['X', 'Y']);
  assert.deepStrictEqual(o.view(3000), { cur: -1, status: [0, 0] });
});

test('nextCheck says when the current section will count as read', () => {
  const o = new Outline(heads(2));
  assert.strictEqual(o.nextCheck(0), null);
  o.at(0, 1000);
  assert.strictEqual(o.nextCheck(1500), READ_MS - 500);
  assert.strictEqual(o.nextCheck(1000 + READ_MS), null);
});

test('an index outside the outline is ignored', () => {
  const o = new Outline(heads(2));
  o.at(9, 0); o.at('x', 0); o.at(1.5, 0);
  assert.strictEqual(o.view(0).cur, -1);
});

test('sanitize keeps a short list of clean headings and drops everything else', () => {
  const long = 'x'.repeat(500);
  const out = sanitize([{ text: '  Hello \n world ', level: 2, id: 'hello' }, { text: long, level: 1 }, { text: '', level: 2 }, { text: 'Deep', level: 9 }, { text: 'Bad id', level: 3, id: 'a b#c' }, null, 'x', { text: 5 }]);
  assert.deepStrictEqual(out.map((x) => x.text), ['Hello world', 'x'.repeat(120), 'Bad id']);
  assert.deepStrictEqual(out.map((x) => x.level), [2, 1, 3]);
  assert.deepStrictEqual(out.map((x) => x.id), ['hello', '', '']);
  assert.strictEqual(sanitize(Array.from({ length: 200 }, (_, i) => ({ text: 'h' + i, level: 2 }))).length, 60);
  for (const bad of [null, undefined, 'x', 5, {}]) assert.deepStrictEqual(sanitize(bad), []);
});
