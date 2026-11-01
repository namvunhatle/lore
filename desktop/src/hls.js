// Minimal HLS playlist parsing: master playlists (quality variants) and plain media playlists.
function resolve(base, ref) { return new URL(ref, base).toString(); }

function parseMaster(text, base) {
  if (!/#EXT-X-STREAM-INF/.test(text)) return null;
  const lines = text.split(/\r?\n/);
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
    const bw = /BANDWIDTH=(\d+)/.exec(lines[i]);
    const res = /RESOLUTION=\d+x(\d+)/.exec(lines[i]);
    const uri = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#'));
    if (uri) variants.push({ url: resolve(base, uri.trim()), bandwidth: bw ? Number(bw[1]) : 0, height: res ? Number(res[1]) : 0 });
  }
  return variants.sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth);
}

function parseMedia(text, base) {
  const lines = text.split(/\r?\n/);
  const keyLine = lines.find((l) => l.startsWith('#EXT-X-KEY') && !/METHOD=NONE/.test(l));
  return {
    encrypted: !!keyLine,
    live: !/#EXT-X-ENDLIST/.test(text),
    segments: lines.filter((l) => l.trim() && !l.startsWith('#')).map((l) => resolve(base, l.trim()))
  };
}

module.exports = { parseMaster, parseMedia };
