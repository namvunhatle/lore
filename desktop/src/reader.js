// AI-06: clean reader. Extracts the article with Mozilla's Readability inside the page's isolated world.
// The reader page sanitizes the result again before showing it (see ui/sanitize.js).
const fs = require('fs');

let source;
function extractionScript() {
  if (!source) source = fs.readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf8');
  return source + `;(() => {
    if (typeof Readability === 'undefined') return null;
    const a = new Readability(document.cloneNode(true), { charThreshold: 400 }).parse();
    return a ? { title: a.title || document.title, byline: a.byline || '', siteName: a.siteName || location.hostname, content: a.content, text: a.textContent || '', length: a.length } : null;
  })()`;
}

module.exports = { extractionScript };
