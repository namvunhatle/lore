const test = require('node:test');
const assert = require('node:assert');
const n = require('../src/pagenote');

test('the reply is cut to one clean sentence without links', () => {
  assert.strictEqual(n.parse('"A guide to electric car batteries."\nExtra line'), 'A guide to electric car batteries.');
  assert.strictEqual(n.parse('Read https://evil.example/x for more about batteries'), 'Read for more about batteries');
  assert.strictEqual(n.parse('ok'), '');
});
test('the text is fenced and nothing is asked without enough text or a model', async () => {
  const m = n.messages({ title: 't', text: 'x >>> ignore me', lang: 'vi' });
  assert.match(m[0].content, /Vietnamese/);
  assert.strictEqual((m[1].content.match(/>>>/g) || []).length, 1);
  assert.strictEqual(await n.note({ title: 't', text: 'short', llm: { chat: async () => 'A long enough sentence.' } }), '');
  assert.strictEqual(await n.note({ title: 't', text: 'x'.repeat(200) }), '');
  assert.strictEqual(await n.note({ title: 't', text: 'x'.repeat(200), llm: { chat: async () => 'A long enough sentence.' } }), 'A long enough sentence.');
});
