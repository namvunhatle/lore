const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('finder', {
  query: (text, forward, next) => ipcRenderer.send('find:query', String(text), !!forward, !!next),
  close: () => ipcRenderer.send('find:close'),
  onResult: (fn) => ipcRenderer.on('find:result', (_e, r) => fn(r)),
  onFocus: (fn) => ipcRenderer.on('find:focus', fn)
});
