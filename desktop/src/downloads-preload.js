const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloads', {
  list: () => ipcRenderer.invoke('downloads:list'),
  act: (id, action) => ipcRenderer.invoke('downloads:act', id, action),
  suggest: (id) => ipcRenderer.invoke('downloads:suggest', id),
  rename: (id, name) => ipcRenderer.invoke('downloads:rename', id, name),
  clear: () => ipcRenderer.invoke('downloads:clear'),
  onUpdate: (fn) => ipcRenderer.on('downloads:update', (_e, list) => fn(list))
});
