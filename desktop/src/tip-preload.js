const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tip', {
  onText: (fn) => ipcRenderer.on('tip:text', (_e, d) => fn(d)),
  size: (w, h) => ipcRenderer.send('tip:size', Math.ceil(w), Math.ceil(h))
});
