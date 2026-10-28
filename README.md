# 📚 English Flashcards Master

**English Flashcards Master** là một ứng dụng web học từ vựng tiếng Anh hiện đại, nhẹ, mượt mà và hoàn toàn miễn phí. Ứng dụng cho phép người dùng tự tải lên danh sách từ vựng từ các file **Excel (`.xlsx`, `.xls`)** hoặc **CSV**, tự động tạo các thẻ Flashcard tương tác, làm bài tập trắc nghiệm, và luyện viết chính tả.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## ✨ Tính Năng Nổi Bật

### 📂 1. Quản Lý Đa Bộ Flashcard (Multi-Deck Support)
- **Tải lên linh hoạt:** Hỗ trợ nhập file Excel/CSV có cấu trúc tiêu đề linh hoạt (tự động nhận diện dòng tiêu đề `Word`, `Phonetic`, `Meaning`, `Example` ngay cả khi file có dòng trống hoặc banner đầu trang).
- **Phân loại bộ bài:** Quản lý riêng biệt nhiều bộ bài khác nhau (*Vocabulary A2, Business English, IELTS,...*).
- **Học linh hoạt:** Dễ dàng chọn học theo từng bộ bài riêng lẻ hoặc gộp tất cả các bộ bài lại để luyện tập.

### 🎯 2. Lập Kế Hoạch Học Tập Theo Ngày (Daily Target & Range Selector)
- **Mục tiêu mỗi ngày:** Tùy chỉnh số lượng từ học trong 1 ngày (ví dụ: 30 từ/ngày).
- **Tự động chia ngày:** Hệ thống tự tính toán và chia từ vựng thành Ngày 1 (Từ 1-30), Ngày 2 (Từ 31-60),...
- **Tùy chọn phạm vi:** 
  - Học từ trong ngày hiện tại.
  - Ôn tập tích lũy từ Ngày 1 đến ngày hiện tại.
  - Tự chọn khoảng từ X đến Y tùy ý.
- **Thứ tự linh hoạt:** Chuyển đổi giữa thứ tự gốc trong file Excel và xáo trộn ngẫu nhiên (*Shuffle*).

### 🕹️ 3. Các Chế Độ Học Đa Dạng
1. **🎴 Thẻ Flashcard 3D:** Lật thẻ mượt mà xem nghĩa & ví dụ, tích hợp phát âm chuẩn (Text-to-Speech), đánh dấu từ cần ôn hoặc từ đã thuộc.
2. **📝 Trắc Nghiệm (Quiz Mode):** Tự động tạo câu hỏi 4 lựa chọn ngẫu nhiên dựa trên bộ từ vựng đã chọn.
3. **⌨️ Luyện Chính Tả (Spelling Mode):** Luyện nhớ mặt chữ bằng cách nghe phát âm, xem nghĩa và gõ chính xác từ tiếng Anh.
4. **📊 Bảng Thống Kê (Dashboard):** Theo dõi tiến độ học tập, tỷ lệ thuộc bài, tổng số từ đã thuộc/cần ôn.

### 🎨 4. Giao Diện & Tương Tác
- **Dark Mode & Light Mode:** Tự động hoặc tùy chỉnh chế độ sáng/tối sắc nét.
- **Responsive 100%:** Tối ưu mượt mà trên cả máy tính, tablet và điện thoại di động.
- **Bấm giờ học tập (Study Timer):** Theo dõi thời gian tập trung học bài.
- **Lưu trữ bảo mật:** Tất cả dữ liệu tiến độ và bộ bài được lưu trực tiếp trên trình duyệt của người dùng (`LocalStorage`), không lo lộ dữ liệu hay cần máy chủ lưu trữ.

---

## 🚀 Hướng Dẫn Sử Dụng Trực Tiếp

Không cần cài đặt Node.js hay Build Tool phức tạp, ứng dụng chạy 100% trên trình duyệt web!

1. **Thao tác nhanh:** Tải file `index.html` về máy tính.
2. Click đúp vào file `index.html` để mở trực tiếp bằng Chrome, Edge, Safari hoặc Firefox.
3. Tải file Excel của bạn lên bằng nút **"Nhập File Excel"** và bắt đầu học ngay!

---

## 📊 Định Dạng File Excel Mẫu

Để ứng dụng đọc dữ liệu chính xác nhất, file Excel (`.xlsx`, `.xls`) của bạn nên bao gồm các cột sau ở dòng tiêu đề:

| STT | Word | Phonetic | Meaning | Example |
| :---: | :--- | :--- | :--- | :--- |
| 1 | ability | `/ə'bɪləti/` | khả năng | She has the ability to pass the exam. |
| 2 | able | `/ˈeɪ.bəl/` | có thể | I am able to swim. |
| 3 | abroad | `/ə'brɔ:d/` | nước ngoài | They went abroad for their holiday. |

> **Lưu ý:** Nếu file Excel của bạn có các dòng ghi chú hoặc tên bài ở Dòng 1 (ví dụ `Vocabulary A2`), ứng dụng vẫn tự động quét và tìm đúng dòng tiêu đề chứa `Word` và `Meaning`.

---

## 🛠️ Công Nghệ Sử Dụng

- **HTML5 & Vanilla JavaScript (ES6+)** - Xử lý logic thuần, hiệu năng cao.
- **Tailwind CSS (CDN)** - Framework giao diện hiện đại, tối ưu responsive.
- **SheetJS (xlsx.full.min.js)** - Đọc và xử lý file Excel/CSV ngay tại client.
- **Canvas Confetti** - Hiệu ứng pháo hoa khi hoàn thành bài học.
- **FontAwesome 6** - Hệ thống icon trực quan.
- **Web Speech API** - Phát âm từ vựng tiếng Anh chuẩn giọng đọc trình duyệt.

---

## 🌐 Deploy Lên Internet Miễn Phí

Bạn có thể dễ dàng đưa ứng dụng này lên mạng cho mọi người cùng dùng bằng các nền tảng miễn phí:

### 1. Netlify Drop (Đơn giản nhất)
1. Bỏ file `index.html` vào một thư mục.
2. Truy cập [app.netlify.com/drop](https://app.netlify.com/drop) và kéo thả thư mục vào.
3. Nhận đường link trang web ngay lập tức!

### 2. GitHub Pages
1. Tạo một Repository mới trên GitHub và upload file `index.html`.
2. Vào **Settings** > **Pages** > Chọn branch `main` và ấn **Save**.

---

## 📝 License

Dự án được phân phối dưới giấy phép **MIT License**. Bạn có thể tự do sử dụng, chỉnh sửa và chia sẻ.
