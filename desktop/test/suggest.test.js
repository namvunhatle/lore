const test = require('node:test');
const assert = require('node:assert/strict');
const sg = require('../src/suggest');

const DDG = `
<div class="result"><h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvnexpress.net%2Fso-sanh-vf8&amp;rut=abc">So sánh <b>VF 8</b> và Model Y &amp; hơn</a></h2></div>
<div class="result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftinhte.vn%2Ftram-sac%3Futm_source%3Dx%26id%3D7&amp;rut=def">Trạm sạc</a></div>
<div class="result result--ad"><a class="result__a" href="https://duckduckgo.com/y.js?ad_provider=x">Quảng cáo</a></div>
`;

test('parseQueries reads a JSON array, keeps at most 3 and drops blanks', () => {
  assert.deepEqual(sg.parseQueries('["a b", "c d", "", "e f", "g h"]'), ['a b', 'c d', 'e f']);
});

test('parseQueries copes with a fenced answer and with plain lines', () => {
  assert.deepEqual(sg.parseQueries('```json\n["x y","z w"]\n```'), ['x y', 'z w']);
  assert.deepEqual(sg.parseQueries('1. xe điện vinfast\n- giá pin\n'), ['xe điện vinfast', 'giá pin']);
});

test('parseQueries returns nothing for an empty answer', () => {
  assert.deepEqual(sg.parseQueries(''), []);
});

test('parseDdg unwraps the redirect, decodes entities and strips tags', () => {
  const r = sg.parseDdg(DDG);
  assert.equal(r[0].url, 'https://vnexpress.net/so-sanh-vf8');
  assert.equal(r[0].title, 'So sánh VF 8 và Model Y & hơn');
});

test('parseDdg skips ads', () => {
  assert.equal(sg.parseDdg(DDG).some((x) => /duckduckgo\.com/.test(x.url)), false);
});

test('parseWiki turns a search response into links', () => {
  const j = { query: { pages: { 1: { title: 'Xe điện', fullurl: 'https://vi.wikipedia.org/wiki/Xe_%C4%91i%E1%BB%87n', index: 1 } } } };
  assert.deepEqual(sg.parseWiki(j), [{ title: 'Xe điện', url: 'https://vi.wikipedia.org/wiki/Xe_%C4%91i%E1%BB%87n' }]);
});

test('choose drops the current page, open hosts, search engines and repeated hosts, then caps at max', () => {
  const rs = [
    { title: 'self', url: 'https://self.com/a' },
    { title: 'open tab', url: 'https://www.open.com/x' },
    { title: 'engine', url: 'https://www.google.com/search?q=x' },
    { title: 'one', url: 'https://one.com/1' },
    { title: 'one again', url: 'https://one.com/2' },
    { title: 'two', url: 'https://two.com/' },
    { title: 'three', url: 'https://three.com/' },
    { title: 'four', url: 'https://four.com/' }
  ];
  const out = sg.choose(rs, { selfUrl: 'https://self.com/b', exclude: ['open.com'], max: 3 });
  assert.deepEqual(out.map((x) => x.title), ['one', 'two', 'three']);
});

test('choose keeps only http(s) links and strips tracking parameters', () => {
  const out = sg.choose([{ title: 'js', url: 'javascript:alert(1)' }, { title: 'ok', url: 'https://a.com/p?utm_source=x&id=7' }], { max: 3 });
  assert.deepEqual(out, [{ title: 'ok', url: 'https://a.com/p?id=7', host: 'a.com' }]);
});

test('suggest asks the model for queries from the title and summary, then searches', async () => {
  let seen;
  const llm = { async chat(m) { seen = m; return '["xe điện vinfast"]'; } };
  const fetchImpl = async (u) => ({ ok: true, text: async () => DDG, json: async () => ({}) , url: String(u) });
  const out = await sg.suggest({ title: 'VF 8', url: 'https://self.com/', summary: ['Đánh giá VF 8.'], llm, fetchImpl, lang: 'vi' });
  assert.match(JSON.stringify(seen), /VF 8/);
  assert.match(JSON.stringify(seen), /Đánh giá VF 8/);
  assert.deepEqual(out.map((x) => x.host), ['vnexpress.net', 'tinhte.vn']);
});

test('suggest never sends the page url or full text to the model', async () => {
  let seen;
  const llm = { async chat(m) { seen = JSON.stringify(m); return '["q q"]'; } };
  const fetchImpl = async () => ({ ok: true, text: async () => DDG, json: async () => ({}) });
  await sg.suggest({ title: 'T', url: 'https://secret.example/path?token=abc', summary: ['s'], llm, fetchImpl });
  assert.equal(/secret\.example|token=abc/.test(seen), false);
});

test('suggest falls back to Wikipedia when the web search finds nothing', async () => {
  const llm = { async chat() { return '["xe điện"]'; } };
  const fetchImpl = async (u) => String(u).includes('duckduckgo')
    ? { ok: true, text: async () => '<html></html>' }
    : { ok: true, json: async () => ({ query: { pages: { 1: { title: 'Xe điện', fullurl: 'https://vi.wikipedia.org/wiki/Xe', index: 1 } } } }) };
  const out = await sg.suggest({ title: 'T', url: 'https://self.com/', summary: ['s'], llm, fetchImpl, lang: 'vi' });
  assert.equal(out[0].host, 'vi.wikipedia.org');
});

test('suggest returns nothing, without throwing, when the model or the network fails', async () => {
  const bad = { async chat() { throw new Error('down'); } };
  assert.deepEqual(await sg.suggest({ title: 'T', url: 'https://a.com/', summary: ['s'], llm: bad, fetchImpl: async () => { throw new Error('x'); } }), []);
  assert.deepEqual(await sg.suggest({ title: 'T', url: 'https://a.com/', summary: ['s'], llm: null, fetchImpl: async () => { throw new Error('x'); } }), []);
});

test('isSearchHost recognises search engines, with or without www, and nothing else', () => {
  for (const h of ['www.google.com', 'google.com.vn', 'duckduckgo.com', 'search.brave.com', 'coccoc.com', 'www.bing.com']) assert.equal(sg.isSearchHost(h), true, h);
  for (const h of ['vnexpress.net', 'googleusercontent.net', 'example.com', '']) assert.equal(sg.isSearchHost(h), false, h);
});

test('suggest does not ask the model anything while the page has no title yet', async () => {
  let asked = 0;
  const llm = { async chat() { asked++; return '["x y"]'; } };
  assert.deepEqual(await sg.suggest({ title: '  ', url: 'https://a.com/', summary: ['s'], llm, fetchImpl: async () => ({ ok: true, text: async () => '' }) }), []);
  assert.equal(asked, 0);
});

test('parseQueries drops a query that is only a stray word with no subject', () => {
  assert.deepEqual(sg.parseQueries('[" review", "guide", "electric cars"]'), ['electric cars']);
});
