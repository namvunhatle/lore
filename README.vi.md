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

Lore là trình duyệt riêng tư, có AI hỗ trợ. Bạn chỉ cần gõ điều mình cần vào một ô duy nhất. Lore trả lời trước và cho biết nguồn, giúp bạn viết lách và sắp xếp công việc, đồng thời ghi nhớ những gì bạn đã đọc **ngay trên máy của bạn, không lưu ở đâu khác**.

> **Trạng thái: bản thử nghiệm đầu tiên.** Ứng dụng cho máy tính chạy được và đã có kiểm thử, nhưng mới ở phiên bản 0.x, bộ cài chưa được ký số, và nhiều hạng mục trong lộ trình vẫn chưa có. Phần [Đã có và chưa có](#đã-có-và-chưa-có) nói rõ điều đó.

## Tải về

Tải bộ cài mới nhất tại **[Releases](https://github.com/tevo-web/lore/releases/latest)**:

| Nền tảng | Tệp |
|---|---|
| macOS (chip Apple) | `Lore-mac-arm64.dmg` |
| macOS (chip Intel) | `Lore-mac-x64.dmg` |
| Windows 10/11 (64-bit) | `Lore-win-x64-setup.exe` |
| Linux (64-bit) | `Lore-linux-x64.AppImage` hoặc `Lore-linux-x64.tar.gz` (đã đóng gói nhưng chưa được thử trên máy Linux thật) |

Bộ cài **chưa được ký số**, nên Windows SmartScreen và macOS Gatekeeper sẽ đưa ra cảnh báo. Trên macOS, lần đầu hãy nhấp chuột phải vào ứng dụng rồi chọn *Open* (hoặc *Mở*). Nếu bạn không muốn chạy một tệp cài sẵn, có thể [tự build từ mã nguồn](#tự-build-từ-mã-nguồn), chỉ mất vài phút.

## Lore làm được gì

- **Trả lời trước.** Hỏi thẳng ở thanh địa chỉ để nhận câu trả lời ngắn gọn kèm nguồn. Lore tra cứu Wikipedia và không bao giờ tự bịa giá cả hay dữ liệu thời gian thực. Mỗi câu do AI viết đều phải chỉ ra được dòng nguồn.
- **Trí nhớ riêng tư.** Tìm lại trang đã đọc theo ý nghĩa, ví dụ "bài về xe điện tuần trước". Chỉ mục được mã hóa và nằm trên máy bạn. Bạn có thể xem, tìm kiếm, xuất và xóa mọi thứ.
- **AI trên mọi trang.** Bảng bên cạnh giúp tóm tắt, dịch ngay tại chỗ, mở chế độ đọc gọn, rút ra thông tin chính, giải thích bằng lời dễ hiểu, và trả lời câu hỏi bằng cách trích đúng đoạn văn. Nhấp chuột phải vào văn bản đã chọn hoặc một ô nhập để viết lại, sửa lỗi, rút gọn, đổi giọng văn, dịch, giải nghĩa hay tóm tắt.
- **Tác vụ lưu lại để dùng lại.** Soạn email, sự kiện lịch hay bài đăng, hoặc tự tạo tác vụ riêng với các ô điền sẵn. Lore viết bản nháp rồi mở trong một tab mới (Gmail, Outlook, Yahoo, Google/Outlook Calendar, X, LinkedIn). **Lore không bao giờ tự gửi, tự đăng hay tự đặt lịch thay bạn.** Bạn kiểm tra rồi tự bấm nút ở dịch vụ đó.
- **Tab gọn gàng.** Nhóm tab, và một cú bấm để Lore gom tab theo chủ đề, đóng tab trùng và xếp dấu trang rời vào thư mục. Bạn xem kế hoạch trước và có thể hoàn tác. Khi lưu dấu trang, Lore gợi ý tiêu đề, thư mục và ghi chú.
- **Đọc trang an toàn.** Trước khi mô hình đọc một trang, Lore loại bỏ chữ ẩn và ký tự không nhìn thấy được, đồng thời cảnh báo khi trang cố ra lệnh cho AI. Xem [docs/ai-safety.md](docs/ai-safety.md).
- **Riêng tư ngay từ đầu.** Chặn quảng cáo và trình theo dõi (EasyList, EasyPrivacy và danh sách dành cho Việt Nam), chặn cookie bên thứ ba, bật Global Privacy Control, giảm khả năng nhận diện qua dấu vân tay trình duyệt, tự đóng thông báo cookie, cảnh báo các trang giả mạo ngân hàng và ví điện tử, chỉ hỏi quyền camera và vị trí một lần, và tab riêng tư không để lại dấu vết.
- **AI do bạn chọn.** Chạy mô hình ngay trên máy qua [Ollama](https://ollama.com), hoặc dùng khóa API riêng cho dịch vụ tương thích OpenAI hay Claude. Bạn cũng có thể tắt AI: mọi tính năng không cần mô hình vẫn hoạt động.
- **Những tính năng cơ bản.** Dấu trang có thanh riêng, trang lịch sử, tìm trong trang, trình quản lý tải xuống, tab được khôi phục sau khi khởi động lại, ghim tab, kéo để sắp xếp, mở lại tab vừa đóng, biểu tượng ổ khóa kèm cảnh báo chứng chỉ rõ ràng và menu chuột phải đầy đủ.
- **Tiếng Việt và tiếng Anh.** Giao diện và ô nhập hiểu cả hai thứ tiếng, có dấu hay không dấu.
- **Tải video** những nội dung bạn được phép lưu (tệp thường và luồng HLS). Luồng mã hóa và các nền tảng như YouTube, Netflix sẽ không bao giờ được hỗ trợ.

## Đã có và chưa có

Đã chạy được trên máy tính: mọi tính năng nêu trên, bằng cả tiếng Việt và tiếng Anh, có kiểm thử đơn vị (chạy trong CI) và kiểm thử đầu-cuối (chạy trên máy cục bộ).

Chưa có, xin đừng trông cậy vào:

| Hạng mục | Tình trạng |
|---|---|
| Bản Android, iOS | Chưa bắt đầu |
| Bản Linux | Đã đóng gói (AppImage và tar.gz) nhưng chưa từng chạy trên máy Linux thật |
| Lõi Rust dùng chung (`core/`) | Mới chỉ là chỗ giữ chỗ. Bản máy tính đang dùng bộ chặn quảng cáo viết bằng JavaScript |
| Agent làm việc với dịch vụ thật | Đã có cơ chế xác nhận trước khi hành động và bộ điều khiển trình duyệt, đã thử với một cổng demo cục bộ. **Chưa thể thanh toán hóa đơn hay đặt vé thật** |
| VPN | Chưa có |
| Đồng bộ giữa các thiết bị | Chưa có |
| Ký số và tự cập nhật | Chưa thiết lập |
| Đăng nhập Google trong Lore | Google có thể từ chối vì họ chặn trình duyệt nhúng. Lore giữ nguyên user agent của Electron và gợi ý mở trang đó bằng trình duyệt của hệ thống |
| Tiện ích mở rộng | Chưa hỗ trợ |

## Dữ liệu nào rời khỏi máy bạn

Lore không có công cụ phân tích, không thu thập dữ liệu sử dụng và không có tài khoản. Ngoài các trang web bạn tự mở, đây là toàn bộ những lần Lore kết nối mạng:

| Khi nào | Kết nối tới | Dữ liệu gửi đi |
|---|---|---|
| Bạn hỏi một câu kiến thức thông thường | `wikipedia.org` | Các từ khóa chủ đề |
| Bạn tìm kiếm trên web | `duckduckgo.com` | Câu bạn tìm kiếm |
| Khoảng mỗi tuần một lần | `easylist.to`, `abpvn.com`, `raw.githubusercontent.com` | Không gì ngoài địa chỉ IP của bạn (tải danh sách chặn quảng cáo và danh sách tên miền lừa đảo) |
| Dùng AI với mô hình chạy trên máy | Ollama của bạn (`localhost`) | Nội dung bạn nhờ xử lý, gửi tới chính máy của bạn |
| Dùng AI với khóa trên đám mây | Nhà cung cấp bạn đã cấu hình | Nội dung bạn nhờ xử lý. Phần Cài đặt cảnh báo máy chủ sẽ nhận nội dung, và mỗi kết quả đều ghi rõ văn bản đã được gửi đi đâu |
| Bạn mở bản nháp hoặc chia sẻ | Gmail, Outlook, Yahoo, X, LinkedIn, Google/Outlook Calendar | Nội dung bạn chọn mở, trong một tab bình thường |

Lịch sử duyệt web, nội dung trang và trí nhớ không bao giờ được tải lên. Cài đặt và trí nhớ được mã hóa bằng kho khóa của hệ điều hành.

## Tự build từ mã nguồn

Bạn cần **Node.js 22 trở lên** và Git.

```bash
git clone https://github.com/tevo-web/lore.git
cd lore/desktop
npm ci
npm run filters     # tải và biên dịch danh sách chặn quảng cáo (cần internet)
npm start           # chạy Lore
```

Chạy kiểm thử: `npm test` (nhanh) và `npm run test:e2e` (mở cửa sổ Electron thật; hãy thoát các ứng dụng Electron khác trước khi chạy). Đóng gói bộ cài: `npm run dist:mac`, `npm run dist:win` hoặc `npm run dist:linux`.

Để thử AI bằng mô hình chạy trên máy: cài [Ollama](https://ollama.com), sau đó mở **Cài đặt → Mô hình AI** trong Lore và chọn một mô hình.

## Đóng góp

Chúng tôi hoan nghênh báo lỗi, bản dịch, kiểm thử và pull request. Hãy đọc [CONTRIBUTING.md](CONTRIBUTING.md) trước khi bắt đầu, báo lỗi bảo mật theo cách riêng tư được nêu trong [SECURITY.md](SECURITY.md), và tuân thủ [Quy tắc ứng xử](CODE_OF_CONDUCT.md).

Một vài việc dễ làm đầu tiên: thêm câu tiếng Việt vào bộ kiểm thử cho ô nhập (`desktop/test/vn-eval.test.js`), viết thêm tác vụ dựng sẵn (`desktop/src/tasks.js`), cải thiện bản dịch (`desktop/src/ui/i18n.js`), viết bộ điều hợp cho agent, hoặc thử bản Linux.

## Giấy phép

[MIT](LICENSE) © 2026 Tevo. Các thành phần của bên thứ ba giữ giấy phép riêng của chúng, xem [docs/third-party.md](docs/third-party.md).
