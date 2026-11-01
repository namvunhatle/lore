// Per-session privacy hardening: ad blocking, third-party cookies, Global Privacy Control, permissions.
// All app state comes in through `deps`, so this can be tested against a real Electron session.
const { isThirdParty, stripsThirdPartyCookies, permissionPolicy, withoutHeader, stripTrackingParams, httpsUpgrade } = require('./privacy');

const done = new WeakSet();
const safeHost = (u) => { try { return new URL(u).hostname; } catch { return ''; } };

function hardenSession(ses, deps) {
  if (done.has(ses)) return;
  done.add(ses);
  const { isPrivate = false, blocker, adsOn, privacy, siteOf, onBlocked, onResponse, ask, scam, onScam, onUpgrade, onStripped, insecureOk } = deps;
  const perms = deps.perms || (() => null);
  // The user agent is left as Electron reports it. Google refuses sign-in from browsers that claim to be another browser
  // (tested: with a Chrome-like user agent Google rejects the sign-in at the first step; with the real one it does not).

  ses.webRequest.onBeforeRequest((details, cb) => {
    if (details.resourceType === 'mainFrame' && scam) {
      const verdict = scam(details.url);
      if (verdict) { onScam(details, verdict); return cb({ cancel: true }); }
    }
    if (details.resourceType === 'mainFrame') {
      const pv = privacy();
      // Links are cleaned first, then upgraded; the redirect comes back through here once, with nothing left to change.
      if (pv.stripTracking && !pv.trackingOff.includes(safeHost(details.url).replace(/^www\./, ''))) {
        const s = stripTrackingParams(details.url);
        if (s.removed) { if (onStripped) onStripped(s.removed); return cb({ redirectURL: s.url }); }
      }
      if (pv.httpsFirst && !(insecureOk && insecureOk(safeHost(details.url)))) {
        const up = httpsUpgrade(details.url);
        if (up) { if (onUpgrade) onUpgrade(details.url, up); return cb({ redirectURL: up }); }
      }
    }
    if (adsOn() && details.resourceType !== 'mainFrame' && blocker.match(details.url, siteOf(details) || details.referrer, details.resourceType)) {
      onBlocked(details.url);
      return cb({ cancel: true });
    }
    cb({});
  });

  const thirdParty = (details) => {
    const site = siteOf(details);
    if (!privacy().blockThirdPartyCookies || details.resourceType === 'mainFrame' || !site || !isThirdParty(details.url, site)) return false;
    return stripsThirdPartyCookies(details.resourceType, !!blocker && blocker.match(details.url, site, details.resourceType));
  };

  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    let headers = { ...details.requestHeaders, 'Sec-GPC': '1' }; // Global Privacy Control: do not sell or share my data
    if (thirdParty(details)) {
      if (process.env.LORE_DEBUG && details.requestHeaders.Cookie) console.log('[cookie] not sent to', safeHost(details.url), 'on', safeHost(siteOf(details)));
      headers = withoutHeader(headers, 'Cookie');
    }
    cb({ requestHeaders: headers });
  });

  ses.webRequest.onHeadersReceived((details, cb) => {
    if (process.env.LORE_DEBUG && thirdParty(details) && details.responseHeaders && (details.responseHeaders['set-cookie'] || details.responseHeaders['Set-Cookie'])) console.log('[cookie] refused from', safeHost(details.url), 'on', safeHost(siteOf(details)));
    cb(thirdParty(details) ? { responseHeaders: withoutHeader(details.responseHeaders, 'Set-Cookie') } : {});
    if (onResponse) onResponse(details);
  });

  // Safe permissions pass, risky ones ask once per site (never in private tabs), the rest are refused.
  // Normal tabs keep answers in the profile's saved list (BRW-18); private tabs only for the life of the tab.
  const mem = new Map();
  const decided = {
    has: (k) => (isPrivate || !perms() ? mem.has(k) : perms().map.has(k)),
    get: (k) => (isPrivate || !perms() ? mem.get(k) : perms().map.get(k)),
    set: (k, v) => { if (isPrivate || !perms()) mem.set(k, v); else { const i = k.lastIndexOf('|'); perms().set(k.slice(0, i), k.slice(i + 1), v); } }
  };
  const policy = (p) => permissionPolicy(p, { isPrivate, setting: privacy().permissions });
  const originOf = (u) => { try { return new URL(u).origin; } catch { return ''; } };
  ses.setPermissionCheckHandler((_wc, permission, origin) => policy(permission) === 'allow' || decided.get(origin + '|' + permission) === true);
  ses.setPermissionRequestHandler(async (wc, permission, cb, details) => {
    const pol = policy(permission);
    if (pol !== 'ask') return cb(pol === 'allow');
    const origin = originOf(details.requestingUrl || wc.getURL());
    const key = origin + '|' + permission;
    if (decided.has(key)) return cb(decided.get(key));
    const ok = await ask(origin, permission);
    decided.set(key, ok);
    cb(ok);
  });
}

module.exports = { hardenSession };
