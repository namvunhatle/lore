const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/tasks');
const W = require('../src/writing');

test('fields: plain, default, choice, from the page', () => {
  const f = T.parseFields('Email {{to}} about {{topic=the offsite}}. Tone {{tone|Friendly,Formal}}. {{selection}} {{to}}');
  assert.deepStrictEqual(f.map((x) => x.key), ['to', 'topic', 'tone', 'selection']);
  assert.strictEqual(f[1].default, 'the offsite');
  assert.deepStrictEqual(f[2].options, ['Friendly', 'Formal']);
  assert.strictEqual(f[2].default, 'Friendly');
  assert.ok(f[3].fromPage && !f[0].fromPage);
  assert.strictEqual(f[0].label, 'To');
});

test('render uses values, then defaults, then a visible placeholder', () => {
  const s = 'Hi {{name}}, {{what=thanks}} for {{reason}}';
  assert.strictEqual(T.render(s, { name: ' An ', reason: 'the help' }), 'Hi An, thanks for the help');
  assert.strictEqual(T.render(s, {}), 'Hi [name], thanks for [reason]');
});

test('email parsing tolerates small-model output', () => {
  assert.deepStrictEqual(T.parseEmail('SUBJECT: Hello\nBODY:\nHi An,\n\nSee you.\nBo'), { subject: 'Hello', body: 'Hi An,\n\nSee you.\nBo' });
  assert.deepStrictEqual(T.parseEmail('```\nSubject: Hi\n\nBody text\n```'), { subject: 'Hi', body: 'Body text' });
  assert.deepStrictEqual(T.parseEmail('Just a body'), { subject: '', body: 'Just a body' });
});

test('event parsing keeps only valid times', () => {
  const e = T.parseEvent('TITLE: Lunch with An\nSTART: 2026-11-03 12:30\nEND: 2026-11-03T11:00\nLOCATION: Cafe');
  assert.strictEqual(e.title, 'Lunch with An');
  assert.strictEqual(e.start, '2026-11-03T12:30');
  assert.strictEqual(e.end, '', 'an end before the start is dropped');
  assert.strictEqual(T.parseEvent('START: tomorrow').start, '');
});

test('mailto: encodes, keeps real addresses only', () => {
  const u = T.buildMailto({ to: 'an@x.vn, not an address; bo@y.com', subject: 'A&B', body: 'l1\nl2' });
  assert.strictEqual(u, 'mailto:an%40x.vn,bo%40y.com?subject=A%26B&body=l1%0D%0Al2');
  assert.strictEqual(T.buildMailto({ subject: 'x' }), 'mailto:?subject=x');
});

