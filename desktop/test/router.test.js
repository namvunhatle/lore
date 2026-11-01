const test = require('node:test');
const assert = require('node:assert');
const { classify } = require('../src/router');
const { isBlocked } = require('../src/blocklist');

test('urls', () => {
  assert.deepStrictEqual(classify('vnexpress.net'), { kind: 'url', url: 'https://vnexpress.net' });
  assert.strictEqual(classify('localhost:3000').url, 'http://localhost:3000');
  assert.strictEqual(classify('https://a.vn/x?y=1').kind, 'url');
});
test('intents, with and without diacritics', () => {
  assert.strictEqual(classify('đóng tiền điện tháng này giúp tôi').kind, 'agent');
  assert.strictEqual(classify('dong tien dien').kind, 'agent');
  assert.strictEqual(classify('tìm lại bài báo tuần trước về xe điện').kind, 'memory');
  assert.strictEqual(classify('tải video bài giảng này').kind, 'download');
});
test('english intents', () => {
  assert.strictEqual(classify('pay my electricity bill this month').kind, 'agent');
  assert.strictEqual(classify('find the article about electric cars I read last week').kind, 'memory');
  assert.strictEqual(classify('download this lecture video').kind, 'download');
  assert.strictEqual(classify('flight prices Hanoi to Da Nang this weekend').kind, 'search');
});
test('search fallback', () => {
  const r = classify('giá vé Hà Nội đi Đà Nẵng');
  assert.strictEqual(r.kind, 'search');
  assert.ok(r.url.startsWith('https://duckduckgo.com/?q='));
});
test('blocklist', () => {
  assert.ok(isBlocked('https://stats.doubleclick.net/x'));
  assert.ok(!isBlocked('https://vnexpress.net/'));
});
