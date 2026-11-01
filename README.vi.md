<p align="center">
  <img src="design/icon/lore-icon-1024.png" width="112" alt="Biểu tượng hoa sen của Lore">
</p>

<h1 align="center">Lore</h1>

<p align="center"><b>Trình duyệt nhớ bạn, và chỉ mình bạn.</b></p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://tevo-web.github.io/lore/">Trang giới thiệu</a> ·
  <a href="https://github.com/tevo-web/lore/releases/latest">Tải về</a>
</p>

Lore là trình duyệt riêng tư có AI hỗ trợ. Bạn gõ điều mình cần vào một thanh duy nhất. Lore trả lời trước (kèm nguồn), giúp bạn viết và lên kế hoạch, và ghi nhớ những gì bạn đã đọc **ngay trên máy của bạn, không ở đâu khác**.

> **Trạng thái: bản thử nghiệm sớm.** Ứng dụng máy tính (macOS và Windows) chạy được và có kiểm thử, nhưng mới là phiên bản 0.x, bộ cài chưa được ký số, và nhiều mục trong lộ trình chưa có. Phần [Đã có và chưa có](#đã-có-và-chưa-có) nói thẳng điều đó.

## Tải về

Lấy bộ cài mới nhất ở **[Releases](https://github.com/tevo-web/lore/releases/latest)**:

| Nền tảng | Tệp |
|---|---|
| macOS (Apple Silicon) | `Lore-mac-arm64.dmg` |
| macOS (Intel) | `Lore-mac-x64.dmg` |
| Windows 10/11 (64-bit) | `Lore-win-x64-setup.exe` |
| Linux | tự build từ mã nguồn (xem bên dưới) |

Bộ cài **chưa được ký số**, nên Windows SmartScreen và macOS Gatekeeper sẽ cảnh báo. Trên macOS, lần đầu hãy nhấp chuột phải vào ứng dụng rồi chọn *Mở*. Nếu bạn không muốn tin một tệp cài sẵn, hãy [tự build](#tự-build-từ-mã-nguồn), chỉ mất vài phút.

## Lore làm được gì

- **Trả lời trước.** Hỏi ngay ở thanh địa chỉ để có câu trả lời ngắn kèm nguồn. Lore tra Wikipedia và không bịa giá hay dữ liệu thời gian thực. Mỗi câu do AI viết đều phải chỉ ra dòng nguồn.
- **Trí nhớ riêng tư.** Tìm lại trang đã đọc theo ý nghĩa ("bài về xe điện tuần trước"). Chỉ mục được mã hóa và nằm trên máy bạn. Bạn xem, tìm, xuất và xóa được mọi thứ.
- **AI trên mọi trang.** Panel bên cạnh tóm tắt, dịch tại chỗ, mở chế độ đọc gọn, rút ra thông tin chính, giải thích bằng lời dễ hiểu và trả lời câu hỏi kèm đoạn trích. Nhấp chuột phải vào văn bản đã chọn hoặc ô nhập để viết lại, sửa lỗi, rút gọn, đổi giọng, dịch, giải nghĩa, tóm tắt.
- **Tác vụ lưu lại được.** Soạn email, sự kiện lịch hay bài đăng, hoặc tự tạo tác vụ với các ô điền sẵn. Lore viết bản nháp và mở trong một tab mới (Gmail, Outlook, Yahoo, Google/Outlook Calendar, X, LinkedIn). **Lore không bao giờ tự gửi, tự đăng hay tự đặt lịch.** Bạn kiểm tra và bấm nút ở dịch vụ đó.
- **Riêng tư mặc định.** Chặn quảng cáo và trình theo dõi (EasyList, EasyPrivacy và danh sách Việt Nam), chặn cookie bên thứ ba, Global Privacy Control, giảm dấu vân tay trình duyệt, tự đóng banner cookie, cảnh báo trang giả mạo ngân hàng và ví điện tử, quyền camera/vị trí chỉ hỏi một lần, tab riêng tư không để lại dấu vết.
- **AI do bạn chọn.** Chạy mô hình ngay trên máy qua [Ollama](https://ollama.com), hoặc dùng khóa API của bạn cho dịch vụ tương thích OpenAI hay Claude. Hoặc tắt AI: mọi thứ không cần mô hình vẫn chạy.
- **Tiếng Việt và tiếng Anh.** Giao diện và thanh nhập hiểu cả hai, có dấu hay không dấu.
- **Tải video** cho nội dung bạn được phép lưu (tệp thường và luồng HLS). Luồng mã hóa và các nền tảng như YouTube, Netflix không bao giờ được hỗ trợ.

## Đã có và chưa có

Đã chạy được (máy tính): mọi thứ ở trên, bằng tiếng Việt và tiếng Anh, có kiểm thử đơn vị (chạy trong CI) và kiểm thử đầu-cuối (chạy cục bộ).

Chưa có, xin đừng trông cậy vào:

| Mảng | Tình trạng |
|---|---|
| Bản Android, iOS, Linux | Chưa bắt đầu (Linux có thể chạy từ mã nguồn nhưng chưa thử) |
| Lõi Rust dùng chung (`core/`) | Mới là chỗ giữ chỗ. Bản máy tính đang dùng bộ chặn quảng cáo viết bằng JavaScript |
| Quy trình agent cho dịch vụ thật | Có bộ máy xác nhận trước khi làm và trình điều khiển trình duyệt, đã thử với cổng demo cục bộ. **Chưa có thanh toán hóa đơn hay đặt vé thật** |
| VPN | Chưa có |
| Đồng bộ giữa thiết bị | Chưa có |
| Ký số, tự cập nhật | Chưa thiết lập |
| Đăng nhập Google trong Lore | Google có thể từ chối vì chặn trình duyệt nhúng. Lore giữ nguyên user agent của Electron và gợi ý mở trang đó bằng trình duyệt hệ thống |
| Tiện ích mở rộng | Chưa hỗ trợ |

## Dữ liệu nào rời khỏi máy bạn

Lore không có phân tích, không có telemetry, không có tài khoản. Ngoài các trang bạn mở, đây là toàn bộ yêu cầu mạng:

| Khi nào | Tới đâu | Gửi gì |
|---|---|---|
| Bạn hỏi một câu thông thường | `wikipedia.org` | Từ khóa chủ đề |
| Bạn tìm kiếm trên web | `duckduckgo.com` | Câu tìm kiếm của bạn |
| Khoảng mỗi tuần một lần | `easylist.to`, `abpvn.com`, `raw.githubusercontent.com` | Chỉ có địa chỉ IP (danh sách chặn quảng cáo và danh sách tên miền lừa đảo) |
| Dùng AI với mô hình trên máy | Ollama của bạn (`localhost`) | Văn bản bạn hỏi, gửi tới chính máy bạn |
| Dùng AI với khóa đám mây | Nhà cung cấp bạn đã cấu hình | Văn bản bạn hỏi. Cài đặt cảnh báo máy chủ sẽ nhận, và mỗi kết quả ghi rõ văn bản đã gửi tới đâu |
| Bạn mở bản nháp hay chia sẻ | Gmail, Outlook, Yahoo, X, LinkedIn, Google/Outlook Calendar | Nội dung bạn chọn mở, trong một tab bình thường |

Lịch sử duyệt web, nội dung trang và trí nhớ không bao giờ được tải lên. Cài đặt và trí nhớ được mã hóa bằng kho khóa của hệ điều hành.

## Tự build từ mã nguồn

Cần **Node.js 22 trở lên** và Git.

```bash
git clone https://github.com/tevo-web/lore.git
cd lore/desktop
npm ci
npm run filters     # tải và biên dịch danh sách chặn quảng cáo (cần internet)
npm start           # chạy Lore
```

Kiểm thử: `npm test` (nhanh) và `npm run test:e2e` (cửa sổ Electron thật; hãy thoát các ứng dụng Electron khác trước). Đóng gói: `npm run dist:mac` hoặc `npm run dist:win`.

Để thử AI bằng mô hình trên máy: cài [Ollama](https://ollama.com), rồi trong Lore mở **Cài đặt → Mô hình AI** và chọn một mô hình.

## Đóng góp

Báo lỗi, bản dịch, kiểm thử và pull request đều được hoan nghênh. Hãy đọc [CONTRIBUTING.md](CONTRIBUTING.md) trước, báo lỗi bảo mật riêng tư theo [SECURITY.md](SECURITY.md), và tuân theo [Quy tắc ứng xử](CODE_OF_CONDUCT.md).

Những chỗ dễ bắt đầu: thêm câu tiếng Việt để kiểm thử thanh nhập (`desktop/test/vn-eval.test.js`), tác vụ dựng sẵn mới (`desktop/src/tasks.js`), bản dịch (`desktop/src/ui/i18n.js`), bộ điều hợp cho agent, và bản Linux.

## Giấy phép

[MIT](LICENSE) © 2026 Tevo. Các thành phần bên thứ ba giữ giấy phép riêng của chúng: xem [docs/third-party.md](docs/third-party.md).
