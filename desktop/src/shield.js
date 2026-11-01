// AI-10: safe reading for AI. A web page is data, never instructions, but a model cannot always tell the two apart,
// and hostile pages know it ("prompt injection": hidden or disguised text that tries to give the assistant orders).
// Nothing here is a guarantee: it removes the cheap tricks, tells the user when a page tries one, and keeps the rule
// that the assistant never acts without the user pressing the button. See docs/ai-safety.md.
//
// Three layers, in the order the text travels:
//   1. In the page: text that a person cannot see (hidden, tiny, off-screen, same colour as the background) is
//      dropped before the page is read. What you see is what the model gets.
//   2. On the text: invisible Unicode (zero-width, bidi overrides, "tag" characters that can smuggle a message) is
//      stripped, and the markers our own prompts use to fence page text cannot be forged.
//   3. On the meaning: text that reads like an order to an AI is flagged so the user is told. It is still treated as
//      page content, never as an instruction.

// Characters a reader cannot see but a model can read.
const INVISIBLE = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFB]|[\u{E0000}-\u{E007F}]|[\u{E0100}-\u{E01EF}]/gu;

function stripInvisible(text) {
  let n = 0;
  const out = String(text == null ? '' : text).replace(INVISIBLE, () => { n++; return ''; });
  return { text: out, removed: n };
}

// Our prompts fence page text with <<< and >>>. Text from a page must not be able to close the fence early.
const fenceSafe = (t) => t.replace(/<{3,}/g, '‹‹‹').replace(/>{3,}/g, '›››');

