const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('compare', {
  tabs: () => ipcRenderer.invoke('compare:tabs'),
  run: (ids) => ipcRenderer.invoke('compare:run', ids),
  settings: () => ipcRenderer.send('settings:open-from-compare')
});
