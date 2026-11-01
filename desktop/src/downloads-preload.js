const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloads', {
  list: () => ipcRenderer.invoke('downloads:list'),
  act: (id, action) => ipcRenderer.invoke('downloads:act', id, action),
  clear: () => ipcRenderer.invoke('downloads:clear'),
  onUpdate: (fn) => ipcRenderer.on('downloads:update', (_e, list) => fn(list))
});
