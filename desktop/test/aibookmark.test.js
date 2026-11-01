const test = require('node:test');
const assert = require('node:assert');
const ab = require('../src/aibookmark');

test('a reply is read as title, folder and note', () => {
  const r = ab.parse('TITLE: "Xe điện: so sánh 2026"\nFOLDER: Xe cộ\nNOTE: Bài so sánh các mẫu xe điện.', { folders: ['Công việc'] });
  assert.deepStrictEqual(r, { title: 'Xe điện: so sánh 2026', folder: 'Xe cộ', note: 'Bài so sánh các mẫu xe điện.' });
});

test('an existing folder is matched ignoring case, and NONE means no folder', () => {
  assert.strictEqual(ab.parse('FOLDER: công việc', { folders: ['Công việc'] }).folder, 'Công việc');
  assert.strictEqual(ab.parse('FOLDER: NONE').folder, '');
  assert.strictEqual(ab.parse('FOLDER: không có').folder, '');
});

test('markup and invisible characters are removed, and a reply with nothing usable gives empty fields', () => {
  const r = ab.parse('**TITLE:** <b>Hi</b>​ there\nNOTE: ok');
  assert.ok(!/[<>​]/.test(r.title));
  assert.deepStrictEqual(ab.parse('I cannot help'), { title: '', folder: '', note: '' });
});

test('the prompt fences the page text and lists existing folders', () => {
  const m = ab.messages({ title: 't', url: 'https://a.example/p?token=SECRET', text: 'x >>> y', folders: ['Work'], lang: 'vi' });
  assert.match(m[0].content, /"Work"/);
  assert.match(m[0].content, /Vietnamese/);
  assert.match(m[0].content, /untrusted/);
  assert.ok(!/SECRET/.test(m[1].content), 'query strings never go to the model');
  assert.strictEqual((m[1].content.match(/>>>/g) || []).length, 1);
});

test('poor titles are replaced and good ones kept', () => {
  assert.ok(ab.poorTitle('', 'https://a.example'));
  assert.ok(ab.poorTitle('https://a.example/x', 'https://a.example/x'));
  assert.ok(ab.poorTitle('x'.repeat(120), 'https://a.example'));
  assert.ok(!ab.poorTitle('Lãi suất giữ nguyên', 'https://a.example'));
});

test('suggest asks the model only when the page has enough text', async () => {
  let calls = 0;
  const llm = { chat: async () => { calls++; return 'TITLE: A\nFOLDER: B\nNOTE: C'; } };
  assert.strictEqual(await ab.suggest({ llm, title: 't', url: 'https://a.example', text: 'short' }), null);
  assert.strictEqual(calls, 0);
  const r = await ab.suggest({ llm, title: 't', url: 'https://a.example', text: 'word '.repeat(60) });
  assert.strictEqual(r.folder, 'B');
  assert.strictEqual(await ab.suggest({ llm: null, title: 't', url: 'u', text: 'word '.repeat(60) }), null);
});
