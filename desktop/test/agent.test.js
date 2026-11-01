const test = require('node:test');
const assert = require('node:assert');
const { AgentRun, match } = require('../src/agent');

function make(extra = {}) {
  const entries = [];
  let commits = 0;
  const run = new AgentRun('bill', {
    stepDelay: 1, log: { append: (e) => entries.push(e) },
    commit: async (c) => { commits++; return { ok: true, message: 'ok ' + c.amount }; }, ...extra
  });
  return { run, entries, commits: () => commits };
}
const until = async (run, state) => { while (run.state !== state) await new Promise((r) => setTimeout(r, 2)); };

test('match workflows', () => {
  assert.strictEqual(match('đóng tiền điện tháng này giúp tôi'), 'bill');
  assert.strictEqual(match('đặt vé 06:10 thứ Bảy'), 'flight');
  assert.strictEqual(match('xin chào'), null);
});
test('does not commit before confirmation', async () => {
  const { run, commits } = make();
  run.start();
  await until(run, 'awaiting');
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(commits(), 0);
  assert.strictEqual(run.snapshot().confirm.amount, '842,000₫');
});
test('approve commits exactly once', async () => {
  const { run, commits } = make();
  const p = run.start();
  await until(run, 'awaiting');
  assert.ok(run.decide(true));
  assert.ok(!run.decide(true));
  await p;
  assert.strictEqual(run.state, 'done');
  assert.strictEqual(commits(), 1);
});
test('decline never commits', async () => {
  const { run, commits } = make();
  const p = run.start();
  await until(run, 'awaiting');
  run.decide(false);
  await p;
  assert.strictEqual(run.state, 'cancelled');
  assert.strictEqual(commits(), 0);
});
test('decide is ignored while steps are running', async () => {
  const { run, commits } = make({ stepDelay: 20 });
  const p = run.start();
  assert.ok(!run.decide(true));
  run.cancel();
  await p;
  assert.strictEqual(commits(), 0);
});
test('log records the flow', async () => {
  const { run, entries } = make();
  const p = run.start();
  await until(run, 'awaiting');
  run.decide(true);
  await p;
  const ev = entries.map((e) => e.event);
  assert.ok(ev.includes('awaiting-confirmation') && ev.includes('confirmed') && ev.at(-1) === 'done');
});
