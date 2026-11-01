const test = require('node:test');
const assert = require('node:assert');
const { Memory } = require('../src/memory');

const DAY = 86400000;
const now = Date.UTC(2026, 10, 1);

function seeded() {
  const m = new Memory({ saveDelayMs: 0 });
  m.add({ url: 'https://vnexpress.net/xe-dien', title: 'Thị trường xe điện Việt Nam', ts: now - 8 * DAY });
  m.add({ url: 'https://vnexpress.net/xe-dien-2', title: 'Xe điện mới nhất', ts: now - 1 * DAY });
  m.add({ url: 'https://tuoitre.vn/bong-da', title: 'Bóng đá hôm nay', ts: now - 8 * DAY });
  m.add({ url: 'file:///x', title: 'ignored', ts: now });
  return m;
}

test('ignores non-http pages', () => assert.strictEqual(seeded().size, 3));
test('finds by words, no diacritics needed', async () => {
  assert.strictEqual((await seeded().search('xe dien', now)).length, 2);
});
test('"tuần trước" restricts to last week', async () => {
  const r = await seeded().search('tìm lại bài báo tuần trước về xe điện', now);
  assert.deepStrictEqual(r.map((i) => i.url), ['https://vnexpress.net/xe-dien']);
});
test('revisit updates timestamp, no duplicate', () => {
  const m = seeded();
  m.add({ url: 'https://tuoitre.vn/bong-da', ts: now });
  assert.strictEqual(m.size, 3);
});
test('English query and time words', async () => {
  const r = await seeded().search('find the article about electric cars I read last week', now);
  assert.deepStrictEqual(r.map((i) => i.url), []);
  const r2 = await seeded().search('find the article about xe dien I read last week', now);
  assert.deepStrictEqual(r2.map((i) => i.url), ['https://vnexpress.net/xe-dien']);
});

// ---- MEM-01 / MEM-03
const { createEmbedder } = require('../src/embedder');
const { isSensitiveHost } = require('../src/memory');

function withText() {
  const m = new Memory({ saveDelayMs: 0 });
  m.add({ url: 'https://news.vn/a', title: 'Ngân hàng Nhà nước giữ nguyên chính sách', ts: now - 1 * DAY });
  m.setText('https://news.vn/a', 'Ngân hàng Nhà nước quyết định giữ nguyên lãi suất điều hành. Các chuyên gia dự báo lãi suất huy động sẽ ổn định trong quý tới.');
  m.add({ url: 'https://blog.vn/b', title: 'Công thức nấu phở bò', ts: now - 1 * DAY });
  m.setText('https://blog.vn/b', 'Hầm xương bò 6 tiếng, thêm quế, hồi và gừng nướng để nước dùng thơm.');
  return m;
}
test('finds a page by what it says, not only its title', async () => {
  const r = await withText().search('hôm qua tôi đọc bài nào nói về lãi suất', now);
  assert.strictEqual(r[0].url, 'https://news.vn/a');
  assert.match(r[0].snippet, /lãi suất/);
  assert.ok(!('text' in r[0]) && !('vec' in r[0]));
});
test('blends meaning search when an embedder is available', async () => {
  const vecs = { 'lãi suất': [1, 0], 'phở': [0, 1] };
  const embedder = { available: async () => true, embed: async (t) => (/phở|xương bò/i.test(t) ? [0, 1] : /lãi suất|Ngân hàng/i.test(t) ? [1, 0] : [0.7, 0.7]) };
  const m = new Memory({ saveDelayMs: 0, embedder });
  m.add({ url: 'https://news.vn/a', title: 'Chính sách tiền tệ', ts: now });
  m.setText('https://news.vn/a', 'Ngân hàng Nhà nước giữ nguyên lãi suất điều hành.');
  m.add({ url: 'https://blog.vn/b', title: 'Món ngon', ts: now });
  m.setText('https://blog.vn/b', 'Hầm xương bò 6 tiếng cho nước dùng thơm.');
  await m._queue;
  assert.strictEqual(m.embeddedCount, 2);
  // "tiền gửi ngân hàng" shares no keyword with the first page's text beyond "ngân hàng", but the vector pulls it first
  const r = await m.search('tiền lãi cho khoản gửi', now);
  assert.strictEqual(r[0].url, 'https://news.vn/a');
});
test('banking and webmail pages are never remembered', () => {
  const m = new Memory({ saveDelayMs: 0 });
  m.add({ url: 'https://ib.vietcombank.com.vn/home', title: 'x' });
  m.add({ url: 'https://mail.google.com/mail/u/0', title: 'Inbox' });
  m.add({ url: 'https://vnexpress.net/', title: 'ok' });
  assert.strictEqual(m.size, 1);
  assert.ok(isSensitiveHost('www.techcombank.com.vn'));
  assert.ok(!isSensitiveHost('shopee.vn'));
});
test('review and delete: one page, one site, a time range, everything', () => {
  const m = new Memory({ saveDelayMs: 0 });
  m.add({ url: 'https://a.vn/1', title: 'a1', ts: now });
  m.add({ url: 'https://a.vn/2', title: 'a2', ts: now - 3 * DAY });
  m.add({ url: 'https://b.vn/1', title: 'b1', ts: now - 40 * DAY });
  assert.deepStrictEqual(m.hosts(), [{ host: 'a.vn', count: 2 }, { host: 'b.vn', count: 1 }]);
  assert.strictEqual(m.remove('https://a.vn/1'), 1);
  assert.strictEqual(m.removeSince('week', now), 1);      // a.vn/2, visited 3 days ago
  assert.strictEqual(m.removeSince('month', now), 0);     // b.vn/1 is 40 days old, outside the last 30
  assert.strictEqual(m.removeHost('b.vn'), 1);
  assert.strictEqual(m.size, 0);
});
test('export has addresses and dates but no page text or vectors', () => {
  const m = withText();
  const out = m.export();
  assert.deepStrictEqual(Object.keys(out[0]).sort(), ['title', 'url', 'visited']);
});
test('saves are batched and flush writes immediately', async () => {
  let writes = 0;
  const m = new Memory({ save: () => { writes++; }, saveDelayMs: 20 });
  m.add({ url: 'https://a.vn/', title: 'a' }); m.add({ url: 'https://a.vn/2', title: 'b' }); m.setTitle('https://a.vn/', 'c');
  assert.strictEqual(writes, 0);
  await new Promise((r) => setTimeout(r, 40));
  assert.strictEqual(writes, 1);
  m.flush();
  assert.strictEqual(writes, 2);
});
test('embedder talks to Ollama', async () => {
  const calls = [];
  const f = async (u, init) => { calls.push(u); return { ok: true, json: async () => (u.endsWith('/api/tags') ? { models: [{ name: 'bge-m3:latest' }] } : { embeddings: [[0.1, 0.2]] }) }; };
  const e = createEmbedder({ model: 'bge-m3', fetchImpl: f });
  assert.ok(await e.available());
  assert.deepStrictEqual(await e.embed('x'), [0.1, 0.2]);
});
