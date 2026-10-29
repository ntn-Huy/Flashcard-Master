# English Flashcards Master

Ứng dụng học từ vựng tiếng Anh chạy hoàn toàn trên trình duyệt, không cần máy chủ và không cần cài đặt. Học bằng **Flashcard**, **Trắc nghiệm** và **Chính tả**, có **lặp lại ngắt quãng (SRS)**, chuỗi ngày học, điểm XP, danh hiệu, luyện phát âm bằng micro, và cài được như một ứng dụng trên điện thoại (PWA, học offline).

> Toàn bộ tiến độ học được lưu ngay trong trình duyệt của người dùng, không gửi đi đâu.

## Tính năng

**Ba chế độ học**
- **Flashcard:** lật thẻ xem nghĩa, ví dụ và phiên âm. Vuốt trái = *Ôn lại*, vuốt phải = *Đã thuộc*. Học theo phiên: từ đã thuộc rời khỏi vòng, từ ôn lại quay lại sau 4 thẻ, học hết thì có màn hình chúc mừng.
- **Trắc nghiệm:** nghe/đọc từ tiếng Anh rồi chọn nghĩa đúng. Trả lời đúng tự chuyển câu, trả lời sai thì từ đó quay lại cuối hàng cho đến khi đúng hết.
- **Chính tả:** nghe phát âm rồi gõ lại từ tiếng Anh, có thanh tiến độ và màn hình hoàn thành.

**Học thông minh**
- **SRS:** từ đúng thì được giãn dần thời gian ôn (1, 3, 7, 14, 30, 60, 120 ngày); từ sai hoặc "Ôn lại" quay lại ngay trong ngày. Phạm vi học có mục **Đến hạn ôn hôm nay** và **Từ hay quên (tất cả bài)** gom từ mọi bộ bài.
- **Phạm vi học linh hoạt:** chia theo mục tiêu từ/ngày, học tích lũy, hoặc chọn khoảng tùy ý; có thể xáo trộn thứ tự.
- **Đọc tự động** từ khi sang thẻ/câu mới (bật/tắt trên header) và **luyện phát âm** bằng micro (chấm theo độ giống từ gốc).
- **Âm thanh hiệu ứng** khi trả lời đúng/sai.

**Động lực**
- Chuỗi ngày học liên tiếp, điểm XP, và **24 danh hiệu** theo nhóm (từ vựng, chuỗi ngày, chính tả, trắc nghiệm, phát âm, SRS, hoàn thành, XP, danh hiệu bí mật). Danh hiệu chưa mở có thanh tiến độ.
- Tab **Thống kê** hiển thị tiến độ ghi nhớ toàn bộ từ vựng.

**Dữ liệu**
- Nạp bộ bài từ file Excel/CSV trong thư mục `data/` (tự cập nhật khi file thay đổi trên GitHub), hoặc người dùng tự bấm **Nhập Excel** để thêm bộ bài riêng. Có hướng dẫn định dạng và file mẫu ngay trong app.

## Cấu trúc repo

```
.
├── index.html                  # Toàn bộ ứng dụng (HTML + CSS + JavaScript)
├── sw.js                       # Service worker: học offline, cập nhật phiên bản
├── manifest.webmanifest        # Khai báo PWA (tên, màu, icon)
├── icon-192.png
├── icon-512.png
├── icon-maskable-512.png
└── data/
    ├── files.json              # (Tùy chọn) danh sách file bộ bài cần nạp
    ├── Vocabulary_A1.xlsx      # Ví dụ bộ bài
    └── Vocabulary_A2.xlsx
```

## Triển khai lên GitHub Pages

1. Tạo repo trên GitHub và tải lên tất cả các file ở trên (giữ nguyên cấu trúc).
2. Vào **Settings → Pages**.
3. Ở mục **Build and deployment**, chọn **Source: Deploy from a branch**, chọn nhánh `main` và thư mục `/ (root)`, rồi bấm **Save**.
4. Đợi khoảng 1-2 phút, truy cập `https://<tên-tài-khoản>.github.io/<tên-repo>/`.

Mọi đường dẫn trong ứng dụng đều là đường dẫn tương đối nên chạy được cả khi repo nằm trong thư mục con như trên.

### Chạy thử trên máy

Mở trực tiếp file `index.html` bằng đường dẫn `file://` sẽ **không** nạp được thư mục `data/` và không bật được service worker. Hãy chạy một máy chủ tĩnh đơn giản trong thư mục repo:

