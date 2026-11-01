// Page text extraction: the article is found in a noisy page, and ads and navigation are left out.
const { app, BrowserWindow } = require('electron');
// Own data folder, so tests never collide with a running Lore.
app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'lore-e2e-')));
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractionScript } = require('../src/reader');
const pageai = require('../src/pageai');

const para = (s) => `<p>${s} ${'Đây là một câu dài để bài viết đủ nội dung cho bộ đọc nhận ra. '.repeat(4)}</p>`;
const ARTICLE = `<!doctype html><html><head><title>Lãi suất giữ nguyên</title></head><body>
<nav>Trang chủ | Tin tức | Quảng cáo</nav><div class="ad">MUA NGAY GIẢM GIÁ</div>
<article><h1>Lãi suất giữ nguyên</h1>${para('Ngân hàng Nhà nước quyết định giữ nguyên lãi suất điều hành.')}${para('Các chuyên gia dự báo lãi suất huy động sẽ ổn định trong quý tới.')}${para('Thị trường phản ứng tích cực với thông tin này.')}
<p>Click <a href="javascript:alert(1)">here</a> <img src="x" onerror="alert(2)"><script>alert(3)</script><iframe src="about:blank"></iframe></p></article>
<footer>© 2026 Báo mẫu</footer></body></html>`;

app.whenReady().then(async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lore-reader-')), 'article.html');
  fs.writeFileSync(file, ARTICLE);
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  let code = 0;
  try {
    await win.loadFile(file);
    const a = await win.webContents.executeJavaScriptInIsolatedWorld(1003, [{ code: extractionScript() }]);
    assert.ok(a && a.content, 'article extracted');
    assert.match(a.title, /Lãi suất giữ nguyên/);
    assert.match(a.text, /giữ nguyên lãi suất điều hành/);
    assert.ok(!/MUA NGAY|Quảng cáo/.test(a.text), 'ads and navigation left out');
    const summary = pageai.extractiveSummary(a.text, 2);
    assert.ok(summary.length >= 1 && summary.every((s) => a.text.includes(s.slice(0, 30))), 'summary sentences come from the page');
    const hits = pageai.bestPassages(a.text, 'lãi suất huy động quý tới');
    assert.match(hits[0], /huy động/);

    console.log('extract ok');
  } catch (e) { console.error('extract FAILED', e); code = 1; }
  app.exit(code);
});
