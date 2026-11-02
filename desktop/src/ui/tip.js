const t = document.getElementById('t');
tip.onText(({ text, cap }) => {
  t.replaceChildren();
  const s = document.createElement('span'); s.textContent = text; t.append(s);
  if (cap) { const k = document.createElement('kbd'); k.textContent = cap; t.append(k); }
  requestAnimationFrame(() => tip.size(t.offsetWidth + 12, t.offsetHeight + 12));
});
