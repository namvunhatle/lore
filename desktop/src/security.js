// The connection state shown next to the address (BRW-07), and the reasons a certificate is refused.
// Pure functions: the address and an error code in, a label out.

// 'https' | 'http' | 'local' | '' (nothing worth saying: our own pages, blank, other schemes)
function connectionOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return 'https';
    if (u.protocol !== 'http:') return '';
    const h = u.hostname.replace(/^\[|\]$/g, '');
    return h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' || h === '::1' ? 'local' : 'http';
  } catch { return ''; }
}

// Chromium net error codes for a certificate that cannot be trusted. https://source.chromium.org/chromium/chromium/src/+/main:net/base/net_error_list.h
const CERT = { '-200': 'name', '-201': 'date', '-202': 'authority', '-203': 'invalid', '-204': 'invalid', '-205': 'invalid', '-206': 'revoked', '-207': 'invalid', '-208': 'weak', '-210': 'name', '-211': 'weak', '-212': 'invalid', '-213': 'invalid', '-214': 'invalid', '-215': 'invalid', '-216': 'invalid' };
const certReason = (code) => CERT[String(code)] || null;

// The same page over HTTPS, or null when it is not a plain HTTP page.
function httpsVersion(url) {
  try { const u = new URL(url); if (u.protocol !== 'http:') return null; u.protocol = 'https:'; return u.toString(); } catch { return null; }
}

module.exports = { connectionOf, certReason, httpsVersion };
