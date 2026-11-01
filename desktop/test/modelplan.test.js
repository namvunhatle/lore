const test = require('node:test');
const assert = require('node:assert');
const { recommend, installed } = require('../src/modelplan');
const GB = 1024 ** 3;

test('the model grows with memory', () => {
  assert.strictEqual(recommend(4 * GB).chat, 'qwen2.5:1.5b');
  assert.strictEqual(recommend(8 * GB).chat, 'qwen2.5:3b');
  assert.strictEqual(recommend(16 * GB).chat, 'qwen2.5:7b');
  assert.strictEqual(recommend(16 * GB).embed, 'bge-m3');
});

test('installed models are recognised by name', () => {
  assert.ok(installed(['qwen2.5:3b'], 'qwen2.5:3b'));
  assert.ok(installed(['qwen2.5:3b-instruct'], 'qwen2.5:3b'));
  assert.ok(installed(['bge-m3:latest'], 'bge-m3'));
  assert.ok(!installed(['qwen2.5:7b'], 'qwen2.5:3b'));
});
