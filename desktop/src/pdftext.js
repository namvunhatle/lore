// AI-12: the text of a PDF, page by page, read on this computer with pdf.js. The file is fetched by the browser itself with
// the tab's own session, so a PDF behind a sign-in works, and nothing is sent anywhere to read it.
const MAX_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 120;

// pdf.js needs Promise.withResolvers (present in the Electron runtime; older Node used for tests lacks it).
if (!Promise.withResolvers) Promise.withResolvers = function () { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

let lib = null;
const load = async () => lib || (lib = await import('pdfjs-dist/legacy/build/pdf.mjs'));

const isPdfUrl = (u) => { try { return /\.pdf$/i.test(new URL(u).pathname); } catch { return false; } };

// -> { pages: [text, …], total } ; throws when the file is not a readable PDF
async function extract(bytes) {
  if (!bytes || !bytes.length || bytes.length > MAX_BYTES) throw new Error('pdf.size');
  const pdfjs = await load();
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const c = await page.getTextContent();
      pages.push(c.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
    }
    return { pages, total: doc.numPages };
  } finally { await task.destroy(); }
}

// One text with a marker at the start of every page, so an answer's passages tell which page they came from.
const withPages = (pages) => pages.map((t, i) => (t ? `(page ${i + 1}) ${t}` : '')).filter(Boolean).join('\n\n');

module.exports = { extract, withPages, isPdfUrl, MAX_PAGES };
