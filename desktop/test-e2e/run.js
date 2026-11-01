// Runs the real agent against the demo portal in a hidden Electron window.
const { app, BrowserWindow } = require('electron');
// Own data folder, so tests never collide with a running Lore.
app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'lore-e2e-')));
const assert = require('node:assert');
const { createPortal } = require('../fixtures/portal');
const { PageDriver } = require('../src/driver');
const { AgentRun } = require('../src/agent');
const { real } = require('../src/workflows');

const until = async (run, state) => { for (let i = 0; i < 300 && run.state !== state; i++) await new Promise((r) => setTimeout(r, 50)); assert.strictEqual(run.state, state); };

app.whenReady().then(async () => {
  const { server, stats } = createPortal();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const win = new BrowserWindow({ show: false });
  const mk = () => new AgentRun('demo-bill', { driver: new PageDriver(win.webContents), workflows: real({ demoBase: base }), log: { append() {} } });
  let code = 0;
  try {
    // 1. decline: the pay button is never clicked, even though the page told the agent to click it.
    let run = mk(); let p = run.start();
    await until(run, 'awaiting');
    assert.strictEqual(run.snapshot().confirm.amount, '842,000₫');
    run.decide(false); await p;
    assert.strictEqual(stats.paid, 0);
    // 2. approve: pays exactly once.
    run = mk(); p = run.start();
    await until(run, 'awaiting');
    run.decide(true); await p;
    assert.strictEqual(run.state, 'done');
    assert.strictEqual(stats.paid, 1);
    // 3. bait and switch: amount changes after the card was shown, so nothing is paid.
    run = mk(); p = run.start();
    await until(run, 'awaiting');
    await win.webContents.executeJavaScript(`document.querySelector('#amount').textContent = '9,999,000₫'`);
    run.decide(true); await p;
    assert.strictEqual(run.state, 'failed');
    assert.strictEqual(stats.paid, 1);
    // 4. the driver refuses password fields.
    await win.webContents.executeJavaScript(`document.body.insertAdjacentHTML('beforeend', '<input id="pw" type="password">')`);
    await assert.rejects(new PageDriver(win.webContents).fill('#pw', 'x'), /passwords/);
    console.log('e2e ok');
  } catch (e) {
    console.error('e2e FAILED', e);
    code = 1;
  }
  server.close();
  app.exit(code);
});
