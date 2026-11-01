// Reads a page's article text with Mozilla's Readability inside the page's isolated world. Hidden text is dropped first
// (see shield.js). This is what the AI features read; there is no separate reader view.
const fs = require('fs');
const { CLEAN_SOURCE } = require('./shield');

let source;
function extractionScript() {
  if (!source) source = fs.readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf8');
  return source + CLEAN_SOURCE + `;(() => {
    if (typeof Readability === 'undefined') return null;
    // Only what a person can see is read: hidden, tiny, off-screen and camouflaged text is dropped first (AI-10).
    const { clone, hidden } = loreCleanClone();
    const a = new Readability(clone, { charThreshold: 400 }).parse();
    return a ? { title: a.title || document.title, byline: a.byline || '', siteName: a.siteName || location.hostname, content: a.content, text: a.textContent || '', length: a.length, hidden } : null;
  })()`;
}

module.exports = { extractionScript };
