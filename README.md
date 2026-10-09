# nghetienghan v2.0

Mới ở v2.0: tab **Chép chính tả** (3 mức độ, gộp 1–3 câu mỗi lượt, tốc độ 0.5x–1x, đối chiếu từng từ và chấm điểm), giao diện thân thiện hơn, bỏ mục Luyện nói.

Website luyện nghe tiếng Hàn qua YouTube: dán link → nhúng video → lấy phụ đề (người tạo → tự động → AI, chỉ khi bạn xác nhận) → transcript đồng bộ, bấm câu để tua.

## Chạy trên máy (localhost)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # tùy chọn: điền GEMINI_API_KEY (lấy miễn phí ở aistudio.google.com)
uvicorn app.main:app --port 8000
```
Mở http://localhost:8000 (backend phục vụ luôn frontend). Test: `python -m pytest tests`.

## Đưa lên GitHub Pages
GitHub Pages chỉ chứa file tĩnh nên **chỉ frontend** được deploy (workflow `.github/workflows/pages.yml`, bật Settings → Pages → Source: GitHub Actions). Backend Python vẫn phải chạy trên máy bạn; trang trên Pages sẽ gọi `http://localhost:8000`. Người khác muốn dùng phải tự chạy backend. Muốn công khai hoàn toàn cần host backend riêng, nhưng YouTube thường chặn IP máy chủ đám mây.

## Giới hạn
- yt-dlp là công cụ không chính thức, có thể hỏng khi YouTube đổi; cập nhật bằng `pip install -U yt-dlp`.
- AI (Gemini miễn phí): chỉ video công khai, có hạn mức và giới hạn độ dài, timestamp có thể lệch.
- Video bị chặn nhúng thì không phát được trong trang.
