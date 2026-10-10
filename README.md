# Nghe Tiếng Hàn

Ứng dụng luyện nghe tiếng Hàn qua video YouTube. Dán link video để xem và học theo transcript đồng bộ; chọn từng câu để nghe lại hoặc luyện chép chính tả.

## Tính năng

- Tìm phụ đề tiếng Hàn do người tạo video cung cấp hoặc do YouTube tạo tự động.
- Dùng phụ đề YouTube dịch sang tiếng Hàn khi video không có track tiếng Hàn gốc.
- Tạo transcript tiếng Hàn bằng Gemini khi không lấy được phụ đề; nếu lời gốc là ngôn ngữ khác, AI dịch sang tiếng Hàn. Kết quả không đạt kiểm tra Hangul sẽ không được hiển thị.
- Luyện chép chính tả với ba mức độ, chọn 1–3 câu mỗi lượt, điều chỉnh tốc độ và xem đối chiếu từng từ.
- Transcript đồng bộ với video; bấm câu để tua đến đoạn tương ứng.
- Nhấn logo để tải lại trang và xóa video, phụ đề cùng dữ liệu tạm của phiên hiện tại.

## Chạy trên máy

Cần Python và pip. Backend phục vụ cả API lẫn frontend.

**Windows PowerShell**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --port 8000
```

**macOS / Linux**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8000
```

Mở http://localhost:8000. Để dùng AI, nhập Gemini API key trong ứng dụng hoặc đặt `GEMINI_API_KEY` trong `backend/.env`. Model mặc định là `gemini-3.8-flash`; có thể đổi bằng `GEMINI_MODEL`. Khởi động lại backend sau khi sửa `.env`.

Chạy kiểm thử backend từ thư mục `backend`:

```bash
python -m pytest tests
```

## Triển khai

GitHub Pages chỉ triển khai frontend. Backend Python vẫn phải chạy riêng; khi dùng trang Pages, cấu hình frontend gọi đến backend đang chạy tại máy người dùng hoặc máy chủ của bạn. YouTube có thể giới hạn việc lấy phụ đề, đặc biệt từ IP máy chủ đám mây.

## Lưu ý

- Gemini chỉ xử lý video công khai được hỗ trợ; hạn mức API và độ dài video có thể giới hạn việc tạo transcript. Nội dung và thời gian do AI tạo có thể chưa chính xác.
- Nếu YouTube trả HTTP 429 khi tải phụ đề, hãy chờ rồi thử lại hoặc xác nhận dùng AI.
- Video không cho phép nhúng sẽ không phát được trong ứng dụng.
- `yt-dlp` là công cụ không chính thức; YouTube có thể thay đổi khiến việc lấy phụ đề bị gián đoạn.

## Lịch sử phiên bản

- **v3.3** — AI tạo phụ đề tiếng Hàn; dịch sang tiếng Hàn nếu lời gốc ở ngôn ngữ khác và kiểm tra kết quả có Hangul.
- **v3.2** — Đổi model Gemini mặc định sang `gemini-3.8-flash`.
- **v3.1** — Thêm retry khi YouTube giới hạn tải phụ đề và hướng xử lý thay thế bằng AI.
- **v3.0** — Hỗ trợ phụ đề YouTube dịch tự động sang tiếng Hàn.
- **v2.0** — Thêm chế độ chép chính tả và cải thiện giao diện.
