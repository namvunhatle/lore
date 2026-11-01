// Pure privacy rules, kept free of Electron so they can be unit tested.

// Multi-label public suffixes we care about. Not the full Public Suffix List; unknown suffixes fall back to the last two labels.
const SUFFIXES = new Set([
  'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn', 'info.vn', 'biz.vn', 'name.vn', 'ac.vn', 'pro.vn', 'health.vn',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.jp', 'ne.jp', 'or.jp',
  'com.sg', 'com.my', 'co.th', 'co.id', 'com.ph', 'com.cn', 'com.hk', 'com.tw', 'co.kr', 'co.in', 'com.br', 'co.nz'
]);

function etld1(host) {
  host = host.toLowerCase().replace(/\.$/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || !host.includes('.')) return host;
  const parts = host.split('.');
  const last2 = parts.slice(-2).join('.');
  if (SUFFIXES.has(last2) && parts.length >= 3) return parts.slice(-3).join('.');
  return last2;
}

function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }

// A request is third-party when its registrable domain differs from the page's.
function isThirdParty(requestUrl, siteUrl) {
  const a = hostOf(requestUrl);
  const b = hostOf(siteUrl);
  if (!a || !b) return false;
  return etld1(a) !== etld1(b);
}

// Permissions a page may use without asking. Everything else is asked about, or refused.
const SAFE = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock']);
const ASKABLE = new Set(['media', 'geolocation', 'notifications', 'clipboard-read', 'midi', 'midiSysex']);

// -> 'allow' | 'ask' | 'deny'
function permissionPolicy(permission, { isPrivate = false, setting = 'ask' } = {}) {
  if (SAFE.has(permission)) return 'allow';
  if (!ASKABLE.has(permission)) return 'deny';
  if (isPrivate || setting === 'block') return 'deny';
  return 'ask';
}

// Web pages may only navigate to web addresses. file:, javascript:, data:, custom schemes are refused.
function isAllowedNavigation(url) {
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:' || url === 'about:blank';
  } catch { return false; }
}

// Google may refuse sign-in from an embedded browser. When it does, it sends the page to a "rejected" address;
// Lore then explains and offers the system browser. Detected from the address only, nothing is sent anywhere.
function isGoogleSignIn(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'accounts.google.com'; } catch { return false; }
}
function isGoogleSignInRejected(url) {
  try {
    const u = new URL(url);
    return isGoogleSignIn(url) && (/\/signin\/(v\d+\/)?rejected|\/deniedsigninrejected/.test(u.pathname) || /disallowed_useragent/.test(u.search));
  } catch { return false; }
}

// Removes headers by case-insensitive name from an Electron header map.
function withoutHeader(headers, name) {
  const out = {};
  for (const k of Object.keys(headers || {})) if (k.toLowerCase() !== name.toLowerCase()) out[k] = headers[k];
  return out;
}

module.exports = { etld1, isThirdParty, permissionPolicy, isAllowedNavigation, isGoogleSignIn, isGoogleSignInRejected, withoutHeader };
