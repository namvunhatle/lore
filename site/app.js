// Landing page behaviour: language switch, the live demo, a light reveal on scroll and the download buttons.
// No tracking and no third-party scripts. The only request is to GitHub's public releases API.
(() => {
  const repo = (window.LORE && window.LORE.repo) || 'tevo-web/lore';
  const gh = 'https://github.com/' + repo;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Repository links ---------------------------------------------------------------------------------------
  for (const a of $$('[data-repo]')) a.href = gh;
  for (const a of $$('[data-repo-path]')) a.href = gh + '/' + a.dataset.repoPath;
  for (const c of $$('pre code')) c.textContent = c.textContent.replace(/github\.com\/[\w.-]+\/[\w.-]+\.git/, 'github.com/' + repo + '.git').replace(/cd [\w.-]+\/desktop/, 'cd ' + repo.split('/')[1] + '/desktop');

  // ---- Words in two languages ---------------------------------------------------------------------------------
  const VI = {
    'skip': 'Bỏ qua, tới nội dung', 'nav.features': 'Một ngày cùng Lore', 'nav.privacy': 'Riêng tư', 'nav.download': 'Tải về', 'nav.faq': 'Hỏi đáp',
    'hero.eyebrow': 'Miễn phí · Mã nguồn mở · MIT', 'hero.h1': '<span>Trình duyệt nhớ bạn,</span> <span>và chỉ mình bạn.</span>',
    'hero.lead': 'Nhớ bài báo bạn đọc tuần trước chứ? Lore nhớ. Và chỉ giữ ký ức đó trên máy của bạn, không ở đâu khác.',
    'cta.download': 'Tải Lore', 'cta.github': 'Xem trên GitHub', 'cta.note': 'macOS, Windows và Linux. Bản đầu tiên, chưa ký số.',
    'demo.note': 'Minh họa những gì Lore làm.',
    'trust.1.b': 'Không cần tài khoản', 'trust.1.t': 'Mở lên là dùng', 'trust.2.b': 'Không telemetry', 'trust.2.t': 'Không gửi gì về đâu cả',
    'trust.3.b': 'AI do bạn chọn', 'trust.3.t': 'Trên máy, khóa của bạn, hoặc tắt', 'trust.4.b': 'Giấy phép MIT', 'trust.4.t': 'Đọc và sửa thoải mái',
    'st.h': 'Một ngày bình thường.', 'st.p': 'Đây là chỗ của Lore trong đó.',
    'f1.eyebrow': '7:40 sáng', 'f1.h': 'Bạn thắc mắc một điều. Cứ hỏi thôi.', 'f1.p': 'Trên tàu, bạn gõ một câu hỏi vào thanh duy nhất, không phải một địa chỉ. Lore trả lời trong một hai dòng và chỉ ra nguồn. Nó không bao giờ đoán giá hay chuyến bay.',
    'f2.eyebrow': '9:15 sáng', 'f2.h': 'Bài báo dài, buổi sáng ngắn.', 'f2.p': 'Lore ngồi ngay cạnh trang. Nó tóm tắt, rút ra các mốc ngày, hoặc trả lời "có nhắc tới giá không?" bằng cách trích đúng dòng đó.',
    'f3.eyebrow': '11:30 sáng', 'f3.h': 'Email bạn cứ lần lữa mãi.', 'f3.p': 'Nói với Lore bạn cần gì. Nó viết bản nháp và mở ngay trong Gmail hay Outlook của bạn. Bạn đọc, bạn bấm Gửi. Phần cuối đó vẫn là của bạn.', 'f3.note': 'Bản nháp mẫu do một mô hình giả lập viết.',
    'f4.eyebrow': '2:00 chiều', 'f4.h': 'Khoan, trang đó ở đâu nhỉ?', 'f4.p': 'Bạn nhớ ý, không nhớ địa chỉ. Hỏi theo ý nghĩa và Lore tìm ra, từ một trí nhớ được mã hóa và chỉ nằm trên máy của bạn.',
    'p.eyebrow': 'Cả ngày, lặng lẽ', 'p.h': 'Bạn chưa mở cài đặt nào. Mọi thứ đã bật sẵn.',
    'p.1.b': 'Chặn quảng cáo và trình theo dõi', 'p.1.t': 'EasyList, EasyPrivacy và hơn thế.', 'p.2.b': 'Chặn cookie bên thứ ba', 'p.2.t': 'Trang web không bám theo bạn.',
    'p.3.b': 'Cảnh báo lừa đảo', 'p.3.t': 'Trang giả mạo ngân hàng, ví điện tử.', 'p.4.b': 'Tab riêng tư', 'p.4.t': 'Không lưu gì. Nhuộm màu tím.',
    'p.5.b': 'Giảm dấu vân tay', 'p.5.t': 'Bạn trông giống mọi người.', 'p.6.b': 'Quyền chỉ hỏi một lần', 'p.6.t': 'Không bao giờ cấp âm thầm.',
    'l.h': 'Dữ liệu nào rời khỏi máy bạn', 'l.when': 'Khi nào', 'l.to': 'Tới', 'l.what': 'Gửi gì',
    'l.r1.a': 'Bạn hỏi một câu thông thường', 'l.r1.c': 'Từ khóa chủ đề', 'l.r2.a': 'Bạn tìm kiếm trên web', 'l.r2.c': 'Câu tìm kiếm',
    'l.r3.a': 'Khoảng mỗi tuần một lần', 'l.r3.c': 'Không gì (danh sách lọc)', 'l.r4.a': 'Bạn dùng khóa AI đám mây', 'l.r4.b': 'Nhà cung cấp bạn chọn', 'l.r4.c': 'Văn bản bạn hỏi',
    'l.note': 'Lịch sử, nội dung trang và trí nhớ không bao giờ được tải lên.', 'l.link': 'Danh sách đầy đủ',
    'f6.eyebrow': '9:30 tối', 'f6.h': 'AI của bạn. Luật của bạn.', 'f6.p': 'Lore dùng được mô hình chạy trên máy bạn, khóa riêng của bạn, hoặc không cần AI. Bạn chọn, còn mọi thứ khác vẫn chạy.', 'f6.win': 'Cài đặt',
    'c.0': 'Trên máy bạn', 'c.1': 'Khóa của bạn', 'c.2': 'Không AI',
    'c.t0': 'Một mô hình qua Ollama, nên những gì bạn hỏi không bao giờ rời khỏi máy.',
    'c.t1': 'Cắm khóa của bạn cho dịch vụ tương thích OpenAI hay Claude. Lore cho bạn biết mỗi đoạn văn bản đã đi đâu.',
    'c.t2': 'Tắt AI. Câu trả lời từ Wikipedia, trí nhớ, chế độ đọc, chặn quảng cáo và cảnh báo lừa đảo vẫn chạy.',
    'h.h': 'Phần nói thật', 'h.p': 'Lore còn non. Chúng tôi muốn nói trước hơn là để bạn tự phát hiện.', 'h.1': 'Chưa có bản cho điện thoại, và bản Linux chưa được thử', 'h.2': 'Chưa thanh toán hóa đơn hay đặt vé thật được', 'h.3': 'Chưa có VPN, đồng bộ hay tiện ích mở rộng', 'h.4': 'Bộ cài chưa được ký, nên máy tính sẽ nhăn mặt',
    'd.h': 'Sẵn sàng khi bạn muốn.', 'd.sub': 'Miễn phí. Không cần tài khoản. Không điều kiện kèm theo.', 'd.none': 'Bản phát hành đầu tiên sắp có. Bạn có thể tự build ngay bây giờ.',
    'd.linux.note': 'Đã build, nhưng chưa được thử trên máy Linux thật.', 'd.sums': 'Mã kiểm tra có trên mỗi bản phát hành.', 'd.all': 'Tất cả bản phát hành',
    'w.s1': 'macOS chặn ứng dụng', 'w.p1': 'Vì chưa được ký. Kéo Lore vào Applications, nhấp chuột phải, chọn Open và xác nhận. Một lần là đủ.',
    'w.s2': 'Windows báo "protected your PC"', 'w.p2': 'Bấm More info, rồi Run anyway. Không muốn tin tệp cài sẵn? Hãy tự build.',
    's.h': 'Tự build từ mã nguồn', 's.src': 'Cần Node.js 22+ và Git.',
    'q.h': 'Hỏi đáp',
    'q.1s': 'Có miễn phí không?', 'q.1p': 'Có: mã nguồn mở, không tài khoản, không quảng cáo. Khóa AI đám mây bạn thêm có thể tốn tiền. Mô hình chạy trên máy thì không.',
    'q.2s': 'Có thật sự riêng tư không?', 'q.2p': 'Không phân tích, không telemetry. Lịch sử và trí nhớ nằm trên máy bạn, được mã hóa. "Riêng tư" không phải "ẩn danh": trang web vẫn thấy kết nối của bạn, và AI đám mây thấy những gì bạn gửi. Mỗi kết quả đều nói rõ văn bản đã đi đâu.',
    'q.3s': 'Tôi có cần mô hình AI không?', 'q.3p': 'Không. Trả lời, trí nhớ, chế độ đọc, chặn quảng cáo và cảnh báo lừa đảo chạy được khi không có. Mô hình thêm khả năng viết, tóm tắt và dịch.',
    'q.5s': 'Đăng nhập Google được không?', 'q.5p': 'Đôi khi. Google chặn một số trình duyệt nhúng. Nếu bị từ chối, Lore đề nghị mở trang bằng trình duyệt hệ thống.',
    'q.6s': 'Có Android hay iPhone không?', 'q.6p': 'Có kế hoạch, chưa bắt đầu.',
    'q.7s': 'Ai làm ra Lore?', 'q.7p': 'Tevo cùng cộng đồng. Giấy phép MIT. Hoan nghênh đóng góp.',
    'foot.tag': 'Trình duyệt nhớ bạn, và chỉ mình bạn.', 'foot.shots': 'Ảnh chụp màn hình có nội dung Wikipedia (CC BY-SA).', 'foot.issues': 'Báo lỗi', 'foot.contrib': 'Đóng góp', 'foot.license': 'Giấy phép', 'foot.security': 'Bảo mật'
  };
  const EN = {};
  const nodes = $$('[data-i18n]');
  for (const el of nodes) if (!(el.dataset.i18n in EN)) EN[el.dataset.i18n] = el.innerHTML;
  EN['c.t1'] = 'Plug in your key for any OpenAI-compatible service or Claude. Lore tells you where each text went.';
  EN['c.t2'] = 'Switch AI off. Answers from Wikipedia, memory, the reader, ad blocking and scam warnings all still work.';
  // ---- Signed or not: the warnings follow the switch in config.js ---------------------------------------------
  const signed = (window.LORE && window.LORE.signed) || {};
  const sm = !!signed.mac, sw = !!signed.windows;
  if (sm) $$('[data-unsigned="mac"]').forEach((n) => n.remove());
  if (sw) $$('[data-unsigned="win"]').forEach((n) => n.remove());
  if (sm && sw) $$('[data-unsigned="any"]').forEach((n) => n.remove());
  if (!$('[data-unsigned="mac"], [data-unsigned="win"]')) $$('[data-unsigned="faq"]').forEach((n) => n.remove());
  if (sm && sw) { EN['cta.note'] = 'macOS, Windows and Linux. Early version.'; VI['cta.note'] = 'macOS, Windows và Linux. Bản đầu tiên.'; }
  else if (sm) { EN['cta.note'] = 'macOS, Windows and Linux. Early version. The macOS app is signed; Windows is not yet.'; VI['cta.note'] = 'macOS, Windows và Linux. Bản đầu tiên. Bản macOS đã ký; Windows thì chưa.'; EN['h.4'] = 'The Windows installer is not signed yet, so expect a warning'; VI['h.4'] = 'Bộ cài Windows chưa được ký, nên sẽ có cảnh báo'; }
  else if (sw) { EN['cta.note'] = 'macOS, Windows and Linux. Early version. The Windows installer is signed; macOS is not yet.'; VI['cta.note'] = 'macOS, Windows và Linux. Bản đầu tiên. Bộ cài Windows đã ký; macOS thì chưa.'; EN['h.4'] = 'The macOS app is not signed yet, so expect a warning'; VI['h.4'] = 'Bản macOS chưa được ký, nên sẽ có cảnh báo'; }

  let lang = 'en';
  const t = (k) => (lang === 'vi' && VI[k] !== undefined ? VI[k] : EN[k]);

  // ---- The live demo -------------------------------------------------------------------------------------------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const DEMO = {
    en: [
      { q: 'What is Da Nang?', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'Answer'), el('p', 'd-big', 'Da Nang is the fourth largest city in Vietnam by population, on the South Central Coast.'), (() => { const s = el('div', 'd-src'); s.append(el('span', 'd-chip', 'Source: Wikipedia, Da Nang'), el('span', 'd-chip', 'Open the original page')); return s; })()); return c; } },
      { q: 'Draft an email asking for a day off', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'Draft'), field('Subject', 'Request for a day off on Friday'), el('p', 'd-body', 'Hi [name],\n\nCould I take Friday off? I will make sure everything is covered before I go.\n\nThanks,'), actions('Open in Gmail', 'You review it. You press Send.')); return c; } },
      { q: 'Find the article I read last week about EVs', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'From your memory'), hit('E', 'Electric cars: what changed this year', 'example.com · 6 days ago'), el('p', 'd-note', 'Found on this computer. Nothing was uploaded.')); return c; } }
    ],
    vi: [
      { q: 'Đà Nẵng là gì?', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'Trả lời'), el('p', 'd-big', 'Đà Nẵng là thành phố lớn thứ tư của Việt Nam theo dân số, nằm ở Duyên hải Nam Trung Bộ.'), (() => { const s = el('div', 'd-src'); s.append(el('span', 'd-chip', 'Nguồn: Wikipedia, Đà Nẵng'), el('span', 'd-chip', 'Mở trang gốc')); return s; })()); return c; } },
      { q: 'Soạn email xin nghỉ một ngày', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'Bản nháp'), field('Tiêu đề', 'Xin nghỉ phép ngày thứ Sáu'), el('p', 'd-body', 'Chào anh/chị [tên],\n\nEm xin phép nghỉ ngày thứ Sáu. Em sẽ sắp xếp xong công việc trước khi nghỉ.\n\nCảm ơn anh/chị,'), actions('Mở trong Gmail', 'Bạn đọc lại. Bạn bấm Gửi.')); return c; } },
      { q: 'Tìm lại bài báo tuần trước về xe điện', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'Từ trí nhớ của bạn'), hit('X', 'Xe điện: những thay đổi trong năm nay', 'example.com · 6 ngày trước'), el('p', 'd-note', 'Tìm thấy trên máy này. Không có gì được tải lên.')); return c; } }
    ]
  };
  function field(k, v) { const d = el('div', 'd-field'); d.append(el('b', '', k), el('span', '', v)); return d; }
  function actions(btn, note) { const d = el('div', 'd-act'); d.append(el('span', 'd-btn', btn), el('span', 'd-note', note)); return d; }
  function hit(ico, title, meta) { const d = el('div', 'd-hit'); const b = el('div'); b.append(el('b', '', title), el('span', '', meta)); d.append(el('span', 'd-ico', ico), b); return d; }

  const qEl = $('#demo-q');
  const body = $('#demo-body');
  let run = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function showCard(i) {
    body.replaceChildren();
    const row = el('div', 'd-row');
    row.append(DEMO[lang][i].card());
    body.append(row);
  }

  async function play() {
    const id = ++run;
    if (calm) { qEl.textContent = DEMO[lang][0].q; showCard(0); return; }
    for (let i = 0; ; i = (i + 1) % 3) {
      const text = DEMO[lang][i].q;
      body.replaceChildren();
      qEl.textContent = '';
      await sleep(500);
      for (let k = 1; k <= text.length; k++) {
        if (id !== run) return;
        qEl.textContent = text.slice(0, k);
        await sleep(36 + Math.random() * 40);
      }
      await sleep(450);
      if (id !== run) return;
      showCard(i);
      await sleep(5200);
      while (document.hidden) await sleep(500);
      if (id !== run) return;
    }
  }

  // ---- Language -----------------------------------------------------------------------------------------------
  function setLang(l, remember) {
    lang = l;
    document.documentElement.lang = l;
    for (const n of nodes) { const k = n.dataset.i18n; const v = t(k); if (v !== undefined) n.innerHTML = v; }
    for (const b of $$('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === l));
    document.title = l === 'vi' ? 'Lore: trình duyệt AI riêng tư' : 'Lore: the private AI browser';
    if (remember) { try { localStorage.setItem('lore-lang', l); } catch { /* optional */ } }
    paintCta();
    play();
  }
  let saved = '';
  try { saved = localStorage.getItem('lore-lang') || ''; } catch { /* optional */ }
  const initial = saved || (/^vi\b/i.test(navigator.language || '') ? 'vi' : 'en');
  for (const b of $$('.lang button')) b.addEventListener('click', () => setLang(b.dataset.lang, true));

  // ---- Night: pick where the AI runs --------------------------------------------------------------------------
  const choiceText = $('#choice-text');
  for (const b of $$('.choices button')) {
    b.addEventListener('click', () => {
      for (const o of $$('.choices button')) o.setAttribute('aria-selected', String(o === b));
      choiceText.dataset.i18n = 'c.t' + b.dataset.choice;
      choiceText.innerHTML = t(choiceText.dataset.i18n);
    });
  }

  // ---- Reveal on scroll, and the story that follows the day --------------------------------------------------
  if ('IntersectionObserver' in window && !calm) {
    for (const group of $$('.cards, .dl')) [...group.children].forEach((c, i) => c.style.setProperty('--i', i));
    const seen = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    for (const r of $$('.reveal')) seen.observe(r);
  } else {
    for (const r of $$('.reveal')) r.classList.add('in');
  }

  // ---- Downloads ----------------------------------------------------------------------------------------------
  const ua = navigator.userAgent || '';
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const os = /win/i.test(plat) || /Windows/.test(ua) ? 'windows' : /mac/i.test(plat) || /Mac OS X/.test(ua) ? 'mac' : /linux/i.test(plat) && !/Android/.test(ua) ? 'linux' : 'other';
  const base = gh + '/releases/latest/download/';
  let released = null; // null = not checked yet, false = no release, true = published
  const assets = new Set();
  const LABEL = {
    en: { windows: 'Download for Windows', mac: 'Download for macOS', linux: 'Download for Linux', other: 'Build Lore from source' },
    vi: { windows: 'Tải cho Windows', mac: 'Tải cho macOS', linux: 'Tải cho Linux', other: 'Tự build Lore' }
  };
  function paintCta() {
    const cta = $('#cta-main');
    $('#cta-label').textContent = LABEL[lang][os];
    const file = os === 'windows' ? 'Lore-win-x64-setup.exe' : os === 'mac' ? 'Lore-mac-arm64.dmg' : os === 'linux' ? 'Lore-linux-x64.AppImage' : '';
    cta.href = os === 'other' ? '#source' : released && (!assets.size || assets.has(file)) ? base + file : '#download';
  }
  for (const a of $$('[data-asset]')) a.href = base + a.dataset.asset;

  setLang(initial, false);

  fetch('https://api.github.com/repos/' + repo + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((rel) => {
      released = true;
      for (const a of rel.assets || []) assets.add(a.name);
      $('#ver').textContent = '· ' + rel.tag_name;
      for (const a of $$('[data-asset]')) {
        const found = (rel.assets || []).find((x) => x.name === a.dataset.asset);
        if (found) a.href = found.browser_download_url; else a.setAttribute('aria-disabled', 'true');
      }
      paintCta();
    })
    .catch(() => {
      // No release yet (or GitHub unreachable): keep the buttons honest instead of linking to a missing file.
      released = false;
      $('#no-release').hidden = false;
      for (const a of $$('[data-asset]')) { a.setAttribute('aria-disabled', 'true'); a.href = '#source'; }
      paintCta();
    });
})();
