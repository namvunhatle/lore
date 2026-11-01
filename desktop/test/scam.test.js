const test = require('node:test');
const assert = require('node:assert');
const { checkUrl } = require('../src/scam');

const r = (u, listed = []) => checkUrl(u, { listHas: (h) => listed.includes(h) });

test('official Vietnamese brand domains are left alone', () => {
  for (const u of ['https://vietcombank.com.vn/', 'https://ib.vietcombank.com.vn/login', 'https://www.momo.vn/', 'https://shopee.vn/product/1',
    'https://evn.com.vn/', 'https://cskh.evnhcmc.vn/', 'https://mbbank.com.vn', 'https://acb.com.vn', 'https://vneid.gov.vn']) {
    assert.strictEqual(r(u), null, u);
  }
});
test('look-alikes of those brands are flagged', () => {
  for (const [u, brand] of [
    ['https://vietcombank-vn.xyz/login', 'Vietcombank'], ['https://secure-techcombank.top', 'Techcombank'],
    ['https://momo-nhanqua.com', 'MoMo'], ['https://shopee-vn.shop/khuyen-mai', 'Shopee'], ['http://acb-online.vip', 'ACB'],
    ['https://tra-cuu-evn.net', 'EVN'], ['https://vietcombank.com.vn.verify-account.cc', 'Vietcombank']]) {
    const x = r(u);
    assert.ok(x && x.reason === 'lookalike' && x.brand === brand, u + ' -> ' + JSON.stringify(x));
  }
});
test('short brand names only match as whole words', () => {
  for (const u of ['https://momofuku.com', 'https://tikitaka.com', 'https://macbidvn.com', 'https://pacbook.org', 'https://evngroup-news.com.example.org/'.replace('evngroup-news', 'seven')]) {
    assert.strictEqual(r(u), null, u);
  }
});
test('brand names in the path are fine', () => {
  assert.strictEqual(r('https://vnexpress.net/vietcombank-lai-suat'), null);
});
test('reported domains are blocked, including subdomains', () => {
  assert.strictEqual(r('https://evil.example/', ['evil.example']).level, 'block');
  assert.strictEqual(r('https://login.evil.example/x', ['evil.example']).reason, 'list');
  assert.strictEqual(r('https://good.example/', ['evil.example']), null);
});
test('punycode hosts warn', () => assert.strictEqual(r('https://vietcómbank.com').reason, 'idn'));
test('local and non-web addresses are never flagged', () => {
  for (const u of ['http://localhost:3000', 'http://192.168.1.1/', 'file:///a', 'not a url', 'about:blank']) assert.strictEqual(r(u, ['localhost']), null, u);
});
