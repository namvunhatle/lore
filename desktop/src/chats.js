// Conversations with the page assistant, kept per page address so that coming back to a page (or another tab) brings its chat
// back. Normal tabs are saved encrypted on this computer; private tabs keep theirs in memory only and never reach this store.
const MAX_THREADS = 150;
const MAX_STATES = 30;

const clip = (s, n) => String(s || '').slice(0, n);

// What is kept of one message: enough to draw it again, nothing heavy.
function keep(s) {
  if (!s || !Number.isFinite(s.seq) || s.state !== 'done' || s.mode === 'translate') return null;
  return {
    seq: s.seq, mode: ['summarize', 'ask', 'sel'].includes(s.mode) ? s.mode : 'ask', state: 'done', question: clip(s.question, 300),
    bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 8).map((b) => clip(b, 400)) : undefined,
    answer: s.answer === undefined ? undefined : clip(s.answer, 3000), found: s.found, ai: !!s.ai,
    passages: Array.isArray(s.passages) ? s.passages.slice(0, 2).map((p) => clip(p, 500)) : undefined,
    model: clip(s.model, 60), remote: clip(s.remote, 100), page: s.page ? { title: clip(s.page.title, 200), host: clip(s.page.host, 100) } : undefined
  };
}

// The pairs a follow-up question can lean on: the last few answers, as short text.
function context(states, n = 3) {
  return states.filter((s) => s.state === 'done').slice(-n).map((s) => ({
    q: s.question || (s.mode === 'summarize' ? 'Summarize this page' : 'Question'),
    a: clip(s.answer || (s.bullets || []).join(' '), 600)
  })).filter((x) => x.a);
}

class ChatStore {
  constructor({ load, save } = {}) {
    this._save = save || (() => {});
    const d = load ? load() : null;
    this.map = new Map();
    const raw = d && !Array.isArray(d) && Array.isArray(d.threads) ? d.threads : [];
    for (const t of raw) {
      if (!t || typeof t.key !== 'string' || !/^https?:\/\//.test(t.url || '') || !Array.isArray(t.states)) continue;
      const states = t.states.map(keep).filter(Boolean).slice(-MAX_STATES);
      if (states.length) this.map.set(t.key, { key: t.key, url: clip(t.url, 2000), title: clip(t.title, 200), ts: Number(t.ts) || Date.now(), states });
    }
  }
  _persist() { this._save({ v: 1, threads: [...this.map.values()] }); }
  get(key) { return this.map.get(key) || null; }
  put(key, { url, title, states }) {
    const kept = states.map(keep).filter(Boolean).slice(-MAX_STATES);
    if (!kept.length) { this.remove(key); return; }
    this.map.set(key, { key, url: clip(url, 2000), title: clip(title, 200), ts: Date.now(), states: kept });
    if (this.map.size > MAX_THREADS) { const old = [...this.map.values()].sort((a, b) => a.ts - b.ts)[0]; this.map.delete(old.key); }
    this._persist();
  }
  remove(key) { if (this.map.delete(key)) this._persist(); }
  clear() { this.map.clear(); this._persist(); }
  // Newest first, for the history list.
  list() {
    return [...this.map.values()].sort((a, b) => b.ts - a.ts).map((t) => {
      let host = ''; try { host = new URL(t.url).hostname.replace(/^www\./, ''); } catch { /* none */ }
      const first = t.states.find((s) => s.question) || t.states[0];
      return { key: t.key, url: t.url, title: t.title || host, host, ts: t.ts, count: t.states.length, preview: clip(first.question || (first.mode === 'summarize' ? '' : first.answer), 120) };
    });
  }
}

module.exports = { ChatStore, keep, context, MAX_STATES };
