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

// Third-party cookies are cut where they only serve tracking: images, pings, fonts and other passive loads, and anything on
// the tracker lists. Frames, scripts, fetch and WebSocket keep theirs, because embedded apps and sign-in flows (an editor
// that embeds its preview, an OAuth redirect) keep their session in them; cutting those makes a site reload forever.
const PASSIVE = new Set(['image', 'media', 'font', 'stylesheet', 'ping', 'cspReport', 'object']);
const stripsThirdPartyCookies = (resourceType, listed) => PASSIVE.has(resourceType) || !!listed;

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

// PRV-13: well-known tracking parameters removed from an address before the page loads. Other parameters are left exactly
// as they were written (not re-encoded), so signed links keep working.
const TRACKING = /^(utm_[a-z0-9_]+|fbclid|gclid|gclsrc|dclid|msclkid|yclid|twclid|ttclid|li_fat_id|igshid|mc_eid|mc_cid|_hsenc|_hsmi|mkt_tok|vero_id|oly_enc_id|oly_anon_id|wickedid)$/i;
function stripTrackingParams(url) {
  let u;
  try { u = new URL(url); } catch { return { url, removed: 0 }; }
  if (!/^https?:$/.test(u.protocol) || !u.search) return { url, removed: 0 };
  const parts = u.search.slice(1).split('&');
  const kept = parts.filter((p) => !TRACKING.test(decodeURIComponent(p.split('=')[0].replace(/\+/g, ' ')).trim()));
  const removed = parts.length - kept.length;
  if (!removed) return { url, removed: 0 };
  u.search = kept.length ? '?' + kept.join('&') : '';
  return { url: u.toString(), removed };
}

// PRV-11: the https:// address for a plain http:// one, or '' when it should be left alone (this computer, a home network,
// an address with its own port).
const LOCAL_END = /\.(local|localhost|test|internal|lan|home|corp)$/;
function httpsUpgrade(url) {
  let u;
  try { u = new URL(url); } catch { return ''; }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'http:' || u.port || !h.includes('.') || LOCAL_END.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.startsWith('[')) return '';
  u.protocol = 'https:';
  return u.toString();
}

module.exports = { stripTrackingParams, httpsUpgrade, etld1, isThirdParty, stripsThirdPartyCookies, permissionPolicy, isAllowedNavigation, isGoogleSignIn, isGoogleSignInRejected, withoutHeader };
