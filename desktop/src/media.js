// Detects downloadable media from network responses. No DRM (CONTRIBUTING.md, "Product rules"): encrypted HLS is refused,
// and platforms whose terms forbid downloading never get a button.

const DENY = [
  'youtube.com', 'youtu.be', 'googlevideo.com', 'netflix.com', 'nflxvideo.net', 'primevideo.com',
  'disneyplus.com', 'hbomax.com', 'max.com', 'spotify.com', 'tiktok.com', 'facebook.com', 'instagram.com'
];

function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }
function inList(host, list) { return list.some((d) => host === d || host.endsWith('.' + d)); }
const isDeniedSite = (pageUrl) => inList(hostOf(pageUrl), DENY);

// Returns { type: 'mp4'|'hls', url, size } or null.
function classifyResponse({ url, contentType = '', contentLength, contentRange, status = 200 }) {
  if (status !== 200 && status !== 206) return null;
  const ct = contentType.toLowerCase().split(';')[0].trim();
  const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
  if (ct === 'application/vnd.apple.mpegurl' || ct === 'application/x-mpegurl' || path.endsWith('.m3u8')) {
    return { type: 'hls', url, size: 0 };
  }
  if (ct === 'video/mp4' || ct === 'video/webm' || path.endsWith('.mp4') || path.endsWith('.webm')) {
    const total = contentRange && /\/(\d+)$/.exec(contentRange);
    const size = total ? Number(total[1]) : Number(contentLength) || 0;
    if (size && size < 300 * 1024) return null; // tiny clips and stream chunks, not the video
    return { type: path.endsWith('.webm') || ct === 'video/webm' ? 'webm' : 'mp4', url, size };
  }
  return null;
}

module.exports = { classifyResponse, isDeniedSite };
