// PRV-03: dismisses cookie banners. Rejects non-essential cookies where a reject button exists, otherwise hides the banner.
// It never clicks anything that looks like "accept". Runs in the page's isolated world for a few seconds after load.
const SCRIPT = `(() => {
  if (window.__loreCookie) return;
  window.__loreCookie = true;
  const BANNER_WORDS = /cookie|consent|gdpr|ccpa|privacy choices|quyền riêng tư|chính sách cookie|sử dụng cookie|dùng cookie/i;
  const REJECT = /^(reject( all)?|decline( all)?|deny( all)?|refuse( all)?|only (strictly )?(necessary|essential)( cookies)?|(necessary|essential)( cookies)? only|use necessary cookies only|continue without accepting|no,? thanks|disagree|từ chối( tất cả)?|chỉ (cookie )?cần thiết|không đồng ý|không chấp nhận|bỏ qua)$/i;
  const ACCEPT = /accept|agree|allow|\\bok\\b|got it|i understand|đồng ý|chấp nhận|cho phép|tôi hiểu/i;
  const CLOSE = /^(×|✕|x|close|dismiss|đóng)$/i;
  const KNOWN = ['#onetrust-reject-all-handler', '#CybotCookiebotDialogBodyButtonDecline', '#didomi-notice-disagree-button', '.qc-cmp2-summary-buttons button[mode="secondary"]',
    'button#truste-consent-required', '.cc-deny', '.cmp-reject', '[data-testid="reject-all"]', 'button[aria-label*="Reject all" i]', '#cookieChoiceDismiss'];
  const KNOWN_BOX = ['#onetrust-banner-sdk', '#CybotCookiebotDialog', '#didomi-host', '.qc-cmp2-container', '#truste-consent-track', '.cc-window', '#cookie-law-info-bar', '#cookie-notice', '.cookie-banner', '.cookie-consent', '#cookieConsent'];

  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 40 && r.height > 20 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const label = (e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ');
  const clickable = (root) => [...root.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')].filter(visible);

  let done = false;
  const result = (action) => { done = true; window.__loreCookieResult = action; };

  function restoreScroll() {
    for (const el of [document.documentElement, document.body]) if (el && getComputedStyle(el).overflow === 'hidden') el.style.setProperty('overflow', 'auto', 'important');
  }

  function rejectIn(root) {
    const buttons = clickable(root);
    const pick = buttons.find((b) => { const t = label(b); return t.length < 60 && REJECT.test(t) && !ACCEPT.test(t); });
    if (pick) { pick.click(); return 'rejected'; }
    return null;
  }

  function hide(box) {
    const close = clickable(box).find((b) => CLOSE.test(label(b)));
    if (close) { close.click(); return 'closed'; }
    box.style.setProperty('display', 'none', 'important');
    return 'hidden';
  }

  function scan() {
    if (done || !document.body) return;
    for (const sel of KNOWN) { const b = document.querySelector(sel); if (b && visible(b)) { b.click(); restoreScroll(); return result('rejected'); } }
    let boxes = KNOWN_BOX.map((s) => document.querySelector(s)).filter((e) => e && visible(e));
    if (!boxes.length) {
      // Generic: a fixed or sticky block of modest size that talks about cookies and has buttons.
      boxes = [...document.querySelectorAll('div, section, aside, form, dialog')].filter((e) => {
        const s = getComputedStyle(e);
        if (s.position !== 'fixed' && s.position !== 'sticky') return false;
        if (!visible(e)) return false;
        const t = e.innerText || '';
        return t.length > 20 && t.length < 1800 && BANNER_WORDS.test(t) && clickable(e).length > 0 && e.getBoundingClientRect().height < innerHeight * 0.9;
      });
      boxes = boxes.filter((e) => !boxes.some((o) => o !== e && e.contains(o))); // innermost only
    }
    for (const box of boxes) {
      const a = rejectIn(box) || hide(box);
      restoreScroll();
      return result(a);
    }
  }

  const start = Date.now();
  const timer = setInterval(() => { scan(); if (done || Date.now() - start > 9000) clearInterval(timer); }, 400);
  scan();
})()`;

module.exports = { cookieBannerScript: SCRIPT };
