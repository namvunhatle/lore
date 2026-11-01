// Renders the social preview image for the landing page. Run: cd desktop && npx electron ../scripts/render-og.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const icon = fs.readFileSync(path.join(__dirname, '..', 'design', 'icon', 'lore-icon-1024.png')).toString('base64');
const html = `<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:-apple-system,"Segoe UI",system-ui,sans-serif}
.bg{width:1200px;height:630px;background:radial-gradient(900px 500px at 15% 0%,#6544E0 0%,#4726B8 45%,#2F178A 100%);color:#fff;display:flex;align-items:center;padding:0 90px;box-sizing:border-box;gap:60px}
img{width:240px;height:240px;border-radius:54px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
h1{font-size:76px;line-height:1.05;letter-spacing:-.03em;margin:0 0 22px;font-weight:650}
p{font-size:30px;margin:0;opacity:.85;line-height:1.35}
small{display:block;margin-top:30px;font-size:24px;opacity:.7}
</style><div class="bg"><img src="data:image/png;base64,${icon}"><div><h1>The browser that<br>remembers you.<br>Only you.</h1><p>Free, open source, private AI browser.</p><small>macOS · Windows · MIT</small></div></div>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 630, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400));
  const shot = await win.webContents.capturePage();
  const out = path.join(__dirname, '..', 'site', 'assets', 'og.png');
  fs.writeFileSync(out, shot.resize({ width: 1200, height: 630 }).toPNG());
  console.log('wrote', out);
  app.exit(0);
});
