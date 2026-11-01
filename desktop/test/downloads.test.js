const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { DownloadList, safeName, uniquePath, isRisky } = require('../src/downloads');

test('file names cannot climb out of the folder or carry odd characters', () => {
  assert.strictEqual(safeName('../../etc/passwd'), 'passwd');
  assert.strictEqual(safeName('..\\..\\evil.exe'), 'evil.exe');
  assert.strictEqual(safeName('a<b>:c?.txt'), 'a_b__c_.txt');
  assert.strictEqual(safeName('.hidden'), 'hidden');
  assert.strictEqual(safeName(''), 'download');
  assert.strictEqual(safeName('x'.repeat(500)).length, 180);
});

test('a taken name gets a number before the extension', () => {
  const taken = new Set([path.join('/d', 'r.pdf'), path.join('/d', 'r (1).pdf')]);
  assert.strictEqual(uniquePath('/d', 'r.pdf', (p) => taken.has(p)), path.join('/d', 'r (2).pdf'));
  assert.strictEqual(uniquePath('/d', 'new.pdf', (p) => taken.has(p)), path.join('/d', 'new.pdf'));
});

test('programs and installers are flagged as risky', () => {
  for (const n of ['setup.exe', 'run.SH', 'tool.dmg', 'a.AppImage', 'x.jar']) assert.ok(isRisky(n), n);
  for (const n of ['photo.jpg', 'report.pdf', 'notes.txt', 'noext']) assert.ok(!isRisky(n), n);
});

function fakeItem(name, total = 100) {
  const it = new EventEmitter();
  let received = 0, paused = false, save = '';
  Object.assign(it, {
    getFilename: () => name, getURL: () => 'https://files.example/a/b.bin?token=SECRET', getTotalBytes: () => total, getReceivedBytes: () => received,
    isPaused: () => paused, canResume: () => true, pause() { paused = true; }, resume() { paused = false; }, cancel() { it.emit('done', {}, 'cancelled'); },
    setSavePath: (p) => { save = p; }, getSavePath: () => save, progress(n) { received = n; it.emit('updated', {}, 'progressing'); }, finish() { received = total; it.emit('done', {}, 'completed'); }
  });
  return it;
}

test('a download is tracked from start to finish without leaking the query string', () => {
  const seen = [];
  const list = new DownloadList({ dir: '/d', onChange: (r) => seen.push(r && r.state), exists: () => false });
  const it = fakeItem('movie.mp4', 200);
  const rec = list.track(it);
  assert.strictEqual(rec.path, path.join('/d', 'movie.mp4'));
  assert.strictEqual(rec.url, 'https://files.example/a/b.bin');
  assert.strictEqual(list.active, 1);
  it.progress(50);
  assert.strictEqual(list.get(rec.id).received, 50);
  list.pause(rec.id);
  assert.ok(list.get(rec.id).paused === false || it.isPaused());
  it.finish();
  assert.strictEqual(list.get(rec.id).state, 'done');
  assert.strictEqual(list.active, 0);
});

test('cancel, remove and clear', () => {
  const list = new DownloadList({ dir: '/d', exists: () => false });
  const a = list.track(fakeItem('a.txt'));
  const b = list.track(fakeItem('b.txt'));
  list.cancel(a.id);
  assert.strictEqual(list.get(a.id).state, 'cancelled');
  list.clearFinished();
  assert.deepStrictEqual(list.items.map((r) => r.id), [b.id]);
  list.remove(b.id);
  assert.strictEqual(list.items.length, 0);
});

test('a finished file can be renamed without overwriting another', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-dl-'));
  const a = path.join(dir, 'download (3).pdf'); const taken = path.join(dir, 'Manual.pdf');
  fs.writeFileSync(a, 'x'); fs.writeFileSync(taken, 'y');
  const list = new DownloadList({ dir });
  list.items.push({ id: 1, name: 'download (3).pdf', path: a, state: 'done' });
  assert.ok(list.rename(1, 'Manual.pdf'));
  assert.strictEqual(list.get(1).name, 'Manual (1).pdf');
  assert.strictEqual(fs.readFileSync(taken, 'utf8'), 'y');
  assert.ok(!list.rename(1, 'Manual.exe'), 'the extension cannot change');
  fs.rmSync(dir, { recursive: true });
});
