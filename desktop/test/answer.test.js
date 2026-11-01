const test = require('node:test');
const assert = require('node:assert');
const { answer, parse, topicOf, titleScore } = require('../src/answer');

const page = (index, title, extra = {}) => ({ index, title, extract: title + ' extract.', fullurl: 'https://en.wikipedia.org/wiki/' + title.replace(/ /g, '_'), ...extra });
const wiki = (...pages) => ({ query: { pages: Object.fromEntries(pages.map((p, i) => [i + 1, p])) } });
const fetchOf = (json) => async () => ({ ok: true, json: async () => json });

test('topic extraction', () => {
  assert.strictEqual(topicOf('who is Ho Chi Minh?'), 'Ho Chi Minh');
  assert.strictEqual(topicOf('what is a black hole'), 'black hole');
  assert.strictEqual(topicOf('VinFast là gì'), 'VinFast');
  assert.strictEqual(topicOf('how to cook pho'), null);
  assert.strictEqual(topicOf('best phone 2026'), null);
  assert.strictEqual(topicOf('a b c d e f g h'), null);
});
test('title scoring', () => {
  assert.strictEqual(titleScore('Ho Chi Minh', 'ho chi minh'), 3);
  assert.strictEqual(titleScore('Da Nang', 'da nang city'), 2);
  assert.strictEqual(titleScore('Ho Chi Minh City', 'ho chi minh'), 0);
  assert.strictEqual(titleScore('Capital punishment in France', 'capital of France'), 0);
  assert.strictEqual(titleScore('Hanoi', 'da nang'), 0);
  assert.strictEqual(titleScore('Capital (French magazine)', 'capital of France'), 0);
  assert.strictEqual(titleScore('Capital', 'capital of France'), 0);
  assert.strictEqual(titleScore('Mercury (planet)', 'mercury'), 0);
  assert.strictEqual(titleScore('Mercury (planet)', 'mercury planet'), 3);
});
test('prefers the exact title over a better-ranked near miss', () => {
  const r = parse(wiki(page(1, 'Ho Chi Minh City'), page(2, 'Ho Chi Minh')), 'Ho Chi Minh');
  assert.strictEqual(r.matched, 'Ho Chi Minh');
});
test('rejects unrelated and disambiguation hits', () => {
  assert.strictEqual(parse(wiki(page(1, 'Tourism in Vietnam'), page(2, 'Hanoi')), 'Da Nang'), null);
  assert.strictEqual(parse(wiki(page(1, 'Mercury', { pageprops: { disambiguation: '' } })), 'Mercury'), null);
  assert.strictEqual(parse(wiki(page(1, 'List of airlines')), 'airlines'), null);
});
test('returns one matched source, not loose neighbours', () => {
  const r = parse(wiki(page(1, 'VinFast'), page(2, 'VinFast Auto'), page(3, 'Vingroup')), 'VinFast');
  assert.deepStrictEqual(r.sources.map((s) => s.title), ['VinFast']);
});
test('answer skips non-lookups without calling the network', async () => {
  let calls = 0;
  assert.strictEqual(await answer('how to cook pho', async () => { calls++; }), null);
  assert.strictEqual(calls, 0);
});
test('answer returns null on network failure', async () => {
  assert.strictEqual(await answer('Da Nang', async () => { throw new Error('offline'); }), null);
});
test('answer end to end with fetch stub', async () => {
  const r = await answer('what is Da Nang', fetchOf(wiki(page(1, 'Tourism in Da Nang'), page(2, 'Da Nang'))));
  assert.strictEqual(r.matched, 'Da Nang');
});

const { answerQuery, needsLiveData } = require('../src/answer');
const wikiStub = async () => ({ provider: 'Wikipedia', matched: 'Da Nang', summary: 'Da Nang is a city in Vietnam.', sources: [{ title: 'Da Nang', url: 'https://en.wikipedia.org/wiki/Da_Nang' }] });
const llmStub = (reply, up = true) => ({ model: 'test:1b', available: async () => up, chat: async () => reply });

test('live-data detection', () => {
  assert.ok(needsLiveData('flight prices Hanoi to Da Nang this weekend'));
  assert.ok(needsLiveData('giá vé Hà Nội đi Đà Nẵng cuối tuần này'));
  assert.ok(!needsLiveData('who founded VinFast'));
});
test('live query without a model does not fall back to a Wikipedia guess', async () => {
  const r = await answerQuery('flight prices Hanoi to Da Nang this weekend', { llm: llmStub('', false), wiki: wikiStub });
  assert.deepStrictEqual(r.sources, []);
  assert.match(r.summary, /won't guess/);
});
test('model-invented prices are discarded', async () => {
  const r = await answerQuery('flight prices Hanoi to Da Nang', { llm: llmStub('Tickets cost about 1,200,000 VND.'), wiki: wikiStub });
  assert.doesNotMatch(r.summary, /1,200,000/);
});
test('live query keeps stable facts and adds the live-data note', async () => {
  const r = await answerQuery('flight prices Hanoi to Da Nang', { llm: llmStub('The flight takes about 1h20 and Vietnam Airlines and Vietjet operate it.'), wiki: wikiStub });
  assert.match(r.summary, /1h20/);
  assert.match(r.summary, /won't guess/);
});
test('non-live query uses model plus wiki context', async () => {
  const r = await answerQuery('what is Da Nang', { llm: llmStub('Da Nang is a coastal city in central Vietnam. [1]'), wiki: wikiStub });
  assert.strictEqual(r.provider, 'On-device AI');
  assert.strictEqual(r.sources.length, 1);
});
test('non-live query without a model falls back to wiki', async () => {
  const r = await answerQuery('what is Da Nang', { llm: llmStub('', false), wiki: wikiStub });
  assert.strictEqual(r.provider, 'Wikipedia');
});

test('claims must cite real evidence; uncited or out-of-range sentences are dropped', () => {
  const { parseClaims } = require('../src/answer');
  const c = parseClaims('Da Nang is a coastal city. [1] It is famous for bridges. [2][1] It has a billion people. [9] Trust me.', 3);
  assert.deepStrictEqual(c, [{ text: 'Da Nang is a coastal city.', cites: [1] }, { text: 'It is famous for bridges.', cites: [2, 1] }]);
  assert.deepStrictEqual(parseClaims('NO_ANSWER', 3), []);
});
test('cited answers carry evidence; uncited ones fall back to the excerpt', async () => {
  const w = async () => ({ provider: 'Wikipedia', matched: 'Da Nang', summary: 'Da Nang is a city in Vietnam. It lies on the coast of the South China Sea.', sources: [{ title: 'Da Nang', url: 'https://en.wikipedia.org/wiki/Da_Nang' }] });
  const good = await answerQuery('what is Da Nang', { llm: llmStub('Da Nang is a city in Vietnam. [1]'), wiki: w });
  assert.strictEqual(good.claims.length, 1);
  assert.strictEqual(good.evidence.length, 2);
  const bad = await answerQuery('what is Da Nang', { llm: llmStub('Da Nang is a city.'), wiki: w });
  assert.strictEqual(bad.provider, 'Wikipedia');
  assert.ok(!bad.claims);
});
