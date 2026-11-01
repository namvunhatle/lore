// Automatic updates (REL-03). Lore asks GitHub Releases whether a newer version exists. Whether it can install the new
// version by itself depends on the system:
//   Windows               installs by itself (the installer is not required to be signed)
//   Linux AppImage        replaces itself
//   macOS                 only when the app is signed and notarized: macOS refuses to swap in an unsigned app
//   everything else       tells the person and opens the download page
const RELEASES = 'https://github.com/tevo-web/lore/releases/latest';

function mode({ platform, signed = false, appImage = false } = {}) {
  if (platform === 'win32') return 'auto';
  if (platform === 'linux') return appImage ? 'auto' : 'manual';
  if (platform === 'darwin') return signed ? 'auto' : 'manual';
  return 'manual';
}

// True when `b` is a newer plain version than `a` ("0.1.2" > "0.1.1"; a pre-release is older than its release).
function isNewer(a, b) {
  const parse = (v) => { const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(String(v || '').trim()); return m ? { n: [+m[1], +m[2], +m[3]], pre: m[4] || '' } : null; };
  const x = parse(a), y = parse(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return y.n[i] > x.n[i];
  if (x.pre === y.pre) return false;
  return !!x.pre && !y.pre ? true : (!x.pre && !!y.pre ? false : y.pre > x.pre);
}

module.exports = { mode, isNewer, RELEASES };
