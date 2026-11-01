// The outline of a page (its headings) and what the person has read of it. Pure and free of Electron, so it can be unit
// tested. The page only reports which heading is at the reading line; the dwell time is measured here. Nothing in this
// file is written to disk: the outline lives in memory for as long as the tab shows the page.
const READ_MS = 2000;   // on screen this long = read; less = skimmed
const MAX_ITEMS = 60;
const MAX_TEXT = 120;

const UNSEEN = 0, SKIMMED = 1, READ = 2;

class Outline {
  constructor(texts = []) { this.setTexts(texts); }

  // The page changed its headings (it was still loading, or it added sections). Seen/read state stays with the headings
  // that are still there; a different page starts clean.
  setTexts(texts) {
    const old = new Map();
    if (this.texts) this.texts.forEach((t, i) => { if (!old.has(t)) old.set(t, []); old.get(t).push({ s: this.status[i], cur: i === this.cur }); });
    this.texts = texts.slice();
    this.status = this.texts.map(() => UNSEEN);
    const was = this.cur >= 0 ? this.since : 0;
    this.cur = -1; this.since = 0;
    this.texts.forEach((t, i) => {
      const q = old.get(t);
      const m = q && q.shift();
      if (!m) return;
      this.status[i] = m.s;
      if (m.cur) { this.cur = i; this.since = was; }
    });
  }

  // The reading line is now at heading `idx` (-1: above the first one).
  at(idx, now) {
    if (!Number.isInteger(idx) || idx < -1 || idx >= this.texts.length || idx === this.cur) return;
    const bump = (i, s) => { if (this.status[i] < s) this.status[i] = s; };
    if (this.cur >= 0) bump(this.cur, now - this.since >= READ_MS ? READ : SKIMMED);
    // Going forward past headings without stopping on them: skimmed. Going back over what was seen changes nothing.
    if (idx > this.cur) for (let i = this.cur + 1; i < idx; i++) bump(i, SKIMMED);
    this.cur = idx; this.since = now;
  }

  view(now) {
    const status = this.status.slice();
    if (this.cur >= 0 && now - this.since >= READ_MS) status[this.cur] = READ;
    return { cur: this.cur, status };
  }

  // Milliseconds until the section in view counts as read, or null when there is nothing to wait for.
  nextCheck(now) {
    if (this.cur < 0 || this.status[this.cur] === READ) return null;
    const left = READ_MS - (now - this.since);
    return left > 0 ? left : null;
  }
}

// What a page sends is not trusted: a short list of plain headings, or nothing.
function sanitize(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const r of raw) {
    if (out.length >= MAX_ITEMS) break;
    if (!r || typeof r !== 'object' || typeof r.text !== 'string') continue;
    const text = r.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!text || !Number.isInteger(r.level) || r.level < 1 || r.level > 3) continue;
    out.push({ text, level: r.level, id: typeof r.id === 'string' && /^[^\s#]{1,200}$/.test(r.id) ? r.id : '' });
  }
  return out;
}

module.exports = { Outline, sanitize, READ_MS, MAX_ITEMS };
