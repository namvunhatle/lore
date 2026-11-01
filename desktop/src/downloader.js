const fs = require('fs');
const path = require('path');
const { parseMaster, parseMedia } = require('./hls');

function safeName(title) {
  const n = (title || 'video').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return n || 'video';
}

function uniquePath(dir, base, ext) {
  let p = path.join(dir, base + ext);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
}

async function downloadFile(fetchFn, url, dest, onProgress, signal) {
  const res = await fetchFn(url, { signal });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = Number(res.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(dest);
  let got = 0;
  try {
    for await (const chunk of res.body) {
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      got += chunk.length;
      if (total) onProgress(got / total);
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  onProgress(1);
}

const text = async (fetchFn, url, signal) => {
  const r = await fetchFn(url, { signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
};

// Lists quality choices for a detected item. HLS master playlists expand to variants.
async function options(fetchFn, item) {
  if (item.type !== 'hls') return [{ label: item.type.toUpperCase(), url: item.url, type: item.type, size: item.size }];
  const body = await text(fetchFn, item.url);
  const variants = parseMaster(body, item.url);
  if (!variants) return [{ label: 'HLS', url: item.url, type: 'hls', size: 0 }];
  return variants.map((v) => ({ label: v.height ? v.height + 'p' : 'HLS', url: v.url, type: 'hls', size: 0 }));
}

async function download(fetchFn, opt, { dir, title, onProgress = () => {}, signal, concurrency = 4 }) {
  const base = safeName(title);
  if (opt.type !== 'hls') {
    const dest = uniquePath(dir, base, opt.type === 'webm' ? '.webm' : '.mp4');
    try { await downloadFile(fetchFn, opt.url, dest, onProgress, signal); } catch (e) { fs.rmSync(dest, { force: true }); throw e; }
    return dest;
  }
  const pl = parseMedia(await text(fetchFn, opt.url, signal), opt.url);
  if (pl.encrypted) throw new Error('protected');
  if (pl.live) throw new Error('live');
  if (!pl.segments.length) throw new Error('empty');
  // No ffmpeg yet: segments are joined as MPEG-TS. Remuxing to MP4 is a later step.
  const dest = uniquePath(dir, base, '.ts');
  const out = fs.createWriteStream(dest);
  try {
    for (let i = 0; i < pl.segments.length; i += concurrency) {
      const batch = await Promise.all(pl.segments.slice(i, i + concurrency).map(async (u) => {
        const r = await fetchFn(u, { signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return Buffer.from(await r.arrayBuffer());
      }));
      for (const b of batch) out.write(b);
      onProgress(Math.min(1, (i + batch.length) / pl.segments.length));
    }
  } catch (e) {
    out.destroy();
    fs.rmSync(dest, { force: true });
    throw e;
  }
  await new Promise((r) => out.end(r));
  return dest;
}

module.exports = { options, download, safeName };
