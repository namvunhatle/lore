// PRV-02: warns before loading fake bank, e-wallet, parcel and shop sites.
// Two layers, both on device:
//   1. Look-alike detection: a trusted Vietnamese brand name inside an address that is not that brand's own domain.
//   2. A downloaded list of reported phishing domains (Phishing.Database, refreshed weekly into the user data folder).
// Only the page address is looked at; nothing is sent anywhere to check it.
const fs = require('fs');
const { etld1 } = require('./privacy');

// token: matched as a substring when long, as a whole word (split on . and -) when short.
const BRANDS = [
  { name: 'Vietcombank', tokens: ['vietcombank'], official: ['vietcombank.com.vn', 'vietcombank.com'] },
  { name: 'Techcombank', tokens: ['techcombank'], official: ['techcombank.com.vn', 'techcombank.com'] },
  { name: 'VietinBank', tokens: ['vietinbank'], official: ['vietinbank.vn', 'vietinbank.com.vn'] },
  { name: 'BIDV', tokens: ['bidv'], official: ['bidv.com.vn', 'bidv.vn'] },
  { name: 'Agribank', tokens: ['agribank'], official: ['agribank.com.vn'] },
  { name: 'MB Bank', tokens: ['mbbank'], official: ['mbbank.com.vn'] },
  { name: 'ACB', tokens: ['acb'], official: ['acb.com.vn'] },
  { name: 'VPBank', tokens: ['vpbank'], official: ['vpbank.com.vn'] },
  { name: 'TPBank', tokens: ['tpbank'], official: ['tpbank.com.vn', 'tpb.vn'] },
  { name: 'Sacombank', tokens: ['sacombank'], official: ['sacombank.com.vn'] },
  { name: 'HDBank', tokens: ['hdbank'], official: ['hdbank.com.vn'] },
  { name: 'Eximbank', tokens: ['eximbank'], official: ['eximbank.com.vn'] },
  { name: 'SeABank', tokens: ['seabank'], official: ['seabank.com.vn'] },
  { name: 'MoMo', tokens: ['momo'], official: ['momo.vn', 'mservice.com.vn'] },
  { name: 'ZaloPay', tokens: ['zalopay'], official: ['zalopay.vn'] },
  { name: 'VNPay', tokens: ['vnpay'], official: ['vnpay.vn'] },
  { name: 'ViettelPay', tokens: ['viettelpay'], official: ['viettelpay.vn', 'viettel.vn'] },
  { name: 'Shopee', tokens: ['shopee'], official: ['shopee.vn', 'shopee.com', 'shopee.sg', 'shopee.co.th', 'shopee.co.id', 'shopee.ph', 'shopee.com.my'] },
  { name: 'Lazada', tokens: ['lazada'], official: ['lazada.vn', 'lazada.com', 'lazada.sg', 'lazada.co.th'] },
  { name: 'Tiki', tokens: ['tiki'], official: ['tiki.vn'] },
  { name: 'Giao Hàng Nhanh', tokens: ['ghn'], official: ['ghn.vn'] },
  { name: 'Giao Hàng Tiết Kiệm', tokens: ['ghtk'], official: ['ghtk.vn'] },
  { name: 'Viettel Post', tokens: ['viettelpost'], official: ['viettelpost.com.vn', 'viettelpost.vn'] },
  { name: 'VNPost', tokens: ['vnpost'], official: ['vnpost.vn'] },
  { name: 'EVN', tokens: ['evn', 'evnhcmc', 'evnnpc', 'evnspc'], official: ['evn.com.vn', 'evnhcmc.vn', 'evnnpc.vn', 'evnspc.vn', 'evnhanoi.vn'] },
  { name: 'VNeID', tokens: ['vneid'], official: ['vneid.gov.vn'] }
];
const SHORT = 6; // tokens shorter than this must be a whole word

const labelsOf = (host) => host.split(/[.\-]/).filter(Boolean);

function isOfficial(host, brand) {
  return brand.official.some((d) => host === d || host.endsWith('.' + d));
}

function lookalike(host) {
  const words = labelsOf(host);
  for (const b of BRANDS) {
    if (isOfficial(host, b)) continue;
    const hit = b.tokens.some((t) => (t.length >= SHORT ? host.includes(t) : words.includes(t)));
    if (hit) return b.name;
  }
  return null;
}

// -> null | { level: 'block'|'warn', reason: 'list'|'lookalike'|'idn', brand?, host }
function checkUrl(url, { listHas = () => false } = {}) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return null;

  // Walk up the domain: a.b.evil.com -> b.evil.com -> evil.com
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (listHas(parts.slice(i).join('.'))) return { level: 'block', reason: 'list', host };

  const brand = lookalike(host);
  if (brand) return { level: 'warn', reason: 'lookalike', brand, host };
  if (host.split('.').some((l) => l.startsWith('xn--'))) return { level: 'warn', reason: 'idn', host };
  return null;
}

// Reported-domain list: one domain per line. Loaded from a cache file; refreshed at most weekly.
const LIST_URL = 'https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt';
const WEEK = 7 * 86400000;

function createScamList({ cachePath, fetchImpl = fetch } = {}) {
  let set = new Set();
  const parse = (text) => new Set(text.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#') && !l.includes('/')));
  return {
    load() { try { set = parse(fs.readFileSync(cachePath, 'utf8')); } catch { /* no cache yet */ } return set.size; },
    has: (host) => set.has(host),
    get size() { return set.size; },
    async refresh() {
      try { if (Date.now() - fs.statSync(cachePath).mtimeMs < WEEK) return false; } catch { /* missing */ }
      const r = await fetchImpl(LIST_URL, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) return false;
      const text = await r.text();
      if (text.length < 1000) return false; // an error page, not a list
      fs.writeFileSync(cachePath, text);
      set = parse(text);
      return true;
    }
  };
}

module.exports = { checkUrl, createScamList, BRANDS };
