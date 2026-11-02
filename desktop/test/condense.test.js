const test = require('node:test');
const assert = require('node:assert');
const { condense, budgetFor } = require('../src/condense');

const page = [
  'Home | Products | Contact | Login | Cart | Help | About us | Careers',
  'The Aurora kettle boils one litre of water in under three minutes and switches itself off.',
  'Customers say the Aurora kettle is quiet, and the kettle keeps water hot for an hour.',
  ...Array.from({ length: 40 }, (_, i) => `Filler paragraph number ${i} that talks about shipping and unrelated cookie settings for visitors.`),
  'The warranty on the Aurora kettle lasts twenty four months from the date of purchase.',
  'Subscribe to our newsletter to get offers every week and never miss a deal on kettles.'
].join('\n');

test('a short page is left alone and a long one is cut to the budget in reading order', () => {
  assert.strictEqual(condense('short text', 100), 'short text');
  const out = condense(page, 600);
  assert.ok(out.length <= 600, String(out.length));
  assert.match(out, /boils one litre/);
  assert.match(out, /warranty/);
  assert.ok(out.indexOf('boils one litre') < out.indexOf('warranty'));
});

test('repeated filler is not sent over and over', () => {
  const out = condense(page, 1500);
  const filler = (out.match(/Filler paragraph/g) || []).length;
  assert.ok(filler < 12, String(filler));
});

test('three levels of data use, balanced by default', () => {
  assert.ok(budgetFor('save').summary < budgetFor('balanced').summary && budgetFor('balanced').summary < budgetFor('detail').summary);
  assert.strictEqual(budgetFor('nonsense').summary, 9000);
});
