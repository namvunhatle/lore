const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('report', {
  get: () => ipcRenderer.invoke('report:get'),
  copy: (text) => ipcRenderer.send('report:copy', String(text))
});
