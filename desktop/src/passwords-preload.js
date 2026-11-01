const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vault', {
  list: () => ipcRenderer.invoke('pw:list'),
  add: (site, user, pass) => ipcRenderer.invoke('pw:add', String(site), String(user), String(pass)),
  remove: (id) => ipcRenderer.invoke('pw:remove', Number(id)),
  copy: (id) => ipcRenderer.invoke('pw:copy', Number(id)),
  check: (id) => ipcRenderer.invoke('pw:check', Number(id)),
  generate: () => ipcRenderer.invoke('pw:generate')
});
