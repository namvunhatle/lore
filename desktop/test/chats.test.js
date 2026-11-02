const test = require('node:test');
const assert = require('node:assert');
const { ChatStore, context } = require('../src/chats');

const S = (seq, o = {}) => ({ seq, mode: 'ask', state: 'done', question: 'q' + seq, answer: 'a' + seq, found: true, ai: true, passages: ['p'], model: 'm', remote: '', page: { title: 'T', host: 'h.example' }, ...o });

test('a thread is saved by page, trimmed, and comes back after a restart', () => {
  let saved;
  const c = new ChatStore({ save: (d) => { saved = d; } });
  c.put('https://a.example/x', { url: 'https://a.example/x', title: 'A', states: [S(1), S(2, { state: 'working' }), S(3, { mode: 'translate' }), S(4)] });
  assert.deepStrictEqual(c.get('https://a.example/x').states.map((s) => s.seq), [1, 4]);
  const again = new ChatStore({ load: () => saved });
  assert.strictEqual(again.list()[0].host, 'a.example');
  assert.strictEqual(again.list()[0].count, 2);
  assert.strictEqual(again.list()[0].preview, 'q1');
});

test('an empty thread is removed; the oldest go when there are too many', () => {
  const c = new ChatStore();
  c.put('https://a.example/', { url: 'https://a.example/', title: '', states: [S(1)] });
  c.put('https://a.example/', { url: 'https://a.example/', title: '', states: [] });
  assert.strictEqual(c.list().length, 0);
  for (let i = 0; i < 160; i++) c.put('https://a.example/' + i, { url: 'https://a.example/' + i, title: '', states: [S(i)] });
  assert.strictEqual(c.list().length, 150);
});

test('damaged files and odd addresses are ignored', () => {
  assert.strictEqual(new ChatStore({ load: () => [] }).list().length, 0);
  assert.strictEqual(new ChatStore({ load: () => ({ threads: [{ key: 'k', url: 'file:///x', states: [S(1)] }, null] }) }).list().length, 0);
});

test('follow-up context is the last answers, short, from finished messages only', () => {
  const ctx = context([S(1), S(2), S(3, { state: 'working' }), S(4, { mode: 'summarize', question: '', answer: undefined, bullets: ['x', 'y'] })], 2);
  assert.deepStrictEqual(ctx.map((c) => c.a), ['a2', 'x y']);
  assert.strictEqual(ctx[1].q, 'Summarize this page');
});
