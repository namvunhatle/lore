const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('organize', {
  propose: () => ipcRenderer.invoke('organize:propose'),
  apply: (plan) => ipcRenderer.invoke('organize:apply', plan),
  undo: () => ipcRenderer.invoke('organize:undo'),
  settings: () => ipcRenderer.send('settings:open-from-organize')
});