// Phrases that read like an order to an AI. Deliberately narrow: a news article about prompt injection will trip them,
// and that is fine, because all it costs is a notice.
const RULES = [
  ['override', /\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|preceding|all|any|your)\b[^.\n]{0,30}\b(?:instructions?|prompts?|rules?|directions?|guidelines?|context)\b/i],
  ['new-instructions', /\b(?:new|updated|real|actual|hidden)\s+(?:system\s+)?(?:instructions?|prompt|task)\s*[:\-–]/i],
  ['reveal', /\b(?:reveal|print|show|output|repeat|leak|disclose)\b[^.\n]{0,30}\b(?:system\s+prompt|your\s+(?:instructions|prompt|rules)|hidden\s+instructions)\b/i],
  ['secrecy', /\b(?:do\s*n[o']t|never|without)\b[^.\n]{0,25}\b(?:tell|inform|mention|notify|alert|let)\b[^.\n]{0,25}\b(?:the\s+)?user\b/i],
  ['exfiltrate', /\b(?:send|forward|email|post|upload|submit|transmit|leak|exfiltrate)\b[^.\n]{0,70}\b(?:password|passwords|credentials?|cookies?|tokens?|api\s*keys?|history|conversation|memory|emails?|session)\b/i],
  ['persona', /\byou\s+(?:are|must)\s+(?:now\s+)?(?:an?\s+)?(?:unrestricted|jailbroken|DAN|in\s+developer\s+mode|no\s+longer\s+bound)\b/i],
  ['directed-at-ai', /\b(?:attention|note\s+to|message\s+for|instructions?\s+for)\s+(?:the\s+)?(?:ai|assistant|llm|language\s+model|agent|chatbot|copilot)\b/i],
  ['role-marker', /(?:^|\n)\s*(?:system|assistant|developer)\s*:\s*\S|<\|(?:im_start|im_end|system|assistant|user|endoftext)\|>|\[\/?INST\]|<<\s*SYS\s*>>/i],
  // Vietnamese
  ['override-vi', /(?:bỏ\s*qua|phớt\s*lờ|quên\s*đi|hủy|huỷ)\b[^.\n]{0,40}(?:hướng\s*dẫn|chỉ\s*dẫn|chỉ\s*thị|yêu\s*cầu|quy\s*tắc|lệnh)\b[^.\n]{0,25}(?:trước|trên|cũ|đã\s*cho)/i],
  ['secrecy-vi', /(?:đừng|không\s*được|không|tuyệt\s*đối\s*không)\s+(?:nói|cho\s*biết|báo|thông\s*báo)\b[^.\n]{0,25}(?:người\s*dùng|cho\s*họ|cho\s*ai)/i],
  ['exfiltrate-vi', /(?:gửi|chuyển|tải\s*lên)\b[^.\n]{0,60}(?:mật\s*khẩu|cookie|token|thông\s*tin\s*đăng\s*nhập|lịch\s*sử|cuộc\s*trò\s*chuyện|khóa\s*api)/i],
  ['directed-at-ai-vi', /(?:gửi\s*(?:tới|đến)|lưu\s*ý\s*cho|chỉ\s*dẫn\s*cho)\s+(?:trợ\s*lý\s*ai|ai|chatbot|mô\s*hình\s*ngôn\s*ngữ)/i]
];

// Returns up to a few findings, each with the surrounding words so the user can judge.
function scan(text, max = 4) {
  const s = String(text || '');
  const out = [];
  const seen = new Set();
  for (const [id, re] of RULES) {
    const m = re.exec(s);
    if (!m || seen.has(id)) continue;
    seen.add(id);
    const a = Math.max(0, m.index - 60);
    const b = Math.min(s.length, m.index + m[0].length + 80);
    out.push({ id, excerpt: (a > 0 ? '…' : '') + s.slice(a, b).replace(/\s+/g, ' ').trim() + (b < s.length ? '…' : '') });
    if (out.length >= max) break;
  }
  return out;
}

// Everything a model is about to read goes through here. `hidden` is what the page-side script threw away.
function prepare(text, hidden = {}) {
  const inv = stripInvisible(text);
  const clean = fenceSafe(inv.text);
  const samples = Array.isArray(hidden.samples) ? hidden.samples : [];
  const hiddenScan = samples.length ? scan(stripInvisible(samples.join('\n')).text, 2) : [];
  return {
    text: clean,
    report: {
      used: clean.length,
      invisible: inv.removed,
      hiddenChars: hidden.chars || 0,
      hiddenFlagged: hiddenScan.length > 0,
      flagged: scan(clean),
      hiddenExcerpt: hiddenScan.length ? hiddenScan[0].excerpt : ''
    }
  };
}

// True when the notice is worth showing. Hidden text on its own is normal (screen-reader labels, menus); hidden text
// that gives orders, or visible text that gives orders, is not.
const worthWarning = (r) => !!r && (r.hiddenFlagged || (r.flagged && r.flagged.length > 0));

// ---- The page side ---------------------------------------------------------------------------------------------
// Runs inside the page's isolated world. Returns a copy of the document with every element a person cannot see
// removed, plus a count and a few samples of what was removed. The live page is never changed.
const CLEAN_SOURCE = `
function loreCleanClone() {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'CANVAS']);
  const info = { chars: 0, count: 0, samples: [] };
  const started = Date.now();
  let visits = 0;
  const nums = (c) => (String(c).match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => {
    const [r, g, b] = nums(c).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const alpha = (c) => { const n = nums(c); return n.length > 3 ? n[3] : 1; };
  const background = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const b = getComputedStyle(e).backgroundColor;
      if (alpha(b) > 0.5) return b;
    }
    return 'rgb(255, 255, 255)';
  };
  const ownText = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim().length > 3) return true; return false; };
  function why(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return 'css';
    if (Number(cs.opacity) < 0.05) return 'opacity';
    if (parseFloat(cs.fontSize) < 5) return 'tiny';
    if (parseFloat(cs.textIndent) < -500) return 'indent';
    if (/inset\\((?:50|100)%/.test(cs.clipPath || '')) return 'clip';
    if (/^matrix\\(0, 0, 0, 0/.test(cs.transform || '')) return 'scale';
    const r = el.getBoundingClientRect();
    if ((r.width < 2 || r.height < 2) && (cs.overflow !== 'visible' || /rect\\(/.test(cs.clip || ''))) return 'clip';
    if (r.right + scrollX < -50 || r.bottom + scrollY < -50 || r.left + scrollX > innerWidth + 6000) return 'offscreen';
    if (ownText(el)) {
      const a = lum(cs.color), b = lum(background(el));
      if (isFinite(a) && isFinite(b) && (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 1.15) return 'camouflage';
    }
    return '';
  }
  function walk(o, c) {
    const kids = Array.from(o.children), ckids = Array.from(c.children);
    const drop = [];
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i], ck = ckids[i];
      if (!ck || k.tagName === 'HEAD') continue;
      if (SKIP.has(k.tagName.toUpperCase())) { drop.push(ck); continue; }
      if (visits++ > 12000 || Date.now() - started > 1200) continue;
      let reason = '';
      try { reason = why(k, getComputedStyle(k)); } catch (e) { reason = ''; }
      if (reason) {
        const t = (k.textContent || '').replace(/\\s+/g, ' ').trim();
        if (t) { info.chars += t.length; info.count++; if (info.samples.length < 4 && t.length >= 8) info.samples.push(t.slice(0, 200)); }
        drop.push(ck);
        continue;
      }
      walk(k, ck);
    }
    for (const d of drop) d.remove();
  }
  const clone = document.cloneNode(true);
  if (clone.documentElement && document.documentElement) walk(document.documentElement, clone.documentElement);
  return { clone, hidden: info };
}
`;

// For pages Readability cannot parse as an article: the visible text of the whole page.
function fallbackScript() {
  return CLEAN_SOURCE + `;(() => {
    const { clone, hidden } = loreCleanClone();
    const b = clone.body;
    const text = b ? (b.textContent || '').replace(/[ \\t]+/g, ' ').replace(/\\n\\s*\\n+/g, '\\n').trim() : '';
    return { text, hidden };
  })()`;
}

module.exports = { stripInvisible, scan, prepare, worthWarning, fenceSafe, CLEAN_SOURCE, fallbackScript, RULES };
