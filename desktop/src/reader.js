// AI-06: clean reader. Extracts the article with Mozilla's Readability inside the page's isolated world.
// The reader page sanitizes the result again before showing it (see ui/sanitize.js).
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
