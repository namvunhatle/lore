// Renders design/icon/lore-icon.svg to PNGs. Run: npx electron scripts/render-icon.js
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', '..', 'design', 'icon', 'lore-icon.svg');
const outs = [
  [1024, path.join(__dirname, '..', '..', 'design', 'icon', 'lore-icon-1024.png')],
  [512, path.join(__dirname, '..', 'build', 'icon.png')]
];

app.whenReady().then(async () => {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const win = new BrowserWindow({ show: false, width: 1024, height: 1024, useContentSize: true, transparent: true, frame: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${svg}`));
  await new Promise((r) => setTimeout(r, 300));
  const shot = await win.webContents.capturePage();
  for (const [size, file] of outs) {
    fs.writeFileSync(file, shot.resize({ width: size, height: size, quality: 'best' }).toPNG());
    console.log('wrote', file);
  }
  app.exit(0);
});
