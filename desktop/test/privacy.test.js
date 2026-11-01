const test = require('node:test');
const assert = require('node:assert');
const { FiltersEngine } = require('@ghostery/adblocker');
const { etld1, isThirdParty, permissionPolicy, isAllowedNavigation, withoutHeader } = require('../src/privacy');
const { createBlocker } = require('../src/adblock');

test('registrable domains, including .com.vn', () => {
  assert.strictEqual(etld1('www.vnexpress.net'), 'vnexpress.net');
  assert.strictEqual(etld1('shop.example.com.vn'), 'example.com.vn');
  assert.strictEqual(etld1('a.b.co.uk'), 'b.co.uk');
  assert.strictEqual(etld1('localhost'), 'localhost');
  assert.strictEqual(etld1('192.168.1.5'), '192.168.1.5');
});
test('third-party detection', () => {
  assert.ok(!isThirdParty('https://static.vnexpress.net/x.js', 'https://vnexpress.net/a'));
  assert.ok(isThirdParty('https://tracker.example/p', 'https://vnexpress.net/a'));
  assert.ok(isThirdParty('https://a.com.vn/x', 'https://b.com.vn/'));
});
test('permission policy', () => {
  assert.strictEqual(permissionPolicy('fullscreen'), 'allow');
  assert.strictEqual(permissionPolicy('geolocation'), 'ask');
  assert.strictEqual(permissionPolicy('geolocation', { isPrivate: true }), 'deny');
  assert.strictEqual(permissionPolicy('media', { setting: 'block' }), 'deny');
  assert.strictEqual(permissionPolicy('usb'), 'deny');
  assert.strictEqual(permissionPolicy('display-capture'), 'deny');
});
test('web pages may only navigate to web addresses', () => {
  for (const u of ['http://a.vn', 'https://a.vn/x?y=1']) assert.ok(isAllowedNavigation(u));
  for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'chrome://gpu', 'lore-run:?q=x', 'not a url']) assert.ok(!isAllowedNavigation(u), u);
});
test('Google sign-in address detection', () => {
  const { isGoogleSignIn } = require('../src/privacy');
  assert.ok(isGoogleSignIn('https://accounts.google.com/v3/signin/identifier?x=1'));
  assert.ok(!isGoogleSignIn('http://accounts.google.com/'));
  assert.ok(!isGoogleSignIn('https://accounts.google.com.evil.example/'));
  assert.ok(!isGoogleSignIn('https://www.google.com/search?q=accounts.google.com'));
  assert.ok(!isGoogleSignIn('nonsense'));
});
test('Google rejection pages are recognised', () => {
  const { isGoogleSignInRejected } = require('../src/privacy');
  assert.ok(isGoogleSignInRejected('https://accounts.google.com/v3/signin/rejected?x=1'));
  assert.ok(isGoogleSignInRejected('https://accounts.google.com/signin/oauth/error?error=disallowed_useragent'));
  assert.ok(!isGoogleSignInRejected('https://accounts.google.com/v3/signin/identifier'));
  assert.ok(!isGoogleSignInRejected('https://example.com/signin/rejected'));
});
test('header removal is case-insensitive', () => {
  assert.deepStrictEqual(withoutHeader({ 'Set-Cookie': ['a'], 'set-cookie': ['b'], Vary: ['x'] }, 'set-cookie'), { Vary: ['x'] });
});
test('filter engine blocks per list rules and honours exceptions', () => {
  const b = createBlocker();
  b.use(FiltersEngine.parse('||ads.example.com^\n||tracker.test^$third-party\n@@||ads.example.com/ok^'));
  assert.ok(b.match('https://ads.example.com/banner.js', 'https://news.vn/', 'script'));
  assert.ok(!b.match('https://ads.example.com/ok/x.js', 'https://news.vn/', 'script'));
  assert.ok(b.match('https://tracker.test/p.gif', 'https://news.vn/', 'image'));
  assert.ok(!b.match('https://tracker.test/p.gif', 'https://tracker.test/', 'image'));
  assert.ok(!b.match('https://news.vn/article', 'https://news.vn/', 'mainFrame'));
});
test('before the engine loads, the small host list still blocks', () => {
  const b = createBlocker();
  assert.ok(!b.ready);
  assert.ok(b.match('https://stats.doubleclick.net/x', 'https://a.vn/', 'script'));
});

test('third-party cookies are cut for passive loads and listed trackers, kept for frames and fetch', () => {
  const { stripsThirdPartyCookies: cut } = require('../src/privacy');
  assert.ok(cut('image', false));
  assert.ok(cut('ping', false));
  assert.ok(cut('script', true));
  assert.ok(!cut('subFrame', false));
  assert.ok(!cut('xhr', false));
  assert.ok(!cut('webSocket', false));
});
