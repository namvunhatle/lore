// Compiles the bundled filter engine. Run before packaging: npm run filters
const fs = require('fs');
const path = require('path');
const { buildEngine, BUNDLED_LISTS } = require('../src/adblock');

(async () => {
  const engine = await buildEngine(BUNDLED_LISTS);
  const out = path.join(__dirname, '..', 'src', 'filters', 'engine.bin');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, engine.serialize());
  console.log('wrote', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
})().catch((e) => { console.error(e.message); process.exit(1); });
