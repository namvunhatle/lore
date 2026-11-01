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
    "skip": "Bỏ qua, tới nội dung",
    "nav.features": "Một ngày cùng Lore",
    "nav.privacy": "Riêng tư",
    "nav.download": "Tải về",
    "nav.faq": "Hỏi đáp",
    "hero.eyebrow": "Miễn phí · Mã nguồn mở · MIT",
    "hero.h1": "<span>Trình duyệt nhớ bạn,</span> <span>và chỉ mình bạn.</span>",
    "hero.lead": "Bài báo bạn đọc tuần trước, còn nhớ không? Lore nhớ giúp bạn, và chỉ cất ký ức ấy trên máy của bạn.",
    "cta.download": "Tải Lore",
    "cta.github": "Xem trên GitHub",
    "cta.note": "Có cho macOS, Windows và Linux. Đây là bản đầu tiên, chưa được ký số.",
    "demo.note": "Minh họa cách Lore hoạt động.",
    "trust.1.b": "Không cần tài khoản",
    "trust.1.t": "Mở lên là dùng",
    "trust.2.b": "Không thu thập dữ liệu",
    "trust.2.t": "Không gửi gì về máy chủ",
    "trust.3.b": "AI do bạn chọn",
    "trust.3.t": "Trên máy, khóa riêng, hoặc tắt",
    "trust.4.b": "Giấy phép MIT",
    "trust.4.t": "Đọc, sửa, chia sẻ tự do",
    "st.h": "Một ngày bình thường.",
    "st.p": "Và đây là chỗ của Lore trong ngày ấy.",
    "f1.eyebrow": "7:40 sáng",
    "f1.h": "Có điều bạn thắc mắc. Cứ hỏi thẳng.",
    "f1.p": "Trên chuyến tàu buổi sáng, bạn gõ thẳng câu hỏi vào ô duy nhất, không cần nhớ địa chỉ trang web. Lore trả lời ngắn gọn và cho bạn biết câu trả lời đến từ đâu. Còn giá vé hay chuyến bay thì nó không bao giờ đoán bừa.",
    "f2.eyebrow": "9:15 sáng",
    "f2.h": "Bài báo dài, buổi sáng ngắn.",
    "f2.p": "Lore ở ngay bên cạnh trang. Nó tóm tắt giúp bạn, nhặt ra các mốc ngày tháng, hoặc khi bạn hỏi \"bài này có nói đến giá không?\" thì chỉ ngay đúng dòng đó.",
    "f3.eyebrow": "11:30 sáng",
    "f3.h": "Bức email bạn cứ hoãn mãi.",
    "f3.p": "Bạn chỉ cần nói mình muốn viết gì. Lore soạn bản nháp rồi mở sẵn trong Gmail hoặc Outlook của bạn. Bạn đọc lại, và chính bạn là người bấm Gửi.",
    "f3.note": "Bản nháp trong ảnh do một mô hình thử nghiệm viết.",
    "f4.eyebrow": "2:00 chiều",
    "f4.h": "Khoan, trang đó ở đâu nhỉ?",
    "f4.p": "Bạn nhớ nội dung chứ không nhớ địa chỉ. Cứ hỏi theo ý, Lore sẽ tìm ra trong bộ nhớ đã mã hóa, chỉ nằm trên máy của bạn.",
    "p.eyebrow": "Cả ngày, âm thầm",
    "p.h": "Bạn chưa hề chỉnh cài đặt nào. Mọi thứ đã được bật sẵn.",
    "p.1.b": "Chặn quảng cáo và trình theo dõi",
    "p.1.t": "Dùng EasyList, EasyPrivacy và nhiều danh sách khác.",
    "p.2.b": "Chặn cookie bên thứ ba",
    "p.2.t": "Các trang không bám theo bạn từ nơi này sang nơi khác.",
    "p.3.b": "Cảnh báo lừa đảo",
    "p.3.t": "Báo khi gặp trang giả mạo ngân hàng hay ví điện tử.",
    "p.4.b": "Tab riêng tư",
    "p.4.t": "Không lưu lại gì, và mang sắc tím để bạn dễ nhận ra.",
    "p.5.b": "Giảm dấu vân tay",
    "p.5.t": "Thiết bị của bạn trông giống mọi người khác.",
    "p.6.b": "Chỉ hỏi quyền một lần",
    "p.6.t": "Không bao giờ tự động cấp quyền.",
    "l.h": "Dữ liệu nào rời khỏi máy bạn",
    "l.when": "Khi nào",
    "l.to": "Gửi đến",
    "l.what": "Nội dung gửi",
    "l.r1.a": "Bạn hỏi một câu kiến thức",
    "l.r1.c": "Các từ khóa chủ đề",
    "l.r2.a": "Bạn tìm kiếm trên web",
    "l.r2.c": "Câu bạn tìm",
    "l.r3.a": "Khoảng mỗi tuần một lần",
    "l.r3.c": "Không gửi gì (chỉ tải danh sách lọc)",
    "l.r4.a": "Bạn dùng khóa AI trên đám mây",
    "l.r4.b": "Nhà cung cấp bạn chọn",
    "l.r4.c": "Nội dung bạn nhờ xử lý",
    "l.note": "Lịch sử, nội dung trang và trí nhớ không bao giờ được tải lên.",
    "l.link": "Xem danh sách đầy đủ",
    "f6.eyebrow": "9:30 tối",
    "f6.h": "AI do bạn chọn. Luật do bạn đặt.",
    "f6.p": "Lore dùng được mô hình chạy ngay trên máy bạn, khóa API riêng của bạn, hoặc không cần AI. Bạn chọn, mọi thứ còn lại vẫn hoạt động bình thường.",
    "f6.win": "Cài đặt",
    "c.0": "Trên máy bạn",
    "c.1": "Khóa riêng",
    "c.2": "Tắt AI",
    "c.t0": "Mô hình chạy qua Ollama ngay trên máy, nên điều bạn hỏi không bao giờ rời khỏi máy.",
    "c.t1": "Nhập khóa API của bạn cho dịch vụ tương thích OpenAI hoặc Claude. Lore luôn cho bạn biết văn bản đã được gửi đi đâu.",
    "c.t2": "Tắt hẳn AI. Câu trả lời từ Wikipedia, trí nhớ, chế độ đọc, chặn quảng cáo và cảnh báo lừa đảo vẫn hoạt động.",
    "h.h": "Nói thật với bạn",
    "h.p": "Lore còn non trẻ. Chúng tôi muốn nói trước, còn hơn để bạn tự phát hiện.",
    "h.1": "Chưa có bản cho điện thoại, và bản Linux chưa được kiểm tra",
    "h.2": "Chưa thể thanh toán hóa đơn hay đặt vé thật",
    "h.3": "Chưa có VPN, đồng bộ giữa các thiết bị hay tiện ích mở rộng",
    "h.4": "Bộ cài chưa được ký số, nên máy tính của bạn sẽ cảnh báo",
    "d.h": "Sẵn sàng khi bạn muốn.",
    "d.sub": "Miễn phí, không cần tài khoản, không kèm điều kiện nào.",
    "d.none": "Bản phát hành đầu tiên sắp ra mắt. Trong lúc chờ, bạn có thể tự build từ mã nguồn.",
    "d.linux.note": "Đã đóng gói nhưng chưa được thử trên máy Linux thật.",
    "d.sums": "Mỗi bản phát hành đều kèm mã SHA-256 để bạn đối chiếu.",
    "d.all": "Tất cả bản phát hành",
    "w.s1": "macOS không cho mở ứng dụng",
    "w.p1": "Do ứng dụng chưa được ký số. Hãy kéo Lore vào thư mục Applications, nhấp chuột phải vào Lore, chọn Open rồi xác nhận. Bạn chỉ cần làm một lần.",
    "w.s2": "Windows hiện cảnh báo \"Windows protected your PC\"",
    "w.p2": "Bấm More info rồi chọn Run anyway. Nếu bạn không muốn chạy một tệp cài sẵn, hãy tự build từ mã nguồn.",
    "s.h": "Tự build từ mã nguồn",
    "s.src": "Cần có Node.js 22 trở lên và Git.",
    "q.h": "Hỏi đáp",
    "q.1s": "Lore có miễn phí không?",
    "q.1p": "Có. Lore là mã nguồn mở, không cần tài khoản và không có quảng cáo. Chỉ khi bạn dùng khóa AI trên đám mây thì nhà cung cấp đó mới có thể tính phí. Mô hình chạy trên máy bạn thì miễn phí.",
    "q.2s": "Lore có thật sự riêng tư không?",
    "q.2p": "Lore không có công cụ phân tích hay thu thập dữ liệu. Lịch sử và trí nhớ nằm trên máy bạn và được mã hóa. Lore nói \"riêng tư\" chứ không nói \"ẩn danh\": các trang web bạn truy cập vẫn thấy kết nối của bạn, và dịch vụ AI trên đám mây sẽ nhận nội dung bạn gửi cho nó. Mỗi kết quả đều cho biết văn bản đã được gửi đi đâu.",
    "q.3s": "Tôi có cần mô hình AI không?",
    "q.3p": "Không. Khi không có mô hình, các tính năng trả lời, trí nhớ, chế độ đọc, chặn quảng cáo và cảnh báo lừa đảo vẫn hoạt động. Mô hình AI bổ sung khả năng viết, tóm tắt và dịch.",
    "q.5s": "Tôi đăng nhập Google được không?",
    "q.5p": "Đôi khi được. Google chặn đăng nhập trên một số trình duyệt nhúng. Nếu bị từ chối, Lore sẽ đề nghị mở trang đó bằng trình duyệt của hệ thống.",
    "q.6s": "Có bản cho Android hay iPhone không?",
    "q.6p": "Đã có kế hoạch nhưng chưa bắt đầu.",
    "q.7s": "Ai làm ra Lore?",
    "q.7p": "Tevo cùng cộng đồng đóng góp. Lore theo giấy phép MIT và luôn hoan nghênh đóng góp.",
    "foot.tag": "Trình duyệt nhớ bạn, và chỉ mình bạn.",
    "foot.shots": "Ảnh chụp màn hình có nội dung Wikipedia (CC BY-SA).",
    "foot.issues": "Báo lỗi",
    "foot.contrib": "Đóng góp",
    "foot.license": "Giấy phép",
    "foot.security": "Bảo mật"
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
  if (sm && sw) { EN['cta.note'] = 'macOS, Windows and Linux. Early version.'; VI['cta.note'] = 'Có cho macOS, Windows và Linux. Đây là bản đầu tiên.'; }
  else if (sm) { EN['cta.note'] = 'macOS, Windows and Linux. Early version. The macOS app is signed; Windows is not yet.'; VI['cta.note'] = 'Có cho macOS, Windows và Linux. Bản macOS đã được ký số, bản Windows thì chưa.'; EN['h.4'] = 'The Windows installer is not signed yet, so expect a warning'; VI['h.4'] = 'Bộ cài Windows chưa được ký số, nên sẽ có cảnh báo'; }
  else if (sw) { EN['cta.note'] = 'macOS, Windows and Linux. Early version. The Windows installer is signed; macOS is not yet.'; VI['cta.note'] = 'Có cho macOS, Windows và Linux. Bộ cài Windows đã được ký số, bản macOS thì chưa.'; EN['h.4'] = 'The macOS app is not signed yet, so expect a warning'; VI['h.4'] = 'Bản macOS chưa được ký số, nên sẽ có cảnh báo'; }

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
      { q: 'Soạn email xin nghỉ một ngày', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'Bản nháp'), field('Tiêu đề', 'Xin nghỉ phép ngày thứ Sáu'), el('p', 'd-body', 'Chào anh/chị [tên],\n\nEm xin phép được nghỉ vào thứ Sáu này. Em sẽ bàn giao xong công việc trước khi nghỉ.\n\nEm cảm ơn anh/chị,'), actions('Mở trong Gmail', 'Bạn xem lại rồi tự bấm Gửi.')); return c; } },
      { q: 'Tìm lại bài báo tuần trước về xe điện', card: () => { const c = el('div', 'd-card'); c.append(el('span', 'd-tag', 'Từ trí nhớ của bạn'), hit('X', 'Xe điện: những thay đổi trong năm nay', 'example.com · 6 ngày trước'), el('p', 'd-note', 'Tìm thấy ngay trên máy. Không có gì được tải lên.')); return c; } }
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