```bash
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

## Thêm bộ bài từ vựng

Có hai cách:

**1. Thêm vào repo (mọi người dùng đều thấy):**
1. Chép file `.xlsx` (hoặc `.xls`, `.csv`) vào thư mục `data/`. Tên bộ bài lấy từ tên file (dấu `_` đổi thành khoảng trắng).
2. Tạo hoặc sửa `data/files.json`, liệt kê tên các file cần nạp:
   ```json
   ["Vocabulary_A1.xlsx", "Vocabulary_A2.xlsx", "Vocabulary_B1.xlsx"]
   ```
3. Commit và push. Người dùng mở lại trang sẽ nhận bộ bài mới hoặc nội dung đã cập nhật.

Nếu không có `files.json`, ứng dụng dùng danh sách mặc định khai báo trong `index.html` (biến `DEFAULT_DATA_FILES`). Tiến độ của các từ đã học được giữ nguyên khi bạn cập nhật file, miễn là từ đó không đổi tên.

**2. Người dùng tự nhập:** bấm nút **Nhập Excel** trên thanh trên cùng, làm theo hướng dẫn và chọn file. Bộ bài này chỉ lưu trong trình duyệt của người đó.

### Định dạng file Excel

| Word | Phonetic | Meaning | Example |
|---|---|---|---|
| apple | /ˈæp.əl/ | quả táo | I eat an apple every day. |
| book | /bʊk/ | quyển sách | She is reading a book. |

- Dữ liệu nằm ở **Sheet đầu tiên**; dòng đầu là tiêu đề, mỗi dòng sau là một từ.
- **Bắt buộc:** cột `Word` (hoặc `Từ vựng`) và `Meaning` (hoặc `Nghĩa`). **Tùy chọn:** `Phonetic` (hoặc `Phiên âm`) và `Example` (hoặc `Ví dụ`).
- Tên cột không phân biệt hoa/thường, thứ tự cột tùy ý, tiêu đề nằm trong 10 dòng đầu.
- Nếu không có tiêu đề, ứng dụng đọc theo thứ tự cột B = từ, C = phiên âm, D = nghĩa, E = ví dụ, bắt đầu từ dòng 2.
- Dòng thiếu `Word` hoặc `Meaning` bị bỏ qua. Không gộp ô, không dùng công thức/hình ảnh. File CSV nên lưu dạng UTF-8.

Trong ứng dụng có nút **Tải file mẫu (.xlsx)** để lấy file đúng định dạng.

## Phím tắt và cử chỉ

| Màn hình | Thao tác | Tác dụng |
|---|---|---|
| Flashcard | `Space` hoặc chạm vào thẻ | Lật thẻ |
| Flashcard | `←` hoặc vuốt trái | Ôn lại |
| Flashcard | `→` hoặc vuốt phải | Đã thuộc |
| Flashcard | `Shift + ←` / `Shift + →` | Thẻ trước / thẻ tiếp (chỉ duyệt, không chấm) |
| Trắc nghiệm | `1` `2` `3` `4` | Chọn đáp án |
| Trắc nghiệm | `Enter` | Sang câu tiếp (sau khi đã trả lời) |

## Điểm XP

| Hành động | XP |
|---|---|
| Đánh dấu "Đã thuộc" lần đầu trong phiên | +5 |
| Trắc nghiệm đúng | +10 |
| Chính tả đúng | +15 |
| Phát âm đạt (từ 80%) | +5 |
| Hoàn thành một phiên không sai/ôn lại lần nào | +50 |
| Mở một danh hiệu | +50 |

## Cài đặt như ứng dụng và học offline

- Trên **Chrome/Edge (máy tính và Android):** dùng menu của trình duyệt chọn *Cài đặt ứng dụng* / *Thêm vào màn hình chính*.
- Trên **iPhone/iPad:** mở bằng Safari, chọn *Chia sẻ → Thêm vào MH chính*.
- Truy cập **một lần khi có mạng** để ứng dụng lưu sẵn mọi thứ cần thiết; sau đó mở được cả khi không có mạng.
- Luyện phát âm bằng micro cần HTTPS (GitHub Pages đã có) và trình duyệt hỗ trợ nhận dạng giọng nói (Chrome, Edge, Safari).

## Cập nhật phiên bản

Chỉ cần commit và push lên GitHub. Với các file cùng tên miền (`index.html`, `data/`), service worker luôn ưu tiên lấy bản mới khi có mạng, và ứng dụng sẽ báo "Có phiên bản mới" để người dùng tải lại trang.

Nếu bạn đổi tên hoặc thêm file tĩnh cần lưu offline (ví dụ icon), hãy tăng số phiên bản của `CACHE` ở đầu file `sw.js` (`flashcard-v4` → `flashcard-v5`) để trình duyệt xóa bộ nhớ đệm cũ.

## Dữ liệu và quyền riêng tư

- Bộ bài người dùng nhập, tiến độ SRS, danh sách đã thuộc/ôn lại, XP, chuỗi ngày và danh hiệu đều lưu trong `localStorage` của trình duyệt, trên từng thiết bị.
- **Không đồng bộ** giữa các thiết bị, và xóa dữ liệu trình duyệt sẽ mất tiến độ. Nút xóa dữ liệu trong tab Thống kê cũng xóa toàn bộ.
- Ứng dụng không có máy chủ riêng và không thu thập dữ liệu. Nhận dạng giọng nói do trình duyệt xử lý (có thể gửi âm thanh tới dịch vụ của nhà cung cấp trình duyệt).

## Công nghệ

HTML, JavaScript thuần (không cần build) cùng các thư viện tải từ CDN:
[Tailwind CSS](https://tailwindcss.com/), [Font Awesome 6.4](https://fontawesome.com/), [SheetJS (xlsx 0.18.5)](https://sheetjs.com/), [canvas-confetti](https://github.com/catdad/canvas-confetti). Đọc phát âm và nhận dạng giọng nói dùng Web Speech API; âm thanh hiệu ứng dùng Web Audio API.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Bộ bài trong `data/` không hiện | Kiểm tra tên file trong `data/files.json` đúng từng chữ (kể cả hoa/thường), và mở trang qua `http(s)://` chứ không phải `file://`. |
| Nhập Excel báo "Không tìm thấy từ vựng hợp lệ" | File cần có tối thiểu hai cột `Word` và `Meaning` ở Sheet đầu tiên. Bấm **Nhập Excel** để xem hướng dẫn và tải file mẫu. |
| Đã push nhưng trang vẫn là bản cũ | Tải lại cứng (`Ctrl+Shift+R`), hoặc đợi vài phút để GitHub Pages triển khai xong. Nếu vẫn cũ, tăng số phiên bản `CACHE` trong `sw.js`. |
| Không có tiếng đọc từ | Kiểm tra nút loa trên header đã bật, âm lượng thiết bị, và trình duyệt có giọng đọc tiếng Anh. |
| Nút micro không hoạt động | Cho phép quyền micro cho trang, và dùng Chrome/Edge/Safari qua HTTPS. |
