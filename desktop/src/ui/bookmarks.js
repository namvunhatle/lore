const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('bm.title');

let folder; // undefined = all
let editing = 0;

function icon(b) {
  const d = document.createElement('div');
  d.className = 'ico';
  if (b.icon) { const i = document.createElement('img'); i.alt = ''; i.src = b.icon; d.append(i); } else d.textContent = (b.title || b.host || '?').trim().charAt(0);
  return d;
}

function row(b) {
  const li = document.createElement('li');
  li.append(icon(b));
  if (editing === b.id) {
    const f = document.createElement('form'); f.className = 'edit';
    const t = document.createElement('input'); t.value = b.title; t.setAttribute('aria-label', T('bm.name'));
    const nt = document.createElement('input'); nt.value = b.note || ''; nt.placeholder = T('bm.notePh'); nt.setAttribute('aria-label', T('bm.note')); nt.maxLength = 240;
    const g = document.createElement('input'); g.value = b.folder; g.placeholder = T('bm.folderPh'); g.setAttribute('aria-label', T('bm.folder')); g.maxLength = 60;
    const r = document.createElement('div'); r.className = 'row';
    const ok = document.createElement('button'); ok.type = 'submit'; ok.className = 'btn pri'; ok.textContent = T('bm.save');
    const no = document.createElement('button'); no.type = 'button'; no.className = 'btn'; no.textContent = T('set.priv.cancel');
    no.addEventListener('click', () => { editing = 0; refresh(); });
    r.append(ok, no);
    f.append(t, nt, g, r);
    f.addEventListener('submit', async (e) => { e.preventDefault(); await bookmarks.update(b.id, { title: t.value, folder: g.value, note: nt.value }); editing = 0; refresh(); });
    li.append(f);
    setTimeout(() => t.focus(), 0);
    return li;
  }
  const body = document.createElement('div'); body.className = 'body';
  const t = document.createElement('button'); t.type = 'button'; t.className = 't'; t.textContent = b.title; t.addEventListener('click', () => bookmarks.go(b.id));
  const u = document.createElement('div'); u.className = 'u'; u.textContent = (b.folder ? b.folder + ' · ' : '') + b.host;
  body.append(t, u);
  if (b.note) { const n = document.createElement('div'); n.className = 'note2'; n.textContent = b.note; body.append(n); }
  const acts = document.createElement('div'); acts.className = 'acts';
  const e = document.createElement('button'); e.type = 'button'; e.textContent = T('bm.editBtn'); e.addEventListener('click', () => { editing = b.id; refresh(); });
  const d = document.createElement('button'); d.type = 'button'; d.className = 'del'; d.textContent = T('dl2.remove'); d.addEventListener('click', async () => { await bookmarks.remove(b.id); refresh(); });
  acts.append(e, d);
  li.append(body, acts);
  return li;
}

function chips(folders) {
  const box = $('#folders');
  box.replaceChildren();
  box.hidden = !folders.length;
  for (const [val, label] of [[undefined, T('bm.all')], ...folders.map((f) => [f, f])]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = label;
    b.setAttribute('aria-pressed', String(val === folder));
    b.addEventListener('click', () => { folder = val; refresh(); });
    box.append(b);
  }
}

async function refresh() {
  const r = await bookmarks.list({ q: $('#q').value, folder });
  if (folder !== undefined && !r.folders.includes(folder)) folder = undefined;
  chips(r.folders);
  $('#list').replaceChildren(...r.items.map(row));
  $('#empty').hidden = r.items.length > 0;
  $('#empty-t').textContent = r.total ? T('bm.noMatch') : T('bm.empty');
  $('#export').disabled = !r.total;
  $('#openall').hidden = !(folder !== undefined && r.items.length > 1);
  $('#openall').textContent = T('bm.openAll', { n: r.items.length });
  $('#org').disabled = !r.total;
}

$('#q').addEventListener('input', refresh);
$('#export').addEventListener('click', () => bookmarks.export());
$('#openall').addEventListener('click', () => bookmarks.openAll(folder));
$('#org').addEventListener('click', () => bookmarks.organize());
bookmarks.onChanged(refresh);
refresh();
