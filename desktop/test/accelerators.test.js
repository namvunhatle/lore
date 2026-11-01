const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Windows and Linux throw on an accelerator Electron cannot parse, which stops the whole menu (and so the app) from starting;
// macOS is more forgiving. Keep to letters, digits, = , . and - after the modifiers.
test('every menu accelerator is one Electron accepts on every system', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const all = [...src.matchAll(/accelerator: '([^']*)'/g)].map((m) => m[1]);
  assert.ok(all.length > 20);
  for (const a of all) assert.match(a, /^((CmdOrCtrl|Ctrl|Alt|Shift|Cmd)\+)*[A-Za-z0-9=,.-]+$/, a);
});
