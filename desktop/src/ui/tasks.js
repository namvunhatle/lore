const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'vi' ? 'vi' : 'en';
const T = (k, v) => LORE_I18N.t(lang, k, v);
LORE_I18N.apply(lang);
document.title = T('task.title');
const $ = (s) => document.querySelector(s);
const main = $('#main');

// Tiny DOM helper: h('div', { class: 'x' }, child, 'text'). Text is always set as text, never as HTML.
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

const ICON = {
  email: '<path d="M4 6h16v12H4zM4 7l8 6 8-6"/>',
  event: '<path d="M5 6h14v14H5zM5 10h14M9 3v4M15 3v4"/>',
  post: '<path d="M4 5h16v11H9l-5 4z"/>',
  text: '<path d="M5 6h14M5 12h14M5 18h9"/>'
};
function icon(kind) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = ICON[kind] || ICON.text; // fixed strings above, no user data
  const w = h('span', { class: 'ic' });
  w.append(s);
  return w;
}

// ---- State -----------------------------------------------------------------------------------------------------
let data = { tasks: [], prefs: {}, ready: false };
let sel = null; // task id, 'quick' or 'edit'
let quick = null; // { kind, request, reply, auto }
let editing = null;
let auto = false; // run as soon as the page is read (set when a button elsewhere asked for this task)
const memo = {}; // what the user typed, per task, kept while the window is open

const nameOf = (t) => (t.nameKey ? T(t.nameKey) : t.name);
const descOf = (t) => (t.descKey ? T(t.descKey) : '');
const FIELD = /\{\{\s*([A-Za-z_]\w*)\s*(?:=([^|}]*))?(?:\|([^}]*))?\}\}/g;
// Fields that hold a word or two get a single line; the rest get a small text box.
const SHORT = /^(recipient|to|name|title|subject|question|goal|topic|company|role|date|time|place|location)$/i;
const PAGE_KEYS = ['content', 'selection', 'page', 'url', 'title'];
function fieldsOf(instruction) {
  const seen = new Map();
  for (const m of String(instruction).matchAll(FIELD)) {
    if (seen.has(m[1])) continue;
    const options = m[3] ? m[3].split(',').map((x) => x.trim()).filter(Boolean) : null;
    seen.set(m[1], {
      key: m[1], label: m[1].replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), fromPage: PAGE_KEYS.includes(m[1]),
      options, hasDefault: m[2] !== undefined || !!(options && options.length), default: m[2] !== undefined ? m[2].trim() : options && options.length ? options[0] : ''
    });
  }
  return [...seen.values()];
}

// ---- Launcher --------------------------------------------------------------------------------------------------
const SPARK = '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>';
let filter = '';

function taskCard(t) {
  return h('button', { class: 'card', type: 'button', onclick: () => open(t.id) }, icon(t.kind), h('span', null, h('span', { class: 't' }, nameOf(t)), descOf(t) && h('span', { class: 'd' }, descOf(t))));
}

