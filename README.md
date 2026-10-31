# English Flashcards Master

Ứng dụng học từ vựng tiếng Anh chạy hoàn toàn trên trình duyệt, đặt trên **GitHub Pages**, không cần máy chủ. Học bằng **Flashcard**, **Trắc nghiệm** và **Chính tả**, có lặp lại ngắt quãng (SRS), nhiệm vụ hằng ngày, cấp độ, danh hiệu, luyện phát âm bằng micro, và cài được như một ứng dụng trên điện thoại (PWA, học offline).

> Mọi tiến độ học được lưu ngay trên thiết bị của người dùng, không gửi đi đâu. Toàn bộ thư viện đã được lưu sẵn trong repo, trang không gọi bất kỳ CDN bên ngoài nào.

## Tính năng

**Học tập**
- **Flashcard theo phiên:** chạm để lật, vuốt trái = *Ôn lại*, vuốt phải = *Đã thuộc*. Từ đã thuộc rời khỏi vòng, từ ôn lại quay lại sau vài thẻ (chỉnh được), học hết thì có màn hình chúc mừng. Có thanh tiến độ, nút **Hoàn tác**, và 4 mức đánh giá SRS: *Quên · Khó · Tốt · Dễ*.
- **Trắc nghiệm:** tự chuyển câu khi đúng, từ sai quay lại đến khi đúng hết. Đáp án nhiễu được chọn thông minh (cùng loại từ, độ dài và chữ gần giống).
- **Chính tả:** gợi ý từng bước, tô đỏ đúng những chữ viết sai, từ sai quay lại cuối hàng.
- **Học hai chiều:** Anh → Việt hoặc Việt → Anh cho Flashcard và Trắc nghiệm.
- **Học hôm nay:** một nút gom từ đến hạn ôn (SRS) và từ mới theo mục tiêu ngày.
- **Tiếp tục phiên học dở:** đóng trang giữa chừng vẫn quay lại học tiếp đúng chỗ.
- **Mẹo nhớ & Từ ma:** ghi mẹo nhớ riêng cho từng từ; từ quên từ 5 lần trở lên được gắn nhãn 👻.
- **Đọc tự động**, giọng Mỹ/Anh, tốc độ đọc chỉnh được; **luyện phát âm** bằng micro.

**Động lực và thống kê**
- Chuỗi ngày học (có **đóng băng chuỗi**), XP, **cấp độ** (10 bậc), **3 nhiệm vụ mỗi ngày**, và **24 danh hiệu** (có thanh tiến độ và danh hiệu bí mật).
- Thống kê: lịch hoạt động 12 tuần, biểu đồ 14 ngày, độ chính xác theo chế độ, phân bố trạng thái ghi nhớ, top 10 từ khó nhất.

**Dữ liệu và độ bền**
- **Sao lưu / khôi phục** tiến độ bằng một file; nhắc sao lưu nếu quá 14 ngày.
- Bộ bài người dùng tự nhập lưu trong **IndexedDB** (chứa được hàng chục nghìn từ), bộ bài mặc định lấy từ thư mục `data/` và tự cập nhật khi file đổi.
- **Chống XSS:** mọi nội dung từ file Excel đều được lọc khi hiển thị, kèm Content-Security-Policy chỉ cho phép kết nối tới chính website.
- **Cài đặt** (bánh răng): âm thanh, âm lượng, giọng đọc, cỡ chữ, giảm chuyển động, rung, số thẻ quay lại sau "Ôn lại"...
- Khả năng tiếp cận: điều hướng bàn phím, nhãn cho trình đọc màn hình, hướng dẫn nhanh lần đầu (mở lại bằng phím `?`).

## Cấu trúc repo

