// AI-11: which on-device model to install on this computer. Chosen by memory size so a small laptop is not asked to run a
// large model. The Qwen 2.5 family reads Vietnamese; the sizes are a starting point, not a measured recommendation.
const GB = 1024 ** 3;
const EMBED = 'bge-m3';

function recommend(totalBytes) {
  const gb = totalBytes / GB;
  const chat = gb < 7 ? 'qwen2.5:1.5b' : gb < 14 ? 'qwen2.5:3b' : 'qwen2.5:7b';
  return { chat, embed: EMBED, gb: Math.round(gb) };
}

// Ollama lists a model as "qwen2.5:3b" or "qwen2.5:3b-instruct"; a bare name means ":latest".
const installed = (names, model) => names.some((n) => n === model || n.startsWith(model + '-') || (!model.includes(':') && n === model + ':latest'));

module.exports = { recommend, installed, EMBED };