function homeView() {
  const input = h('input', { type: 'text', placeholder: T('task.ask.ph'), autocomplete: 'off', spellcheck: 'false', 'aria-label': T('task.ask.ph') });
  input.value = filter;
  const grid = h('div');
  const paint = () => {
    filter = input.value;
    const q = filter.trim().toLowerCase();
    grid.replaceChildren();
    const match = (t) => !q || (nameOf(t) + ' ' + descOf(t)).toLowerCase().includes(q);
    if (q) {
      const now = h('button', { class: 'card now', type: 'button', onclick: () => startQuick(input.value.trim()) },
        h('span', { class: 'ic' }), h('span', null, h('span', { class: 't' }, T('task.ask.go')), h('span', { class: 'd' }, input.value.trim())));
      now.querySelector('.ic').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPARK}</svg>`; // fixed string
      grid.append(h('div', { class: 'cards' }, now));
    }
    let any = false;
    for (const [title, items, empty] of [[T('task.group.page'), data.tasks.filter((t) => t.group === 'page' && match(t))], [T('task.group.write'), data.tasks.filter((t) => t.group === 'write' && match(t))], [T('task.mine'), data.tasks.filter((t) => !t.builtin && match(t)), q ? '' : T('task.empty')]]) {
      if (!items.length && !(empty)) continue;
      grid.append(h('p', { class: 'group' }, title));
      if (!items.length) grid.append(h('p', { class: 'none' }, empty));
      else { any = true; grid.append(h('div', { class: 'cards' }, items.map(taskCard))); }
    }
    if (q && !any) grid.append(h('p', { class: 'none gap' }, T('task.nomatch')));
  };
  input.addEventListener('input', paint);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { e.preventDefault(); startQuick(input.value.trim()); } });
  paint();
  const box = h('div', { class: 'ask' }, input, h('kbd', null, '↵'));
  box.prepend((() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = SPARK; return s; })());
  setTimeout(() => input.focus(), 30);
  return h('div', { class: 'view' }, box, grid);
}

async function startQuick(text) {
  const r = await tasks.classify(text);
  quick = { kind: r.kind, request: text, reply: r.reply, auto: true };
  delete memo.quick;
  filter = '';
  sel = 'quick';
  show();
}

function setHeader() {
  const home = !sel;
  $('#back').hidden = home;
  const t = data.tasks.find((x) => x.id === sel);
  $('#title').textContent = home ? T('task.title') : sel === 'quick' ? T('task.quick') : sel === 'edit' ? (editing && editing.id ? T('task.edit') : T('task.editor.new')) : t ? nameOf(t) : T('task.title');
}

function back() {
  if (sel === 'edit' && editing && editing.id) { sel = editing.id; show(); return; }
  sel = null;
  quick = null;
  show();
}

async function refresh() {
  data = await tasks.list();
}

function open(id, { run = false } = {}) {
  sel = id;
  quick = null;
  auto = run;
  show();
}

function show() {
  main.replaceChildren();
  setHeader();
  const t = data.tasks.find((x) => x.id === sel);
  if (sel === 'quick') main.append(runView({ id: 'quick', kind: quick.kind, name: T('task.quick'), instruction: quick.reply ? 'Write a reply to the message below, as I describe: {{request}}\n\nMESSAGE:\n{{content}}' : '{{request}}', quick }));
  else if (sel === 'edit') main.append(editView(editing));
  else if (t) main.append(runView(t));
  else { sel = null; setHeader(); main.append(homeView()); }
  main.scrollTop = 0;
}

// ---- Run view --------------------------------------------------------------------------------------------------
function runView(task) {
  const fields = fieldsOf(task.instruction);
  const userFields = fields.filter((f) => !f.fromPage && !(task.id === 'quick' && f.key === 'request'));
  const usesContent = fields.some((f) => ['content', 'selection', 'page'].includes(f.key));
  const saved = data.prefs[task.id] || {};
  const vals = (memo[task.id] = memo[task.id] || {});
  if (task.quick && vals.request === undefined) vals.request = task.quick.request;
  for (const f of userFields) if (vals[f.key] === undefined) vals[f.key] = saved[f.key] !== undefined ? saved[f.key] : f.default;

  const inputs = {};
  const result = h('div');
  const status = h('span', { class: 'status', role: 'status' });
  const using = h('div', { class: 'using' });
  const ctx = { selection: '', page: '', content: '', url: '', title: '', source: '', loaded: !fields.some((f) => f.fromPage) };
  let editBox = null;
  let gen;

  const form = h('form', { onsubmit: (e) => { e.preventDefault(); gen.click(); } });
  if (task.id === 'quick') {
    inputs.request = h('textarea', { rows: 3, placeholder: T('task.quick.ph') });
    inputs.request.value = vals.request || '';
    form.append(h('label', { class: 'f' }, h('span', null, T('task.quick.label')), inputs.request));
  }
  form.append(using);
  for (const f of userFields) {
    const el = f.options ? h('select', null, f.options.map((o) => h('option', { value: o }, o))) : SHORT.test(f.key) ? h('input', { type: 'text' }) : h('textarea', { rows: 2 });
    el.value = vals[f.key];
    inputs[f.key] = el;
    form.append(h('label', { class: 'f' }, h('span', null, f.label + (f.hasDefault ? '' : ' *')), el));
  }
  const langSel = h('select', null, h('option', { value: 'auto' }, T('task.lang.auto')), ['en', 'vi'].map((c) => h('option', { value: c }, c === 'en' ? 'English' : 'Tiếng Việt')));
  langSel.value = vals._lang || 'auto';
  form.append(h('details', { class: 'opts' }, h('summary', null, T('task.options')), h('label', { class: 'f' }, h('span', null, T('task.lang')), langSel)));

  const needsContent = () => usesContent && !ctx.content && !(editBox && editBox.value.trim());
  const collect = () => {
    for (const [k, el] of Object.entries(inputs)) vals[k] = el.value;
    vals._lang = langSel.value;
    const out = { ...vals };
    out.content = editBox ? editBox.value : ctx.content;
    out.selection = ctx.selection; out.page = ctx.page; out.url = ctx.url; out.title = ctx.title;
    return out;
  };

  function paintUsing() {
    const wasOpen = editBox && !editBox.hidden;
    using.replaceChildren();
    if (!usesContent) return;
    if (!ctx.loaded) return using.append(h('p', { class: 'chip-using' }, h('i', { class: 'spin' }), T('task.reading')));
    if (!ctx.content) return using.append(h('p', { class: 'warnbox' }, T('task.needPage')));
    const label = ctx.source === 'selection' ? T('task.using.sel', { n: ctx.content.length }) : T('task.using.page', { title: ctx.title || ctx.url });
    if (!editBox) { editBox = h('textarea', { rows: 6, class: 'sent' }); editBox.value = ctx.content; editBox.hidden = true; }
    editBox.hidden = !wasOpen;
    const toggle = h('button', { class: 'link', type: 'button', onclick: () => { editBox.hidden = !editBox.hidden; } }, T('task.edit.sent'));
    using.append(h('p', { class: 'chip-using' }, h('b', null, label), ' ', toggle), editBox);
  }

  async function loadContext() {
    if (!fields.some((f) => f.fromPage)) return;
    try { Object.assign(ctx, await tasks.context(usesContent)); } catch { /* the page may be gone */ }
    ctx.loaded = true;
    paintUsing();
    maybeAuto();
  }

  function missing() {
    if (task.id === 'quick' && !String(inputs.request.value).trim()) return inputs.request;
    for (const f of userFields) if (!f.hasDefault && !String(inputs[f.key].value).trim()) return inputs[f.key];
    return null;
  }
  function maybeAuto() {
    if (!auto || !data.ready || !ctx.loaded || missing() || needsContent()) return;
    auto = false;
    gen.click();
  }

  gen = h('button', { class: 'btn acc', type: 'button', onclick: async () => {
    const bad = missing();
    if (bad) { bad.focus(); status.className = 'status err'; status.textContent = T('task.required'); return; }
    if (needsContent()) { status.className = 'status err'; status.textContent = T('task.needPage'); return; }
    const values = collect();
    gen.disabled = true;
    result.replaceChildren();
    status.className = 'status';
    status.replaceChildren(h('i', { class: 'spin' }), T('task.working'));
    const r = await tasks.run({ id: task.id, kind: task.kind, reply: !!(task.quick && task.quick.reply), values, lang: values._lang });
    gen.disabled = false;
    status.replaceChildren();
    if (r.error) { status.className = 'status err'; status.textContent = T(r.error) === r.error ? T('task.err') : T(r.error); if (r.error === 'task.noModel') result.append(noModel()); return; }
    gen.textContent = T('task.regen');
    result.replaceChildren(resultView(task, r, values));
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } }, T('task.generate'));
  form.append(h('div', { class: 'bar' }, gen, status));

  const mine = !task.builtin && task.id !== 'quick';
  const head = h('div', { class: 'top2' },
    icon(task.kind),
    h('h2', null, nameOf(task)),
    h('div', { class: 'links' },
      mine && h('button', { class: 'link', type: 'button', onclick: () => startEdit(task) }, T('task.edit')),
      task.id !== 'quick' && h('button', { class: 'link', type: 'button', onclick: () => startEdit({ ...task, id: '', builtin: false, name: nameOf(task) + ' 2' }) }, T('task.dup')),
      mine && h('button', { class: 'link del', type: 'button', onclick: async () => { if (confirm(T('task.delete.q', { n: nameOf(task) }))) { await tasks.remove(task.id); sel = null; await refresh(); show(); } } }, T('task.delete'))));

  const view = h('div', { class: 'view' }, head, h('p', { class: 'lead' }, descOf(task) || (task.id === 'quick' ? T('task.quick.d') : '')), !data.ready && noModel(), form, result);
  form.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); gen.click(); } });
  setTimeout(() => { const first = inputs.request || (userFields[0] && inputs[userFields[0].key]); if (first && !auto && !(task.quick && task.quick.auto)) first.focus(); }, 60);
  paintUsing();
  if (task.quick && task.quick.auto) { auto = true; task.quick.auto = false; }
  loadContext();
  if (!fields.some((f) => f.fromPage)) setTimeout(maybeAuto, 30);
  return view;
}

function noModel() {
  return h('p', { class: 'warnbox' }, T('task.noModel'), h('button', { type: 'button', onclick: () => tasks.settings() }, T('task.openSettings')));
}

// ---- Result view -----------------------------------------------------------------------------------------------
function flash(text) {
  const p = h('div', { class: 'pop', role: 'status' }, text);
  document.body.append(p);
  setTimeout(() => p.remove(), 2200);
}
const act = async (req) => {
  const r = await tasks.act(req);
  if (r && r.error) flash(T(r.error) === r.error ? T('task.err') : T(r.error));
  else if (r && r.ok && r.where) {
    flash(T(r.where === 'lore' ? (r.copied ? 'act.openedCopied' : 'act.opened') : 'act.openedApp'));
    if (req.provider) { data.prefs._ui = { ...(data.prefs._ui || {}), [req.type === 'mail' ? 'mail' : 'cal']: req.provider }; }
  }
  return r;
};
// "Open with" row: a remembered choice of service next to the main button.
function openWith(kind, options, label, onGo) {
  const sel = h('select', null, options.map(([v, t]) => h('option', { value: v }, t)));
  sel.value = (data.prefs._ui && data.prefs._ui[kind]) || options[0][0];
  return h('div', { class: 'with' },
    h('div', { class: 'wsel' }, h('span', null, T('act.openwith')), sel),
    h('button', { class: 'btn acc', type: 'button', onclick: () => onGo(sel.value) }, label));
}
const copy = (text) => act({ type: 'copy', text }).then((r) => { if (!r || !r.error) flash(T('act.copied')); });

function resultView(task, r, values) {
  const box = h('div', { class: 'res' }, h('h3', null, T('task.draft')));
  const out = r.result;
  const saveBtn = task.id === 'quick' && h('button', { class: 'btn', type: 'button', onclick: () => startEdit({ id: '', name: String(values.request).slice(0, 40), kind: task.kind, instruction: String(values.request) }) }, T('task.save'));
  if (task.kind === 'email') {
    const to = h('input', { type: 'text', placeholder: 'name@example.com' });
    const m = /[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+/.exec(String(values.recipient || ''));
    to.value = m ? m[0] : '';
    const subject = h('input', { type: 'text' }); subject.value = out.subject;
    const body = h('textarea', { class: 'big', rows: 10 }); body.value = out.body;
    box.append(h('label', { class: 'f' }, h('span', null, T('res.to')), to), h('label', { class: 'f' }, h('span', null, T('res.subject')), subject), h('label', { class: 'f' }, h('span', null, T('res.body')), body),
      openWith('mail', [['gmail', 'Gmail'], ['outlook', 'Outlook'], ['yahoo', 'Yahoo Mail'], ['app', T('act.mailapp')]], T('act.draft'), (provider) => act({ type: 'mail', provider, to: to.value, subject: subject.value, body: body.value })),
      h('div', { class: 'acts' },
        h('button', { class: 'btn', type: 'button', onclick: () => copy((subject.value ? subject.value + '\n\n' : '') + body.value) }, T('act.copy')), saveBtn),
      h('p', { class: 'note' }, T('act.note.mail')));
  } else if (task.kind === 'event') {
    const title = h('input', { type: 'text' }); title.value = out.title;
    const start = h('input', { type: 'datetime-local' }); start.value = out.start;
    const end = h('input', { type: 'datetime-local' }); end.value = out.end;
    const where = h('input', { type: 'text' }); where.value = out.location;
    const notes = h('textarea', { rows: 3 }); notes.value = out.notes;
    const ev = () => ({ title: title.value, start: start.value, end: end.value, location: where.value, notes: notes.value });
    const need = () => { if (!start.value) { start.focus(); flash(T('res.needStart')); return false; } return true; };
    box.append(h('label', { class: 'f' }, h('span', null, T('res.title')), title),
      h('div', { class: 'row' }, h('label', { class: 'f' }, h('span', null, T('res.start')), start), h('label', { class: 'f' }, h('span', null, T('res.end')), end)),
      h('label', { class: 'f' }, h('span', null, T('res.where')), where), h('label', { class: 'f' }, h('span', null, T('res.notes')), notes),
      openWith('cal', [['google', 'Google Calendar'], ['outlook', 'Outlook Calendar'], ['ics', T('act.ics')]], T('act.addcal'), (provider) => need() && act({ type: 'cal', provider, event: ev() })),
      h('div', { class: 'acts' }, saveBtn),
      h('p', { class: 'note' }, out.start ? T('act.note.event') : T('res.noStart')));
  } else if (task.kind === 'post') {
    const text = h('textarea', { class: 'big', rows: 8 }); text.value = out.text;
    const count = h('div', { class: 'count' });
    const upd = () => { count.textContent = T('act.chars', { n: text.value.length, max: r.max }); count.classList.toggle('over', text.value.length > r.max); };
    text.addEventListener('input', upd); upd();
    const go = (p) => act({ type: 'compose', platform: p, text: text.value });
    box.append(h('label', { class: 'f' }, h('span', null, T('res.post')), text), count,
      h('div', { class: 'acts' },
        h('button', { class: 'btn acc', type: 'button', onclick: () => go(r.platform) }, T('act.open.' + r.platform)),
        h('button', { class: 'btn', type: 'button', onclick: () => copy(text.value) }, T('act.copy')), saveBtn),
      h('p', { class: 'note' }, T('act.note.post')));
  } else {
    const text = h('textarea', { class: 'big', rows: 10 }); text.value = out.text;
    box.append(h('label', { class: 'f' }, h('span', null, T('res.text')), text), h('div', { class: 'acts' }, h('button', { class: 'btn acc', type: 'button', onclick: () => copy(text.value) }, T('act.copy')), saveBtn));
  }
  if (r.remote) box.append(h('p', { class: 'note' }, T('task.sentTo', { host: r.remote })));
  return box;
}

// ---- Editor ----------------------------------------------------------------------------------------------------
function startEdit(t) { editing = t; sel = 'edit'; show(); }

function editView(t) {
  const name = h('input', { type: 'text', maxlength: 60, placeholder: T('task.name.ph') }); name.value = t.name || '';
  const kind = h('select', null, ['email', 'event', 'post', 'text'].map((k) => h('option', { value: k }, T('task.kind.' + k)))); kind.value = t.kind || 'email';
  const instr = h('textarea', { rows: 8, placeholder: T('task.instr.ph') }); instr.value = t.instruction || '';
  const chips = h('div', { class: 'chips' });
  const status = h('span', { class: 'status', role: 'status' });
  const upd = () => {
    chips.replaceChildren();
    const f = fieldsOf(instr.value);
    if (!f.length) return chips.append(h('span', { class: 'hint' }, T('task.fields.none')));
    for (const x of f) chips.append(h('span', { class: 'chip' }, x.fromPage ? T('task.f.' + x.key) : x.label + (x.options ? ' ▾' : '')));
  };
  instr.addEventListener('input', upd); upd();
  // Insert a field at the cursor so nobody has to remember the {{ }} syntax.
  const insert = (text, select) => {
    const a = instr.selectionStart, b = instr.selectionEnd;
    instr.setRangeText(text, a, b, 'end');
    if (select) instr.setSelectionRange(a + 2, a + 2 + select.length);
    instr.focus();
    upd();
  };
  const save = h('button', { class: 'btn acc', type: 'button', onclick: async () => {
    const r = await tasks.save({ id: t.id || undefined, name: name.value, kind: kind.value, instruction: instr.value });
    if (r.error) { status.className = 'status err'; status.textContent = T(r.error); return; }
    await refresh();
    delete memo[r.task.id];
    open(r.task.id);
    flash(T('task.saved'));
  } }, T('task.saveBtn'));
  return h('div', { class: 'view' },
    h('label', { class: 'f' }, h('span', null, T('task.name')), name),
    h('label', { class: 'f' }, h('span', null, T('task.type')), kind),
    h('label', { class: 'f' }, h('span', null, T('task.instr')), instr),
    h('div', { class: 'insert' },
      h('button', { class: 'chip add', type: 'button', onclick: () => insert('{{detail}}', 'detail') }, '+ ' + T('task.add.ask')),
      h('button', { class: 'chip add', type: 'button', onclick: () => insert('{{content}}') }, '+ ' + T('task.add.content')),
      h('button', { class: 'chip add', type: 'button', onclick: () => insert('{{url}}') }, '+ ' + T('task.add.url'))),
    h('p', { class: 'hint' }, T('task.instr.hint')),
    h('div', { class: 'f' }, h('span', null, T('task.fields')), chips),
    h('div', { class: 'bar' }, save, h('button', { class: 'btn', type: 'button', onclick: back }, T('task.cancel')), status));
}

// ---- Boot ------------------------------------------------------------------------------------------------------
$('#new').addEventListener('click', () => startEdit({ id: '', name: '', kind: 'email', instruction: '' }));
$('#back').addEventListener('click', back);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sel && !e.defaultPrevented && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) back(); });

function openRequest(req) {
  if (!req) return;
  if (req.quick) { quick = { kind: req.quick.kind, request: req.quick.request, reply: !!req.quick.reply, auto: !!req.quick.request }; delete memo.quick; sel = 'quick'; show(); }
  else if (req.select) open(req.select, { run: !!req.auto });
}

tasks.onOpen(async (req) => { await refresh(); openRequest(req); });
refresh().then(() => {
  const q = params.get('quick');
  if (q) openRequest({ quick: { kind: params.get('kind') || 'text', request: q, reply: params.get('reply') === '1' } });
  else if (params.get('select')) openRequest({ select: params.get('select'), auto: params.get('auto') === '1' });
  else show();
});
