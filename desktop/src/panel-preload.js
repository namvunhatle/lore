const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  platform: process.platform,
  onState: (fn) => ipcRenderer.on('agent:state', (_e, s) => fn(s)),
  onPage: (fn) => ipcRenderer.on('page:state', (_e, s) => fn(s)),
  modelMenu: (x, y) => ipcRenderer.send('model:menu', Math.round(x), Math.round(y)),
  onModel: (fn) => ipcRenderer.on('model:info', (_e, m) => fn(m)),
  chats: { list: () => ipcRenderer.invoke('chats:list'), open: (k) => ipcRenderer.send('chats:open', k), remove: (k) => ipcRenderer.send('chats:delete', k), fresh: () => ipcRenderer.send('chat:new') },
  onThread: (fn) => ipcRenderer.on('page:thread', (_e, t) => fn(t)),
  pageDo: (action, arg) => ipcRenderer.send('page:do', action, arg),
  pageView: (v) => ipcRenderer.send('page:view', v),
  copy: (t) => ipcRenderer.send('panel:copy', t),
  pageShow: (t) => ipcRenderer.send('page:show', t),
  onLang: (fn) => ipcRenderer.on('lang', (_e, l) => fn(l)),
  onDl: (fn) => ipcRenderer.on('dl:state', (_e, s) => fn(s)),
  dlStart: (i) => ipcRenderer.send('dl:start', i),
  dlReveal: () => ipcRenderer.send('dl:reveal'),
  decide: (approved) => ipcRenderer.send('agent:decide', !!approved),
  close: () => ipcRenderer.send('agent:close')
});
