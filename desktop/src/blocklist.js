// Minimal host blocklist. To be replaced by the Rust core (adblock-rust + EasyList + Vietnam list).
const HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com',
  'googletagmanager.com', 'adservice.google.com', 'facebook.net', 'connect.facebook.net',
  'adnxs.com', 'taboola.com', 'outbrain.com', 'criteo.com', 'scorecardresearch.com',
  'hotjar.com', 'amazon-adsystem.com', 'adsrvr.org', 'pubmatic.com', 'rubiconproject.com'
];

function isBlocked(urlString) {
  let host;
  try { host = new URL(urlString).hostname; } catch { return false; }
  return HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

module.exports = { isBlocked };
