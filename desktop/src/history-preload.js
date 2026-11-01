const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browsing', {
  list: (opts) => ipcRenderer.invoke('history:list', opts),
  remove: (url) => ipcRenderer.invoke('history:remove', url),
  clear: (range) => ipcRenderer.invoke('history:clear', range),
  go: (url) => ipcRenderer.send('history:go', url)
});
