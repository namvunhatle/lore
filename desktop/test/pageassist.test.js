const test = require('node:test');
const assert = require('node:assert');
const { summarize, ask, chunkBlocks, parseNumbered, translateBatch } = require('../src/pageassist');

const TEXT = `Ngân hàng Nhà nước quyết định giữ nguyên lãi suất điều hành trong cuộc họp hôm nay.

Các chuyên gia dự báo lãi suất huy động sẽ ổn định trong quý tới nhờ thanh khoản dồi dào của hệ thống.

Thị trường chứng khoán phản ứng tích cực với thông tin này, chỉ số VN-Index tăng nhẹ vào cuối phiên giao dịch.`;
const llm = (reply, up = true) => ({ available: async () => up, chat: async () => reply });

test('summary falls back to key sentences from the page when no model is set up', async () => {
  const s = await summarize({ text: TEXT, llm: null });
  assert.strictEqual(s.ai, false);
  assert.ok(s.bullets.length >= 1 && s.bullets.every((b) => TEXT.includes(b)));
});
test('summary uses the model when available', async () => {
  const s = await summarize({ text: TEXT, llm: llm('- Giữ nguyên lãi suất.\n- Dự báo ổn định.\n'), lang: 'vi' });
  assert.deepStrictEqual(s.bullets, ['Giữ nguyên lãi suất.', 'Dự báo ổn định.']);
  assert.strictEqual(s.ai, true);
});
test('ask returns the page passage as evidence, and says so when nothing matches', async () => {
  const a = await ask({ text: TEXT, question: 'lãi suất huy động quý tới', llm: null });
  assert.ok(a.found && /huy động/.test(a.passages[0]));
  const none = await ask({ text: TEXT, question: 'bóng đá world cup', llm: llm('anything') });
  assert.strictEqual(none.found, false);
});
test('ask: model phrases the answer; NO_ANSWER keeps just the passages', async () => {
  const yes = await ask({ text: TEXT, question: 'lãi suất điều hành', llm: llm('Giữ nguyên. [1]') });
  assert.strictEqual(yes.answer, 'Giữ nguyên.');
  const no = await ask({ text: TEXT, question: 'lãi suất điều hành', llm: llm('NO_ANSWER') });
  assert.strictEqual(no.answer, '');
  assert.ok(no.passages.length);
});
test('translation batching and parsing', async () => {
  const blocks = Array.from({ length: 20 }, (_, k) => ({ i: k + 1, text: 'x'.repeat(100) }));
  const chunks = chunkBlocks(blocks);
  assert.ok(chunks.every((c) => c.length <= 8) && chunks.flat().length === 20);
  assert.deepStrictEqual(parseNumbered('1|Xin chào\nnoise\n2: Tạm biệt\n9|không yêu cầu', [1, 2]), { 1: 'Xin chào', 2: 'Tạm biệt' });
  const out = await translateBatch({ blocks: [{ i: 1, text: 'Hello' }, { i: 2, text: 'Bye' }], llm: llm('1|Xin chào\n2|Tạm biệt'), target: 'vi' });
  assert.deepStrictEqual(out, { 1: 'Xin chào', 2: 'Tạm biệt' });
});

test('a long page is read from its start, middle and end', () => {
  const { samplePage } = require('../src/pageassist');
  const t = 'A'.repeat(5000) + 'M'.repeat(5000) + 'Z'.repeat(5000);
  const s = samplePage(t, 9000);
  assert.ok(s.length <= 9100);
  assert.ok(s.includes('A') && s.includes('M') && s.includes('Z'));
  assert.strictEqual(samplePage('short', 9000), 'short');
});

test('an answer that ran out of room is cut at the last whole sentence', () => {
  const { cutAtSentence } = require('../src/pageassist');
  const cut = 'Xe điện đi được 400 km. Một số mẫu đi được hơn 600 km. Tuy nhiên điều này còn phụ thuộc vào thời tiết và khi trời';
  assert.strictEqual(cutAtSentence(cut, true), 'Xe điện đi được 400 km. Một số mẫu đi được hơn 600 km.');
  assert.strictEqual(cutAtSentence(cut, false), cut);
  assert.strictEqual(cutAtSentence('Done.', true), 'Done.');
});

test('a summary drops a last bullet that was cut off, but only when the model ran out of room', async () => {
  const mk = (truncated) => ({ available: async () => true, truncated, chat: async () => '- Điểm thứ nhất của bài viết.\n- Điểm thứ hai của bài viết.\n- Điểm thứ ba bị cắt giữa chừng và' });
  const text = 'Câu một của bài viết. '.repeat(40);
  const a = await require('../src/pageassist').summarize({ text, llm: mk(true), lang: 'vi' });
  assert.strictEqual(a.bullets.length, 2);
  const b = await require('../src/pageassist').summarize({ text, llm: mk(false), lang: 'vi' });
  assert.strictEqual(b.bullets.length, 3);
});

test('an answer the model had to stop is marked as cut, not shown as finished', async () => {
  const llm = { available: async () => true, truncated: true, chat: async () => 'The city is on the coast of Vietnam and known for beaches. It has grown quickly as' };
  const text = 'The city is on the coast of Vietnam and known for beaches. '.repeat(10);
  const a = await ask({ text, question: 'where is the city', llm });
  assert.ok(a.cut);
  assert.ok(a.answer.endsWith('beaches.'));
});
