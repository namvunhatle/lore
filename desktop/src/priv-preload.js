const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('priv', {
  get: () => ipcRenderer.invoke('priv:get'),
  set: (key, value) => ipcRenderer.invoke('priv:set', String(key), !!value),
  report: () => ipcRenderer.send('priv:report'),
  settings: () => ipcRenderer.send('priv:settings'),
  size: (h) => ipcRenderer.send('priv:size', Math.ceil(h)),
  close: () => ipcRenderer.send('priv:close'),
  onRefresh: (fn) => ipcRenderer.on('priv:refresh', fn)
});
