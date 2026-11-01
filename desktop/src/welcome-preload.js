const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('welcome', {
  init: () => ipcRenderer.invoke('welcome:init'),
  profile: (name, color) => ipcRenderer.invoke('welcome:profile', name, color),
  importFrom: (req) => ipcRenderer.invoke('welcome:import', req),
  importFile: () => ipcRenderer.invoke('welcome:importFile'),
  setDefault: () => ipcRenderer.invoke('welcome:default'),
  done: () => ipcRenderer.send('welcome:done')
});
