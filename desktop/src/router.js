// Classifies what the user typed into the intent bar.
// Kinds: url | search | memory | agent | download | write (email, reply, event, post) | page (summarize, translate, ask about the current page).

function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
}

// BRW-08: the search engine behind the address bar. `%s` stands for the search text.
const ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=%s',
  google: 'https://www.google.com/search?q=%s',
  bing: 'https://www.bing.com/search?q=%s',
  brave: 'https://search.brave.com/search?q=%s',
  coccoc: 'https://coccoc.com/search?query=%s'
};
let searchTemplate = ENGINES.duckduckgo;
// A custom template must be an https address with exactly one %s; anything else keeps the current engine.
function validSearchTemplate(t) {
  try { return !!t && (t.match(/%s/g) || []).length === 1 && new URL(t.replace('%s', 'x')).protocol === 'https:'; } catch { return false; }
}
function setSearchEngine(id, custom = '') {
  const t = id === 'custom' ? String(custom).trim() : ENGINES[id];
  if (!validSearchTemplate(t)) return false;
  searchTemplate = t;
  return true;
}
const searchUrl = (q) => searchTemplate.replace('%s', encodeURIComponent(q));

function asUrl(input) {
  const t = input.trim();
  if (/\s/.test(t)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
  if (/^localhost(:\d+)?(\/|$)/i.test(t)) return 'http://' + t;
  if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(t)) return 'https://' + t;
  return null;
}

// Slang and typo expansion, applied to already de-accented text. Only forms that are unambiguous in an intent bar.
const SLANG = [
  [/\b(ko|hok|hong)\b/g, 'khong'], [/\bdc\b/g, 'duoc'], [/\btrc\b/g, 'truoc'], [/\bhqua\b/g, 'hom qua'], [/\bbn\b/g, 'bao nhieu'],
  [/\bj\b/g, 'gi'], [/\bdo?wn?load\b/g, 'download'], [/\bnai\b/g, 'nay']
];
function expand(n) { return SLANG.reduce((t, [re, to]) => t.replace(re, to), n); }

const QUESTION_OPENER = /^(cach|lam sao|lam the nao|how to|how do|how can|tai sao|why)\b/;

const PAGE = [
  ['summarize', /\btl;?dr\b|\b(tom tat|summari[sz]e|tong ket)\b.*\b(trang|bai|page|article|nay|this)\b|\b(tom tat|summari[sz]e)\b$/],
  ['translate', /\b(dich|translate)\b.*\b(trang|bai|page|article|nay|this)\b/],
  ['ask', /\b(trang|bai) (nay|do)\b.*\b(noi|nhac|co|viet|cho biet|de cap)\b|\bwhat does this (page|article) say\b|\bdoes this (page|article) (mention|say|cover)\b/]
];

const DOWNLOAD = /\btai (xuong )?(video|phim)\b|\bluu video\b|\bvideo (nay|bai giang)\b.*\b(ve may|tai)\b|\bdownload\b.*\b(video|movie|lecture|phim)\b|\bdownload (video|phim)\b|\bsave\b.*\bvideo\b/;
const AGENT = /\bdong tien\b|\bthanh toan\b|\bhoa don (dien|nuoc|net|internet|gas)\b|\bdat ve\b|\bbook\b.*\b(ve|flight|ticket)\b|\bpay\b.*\b(bill|tien|hoa don)\b|\bpay (my|the|this)\b/;
// Drafting work: emails, calendar events, social posts. Lore writes a draft; the user sends it.
const WRITE = [
  ['reply', /\b(reply|respond)\b.*\b(email|mail|message|this)\b|\b(tra loi|phan hoi)\b.*\b(email|mail|tin nhan|thu)\b/],
  ['event', /\b(dat lich|len lich|tao lich|them lich|nhac (toi|minh))\b|\bschedule (a|an|my|me|the|this)\b|\b(set up|book|create|add) (a |an )?(meeting|call|event|reminder|appointment)\b|\bto (my|the) calendar\b|\bon my calendar\b/],
  ['post', /\b(viet|soan|tao|write|draft|compose|create)\b.*\b(bai dang|bai post|status|caption|tweet|post|bai linkedin|bai facebook|bai fb)\b|\bdang (bai )?(len )?(facebook|fb|linkedin|twitter)\b/],
  ['email', /\b(viet|soan|tao|write|draft|compose)\b.*\b(e-?mail|mail|thu)\b/]
];

const MEMORY = new RegExp([
  '\\btim lai\\b', '\\bfind lai\\b', '\\blich su (xem|duyet)\\b',
  '\\b(bai|trang|web|tin|link)\\b.*\\b(toi|minh)\\b.*\\b(da )?(doc|xem|vao)\\b', '\\b(toi|minh)\\b.*\\b(da )?(doc|xem|vao)\\b.*\\b(bai|trang|web|tin|link)\\b',
  '\\bfind\\b.*\\b(article|page|site)\\b.*\\bi (read|visited|saw)\\b', '\\b(page|article|site)\\b.*\\bi (visit|visited|read|saw|viewed)\\b',
  '\\bi (read|visited|saw)\\b', '\\bsearch my (history|browsing|memory)\\b', '\\bmy (history|memory)\\b',
  '\\bfind the (article|page)\\b.*\\blast week\\b'
].join('|'));

function classify(input) {
  const text = input.trim();
  const url = asUrl(text);
  if (url) return { kind: 'url', url };
  const n = expand(norm(text));
  for (const [action, re] of PAGE) if (re.test(n)) return { kind: 'page', action, text };
  if (DOWNLOAD.test(n)) return { kind: 'download', text };
  if (!QUESTION_OPENER.test(n)) for (const [task, re] of WRITE) if (re.test(n)) return { kind: 'write', task, text };
  if (AGENT.test(n) && !QUESTION_OPENER.test(n)) return { kind: 'agent', text };
  if (MEMORY.test(n)) return { kind: 'memory', text };
  return { kind: 'search', url: searchUrl(text), text };
}

module.exports = { classify, norm, setSearchEngine, validSearchTemplate, searchUrl, ENGINES };
