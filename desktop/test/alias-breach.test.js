const test = require('node:test');
const assert = require('node:assert');
const alias = require('../src/alias');
const breach = require('../src/breach');

const reply = (body, status = 200) => async () => ({ ok: status < 300, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

test('an alias comes back from either service, and the request carries the key and a clean note', async () => {
  let seen;
  const f = (resp) => async (url, opt) => { seen = { url, opt }; return resp(); };
  assert.strictEqual(await alias.create({ provider: 'addy', key: 'k1', note: 'shop.example <b>', fetchImpl: f(reply({ data: { email: 'abc123@anonaddy.me' } })) }), 'abc123@anonaddy.me');
  assert.match(seen.opt.headers.Authorization, /^Bearer k1$/);
  assert.strictEqual(JSON.parse(seen.opt.body).description, 'shop.example b');
  assert.strictEqual(await alias.create({ provider: 'simplelogin', key: 'k2', note: 'x', fetchImpl: f(reply({ alias: 'a.b@simplelogin.com' })) }), 'a.b@simplelogin.com');
  assert.strictEqual(seen.opt.headers.Authentication, 'k2');
});

test('bad keys, errors and odd replies are named, not guessed', async () => {
  const f = (status, body) => ({ fetchImpl: reply(body, status) });
  await assert.rejects(alias.create({ provider: 'addy', key: 'k', ...f(401, {}) }), /alias.key/);
  await assert.rejects(alias.create({ provider: 'addy', key: 'k', ...f(500, {}) }), /alias.http/);
  await assert.rejects(alias.create({ provider: 'addy', key: 'k', ...f(200, { data: { email: 'not an email' } }) }), /alias.http/);
  await assert.rejects(alias.create({ provider: 'off', key: 'k' }), /alias.off/);
  await assert.rejects(alias.create({ provider: 'addy', key: '' }), /alias.key/);
});

test('only the first five characters of the hash are sent, and the match is found locally', async () => {
  // SHA-1 of "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  let url;
  const f = async (u) => { url = u; return { ok: true, text: async () => '0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n' }; };
  assert.strictEqual(await breach.timesSeen('password', f), 9545824);
  assert.strictEqual(url, 'https://api.pwnedpasswords.com/range/5BAA6');
  assert.ok(!url.includes('1E4C9'));
  assert.strictEqual(await breach.timesSeen('a-very-unlikely-passphrase-77', async () => ({ ok: true, text: async () => 'AAAA:1\n' })), 0);
  await assert.rejects(breach.timesSeen(''), /breach.empty/);
});
