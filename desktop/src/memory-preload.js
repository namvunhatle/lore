const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('memory', {
  get: () => ipcRenderer.invoke('memory:get'),
  list: (opts) => ipcRenderer.invoke('memory:list', opts),
  topics: () => ipcRenderer.invoke('memory:topics'),
  digest: () => ipcRenderer.invoke('memory:digest'),
  remove: (url) => ipcRenderer.invoke('memory:remove', url),
  removeHost: (host) => ipcRenderer.invoke('memory:removeHost', host),
  removeRange: (range) => ipcRenderer.invoke('memory:removeRange', range),
  export: () => ipcRenderer.invoke('memory:export')
});
