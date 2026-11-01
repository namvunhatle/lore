const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('dl2.title');

const size = (n) => {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
};
const ext = (name) => { const m = /\.([a-z0-9]{1,5})$/i.exec(name); return m ? m[1] : '·'; };

function button(text, action, id, quiet) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (quiet) b.className = 'quiet';
  b.addEventListener('click', () => downloads.act(id, action));
  return b;
}

function row(r) {
  const li = document.createElement('li');
  const e = document.createElement('div'); e.className = 'ext'; e.textContent = ext(r.name);
  const body = document.createElement('div'); body.className = 'body';
  const name = document.createElement('div'); name.className = 'name'; name.textContent = r.name; name.title = r.name;
  const meta = document.createElement('div'); meta.className = 'meta';
  const pct = r.total ? Math.min(100, Math.round((r.received / r.total) * 100)) : 0;
  let line;
  let bad = false;
  if (r.state === 'progressing') line = r.paused ? T('dl2.paused') : (r.total ? T('dl2.progress', { a: size(r.received), b: size(r.total), p: pct }) : T('dl2.progressNoTotal', { a: size(r.received) }));
  else if (r.state === 'interrupted') line = T('dl2.interrupted');
  else if (r.state === 'done') line = size(r.total || r.received);
  else if (r.state === 'cancelled') line = T('dl2.cancelled');
  else { line = T('dl2.failedShort'); bad = true; }
  meta.textContent = [r.host, line].filter(Boolean).join(' · ');
  if (bad) meta.classList.add('bad');
  body.append(name, meta);
  if (r.state === 'progressing' || r.state === 'interrupted') {
    const bar = document.createElement('div'); bar.className = 'bar' + (r.total ? '' : ' wait');
    const fill = document.createElement('i'); fill.style.width = pct + '%'; bar.append(fill);
    body.append(bar);
  }
  if (r.state === 'done' && r.risky) { const w = document.createElement('div'); w.className = 'warnline'; w.textContent = T('dl2.risky'); body.append(w); }
  const acts = document.createElement('div'); acts.className = 'acts';
  const sug = document.createElement('div'); sug.className = 'sug'; sug.hidden = true;
  if (r.state === 'progressing') acts.append(button(r.paused ? T('dl2.resume') : T('dl2.pause'), r.paused ? 'resume' : 'pause', r.id), button(T('dl2.cancel'), 'cancel', r.id, true));
  else if (r.state === 'interrupted') acts.append(button(T('dl2.resume'), 'resume', r.id), button(T('dl2.cancel'), 'cancel', r.id, true));
  else {
    if (r.state === 'done') acts.append(button(T('dl2.open'), 'open', r.id), button(T('dl2.reveal'), 'reveal', r.id));
    if (r.state === 'done' && !r.risky && !r.private) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'quiet'; b.textContent = T('dl2.rename');
      b.addEventListener('click', async () => {
        b.disabled = true; sug.hidden = false; sug.textContent = T('dl2.renameWait');
        const n = await downloads.suggest(r.id);
        b.disabled = false;
        if (!n) { sug.textContent = T('dl2.renameNone'); return; }
        sug.replaceChildren();
        const t = document.createElement('span'); t.textContent = n; t.className = 'new';
        const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = T('dl2.renameApply');
        ok.addEventListener('click', async () => { if (!(await downloads.rename(r.id, n))) sug.textContent = T('dl2.renameFail'); });
        sug.append(t, ok);
      });
      acts.append(b);
    }
    acts.append(button(T('dl2.remove'), 'remove', r.id, true));
  }
  body.append(acts, sug);
  li.append(e, body);
  return li;
}

function render(list) {
  const ul = $('#list');
  ul.replaceChildren(...list.map(row));
  $('#empty').hidden = list.length > 0;
  $('#clear').hidden = !list.some((r) => r.state === 'done' || r.state === 'cancelled' || r.state === 'failed');
}

$('#clear').addEventListener('click', () => downloads.clear());
downloads.onUpdate(render);
downloads.list().then(render);
