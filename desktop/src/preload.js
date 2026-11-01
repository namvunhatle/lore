const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lore', {
  platform: process.platform,
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  classify: (text) => ipcRenderer.invoke('intent:classify', String(text).slice(0, 300)),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onTypeRun: (fn) => ipcRenderer.on('type-run', (_e, q) => fn(String(q))),
  onToast: (fn) => ipcRenderer.on('toast', (_e, t) => fn(t)),
  focusIntent: (fn) => ipcRenderer.on('focus-intent', fn)
});
