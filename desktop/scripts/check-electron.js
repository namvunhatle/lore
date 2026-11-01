// Electron freshness rule: Lore is a browser, so its engine must stay within the two newest Electron majors.
// Electron supports only the latest three majors and ships a new one about every 8 weeks.
//   ok    pinned major is the latest
//   warn  one behind: update within the 8-week release window
//   fail  two or more behind: the engine is missing security fixes, so CI fails
// Usage: node scripts/check-electron.js [--strict]   (--strict also fails when the registry cannot be reached)
const fs = require('fs');
const path = require('path');

const major = (v) => Number(String(v).replace(/^[^\d]*/, '').split('.')[0]);

function check(pinned, latest) {
  const behind = major(latest) - major(pinned);
  const status = behind <= 0 ? 'ok' : behind === 1 ? 'warn' : 'fail';
  return { status, behind, pinned: major(pinned), latest: major(latest) };
}

async function latestVersion(fetchImpl = fetch) {
  const r = await fetchImpl('https://registry.npmjs.org/-/package/electron/dist-tags', { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('registry returned HTTP ' + r.status);
  return (await r.json()).latest;
}

async function main() {
  const strict = process.argv.includes('--strict');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const pinned = pkg.devDependencies.electron;
  let latest;
  try { latest = await latestVersion(); } catch (e) {
    console.log(`Could not check the latest Electron (${e.message}).`);
    process.exit(strict ? 1 : 0);
  }
  const r = check(pinned, latest);
  const msg = `Electron pinned ${pinned} (major ${r.pinned}), latest ${latest} (major ${r.latest}).`;
  if (r.status === 'ok') console.log('OK. ' + msg);
  else if (r.status === 'warn') console.log('WARNING: one major behind. Update within the next release window. ' + msg);
  else { console.error(`FAIL: ${r.behind} majors behind. Lore must stay within the two newest Electron majors. ` + msg); process.exit(1); }
}

if (require.main === module) main();
module.exports = { check, major };
