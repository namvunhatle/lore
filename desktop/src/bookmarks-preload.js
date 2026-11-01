const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bookmarks', {
  list: (opts) => ipcRenderer.invoke('bookmarks:list', opts),
  update: (id, patch) => ipcRenderer.invoke('bookmarks:update', id, patch),
  remove: (id) => ipcRenderer.invoke('bookmarks:remove', id),
  go: (id) => ipcRenderer.send('bookmarks:go', id),
  openAll: (folder) => ipcRenderer.send('bookmarks:openAll', folder),
  organize: () => ipcRenderer.send('organize:open'),
  export: () => ipcRenderer.invoke('bookmarks:export'),
  onChanged: (fn) => ipcRenderer.on('bookmarks:changed', fn)
});
