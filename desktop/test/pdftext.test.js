const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pdf = require('../src/pdftext');

test('text is read page by page and marked with page numbers', async () => {
  const r = await pdf.extract(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.pdf')));
  assert.strictEqual(r.total, 2);
  assert.match(r.pages[0], /warranty lasts twenty four months/);
  assert.match(r.pages[1], /Returns are accepted/);
  const t = pdf.withPages(r.pages);
  assert.match(t, /\(page 1\) Product manual/);
  assert.match(t, /\(page 2\) Returns/);
});

test('files that are not PDFs or are too big are refused', async () => {
  await assert.rejects(pdf.extract(Buffer.from('not a pdf at all')));
  await assert.rejects(pdf.extract(Buffer.alloc(0)), /pdf.size/);
});

test('PDF addresses are recognised by their path', () => {
  assert.ok(pdf.isPdfUrl('https://a.example/files/manual.PDF?x=1'));
  assert.ok(!pdf.isPdfUrl('https://a.example/pdf'));
});
