// Page understanding that works without any model: key sentences and the passage that answers a question.
// A model (local or API) is only used on top of this, and always sees just these short passages, never the whole page.
const { norm } = require('./router');
const { tokens } = require('./memory');

const sentencesOf = (text) => text.replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ0-9"“])/).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 400);

// Picks the n most representative sentences, returned in reading order.
function extractiveSummary(text, n = 3) {
  const sents = sentencesOf(text);
  if (sents.length <= n) return sents;
  const freq = new Map();
  for (const s of sents) for (const w of new Set(tokens(s))) freq.set(w, (freq.get(w) || 0) + 1);
  const scored = sents.map((s, i) => {
    const ws = tokens(s);
    const score = ws.reduce((a, w) => a + ((freq.get(w) || 0) > 1 ? Math.log(1 + freq.get(w)) : 0), 0) / Math.sqrt(ws.length || 1);
    return { s, i, score: score * (1 + 0.6 / (1 + i)) }; // early sentences matter more
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}

function paragraphsOf(text) {
  const raw = text.split(/\n{2,}|\r\n{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length >= 30);
  const out = [];
  for (const p of raw) {
    if (p.length <= 700) out.push(p);
    else for (let i = 0; i < p.length; i += 600) out.push(p.slice(i, i + 700));
  }
  return out;
}

// The passages of the page that best match a question (BM25), best first. Empty if nothing matches.
function bestPassages(text, question, k = 3) {
  const q = tokens(question);
  const paras = paragraphsOf(text);
  if (!q.length || !paras.length) return [];
  const docs = paras.map((p) => tokens(p));
  const N = docs.length;
  const avg = docs.reduce((s, d) => s + d.length, 0) / N || 1;
  const df = Object.fromEntries(q.map((t) => [t, docs.filter((d) => d.includes(t)).length]));
  const scored = paras.map((p, i) => {
    const d = docs[i];
    const score = q.reduce((s, t) => {
      const tf = d.filter((x) => x === t).length;
      if (!tf) return s;
      return s + Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5)) * ((tf * 2.4) / (tf + 1.4 * (0.25 + 0.75 * d.length / avg)));
    }, 0);
    return { p, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map((x) => x.p);
}

const readingMinutes = (text) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));

module.exports = { extractiveSummary, bestPassages, readingMinutes, sentencesOf };
