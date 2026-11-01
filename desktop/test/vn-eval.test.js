// VN-01: Vietnamese understanding eval set. Each row is what a real person might type.
// Covers diacritics on/off, abbreviations and slang, and mixed Vietnamese-English.
const test = require('node:test');
const assert = require('node:assert');
const { classify } = require('../src/router');

const CASES = [
  // write ----------------------------------------------------------------
  ['soạn email xin nghỉ phép gửi sếp', 'write'],
  ['soan mail cam on khach hang', 'write'],
  ['viết thư xin lỗi đối tác', 'write'],
  ['write an email to my landlord about the late rent', 'write'],
  ['draft a polite email declining the offer', 'write'],
  ['reply to this email saying I agree', 'write'],
  ['trả lời email này giúp tôi', 'write'],
  ['đặt lịch họp với An thứ hai 3h chiều', 'write'],
  ['dat lich hop team sang mai 9h', 'write'],
  ['nhắc tôi gọi mẹ lúc 8h tối', 'write'],
  ['schedule a call with Minh tomorrow at 10am', 'write'],
  ['add dentist appointment to my calendar friday 2pm', 'write'],
  ['viết bài đăng facebook giới thiệu quán cà phê mới', 'write'],
  ['soạn caption instagram cho ảnh du lịch', 'write'],
  ['write a linkedin post about our product launch', 'write'],
  ['draft a tweet about the new release', 'write'],
  // not writing tasks: stay search ------------------------------------------
  ['cách viết email xin việc', 'search'],
  ['how to write a cover letter email', 'search'],
  ['bus schedule hanoi', 'search'],
  ['gmail đăng nhập', 'search'],
  ['lịch chiếu phim hôm nay', 'search'],

  // memory ---------------------------------------------------------------
  ['tìm lại bài báo tuần trước về xe điện', 'memory'],
  ['tim lai bai bao tuan truoc ve xe dien', 'memory'],
  ['hôm qua tôi đọc bài nào nói về lãi suất', 'memory'],
  ['hom qua toi doc bai nao ve lai suat', 'memory'],
  ['tìm lại trang mình xem hôm qua', 'memory'],
  ['tim lai trang minh da xem tuan trc', 'memory'],
  ['bài viết tôi đã đọc về chứng khoán', 'memory'],
  ['find lại bài báo về xe điện', 'memory'],
  ['tìm lại cái web bán giày hôm kia', 'memory'],
  ['lịch sử xem trang về du lịch đà nẵng', 'memory'],
  ['find the article about electric cars I read last week', 'memory'],
  ['which page did I visit yesterday about interest rates', 'memory'],
  ['search my history for pho recipes', 'memory'],
  // download -------------------------------------------------------------
  ['tải video bài giảng này', 'download'],
  ['tai video nay ve may', 'download'],
  ['tải phim này giúp tôi', 'download'],
  ['download video này', 'download'],
  ['dowload video bai giang', 'download'],
  ['lưu video này về máy', 'download'],
  ['download this lecture video', 'download'],
  ['save this video for offline', 'download'],
  ['tải xuống video trên trang', 'download'],
  // agent ----------------------------------------------------------------
  ['đóng tiền điện tháng này giúp tôi', 'agent'],
  ['dong tien dien thang nay', 'agent'],
  ['thanh toán hóa đơn nước', 'agent'],
  ['thanh toan hoa don internet', 'agent'],
  ['đặt vé hà nội đà nẵng thứ bảy', 'agent'],
  ['dat ve may bay ha noi da nang', 'agent'],
  ['book vé hà nội đà nẵng', 'agent'],
  ['pay tiền điện giúp mình', 'agent'],
  ['đóng tiền net nhà mình', 'agent'],
  ['pay my electricity bill this month', 'agent'],
  ['book a flight to da nang', 'agent'],
  ['dat ve tau di hue', 'agent'],
  // page actions ---------------------------------------------------------
  ['tóm tắt trang này', 'page:summarize'],
  ['tom tat trang nay', 'page:summarize'],
  ['tóm tắt bài này giúp mình', 'page:summarize'],
  ['summarize this page', 'page:summarize'],
  ['tl;dr', 'page:summarize'],
  ['dịch trang này sang tiếng anh', 'page:translate'],
  ['dich trang nay', 'page:translate'],
  ['translate this page', 'page:translate'],
  ['translate trang này sang tiếng việt', 'page:translate'],
  ['chế độ đọc', 'page:reader'],
  ['che do doc sach', 'page:reader'],
  ['reader mode', 'page:reader'],
  ['đọc trang này cho gọn', 'page:reader'],
  ['trang này nói gì về giá', 'page:ask'],
  ['what does this page say about pricing', 'page:ask'],
  ['bài này có nhắc tới lãi suất không', 'page:ask'],
  // search (must NOT be hijacked) ----------------------------------------
  ['giá vé hà nội đi đà nẵng cuối tuần này', 'search'],
  ['gia ve ha noi da nang', 'search'],
  ['thời tiết hà nội hôm nay', 'search'],
  ['thoi tiet da nang', 'search'],
  ['đà nẵng là gì', 'search'],
  ['phở bò làm thế nào', 'search'],
  ['xe điện vinfast giá bao nhiêu', 'search'],
  ['what is da nang', 'search'],
  ['flight prices hanoi to da nang this weekend', 'search'],
  ['ko biet nen mua laptop nao', 'search'],
  ['best phở in hà nội', 'search'],
  ['hóa đơn là gì', 'search'],
  ['cách đóng thuế thu nhập cá nhân', 'search'],
  // urls -----------------------------------------------------------------
  ['vnexpress.net', 'url'],
  ['https://tuoitre.vn/abc', 'url'],
  ['localhost:3000', 'url'],
  ['dichvucong.gov.vn', 'url'],
];

function label(r) { return r.kind === 'page' ? 'page:' + r.action : r.kind; }

test('Vietnamese intent eval set', () => {
  const misses = CASES.map(([q, want]) => [q, want, label(classify(q))]).filter(([, w, g]) => w !== g);
  const rate = 1 - misses.length / CASES.length;
  if (misses.length) console.log(misses.map(([q, w, g]) => `  "${q}" -> ${g} (wanted ${w})`).join('\n'));
  assert.ok(rate >= 1, `pass rate ${(rate * 100).toFixed(0)}%`);
});
