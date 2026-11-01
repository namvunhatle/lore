const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('settings:get'),
  save: (patch) => ipcRenderer.invoke('settings:save', patch),
  test: (patch) => ipcRenderer.invoke('settings:test', patch),
  clear: () => ipcRenderer.invoke('settings:clear'),
  models: (url) => ipcRenderer.invoke('settings:models', url),
  pull: (url, model) => ipcRenderer.invoke('settings:pull', url, model),
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    create: (name, color) => ipcRenderer.invoke('profiles:create', name, color),
    update: (id, patch) => ipcRenderer.invoke('profiles:update', id, patch),
    remove: (id) => ipcRenderer.invoke('profiles:remove', id),
    switch: (id) => ipcRenderer.invoke('profiles:switch', id)
  },
  onPane: (fn) => ipcRenderer.on('settings:pane', (_e, id) => fn(id)),
  onPull: (fn) => ipcRenderer.on('settings:pull-progress', (_e, p, status) => fn(p, status)),
  ollamaSite: () => ipcRenderer.send('settings:ollama-site')
});
