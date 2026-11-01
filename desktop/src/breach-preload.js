const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('breach', {
  check: (password) => ipcRenderer.invoke('breach:check', String(password))
});
