// Runs in every web page's sandboxed preload. Exposes nothing to the page.
// PRV-10: when enabled (argument --lore-fp=1) it makes this browser look more like everyone else's and adds tiny noise to
// canvas reads. The function below runs in the page's main world before any page script, so it must be self-contained.
const { webFrame } = require('electron');

function applyFingerprintProtection() {
  const seed = Math.floor(Math.random() * 1e9);
  const def = (obj, prop, value) => { try { Object.defineProperty(obj, prop, { get: () => value, configurable: true }); } catch { /* locked */ } };
  def(Navigator.prototype, 'hardwareConcurrency', 4);
  def(Navigator.prototype, 'deviceMemory', 8);
  def(Navigator.prototype, 'languages', Object.freeze([navigator.language]));

  // Canvas: flip the lowest bit of a few colour values, differently each page load. Invisible, but breaks cross-site hashing.
  const noisy = (data) => {
    let s = seed;
    for (let i = 0; i < data.length; i += 16) { s = (s * 1664525 + 1013904223) >>> 0; if (s % 3 === 0) data[i] ^= 1; }
    return data;
  };
  const origGet = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...a) {
    const img = origGet.apply(this, a);
    noisy(img.data);
    return img;
  };
  const wrapExport = (proto, name) => {
    const orig = proto[name];
    proto[name] = function (...a) {
      try {
        const w = this.width; const h = this.height;
        if (w && h && w * h < 4e6) {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(this, 0, 0);
          const img = origGet.call(ctx, 0, 0, w, h);
          noisy(img.data);
          ctx.putImageData(img, 0, 0);
          return orig.apply(c, a);
        }
      } catch { /* tainted or unsupported: fall through */ }
      return orig.apply(this, a);
    };
  };
  wrapExport(HTMLCanvasElement.prototype, 'toDataURL');
  wrapExport(HTMLCanvasElement.prototype, 'toBlob');

  // WebGL: do not reveal the exact graphics card.
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const C = window[name];
    if (!C) continue;
    const orig = C.prototype.getParameter;
    C.prototype.getParameter = function (p) {
      if (p === 37445) return 'Google Inc.';
      if (p === 37446) return 'ANGLE (Generic Renderer)';
      return orig.call(this, p);
    };
  }
}

// webFrame runs the code in the page's main world; Electron 33 has no contextBridge.executeInMainWorld yet.
if (process.argv.includes('--lore-fp=1')) webFrame.executeJavaScript('(' + applyFingerprintProtection.toString() + ')()');
