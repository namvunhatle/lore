// Fewer tokens for the same page (token saver): instead of sending the start, middle and end of a long page, send the sentences
// that carry it. Sentences are scored by how common their words are across the page and by where they sit, near-duplicates are
// dropped, and what is kept stays in reading order. No model, no network.
const { tokens } = require('./memory');

function condense(text, max) {
  const t = String(text || '');
  if (t.length <= max) return t;
  const sents = [];
  t.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 30).forEach((p, pi) => {
    for (const s of p.split(/(?<=[.!?。])\s+/)) if (s.length > 25 && s.length < 600) sents.push({ s, pi, i: sents.length });
  });
  if (!sents.length) return t.slice(0, max);
  const freq = new Map();
  const words = sents.map((x) => tokens(x.s));
  for (const w of words) for (const k of new Set(w)) freq.set(k, (freq.get(k) || 0) + 1);
  const N = sents.length;
  sents.forEach((x, k) => {
    const w = words[k];
    // Words that are everywhere (menus, boilerplate) count for less; rarer shared words count for more.
    const raw = w.reduce((a, k2) => a + (freq.get(k2) > 1 && freq.get(k2) < N * 0.5 ? Math.log(1 + freq.get(k2)) : 0), 0);
    x.score = raw / Math.sqrt(Math.max(w.length, 4)) + (k < 3 ? 1.5 : 0) + (x.i === N - 1 ? 0.5 : 0);
  });
  const seen = new Set();
  const picked = [];
  let size = 0;
  for (const x of [...sents].sort((a, b) => b.score - a.score)) {
    const key = x.s.slice(0, 40).toLowerCase();
    if (seen.has(key) || size + x.s.length + 1 > max) continue;
    seen.add(key); picked.push(x); size += x.s.length + 1;
  }
  return picked.sort((a, b) => a.i - b.i).map((x) => x.s).join('\n');
}

// What is sent for each setting of Settings > AI > Data used.
const BUDGET = {
  save: { summary: 2500, compare: 1200, passages: 2 },
  balanced: { summary: 9000, compare: 3500, passages: 3 },
  detail: { summary: 14000, compare: 5000, passages: 4 }
};
const budgetFor = (mode) => BUDGET[mode] || BUDGET.balanced;

module.exports = { condense, budgetFor, BUDGET };
