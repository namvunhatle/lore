const { contextBridge } = require('electron');
const now = Date.now();
contextBridge.exposeInMainWorld('memory', {
  list: async ({ q = '' } = {}) => ({
    items: [{ url: 'https://news.vn/a', title: 'Giữ nguyên lãi suất', ts: now - 86400000, host: 'news.vn', snippet: 'Ngân hàng Nhà nước giữ nguyên lãi suất.' }].filter(() => !q || /lãi/.test(q)),
    total: 5, hosts: [{ host: 'news.vn', count: 3 }], embedded: 0
  }),
  topics: async () => [], digest: async () => ({ pages: 0, topics: [], text: '' }),
  remove: async () => 1, removeHost: async () => 1, removeRange: async () => 1, export: async () => ({ ok: true, count: 5 })
});