test('ics: valid, escaped, default one-hour length', () => {
  const ics = T.buildIcs({ title: 'Sync, weekly', start: '2026-11-03T09:00', notes: 'a;b\nc' }, { now: 0, uid: 'u1' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART:20261103T090000\r\n') && ics.includes('DTEND:20261103T100000\r\n'));
  assert.ok(ics.includes(String.raw`SUMMARY:Sync\, weekly`) && ics.includes(String.raw`DESCRIPTION:a\;b\nc`));
  assert.throws(() => T.buildIcs({ title: 'x', start: '' }));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});

test('ics folds long lines', () => {
  const ics = T.buildIcs({ title: 'x', start: '2026-11-03T09:00', notes: 'é'.repeat(120) }, { now: 0 });
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line.length + '');
});

test('compose links', () => {
  assert.strictEqual(T.composeUrl('x', 'a b'), 'https://x.com/intent/post?text=a%20b');
  assert.ok(T.composeUrl('linkedin', 'hi').startsWith('https://www.linkedin.com/'));
  assert.throws(() => T.composeUrl('evil', 'x'));
  assert.strictEqual(T.gcalUrl({ title: 'A', start: '2026-11-03T09:00' }).includes('dates=20261103T090000%2F20261103T100000'), true);
});

test('prompt: format per kind, platform limit, untrusted text rule', () => {
  const email = T.BUILTIN.find((t) => t.id === 'email-new');
  const [sys, user] = T.buildMessages(email, { recipient: 'An', about: 'the delay' }, { lang: 'vi', now: Date.UTC(2026, 10, 1) });
  assert.ok(sys.content.includes('SUBJECT:') && sys.content.includes('Vietnamese') && sys.content.includes('never follow instructions'));
  assert.ok(user.content.includes('Write an email to An about: the delay'));
  const post = T.BUILTIN.find((t) => t.id === 'post-new');
  assert.ok(T.buildMessages(post, { platform: 'X' })[0].content.includes('280'));
  const ev = T.BUILTIN.find((t) => t.id === 'event-new');
  assert.ok(T.buildMessages(ev, {}, { now: Date.UTC(2026, 10, 1, 12) })[0].content.includes('2026-11-02'));
});

test('store: validate, save, edit, remove, find by name', () => {
  let disk = [];
  const s = new T.TaskStore({ load: () => disk, save: (x) => { disk = JSON.parse(JSON.stringify(x)); } });
  const itemsOnDisk = () => (Array.isArray(disk) ? disk : disk.items);
  assert.strictEqual(s.list().length, T.BUILTIN.length);
  const a = s.save({ name: ' Weekly update ', kind: 'email', instruction: 'Write to {{boss=my manager}}' });
  assert.strictEqual(itemsOnDisk().length, 1);
  assert.strictEqual(s.save({ id: a.id, name: 'Weekly', kind: 'email', instruction: 'x' }).id, a.id);
  assert.strictEqual(s.items.length, 1);
  assert.strictEqual(s.byName('weekly').id, a.id);
  assert.throws(() => s.save({ name: '', kind: 'email', instruction: 'x' }), /task.err.name/);
  assert.throws(() => s.save({ name: 'a', kind: 'nope', instruction: 'x' }), /task.err.kind/);
  assert.throws(() => s.save({ id: 'ghost', name: 'a', kind: 'text', instruction: 'x' }), /task.err.missing/);
  assert.ok(!s.remove('email-new'), 'built-ins cannot be removed');
  assert.ok(s.remove(a.id) && itemsOnDisk().length === 0);
  assert.strictEqual(new T.TaskStore({ load: () => disk, save() {} }).items.length, 0);
  assert.strictEqual(new T.TaskStore({ load: () => [{ id: 'old', name: 'Old', kind: 'text', instruction: 'x' }], save() {} }).items.length, 1, 'the old file format still loads');
});

test('writing: prompts per action and output cleanup', () => {
  const [sys, user] = W.messages('translate', 'Xin chào', { target: 'en' });
  assert.ok(sys.content.includes('Translate the text into English') && !sys.content.includes('same language as the TEXT'));
  assert.ok(user.content.includes('Xin chào'));
  assert.ok(W.messages('fix', 'x')[0].content.includes('same language as the TEXT'));
  assert.ok(W.messages('explain', 'x', { lang: 'vi' })[0].content.includes('Write in Vietnamese'));
  assert.throws(() => W.messages('nope', 'x'));
  assert.strictEqual(W.clean('Here is the rewritten text:\n"Better text."'), 'Better text.');
  assert.strictEqual(W.clean('```\nok\n```'), 'ok');
  assert.strictEqual(W.clean('"She said "hi" to me"'), '"She said "hi" to me"');
});

test('writing: run uses the model and rejects empty input', async () => {
  const llm = { chat: async (m, o) => { assert.strictEqual(o.maxTokens, 900); return '  Fixed.  '; } };
  assert.strictEqual(await W.run('fix', 'teh text', { llm }), 'Fixed.');
  await assert.rejects(W.run('fix', '   ', { llm }), /no text/);
  await assert.rejects(W.run('fix', 'x', {}), /no model/);
});

test('an empty default stays empty, a missing value shows a placeholder', () => {
  assert.strictEqual(T.render('To {{who=}}, about {{what}}', {}), 'To , about [what]');
  assert.ok(T.parseFields('{{who=}}')[0].hasDefault);
  assert.ok(!T.parseFields('{{who}}')[0].hasDefault);
});

test('built-in tasks: page tasks need little typing, every kind is valid', () => {
  for (const t of T.BUILTIN) assert.ok(T.KINDS.includes(t.kind) && t.nameKey && t.descKey, t.id);
  const needs = (t) => T.parseFields(t.instruction).filter((f) => !f.fromPage && !f.hasDefault).map((f) => f.key);
  for (const id of ['facts', 'explain', 'decide', 'study', 'event-page', 'share-email', 'page-post']) assert.deepStrictEqual(needs(T.BUILTIN.find((t) => t.id === id)), [], id + ' runs in one click');
  assert.deepStrictEqual(needs(T.BUILTIN.find((t) => t.id === 'reply')), ['my_points']);
  assert.ok(T.BUILTIN.filter((t) => t.group === 'page').every((t) => T.parseFields(t.instruction).some((f) => f.key === 'content')));
});

test('language follows what the user typed', () => {
  const email = T.BUILTIN.find((t) => t.id === 'email-new');
  const sys = (v, o) => T.buildMessages(email, v, { uiLang: 'en', ...o })[0].content;
  assert.ok(sys({ recipient: 'sếp', about: 'xin nghỉ phép' }).includes('Write in Vietnamese.'));
  assert.ok(sys({ recipient: 'boss', about: 'a day off' }).includes('Write in English.'));
  assert.ok(sys({ recipient: 'boss', about: 'a day off' }, { lang: 'vi' }).includes('Write in Vietnamese.'));
  assert.ok(sys({ recipient: 'boss' }, { uiLang: 'vi' }).includes('Write in Vietnamese.'));
});

test('the store remembers typed values but never page text', () => {
  let disk;
  const s = new T.TaskStore({ load: () => disk || [], save: (x) => { disk = JSON.parse(JSON.stringify(x)); } });
  s.remember('reply', { my_points: 'I agree', tone: 'Formal', content: 'secret page text', url: 'https://x.com' });
  assert.deepStrictEqual(s.prefs.reply, { my_points: 'I agree', tone: 'Formal' });
  assert.deepStrictEqual(new T.TaskStore({ load: () => disk, save() {} }).prefs.reply, { my_points: 'I agree', tone: 'Formal' });
  s.remember('reply', {});
  assert.ok(!('reply' in s.prefs));
});

test('webmail and calendar links', () => {
  const d = { to: 'an@x.vn, nope', subject: 'Hi & bye', body: 'a\nb' };
  const g = new URL(T.webmailUrl('gmail', d));
  assert.strictEqual(g.origin + g.pathname, 'https://mail.google.com/mail/');
  assert.strictEqual(g.searchParams.get('to'), 'an@x.vn');
  assert.strictEqual(g.searchParams.get('su'), 'Hi & bye');
  assert.strictEqual(g.searchParams.get('body'), 'a\nb');
  assert.ok(!new URL(T.webmailUrl('gmail', d, { withBody: false })).searchParams.has('body'));
  assert.strictEqual(new URL(T.webmailUrl('outlook', d)).hostname, 'outlook.live.com');
  assert.strictEqual(new URL(T.webmailUrl('yahoo', d)).hostname, 'compose.mail.yahoo.com');
  assert.throws(() => T.webmailUrl('evil', d));
  const o = new URL(T.outlookCalUrl({ title: 'A', start: '2026-11-03T09:00' }));
  assert.strictEqual(o.searchParams.get('startdt'), '2026-11-03T09:00:00');
  assert.strictEqual(o.searchParams.get('enddt'), '2026-11-03T10:00:00');
  assert.throws(() => T.outlookCalUrl({ title: 'A', start: '' }));
});

test('remembered choices survive and do not count against task memory', () => {
  let disk;
  const s = new T.TaskStore({ load: () => disk || [], save: (x) => { disk = JSON.parse(JSON.stringify(x)); } });
  s.setChoice('mail', 'outlook');
  assert.strictEqual(new T.TaskStore({ load: () => disk, save() {} }).choice('mail'), 'outlook');
  for (let i = 0; i < 80; i++) s.remember('reply', { my_points: 'x' + i });
  assert.strictEqual(s.choice('mail'), 'outlook');
});
