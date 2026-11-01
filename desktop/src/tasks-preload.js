const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tasks', {
  platform: process.platform,
  classify: (text) => ipcRenderer.invoke('tasks:classify', text),
  list: () => ipcRenderer.invoke('tasks:list'),
  save: (task) => ipcRenderer.invoke('tasks:save', task),
  remove: (id) => ipcRenderer.invoke('tasks:remove', id),
  context: (needPage) => ipcRenderer.invoke('tasks:context', !!needPage),
  run: (req) => ipcRenderer.invoke('tasks:run', req),
  act: (req) => ipcRenderer.invoke('tasks:act', req),
  settings: () => ipcRenderer.send('settings:open-from-tasks'),
  onOpen: (fn) => ipcRenderer.on('tasks:open', (_e, req) => fn(req))
});
