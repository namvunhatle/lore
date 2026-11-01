// Starts the packaged app and waits for it to say it works (see runSmoke in src/main.js). Usage: node scripts/smoke.js
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const find = () => {
  if (process.platform === 'darwin') {
    // The build for this computer's own chip: the other one would need Rosetta.
    for (const d of process.arch === 'arm64' ? ['mac-arm64', 'mac'] : ['mac', 'mac-arm64']) if (fs.existsSync(path.join(dist, d, 'Lore.app'))) return path.join(dist, d, 'Lore.app', 'Contents', 'MacOS', 'Lore');
  } else if (process.platform === 'win32') {
    const p = path.join(dist, 'win-unpacked', 'Lore.exe');
    if (fs.existsSync(p)) return p;
  } else {
    const dir = path.join(dist, 'linux-unpacked');
    for (const n of ['lore', 'Lore', 'lore-desktop']) if (fs.existsSync(path.join(dir, n))) return path.join(dir, n);
  }
  return '';
};

const bin = find();
if (!bin) { console.error('smoke: no packaged app found in dist/'); process.exit(2); }
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-smoke-'));
const args = ['--user-data-dir=' + data];
if (process.platform === 'linux') args.push('--no-sandbox'); // the unpacked build has no setuid sandbox helper on CI
const child = spawn(bin, args, { env: { ...process.env, LORE_SMOKE: '1', LORE_NO_WELCOME: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
child.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
const kill = setTimeout(() => { console.error('smoke: gave up after 60 s'); child.kill('SIGKILL'); }, 60000);
child.on('exit', (code) => {
  clearTimeout(kill);
  fs.rmSync(data, { recursive: true, force: true });
  if (code === 0 && /LORE_SMOKE_OK/.test(out)) { console.log('smoke: ok'); process.exit(0); }
  console.error('smoke: failed (exit ' + code + ')');
  process.exit(1);
});
