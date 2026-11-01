const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyResponse, isDeniedSite } = require('../src/media');
const { parseMaster, parseMedia } = require('../src/hls');
const { options, download, safeName } = require('../src/downloader');

test('classify mp4 / hls / noise', () => {
  assert.strictEqual(classifyResponse({ url: 'https://a.vn/v.mp4', contentType: 'video/mp4', contentLength: '5000000' }).type, 'mp4');
  assert.strictEqual(classifyResponse({ url: 'https://a.vn/p.m3u8', contentType: 'application/vnd.apple.mpegurl' }).type, 'hls');
  assert.strictEqual(classifyResponse({ url: 'https://a.vn/v.mp4', contentType: 'video/mp4', status: 206, contentRange: 'bytes 0-99/9000000' }).size, 9000000);
  assert.strictEqual(classifyResponse({ url: 'https://a.vn/x.mp4', contentType: 'video/mp4', contentLength: '1000' }), null);
  assert.strictEqual(classifyResponse({ url: 'https://a.vn/x.js', contentType: 'text/javascript' }), null);
  assert.strictEqual(classifyResponse({ url: 'https://a.vn/v.mp4', contentType: 'video/mp4', status: 404 }), null);
});
test('denied sites', () => {
  assert.ok(isDeniedSite('https://www.youtube.com/watch?v=1'));
  assert.ok(!isDeniedSite('https://classroom.example.vn/bai-3'));
});
test('hls master and media parsing', () => {
  const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\nhi/hd.m3u8\n';
  const v = parseMaster(master, 'https://a.vn/p/master.m3u8');
  assert.deepStrictEqual(v.map((x) => x.height), [1080, 360]);
  assert.strictEqual(v[0].url, 'https://a.vn/p/hi/hd.m3u8');
  const media = '#EXTM3U\n#EXTINF:4,\ns1.ts\n#EXTINF:4,\ns2.ts\n#EXT-X-ENDLIST\n';
  const m = parseMedia(media, 'https://a.vn/p/x.m3u8');
  assert.deepStrictEqual([m.encrypted, m.live, m.segments.length], [false, false, 2]);
  assert.ok(parseMedia('#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:4,\ns.ts\n#EXT-X-ENDLIST', 'https://a.vn/').encrypted);
});
test('safeName', () => assert.strictEqual(safeName('Bài 3: Widget/Trạng thái?'), 'Bài 3 Widget Trạng thái'));

const fakeFetch = (map) => async (url) => {
  const body = map[url];
  if (body === undefined) return { ok: false, status: 404 };
  const buf = Buffer.from(body);
  return {
    ok: true, status: 200, headers: { get: () => String(buf.length) },
    body: (async function* () { yield buf.subarray(0, 3); yield buf.subarray(3); })(),
    text: async () => body, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)
  };
};

test('download mp4 with progress', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-'));
  const prog = [];
  const f = await download(fakeFetch({ 'https://a.vn/v.mp4': 'hello world' }), { type: 'mp4', url: 'https://a.vn/v.mp4' }, { dir, title: 'Bài 3', onProgress: (p) => prog.push(p) });
  assert.strictEqual(fs.readFileSync(f, 'utf8'), 'hello world');
  assert.strictEqual(prog.at(-1), 1);
  const f2 = await download(fakeFetch({ 'https://a.vn/v.mp4': 'x' }), { type: 'mp4', url: 'https://a.vn/v.mp4' }, { dir, title: 'Bài 3' });
  assert.notStrictEqual(f, f2);
});
test('download hls joins segments in order, refuses encrypted', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-'));
  const ok = { 'https://a.vn/m.m3u8': '#EXTINF:1,\ns1.ts\n#EXTINF:1,\ns2.ts\n#EXTINF:1,\ns3.ts\n#EXT-X-ENDLIST', 'https://a.vn/s1.ts': 'A', 'https://a.vn/s2.ts': 'B', 'https://a.vn/s3.ts': 'C' };
  const f = await download(fakeFetch(ok), { type: 'hls', url: 'https://a.vn/m.m3u8' }, { dir, title: 'v', concurrency: 2 });
  assert.strictEqual(fs.readFileSync(f, 'utf8'), 'ABC');
  await assert.rejects(download(fakeFetch({ 'https://a.vn/e.m3u8': '#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:1,\ns.ts\n#EXT-X-ENDLIST' }), { type: 'hls', url: 'https://a.vn/e.m3u8' }, { dir, title: 'e' }), /protected/);
});
test('options expands master playlist', async () => {
  const o = await options(fakeFetch({ 'https://a.vn/m.m3u8': '#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1x720\na.m3u8' }), { type: 'hls', url: 'https://a.vn/m.m3u8' });
  assert.deepStrictEqual(o.map((x) => x.label), ['720p']);
});
