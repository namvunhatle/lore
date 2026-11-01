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

// BRW-12: when a person submits a form that has a password, tell the browser (never the page) so it can offer to save it.
// Only real clicks and key presses count, not events a page makes up. The browser takes the site from the tab itself.
const { ipcRenderer } = require('electron');
// A page can make the browser submit a form by script, so a submit only counts when the person pressed a key or clicked a
// moment ago; a page cannot fake those.
let lastInput = 0;
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, (e) => { if (e.isTrusted) lastInput = Date.now(); }, true);
function reportLogin(form) {
  if (Date.now() - lastInput > 10000) return;
  try {
    const pw = [...form.querySelectorAll('input[type=password]')].find((i) => i.value);
    if (!pw) return;
    const before = [...form.querySelectorAll('input')].filter((i) => ['text', 'email', 'tel', ''].includes(i.type) && i.value && (i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING));
    const named = form.querySelector('input[autocomplete~=username]');
    const user = (named && named.value) || (before.length ? before[before.length - 1].value : '');
    ipcRenderer.send('pw:submit', { user: String(user).slice(0, 200), pass: String(pw.value).slice(0, 500) });
  } catch { /* a page we cannot read */ }
}
document.addEventListener('submit', (e) => { if (e.isTrusted && e.target instanceof HTMLFormElement) reportLogin(e.target); }, true);
document.addEventListener('click', (e) => {
  if (!e.isTrusted || !e.target || !e.target.closest) return;
  const b = e.target.closest('button, input[type=submit]');
  if (b && b.form && b.type !== 'button' && b.type !== 'reset') reportLogin(b.form);
}, true);

// The page's outline, for the sidebar (never for the page). Headings only (h1-h3, not in navigation), cut to short text,
// sent to the browser, which keeps them in memory for as long as the tab shows this page. Nothing here reads the body text.
// Private tabs and pages that are not on the web report nothing. The browser can also ask this page to scroll to a heading.
if (!process.argv.includes('--lore-private=1')) {
  const SKIP = 'nav, aside, footer, dialog, [role=navigation], [role=banner], [role=complementary], [aria-hidden=true], [hidden]';
  let heads = [];
  let lastSent = '';
  let lastIdx = -2;
  const scan = () => {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      heads = [...document.querySelectorAll('h1, h2, h3')].filter((h) => !h.closest(SKIP) && h.getClientRects().length && (h.textContent || '').trim());
      const items = heads.slice(0, 60).map((h) => ({
        text: (h.textContent || '').replace(/\[edit\]/gi, '').replace(/\s+/g, ' ').trim().slice(0, 120),
        level: Number(h.tagName[1]),
        id: h.id || (h.querySelector('[id]') || {}).id || ''
      }));
      heads = heads.slice(0, 60);
      const sig = JSON.stringify(items);
      if (sig !== lastSent) { lastSent = sig; ipcRenderer.send('outline:set', items); lastIdx = -2; }
      report();
    } catch { /* a page we cannot read */ }
  };
  // The heading at the reading line: the last one whose top is above 30% of the window height.
  const report = () => {
    if (!heads.length) return;
    const line = innerHeight * 0.3;
    let idx = -1;
    for (let i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top <= line) idx = i; else break; }
    if (idx !== lastIdx) { lastIdx = idx; ipcRenderer.send('outline:at', idx); }
  };
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    setTimeout(() => { ticking = false; report(); }, 120);
  }, { passive: true, capture: true });
  document.addEventListener('DOMContentLoaded', scan);
  window.addEventListener('load', () => { scan(); setTimeout(scan, 1500); setTimeout(scan, 6000); });
  ipcRenderer.on('outline:go', (_e, i) => {
    const h = Number.isInteger(i) && heads[i];
    if (h && h.isConnected) h.scrollIntoView({ block: 'start' });
  });
}
