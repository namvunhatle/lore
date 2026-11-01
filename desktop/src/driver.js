// Drives a tab's real page. Actions run in an isolated world, so page scripts cannot tamper with them.
// What the page says is returned as data only; nothing here interprets it as instructions.
const WORLD = 1001;
const J = JSON.stringify;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { t: tr } = require('./ui/i18n');

class PageDriver {
  constructor(webContents, t = (k, v) => tr('en', k, v)) { this.wc = webContents; this.t = t; }

  _eval(code) { return this.wc.executeJavaScriptInIsolatedWorld(WORLD, [{ code }]); }
  url() { return this.wc.getURL(); }

  async goto(url) {
    if (!/^https?:\/\//.test(url)) throw new Error(this.t('drv.onlyHttp'));
    await this.wc.loadURL(url);
  }

  async waitFor(selector, timeoutMs = 8000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (await this._eval(`!!document.querySelector(${J(selector)})`)) return;
      await sleep(100);
    }
    throw new Error(this.t('drv.notFound', { sel: selector }));
  }

  async text(selector) {
    const t = await this._eval(`(document.querySelector(${J(selector)}) || {}).innerText`);
    if (t == null) throw new Error(this.t('drv.notFound', { sel: selector }));
    return String(t).trim();
  }

  async click(selector) {
    const ok = await this._eval(`(() => { const e = document.querySelector(${J(selector)}); if (!e) return false; e.click(); return true; })()`);
    if (!ok) throw new Error(this.t('drv.notFound', { sel: selector }));
  }

  // Never fills passwords or card fields: those go through the platform credential manager (CONTRIBUTING.md, "Product rules").
  async fill(selector, value) {
    const r = await this._eval(`(() => {
      const e = document.querySelector(${J(selector)});
      if (!e) return 'missing';
      const ac = (e.getAttribute('autocomplete') || '').toLowerCase();
      if (e.type === 'password' || /^cc-|current-password|new-password/.test(ac)) return 'refused';
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value').set;
      set.call(e, ${J(String(value))});
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    })()`);
    if (r === 'missing') throw new Error(this.t('drv.notFound', { sel: selector }));
    if (r === 'refused') throw new Error(this.t('drv.noFill'));
  }
}

module.exports = { PageDriver };
