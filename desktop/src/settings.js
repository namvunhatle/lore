// User settings. API keys are stored encrypted (Electron safeStorage); if secure storage is unavailable
// they are kept for this session only and never written to disk. The renderer never receives a key back.
const { isLocalHost } = require('./llm');

const DEFAULTS = () => ({
  language: 'auto', // auto | en | vi
  privacy: { blockThirdPartyCookies: true, scamProtection: true, cookieBanners: true, reduceFingerprint: true, permissions: 'ask' }, // permissions: ask | block
  provider: 'local', // local | openai | anthropic | off
  local: { url: process.env.LORE_LLM_URL || 'http://127.0.0.1:11434', model: process.env.LORE_LLM_MODEL || 'qwen2.5:3b', embedModel: 'bge-m3' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', key: '' },
  anthropic: { model: 'claude-haiku-5-5', key: '' }
});
const PROVIDERS = ['local', 'openai', 'anthropic', 'off'];
const LANGUAGES = ['auto', 'en', 'vi'];

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
    const pv = patch.privacy || {};
    for (const k of ['blockThirdPartyCookies', 'scamProtection', 'cookieBanners', 'reduceFingerprint']) if (typeof pv[k] === 'boolean') out.privacy[k] = pv[k];
    if (pv.permissions !== undefined) out.privacy.permissions = pv.permissions;
    for (const k of ['local', 'openai', 'anthropic']) {
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
    if (!['ask', 'block'].includes(cfg.privacy.permissions)) throw new Error('set.v.provider');
    if (cfg.provider === 'local') { httpUrl(cfg.local.url, { allowPlainLocal: true }); if (!cfg.local.model) throw new Error('set.v.chooseModel'); }
    if (cfg.provider === 'openai') {
      httpUrl(cfg.openai.baseUrl, { allowPlainLocal: true });
      if (!cfg.openai.model) throw new Error('set.v.model');
      if (!cfg.openai.key && !isLocalHost(cfg.openai.baseUrl)) throw new Error('set.v.key');
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
      provider: c.provider, language: c.language, privacy: { ...c.privacy }, persistent: this.persistent,
      local: { ...c.local },
      openai: { baseUrl: c.openai.baseUrl, model: c.openai.model, hasKey: !!c.openai.key },
      anthropic: { model: c.anthropic.model, hasKey: !!c.anthropic.key }
    };
  }
}

module.exports = { Settings, DEFAULTS };
