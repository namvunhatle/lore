// Composes the README hero image from the real screenshots in site/assets. Run: cd desktop && npx electron ../scripts/render-hero.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'site', 'assets');
const b64 = (f, mime) => `data:${mime};base64,` + fs.readFileSync(path.join(dir, f)).toString('base64');
const html = `<style>
html,body{margin:0;background:linear-gradient(160deg,#F4F1FF,#E3DCFA)}
.win{width:1280px;border-radius:14px;overflow:hidden;background:#fff;border:1px solid #D9DCE3;box-shadow:0 12px 40px rgba(40,20,100,.18)}
.bar{position:relative}.bar img{width:1280px;display:block}
.dots{position:absolute;left:15px;top:18px;display:flex;gap:9px}.dots i{width:12px;height:12px;border-radius:50%;background:#FF5F57}.dots i:nth-child(2){background:#FEBC2E}.dots i:nth-child(3){background:#28C840}
.body{display:grid;grid-template-columns:900px 380px;border-top:1px solid #E4E6EC}.body img{width:100%;display:block}.body img+img{border-left:1px solid #E4E6EC}
body{padding:24px;width:1280px}
</style><div class="win"><div class="bar"><span class="dots"><i></i><i></i><i></i></span><img src="${b64('bar-page.png', 'image/png')}"></div><div class="body"><img src="${b64('page-panel.jpg', 'image/jpeg')}"><img src="${b64('panel.png', 'image/png')}"></div></div>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1328, height: 860, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 800));
  const shot = await win.webContents.capturePage();
  const out = path.join(dir, 'hero.png'); // then: sips -s format jpeg -s formatOptions 85 hero.png --out hero.jpg (the README uses the smaller JPEG)
  fs.writeFileSync(out, shot.resize({ width: 1800 }).toPNG());
  console.log('wrote', out);
  app.exit(0);
});
