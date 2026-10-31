# Hướng dẫn cập nhật dự án lên GitHub (nâng cấp lên phiên bản 5)

Có hai cách. **Cách A (trên trình duyệt)** không cần cài gì, phù hợp nếu bạn chưa quen Git. **Cách B (dòng lệnh)** nhanh hơn nếu bạn đã dùng Git.

> Dữ liệu học của người dùng nằm trong trình duyệt của họ, **không** nằm trong repo. Bản mới tự chuyển dữ liệu cũ sang định dạng mới khi họ mở lại trang, nên không ai mất tiến độ. Điều kiện: giữ nguyên **tên repo** (địa chỉ trang `...github.io/<tên-repo>/` không đổi).

## Chuẩn bị

1. Giải nén file `english-flashcards-v5.zip` ra một thư mục trên máy.
2. **Không đụng vào thư mục `data/`** trong repo của bạn (đây là nơi chứa các file Excel của bạn). Bản zip cố ý không có thư mục này.
3. (Khuyến nghị) Tạo bản lưu dự phòng của phiên bản cũ: trên trang repo, bấm nhánh `main` → gõ tên `backup-v4` → **Create branch**. Nếu có sự cố, bạn có thể quay lại nhánh này.

## Cách A: Cập nhật ngay trên github.com

1. Mở repo của bạn trên github.com, đảm bảo đang ở nhánh `main`.
2. Bấm **Add file → Upload files**.
3. Mở thư mục đã giải nén, **chọn tất cả nội dung bên trong** (không kéo thả chính thư mục cha) và kéo vào khung tải lên của GitHub. Trình duyệt Chrome/Edge sẽ giữ nguyên cấu trúc thư mục con (`css/`, `js/`, `vendor/`, `scripts/`, `tests/`, `.github/`...).
   - Tệp ẩn `.github` và `.gitignore` có thể không hiện trong thư mục của bạn. Trên Windows: tab *View* → bật *Hidden items*. Trên Mac: nhấn `Cmd+Shift+.`.
   - Nếu GitHub báo vượt giới hạn số file trong một lần tải (100 file), hãy tải làm hai đợt: đợt 1 gồm `index.html`, `sw.js`, `manifest.webmanifest`, các file `.png`, thư mục `css/`, `js/`, `vendor/`; đợt 2 gồm phần còn lại.
4. Cuộn xuống ô **Commit changes**, ghi thông điệp, ví dụ `Nâng cấp lên phiên bản 5`, chọn **Commit directly to the main branch**, bấm **Commit changes**.
5. Vào tab **Actions** để theo dõi: dòng *pages build and deployment* sẽ chạy và hiện dấu ✓ xanh sau khoảng 1-2 phút.

## Cách B: Dùng Git

```bash
git clone https://github.com/<tên-tài-khoản>/<tên-repo>.git
cd <tên-repo>
git checkout -b backup-v4 && git push -u origin backup-v4   # (khuyến nghị) lưu bản cũ
git checkout main

# Chép toàn bộ nội dung đã giải nén vào thư mục repo (ghi đè file trùng tên, KHÔNG xóa thư mục data/)
cp -R /đường/dẫn/thư-mục-giải-nén/. .

git add .
git commit -m "Nâng cấp lên phiên bản 5"
git push origin main
```

## Kiểm tra sau khi cập nhật

1. Đợi dấu ✓ xanh ở tab **Actions** (mục *pages build and deployment*).
2. Mở trang web, bấm `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`). Trên điện thoại: đóng hẳn trình duyệt và mở lại **hai lần** (lần đầu để tải bản mới, lần hai để áp dụng).
3. Bạn đã có bản mới nếu thấy:
   - Biểu tượng **bánh răng** (Cài đặt) trên thanh trên cùng.
   - Khung **Học hôm nay** ở đầu trang Bộ bài.
   - Tab Thống kê có Lịch hoạt động, Cấp độ và nút **Sao lưu / Khôi phục**.
4. Mở một bộ bài, học thử vài thẻ, thử nút **Hoàn tác**.
5. Với người đã cài ứng dụng ra màn hình chính: mở app một lần khi có mạng, sẽ thấy thông báo "Có phiên bản mới - hãy tải lại trang". Tải lại là xong.

Mẹo: nên **Sao lưu** tiến độ của chính bạn (Thống kê → Sao lưu) ngay sau khi nâng cấp xong, để có sẵn một bản dự phòng.

## Nếu có sự cố: quay lại bản cũ

- **Trên github.com:** vào tab **Code** → bấm *commits* → mở commit "Nâng cấp lên phiên bản 5" → bấm **Revert** (nút dấu ba chấm) → tạo pull request và **Merge**. Hoặc đổi nhánh mặc định về `backup-v4` ở *Settings → Branches* và chọn nhánh đó trong *Settings → Pages*.
- **Bằng Git:** `git revert HEAD` rồi `git push`.

## Công việc thường ngày sau này

**Thêm hoặc sửa bộ bài (không cần đổi số phiên bản):**
1. Vào thư mục `data/` trên GitHub → **Add file → Upload files** → tải file `.xlsx` mới (file cùng tên sẽ được ghi đè).
2. Mở `data/files.json` (nếu chưa có thì **Add file → Create new file**, đặt tên `data/files.json`), bấm biểu tượng bút chì và thêm tên file vào danh sách, ví dụ:
   ```json
   ["Vocabulary_A1.xlsx", "Vocabulary_A2.xlsx", "Vocabulary_B1.xlsx"]
   ```
3. Bấm **Commit changes**. Người dùng mở lại trang sẽ thấy bộ bài mới.

**Sửa code (js, css, index.html):** tăng số phiên bản ở hai nơi (đổi mọi `?v=5` thành `?v=6` trong `index.html` và `sw.js`, và `flashcard-v5` thành `flashcard-v6` trong `sw.js`). Nhớ làm cả hai, nếu không người dùng có thể gặp trang lỗi do lẫn file cũ và mới.

**Đọc kết quả kiểm tra tự động:** sau mỗi lần commit, tab **Actions** hiện dấu ✓ (ổn) hoặc ✗ (có lỗi). Bấm vào lần chạy bị ✗ để xem dòng báo lỗi, ví dụ file Excel thiếu cột `Meaning`, tên file trong `files.json` gõ sai, hoặc số phiên bản hai nơi không khớp. Lỗi này không làm hỏng trang đang chạy, nhưng nên sửa sớm.

**Khi thêm tính năng cần class Tailwind mới:** chạy `npm install` rồi `npm run build:css` trên máy và commit file `css/tailwind.css` mới. Nếu chỉ thêm bộ bài hay sửa chữ thì không cần.
