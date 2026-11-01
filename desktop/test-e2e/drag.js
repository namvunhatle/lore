// Dragging tabs in the sidebar, in the real app, with real mouse events: a few pixels are not a drag, a drop on the top or
// bottom of a row reorders, on the middle groups, on a pin pins, a pinned tab dropped among the others unpins, Escape
// cancels, and the ghost is always gone once the spring has settled. Runs main.js itself.
const { app, BrowserWindow, Menu } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'lore-drag-')));
process.env.LORE_NO_WELCOME = '1';
const assert = require('node:assert');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let state = null;
  const probe = new BrowserWindow({ show: false });
  const proto = Object.getPrototypeOf(probe.webContents);
  const send = proto.send;
  proto.send = function (ch, ...a) { if (ch === 'state') state = a[0]; return send.call(this, ch, ...a); };
  probe.destroy();
  require('../src/main.js');
  const until = async (f, what) => { for (let i = 0; i < 100; i++) { try { if (f()) return; } catch { /* not yet */ } await sleep(100); } throw new Error('timed out: ' + what + '\n' + JSON.stringify(state && state.tabs.map((t) => [t.id, t.pinned, t.group]))); };
  const ui = () => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('index.html')).webContents;
  const ids = () => state.tabs.map((t) => t.id);
  const rect = (id) => ui().executeJavaScript(`(() => { const el = [...document.querySelectorAll('#slist .srow, #pins .pin')].find((e) => e._t && e._t.id === ${id}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const left = () => ui().executeJavaScript(`[...document.querySelectorAll('.sghost, .sdrag, .sland')].map((e) => e.className)`);
  // The spring settles in well under a second; a window that is not in front can hold animation frames back, and the
  // sidebar then removes the ghost after 1.5 s, so wait up to 2.5 s.
  const gone = async () => { let l = []; for (let i = 0; i < 25; i++) { l = await left(); if (!l.length) return true; await sleep(100); } console.log('left over:', JSON.stringify(l)); return false; };
  const mouse = (type, x, y) => ui().sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  // Press on the middle of `from`, move to the given fraction of the height of `to` (or by an offset), let go.
  const drag = async (from, to, frac, { cancel = false, stop = false } = {}) => {
    const a = await rect(from), b = await rect(to);
    const sx = a.x + 40, sy = a.y + a.h / 2;
    const ex = b.x + (frac.x === undefined ? 40 : b.w * frac.x), ey = b.y + b.h * (frac.y === undefined ? frac : frac.y);
    mouse('mouseMove', sx, sy); mouse('mouseDown', sx, sy);
    for (let i = 1; i <= 8; i++) { mouse('mouseMove', sx + ((ex - sx) * i) / 8, sy + ((ey - sy) * i) / 8); await sleep(16); }
    if (process.env.DRAG_DEBUG) console.log('over', JSON.stringify(await ui().executeJavaScript(`[...document.querySelectorAll('[class*=over]')].map((e) => e.className + ':' + (e._t && e._t.id))`)), 'end', Math.round(ex), Math.round(ey), 'rects', JSON.stringify([a, b]));
    if (stop) return;
    if (cancel) { ui().sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); ui().sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); }
    mouse('mouseUp', ex, ey);
  };
  let code = 0;
  try {
    await until(() => state && state.tabs.length, 'first state');
    BrowserWindow.fromWebContents(ui()).showInactive(); // animation frames only run in a window that is shown
    if (process.env.DRAG_DEBUG) ui().on('console-message', (...a) => console.log('UI', a.slice(1, 4).join(' | '))); // dbg-console
    // Tabs in the sidebar, through the real View menu.
    const find = (items) => { for (const i of items) { if (i.label === 'Tabs in Sidebar') return i; if (i.submenu) { const f = find(i.submenu.items); if (f) return f; } } return null; };
    find(Menu.getApplicationMenu().items).click();
    await until(() => state.layout === 'side', 'sidebar layout');
    for (let i = 0; i < 3; i++) ui().executeJavaScript(`lore.send('tab:new')`);
    await until(() => state.tabs.length === 4, 'four tabs');
    await sleep(600);
    const [a, b, c, d] = ids();

    // 1. A few pixels is a click, not a drag.
    { const r = await rect(b); mouse('mouseMove', r.x + 40, r.y + 15); mouse('mouseDown', r.x + 40, r.y + 15); mouse('mouseMove', r.x + 43, r.y + 17); mouse('mouseUp', r.x + 43, r.y + 17); await sleep(300); }
    assert.deepStrictEqual(ids(), [a, b, c, d]);
    assert.ok(await gone(), 'no ghost after a click');

    // 2. Drop on the top part of the first row: it goes first.
    await drag(d, a, 0.1);
    await until(() => ids()[0] === d, 'd moved to the front');
    assert.deepStrictEqual(ids(), [d, a, b, c]);
    await sleep(900);
    assert.ok(await gone(), 'the ghost has settled and gone');

    // 3. Drop on the bottom part of the last row: it goes last.
    await drag(d, c, 0.9);
    await until(() => ids()[3] === d, 'd moved to the end');
    assert.deepStrictEqual(ids(), [a, b, c, d]);
    await sleep(900);

    // 4. Escape: nothing changes, the ghost goes back.
    await drag(c, a, 0.1, { cancel: true });
    await sleep(900);
    assert.deepStrictEqual(ids(), [a, b, c, d], 'Escape cancels the drop');
    assert.ok(await gone(), 'ghost gone after cancel');

    // 5. Drop on the middle of a row: the two become a group.
    await drag(c, b, 0.5);
    await until(() => state.groups.length === 1, 'a group was made');
    assert.strictEqual(state.tabs.find((t) => t.id === b).group, state.tabs.find((t) => t.id === c).group);
    // The new group opens its name for editing, and the sidebar is not redrawn while a name is typed: close it.
    await sleep(300);
    ui().sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); ui().sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await sleep(900);

    // 6. A pinned tab (pinned through the same message the drop uses) and a drop on it pins the dragged tab too.
    ui().executeJavaScript(`lore.send('tab:setPinned', ${a}, true)`);
    await until(() => state.tabs.find((t) => t.id === a).pinned, 'a is pinned');
    await sleep(500);
    await drag(d, a, { x: 0.8, y: 0.5 });
    await until(() => state.tabs.find((t) => t.id === d).pinned, 'd pinned by dropping on a pin');
    await sleep(900);
    assert.ok(await gone());

    // 7. A pinned tab dropped among the others comes off the pins.
    await drag(d, b, 0.9);
    await until(() => !state.tabs.find((t) => t.id === d).pinned, 'd unpinned by dropping among the others');
    await sleep(900);
    assert.ok(await gone(), 'ghost gone at the end');
    console.log('drag ok');
  } catch (e) { console.error('drag FAILED', e); code = 1; }
  app.exit(code);
});
