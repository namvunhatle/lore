// User settings. API keys are stored encrypted (Electron safeStorage); if secure storage is unavailable
// they are kept for this session only and never written to disk. The renderer never receives a key back.
const { isLocalHost } = require('./llm');

const DEFAULTS = () => ({
  language: 'auto', // auto | en | vi
  autoUpdate: true,   // look for a newer version on GitHub now and then
  appearance: 'system', // system | light | dark
  tabsLayout: 'top', // top (a strip above the page) | side (a list down the left)
  startup: 'restore', // restore (continue where I left off) | new (start with a new tab)
  privacy: {
    blockThirdPartyCookies: true, scamProtection: true, cookieBanners: true, reduceFingerprint: true, permissions: 'ask', // permissions: ask | block
    httpsFirst: true, stripTracking: true, memory: true, lock: false,
    doh: 'automatic', // off | automatic | cloudflare | quad9
    trackingOff: [], aiOff: [] // sites where link cleaning / AI reading are switched off
  },
  aiSaving: 'balanced', // save | balanced | detail: how much of a page is sent to a model
  sidebar: 'full', // full | rail: the tab list at the left of the window
  minFont: 0, // smallest text size a page may use, in px; 0 leaves pages alone
  search: 'duckduckgo', searchCustom: '', // duckduckgo | google | bing | brave | coccoc | custom
  alias: { provider: 'off', key: '' }, // off | addy | simplelogin
  provider: 'local', // local | openai | anthropic | gemini | mistral | off
  local: { url: process.env.LORE_LLM_URL || 'http://127.0.0.1:11434', model: process.env.LORE_LLM_MODEL || 'qwen2.5:3b', embedModel: 'bge-m3' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', key: '' },
  anthropic: { model: 'claude-haiku-5-5', key: '' },
  gemini: { model: 'gemini-2.5-flash', key: '' },
  mistral: { model: 'mistral-small-latest', key: '' }
});
const PROVIDERS = ['local', 'openai', 'anthropic', 'gemini', 'mistral', 'off'];
const LANGUAGES = ['auto', 'en', 'vi'];
const STARTUPS = ['restore', 'new'];
const APPEARANCES = ['system', 'light', 'dark'];
const TAB_LAYOUTS = ['top', 'side'];
const DOH = ['off', 'automatic', 'cloudflare', 'quad9'];
const ALIAS = ['off', 'addy', 'simplelogin'];
const hostList = (v) => (Array.isArray(v) ? [...new Set(v.filter((h) => typeof h === 'string' && /^[a-z0-9.-]{1,100}$/i.test(h)).map((h) => h.toLowerCase()))].slice(0, 200) : null);

function httpUrl(u, { allowPlainLocal }) {
  let x;
  try { x = new URL(u); } catch { throw new Error('set.v.url'); }
  if (x.protocol === 'https:') return;
  if (x.protocol === 'http:' && allowPlainLocal && isLocalHost(u)) return;
  throw new Error(allowPlainLocal ? 'set.v.localhttp' : 'set.v.https');
}

class Settings {
  constructor({ load, save, persistent = false } = {}) {
    this.persistent = persistent;
    this._save = save || (() => {});
    const saved = load ? load() : null;
    this.cfg = this._merge(DEFAULTS(), saved && !Array.isArray(saved) ? saved : {});
  }

  _merge(base, patch) {
    const out = JSON.parse(JSON.stringify(base));
    if (patch.provider !== undefined) out.provider = patch.provider;
    if (patch.language !== undefined) out.language = patch.language;
    if (STARTUPS.includes(patch.startup)) out.startup = patch.startup;
    if (APPEARANCES.includes(patch.appearance)) out.appearance = patch.appearance;
    if (TAB_LAYOUTS.includes(patch.tabsLayout)) out.tabsLayout = patch.tabsLayout;
    if (typeof patch.autoUpdate === 'boolean') out.autoUpdate = patch.autoUpdate;
    const pv = patch.privacy || {};
    for (const k of ['blockThirdPartyCookies', 'scamProtection', 'cookieBanners', 'reduceFingerprint', 'httpsFirst', 'stripTracking', 'memory', 'lock']) if (typeof pv[k] === 'boolean') out.privacy[k] = pv[k];
    if (DOH.includes(pv.doh)) out.privacy.doh = pv.doh;
    for (const k of ['trackingOff', 'aiOff']) { const l = hostList(pv[k]); if (l) out.privacy[k] = l; }
    if (['save', 'balanced', 'detail'].includes(patch.aiSaving)) out.aiSaving = patch.aiSaving;
    if (['full', 'rail'].includes(patch.sidebar)) out.sidebar = patch.sidebar;
    if ([0, 12, 14, 16, 18].includes(patch.minFont)) out.minFont = patch.minFont;
    if (['duckduckgo', 'google', 'bing', 'brave', 'coccoc', 'custom'].includes(patch.search)) out.search = patch.search;
    if (typeof patch.searchCustom === 'string') out.searchCustom = patch.searchCustom.trim().slice(0, 300);
    const al = patch.alias || {};
    if (ALIAS.includes(al.provider)) out.alias.provider = al.provider;
    if (typeof al.key === 'string' && al.key.trim()) out.alias.key = al.key.trim();
    if (pv.permissions !== undefined) out.privacy.permissions = pv.permissions;
    for (const k of ['local', 'openai', 'anthropic', 'gemini', 'mistral']) {
      for (const f of Object.keys(out[k])) {
        const v = patch[k] && patch[k][f];
        if (typeof v !== 'string') continue;
        if (f === 'key' && v === '') continue; // blank keeps the saved key; use clearKey to remove it
        out[k][f] = v.trim();
      }
    }
    for (const k of patch.clearKey || []) if (out[k] && 'key' in out[k]) out[k].key = '';
    return out;
  }

  validate(cfg) {
    if (!PROVIDERS.includes(cfg.provider)) throw new Error('set.v.provider');
    if (!LANGUAGES.includes(cfg.language)) throw new Error('set.v.lang');
    if (cfg.search === 'custom' && !require('./router').validSearchTemplate(cfg.searchCustom)) throw new Error('set.v.search');
    if (!['ask', 'block'].includes(cfg.privacy.permissions)) throw new Error('set.v.provider');
    if (cfg.provider === 'local') { httpUrl(cfg.local.url, { allowPlainLocal: true }); if (!cfg.local.model) throw new Error('set.v.chooseModel'); }
    if (cfg.provider === 'openai') {
      httpUrl(cfg.openai.baseUrl, { allowPlainLocal: true });
      if (!cfg.openai.model) throw new Error('set.v.model');
      if (!cfg.openai.key && !isLocalHost(cfg.openai.baseUrl)) throw new Error('set.v.key');
    }
    if (cfg.provider === 'mistral') {
      if (!cfg.mistral.model) throw new Error('set.v.model');
      if (!cfg.mistral.key) throw new Error('set.v.key');
    }
    if (cfg.provider === 'gemini') {
      if (!cfg.gemini.model) throw new Error('set.v.model');
      if (!cfg.gemini.key) throw new Error('set.v.key');
    }
    if (cfg.provider === 'anthropic') {
      if (!cfg.anthropic.model) throw new Error('set.v.model');
      if (!cfg.anthropic.key) throw new Error('set.v.key');
    }
  }

  // The config that would result from a patch, without saving it (used by "Test connection").
  preview(patch) { const c = this._merge(this.cfg, patch); this.validate(c); return c; }

  update(patch) {
    this.cfg = this.preview(patch);
    this._save(this.cfg);
    return this.view();
  }

  get() { return this.cfg; }

  // Safe to send to the settings page: keys are replaced by a hasKey flag.
  view() {
    const c = this.cfg;
    return {
      provider: c.provider, aiSaving: c.aiSaving, sidebar: c.sidebar, minFont: c.minFont, search: c.search, searchCustom: c.searchCustom, language: c.language, startup: c.startup, appearance: c.appearance, tabsLayout: c.tabsLayout, autoUpdate: c.autoUpdate, privacy: { ...c.privacy }, persistent: this.persistent,
      local: { ...c.local },
      openai: { baseUrl: c.openai.baseUrl, model: c.openai.model, hasKey: !!c.openai.key },
      anthropic: { model: c.anthropic.model, hasKey: !!c.anthropic.key },
      gemini: { model: c.gemini.model, hasKey: !!c.gemini.key },
      mistral: { model: c.mistral.model, hasKey: !!c.mistral.key },
      alias: { provider: c.alias.provider, hasKey: !!c.alias.key }
    };
  }
}

module.exports = { Settings, DEFAULTS };
