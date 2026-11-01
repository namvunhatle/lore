// Optional on-device embeddings through Ollama, for "search by meaning" in Memory. Without it, Memory uses keywords only.
function createEmbedder({ url = 'http://127.0.0.1:11434', model = 'bge-m3', fetchImpl = fetch } = {}) {
  const base = url.replace(/\/+$/, '');
  return {
    model,
    async available() {
      try {
        const r = await fetchImpl(base + '/api/tags', { signal: AbortSignal.timeout(700) });
        if (!r.ok) return false;
        return ((await r.json()).models || []).some((m) => (model.includes(':') ? m.name === model : m.name.startsWith(model + ':')));
      } catch { return false; }
    },
    async embed(text) {
      const r = await fetchImpl(base + '/api/embed', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, input: text }), signal: AbortSignal.timeout(20000)
      });
      if (!r.ok) throw new Error('embed HTTP ' + r.status);
      const j = await r.json();
      return (j.embeddings && j.embeddings[0]) || null;
    }
  };
}
module.exports = { createEmbedder };