```
.
├── index.html                  # Trang chính
├── css/
│   ├── tailwind.css            # CSS đã biên dịch (npm run build:css)
│   └── app.css                 # CSS riêng của ứng dụng
├── js/
│   ├── app.js                  # Logic chính: dữ liệu, thẻ, trắc nghiệm, chính tả
│   └── features.js             # Hệ thống bổ sung: cài đặt, sao lưu, nhiệm vụ, thống kê...
├── vendor/                     # Thư viện đã lưu sẵn (SheetJS, confetti, Font Awesome)
├── data/                       # Bộ bài của bạn (file Excel) + files.json
├── sw.js                       # Service worker (offline)
├── manifest.webmanifest        # Khai báo PWA
├── icon-*.png
├── scripts/                    # Công cụ kiểm tra dữ liệu, chép thư viện
├── tests/                      # Kiểm thử tự động
├── .github/workflows/ci.yml    # Tự kiểm tra mỗi lần push
└── package.json
```

## Triển khai lên GitHub Pages

1. Đưa toàn bộ file lên repo (xem **HUONG_DAN_CAP_NHAT_GITHUB.md**).
2. Vào **Settings → Pages**, chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`, bấm **Save**.
3. Sau khoảng 1-2 phút, mở `https://<tên-tài-khoản>.github.io/<tên-repo>/`.

Mọi đường dẫn đều là đường dẫn tương đối nên chạy được khi repo nằm trong thư mục con.

**Chạy thử trên máy:** không mở trực tiếp bằng `file://`, hãy chạy máy chủ tĩnh trong thư mục repo:

```bash
python3 -m http.server 8000      # rồi mở http://localhost:8000
```

## Thêm bộ bài từ vựng

**Cách 1: thêm vào repo (mọi người dùng đều thấy)**
1. Chép file `.xlsx` (hoặc `.xls`, `.csv`) vào thư mục `data/`. Tên bộ bài lấy từ tên file (dấu `_` đổi thành khoảng trắng).
2. Liệt kê tên file trong `data/files.json`:
   ```json
   ["Vocabulary_A1.xlsx", "Vocabulary_A2.xlsx", "Vocabulary_B1.xlsx"]
   ```
3. Commit và push. Người dùng mở lại trang sẽ nhận bộ bài mới hoặc nội dung đã cập nhật. Tiến độ của các từ không đổi tên vẫn được giữ.

Nếu không có `files.json`, ứng dụng dùng danh sách mặc định khai báo trong `js/app.js` (biến `DEFAULT_DATA_FILES`).

**Cách 2: người dùng tự nhập:** bấm **Nhập Excel** trên thanh trên cùng, xem hướng dẫn, tải file mẫu và chọn file. Bộ bài này chỉ lưu trên thiết bị của người đó.

### Định dạng file Excel

| Word | Phonetic | Meaning | Example |
|---|---|---|---|
| apple | /ˈæp.əl/ | quả táo | I eat an apple every day. |
| book | /bʊk/ | quyển sách | She is reading a book. |

- Dữ liệu ở **Sheet đầu tiên**; dòng đầu là tiêu đề, mỗi dòng sau là một từ.
- **Bắt buộc:** `Word` (hoặc `Từ vựng`) và `Meaning` (hoặc `Nghĩa`). **Tùy chọn:** `Phonetic` (`Phiên âm`), `Example` (`Ví dụ`).
- Tên cột không phân biệt hoa/thường, thứ tự tùy ý, tiêu đề nằm trong 10 dòng đầu. Không có tiêu đề thì đọc theo cột B, C, D, E từ dòng 2.
- Dòng thiếu `Word` hoặc `Meaning` bị bỏ qua. Không gộp ô, không công thức. File CSV nên lưu UTF-8.
- Chạy `npm run validate` để kiểm tra các file trong `data/` trước khi đẩy lên.

## Cách chấm điểm ghi nhớ

