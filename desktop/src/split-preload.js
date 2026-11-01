const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splitApi', {
  drag: (screenX) => ipcRenderer.send('split:drag', Number(screenX)),
  reset: () => ipcRenderer.send('split:reset')
});
