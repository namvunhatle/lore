const { t: tr } = require('./ui/i18n');

// Real workflows that drive the user's tab. Each is data plus small selector adapters.
// Sensitive step = commit(), run only after the user confirms the exact item and amount.

// Local demo portal (fixtures/portal.js) so the whole path can be tested without a real biller.
function demoBill(base, t) {
  return {
    title: t('demo.title'),
    steps: [
      { text: t('demo.s1'), run: (c) => c.driver.goto(base) },
      { text: t('demo.s2'), run: (c) => c.driver.waitFor('#amount') },
      { text: t('demo.s3'), run: async (c) => {
        c.amount = await c.driver.text('#amount');
        c.invoice = await c.driver.text('#invoice');
        c.origin = new URL(c.driver.url()).origin;
      } }
    ],
    confirm: (c) => ({
      item: t('demo.item', { inv: c.invoice, host: new URL(c.origin).host }),
      amount: c.amount,
      meta: t('demo.meta'),
      cta: t('demo.cta')
    }),
    // Re-check the live page: if the origin or amount changed after you were shown the card, do not pay.
    commit: async (c, conf) => {
      if (new URL(c.driver.url()).origin !== c.origin) throw new Error(t('demo.err.origin'));
      if ((await c.driver.text('#amount')) !== conf.amount) throw new Error(t('demo.err.amount'));
      await c.driver.click('#pay');
      await c.driver.waitFor('#receipt');
      return { ok: true, message: t('demo.done') + (await c.driver.text('#receipt')) };
    }
  };
}

function real({ demoBase, t = (k, v) => tr('en', k, v) } = {}) {
  return { 'demo-bill': demoBill(demoBase || 'http://localhost:4010/', t) };
}

module.exports = { real };
