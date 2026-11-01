// Agent action layer. Agent safety rules (CONTRIBUTING.md, "Product rules"):
//  - The sensitive step (commit) runs only after an explicit decision from the trusted panel, for the exact item and amount shown.
//  - Page content is data: nothing a web page says can call decide(); only the main process wires it, from the panel's own webContents.
//  - Everything the agent does is appended to a local log.
// Workflows below are SIMULATED: they do not touch any real service or money yet.
const { EventEmitter } = require('events');
const { norm } = require('./router');
const { t: tr } = require('./ui/i18n');

// Text fields are i18n keys; AgentRun translates them with the t it is given.
const WORKFLOWS = {
  bill: {
    title: 'wf.bill.title',
    steps: ['wf.bill.s1', 'wf.bill.s2', 'wf.bill.s3'],
    confirm: { item: 'wf.bill.item', amount: 'wf.bill.amount', meta: 'wf.bill.meta', cta: 'wf.bill.cta' },
    done: 'wf.bill.done'
  },
  flight: {
    title: 'wf.flight.title',
    steps: ['wf.flight.s1', 'wf.flight.s2', 'wf.flight.s3'],
    confirm: { item: 'wf.flight.item', amount: 'wf.flight.amount', meta: 'wf.flight.meta', cta: 'wf.flight.cta' },
    done: 'wf.flight.done'
  }
};

function match(text) {
  const n = norm(text);
  if (/\bdemo\b/.test(n) && /thanh toan|dong tien|dien|pay|bill|electric/.test(n)) return 'demo-bill';
  if (/dien|hoa don|dong tien|thanh toan|\bpay\b|\bbill\b|electric/.test(n)) return 'bill';
  if (/dat ve|ve may bay|chuyen bay|\bbook\b.*\b(flight|ticket)/.test(n)) return 'flight';
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

class AgentRun extends EventEmitter {
  // workflows: id -> definition. steps are strings (simulated) or { text, run(ctx) } (real, using ctx.driver).
  // confirm may be a function(ctx). commit(ctx, confirm) runs only after approval.
  constructor(id, { log = { append() {} }, stepDelay = 900, commit, driver, workflows = WORKFLOWS, t = (k, v) => tr('en', k, v) } = {}) {
    super();
    this.t = t;
    this.id = id;
    this.wf = workflows[id];
    this.title = this.wf.title.startsWith('wf.') || this.wf.title.startsWith('demo.') ? t(this.wf.title) : this.wf.title;
    this.ctx = { driver };
    this.runId = ++seq;
    this.log = log;
    this.stepDelay = stepDelay;
    this.commit = commit || (this.wf.commit ? (c) => this.wf.commit(this.ctx, c) : async () => ({ ok: true, message: this.t(this.wf.done) }));
    this.steps = this.wf.steps.map((x) => (typeof x === 'string' ? { text: this.t(x), status: 'wait' } : { text: x.text, run: x.run, status: 'wait' }));
    this.confirmData = null;
    this.state = 'running'; // running | awaiting | done | cancelled | failed
    this.result = '';
    this._decide = null;
  }

  _tConfirm(c) {
    return { item: this.t(c.item), amount: this.t(c.amount), meta: this.t(c.meta), cta: this.t(c.cta) };
  }

  snapshot() {
    return {
      runId: this.runId, title: this.title, state: this.state, steps: this.steps.map(({ text, status }) => ({ text, status })),
      confirm: this.state === 'awaiting' ? this.confirmData : null, result: this.result
    };
  }

  _note(event, detail = '') {
    this.log.append({ ts: Date.now(), run: this.runId, workflow: this.id, event, detail });
    this.emit('change', this.snapshot());
  }

  async start() {
    this._note('start', this.title);
    try {
      for (const s of this.steps) {
        if (this.state !== 'running') return;
        s.status = 'running';
        this._note('step-start', s.text);
        if (s.run) await s.run(this.ctx); else await sleep(this.stepDelay);
        if (this.state !== 'running') return;
        s.status = 'done';
        this._note('step-done', s.text);
      }
      this.confirmData = typeof this.wf.confirm === 'function' ? await this.wf.confirm(this.ctx) : this._tConfirm(this.wf.confirm);
    } catch (e) {
      if (this.state !== 'running') return;
      this.state = 'failed';
      this.result = this.t('agent.failed', { e: e.message });
      this._note('failed', e.message);
      return;
    }
    if (this.state !== 'running') return;
    const c = this.confirmData;
    this.state = 'awaiting';
    this._note('awaiting-confirmation', `${c.item} ${c.amount}`);
    const approved = await new Promise((resolve) => { this._decide = resolve; });
    if (!approved) return;
    this._note('confirmed', `${c.item} ${c.amount}`);
    try {
      const r = await this.commit(c);
      this.state = r.ok ? 'done' : 'failed';
      this.result = r.message;
    } catch (e) {
      this.state = 'failed';
      this.result = this.t('agent.failed2', { e: e.message });
    }
    this._note(this.state, this.result);
  }

  // Only the main process calls this, from the trusted panel. Ignored unless a confirmation is pending.
  decide(approved) {
    if (this.state !== 'awaiting' || !this._decide) return false;
    const d = this._decide;
    this._decide = null;
    if (!approved) { this.state = 'cancelled'; this._note('cancelled', 'user declined'); }
    d(!!approved);
    return true;
  }

  cancel() {
    if (this.state === 'running') { this.state = 'cancelled'; this._note('cancelled', 'user closed'); }
    else this.decide(false);
  }
}

module.exports = { AgentRun, WORKFLOWS, match };