| Nút / phím | Ý nghĩa | Lịch ôn tiếp theo |
|---|---|---|
| Ôn lại (`1`, `←`, vuốt trái) | Quên | Học lại ngay hôm nay |
| Khó (`2`) | Nhớ nhưng khó | Ngày mai |
| Đã thuộc (`3`, `→`, vuốt phải) | Tốt | Tăng một bậc: 1, 3, 7, 14, 30, 60, 120 ngày |
| Dễ (`4`) | Quá dễ | Tăng hai bậc |

Phím khác: `Space` lật thẻ, `Shift+←/→` thẻ trước/sau, `Z` hoàn tác, `?` mở hướng dẫn. Trắc nghiệm: `1-4` chọn đáp án, `Enter` câu tiếp theo.

Chỉ lần chấm **đầu tiên** của mỗi từ trong một phiên được tính vào SRS và XP, để việc nhớ ngắn hạn không làm lịch ôn bị lệch.

## Dữ liệu và quyền riêng tư

- Tiến độ, XP, nhật ký học, mẹo nhớ... nằm trong `localStorage`; bộ bài người dùng nhập nằm trong IndexedDB của trình duyệt.
- **Không đồng bộ** giữa các thiết bị. Dùng nút **Sao lưu** (tab Thống kê) rồi **Khôi phục** trên thiết bị khác. Safari có thể xóa dữ liệu trang sau 7 ngày không dùng nếu chưa thêm vào màn hình chính, nên hãy sao lưu định kỳ.
- Ứng dụng không có máy chủ riêng và không thu thập dữ liệu. Nhận dạng giọng nói do trình duyệt xử lý.

## Cập nhật phiên bản

Mỗi lần **sửa file trong `js/`, `css/` hoặc `index.html`**, hãy tăng số phiên bản ở hai nơi để mọi người dùng nhận bản mới ngay:

1. Trong `index.html` và `sw.js`: đổi tất cả `?v=5` thành `?v=6`.
2. Trong `sw.js`: đổi `flashcard-v5` thành `flashcard-v6`.

(Dùng chức năng Tìm & Thay thế của trình soạn thảo.) Sửa file Excel trong `data/` thì **không** cần đổi số phiên bản. `npm run validate` sẽ báo lỗi nếu hai nơi không khớp nhau.

## Dành cho người phát triển

```bash
npm install            # cài công cụ (chỉ để phát triển, không cần khi chỉ thêm bộ bài)
npm run build:css      # biên dịch lại css/tailwind.css (khi thêm class Tailwind mới)
npm run vendor         # chép lại thư viện vào vendor/
npm run validate       # kiểm tra data/ và số phiên bản
npm test               # chạy kiểm thử tự động (jsdom)
npm run check          # chạy tất cả kiểm tra như CI
```

Mỗi lần push, **GitHub Actions** (`.github/workflows/ci.yml`) tự chạy `npm run check`; dấu ✗ đỏ cạnh commit nghĩa là có lỗi cần xem lại.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Đã push nhưng trang vẫn là bản cũ | Đợi 1-2 phút để GitHub Pages triển khai, rồi tải lại cứng (`Ctrl+Shift+R`) hoặc đóng hẳn tab và mở lại. Nếu bạn sửa code, nhớ tăng số phiên bản (mục trên). |
| Bộ bài trong `data/` không hiện | Kiểm tra tên trong `data/files.json` đúng từng chữ (kể cả hoa/thường); chạy `npm run validate`. |
| Nhập Excel báo "Không tìm thấy từ vựng hợp lệ" | File cần tối thiểu hai cột `Word` và `Meaning` ở Sheet đầu tiên. Bấm **Nhập Excel** để xem hướng dẫn và tải file mẫu. |
| Muốn dùng lại bộ bài mặc định đã ẩn | Cài đặt (bánh răng) → *Hiện lại các bộ bài đã ẩn*. |
| Không có tiếng đọc từ | Kiểm tra Cài đặt đã bật tự động đọc, âm lượng thiết bị, và trình duyệt có giọng tiếng Anh. |
| Micro không hoạt động | Cho phép quyền micro; dùng Chrome/Edge/Safari qua HTTPS. |
