// Compiles the bundled filter engine. Run before packaging: npm run filters
const fs = require('fs');
const https = require('https');
const path = require('path');
const { buildEngine, BUNDLED_LISTS } = require('../src/adblock');

// Node's built-in fetch can crash a build with an assertion inside undici on some CI runners (seen on Windows), and that
// error cannot be caught. A plain https request with a few retries is slower to write but does not have that problem.
function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'lore-build' }, timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function download(url) {
  let last;
  for (let i = 0; i < 4; i++) {
    try { return await get(url); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  console.error('could not download', url, '-', last.message);
  throw last;
}

(async () => {
  const engine = await buildEngine(BUNDLED_LISTS, async (url) => { const text = await download(url); return { ok: true, text: async () => text }; });
  const out = path.join(__dirname, '..', 'src', 'filters', 'engine.bin');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, engine.serialize());
  console.log('wrote', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
})().catch((e) => { console.error(e.message); process.exit(1); });
