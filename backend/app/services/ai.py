"""Gemini API (gói miễn phí). Chỉ được gọi sau khi người dùng xác nhận (kiểm tra ở routes)."""
import json
import os

import httpx

from ..core.errors import AppError
from .transcript import clean_cues

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent"
FORMAT = 'Trả về JSON: mảng [{"start": giây, "end": giây, "text": "..."}], tăng dần theo thời gian.'


def _call(parts: list, key: str | None):
    key = key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise AppError("NO_AI_KEY", "Chưa có Gemini API key. Nhập key trên giao diện hoặc đặt GEMINI_API_KEY trong backend/.env.")
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
    try:
        r = httpx.post(ENDPOINT.format(os.getenv("GEMINI_MODEL", "gemini-2.5-flash")),
                       headers={"x-goog-api-key": key}, json=body, timeout=300)
    except httpx.HTTPError as e:
        raise AppError("AI_NETWORK", f"Không kết nối được Gemini: {str(e)[:120]}", 502)
    if r.status_code == 429:
        raise AppError("AI_QUOTA", "Đã hết hạn mức miễn phí của Gemini. Thử lại sau.", 429)
    if r.status_code >= 400:
        raise AppError("AI_ERROR", f"Gemini trả lỗi {r.status_code}: {r.text[:200]}", 502)
    try:
        return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    except Exception:
        raise AppError("AI_BAD_OUTPUT", "Gemini trả về dữ liệu không đọc được. Thử lại hoặc dùng video ngắn hơn.", 502)


def _video_part(vid: str) -> dict:
    return {"file_data": {"file_uri": f"https://www.youtube.com/watch?v={vid}"}}


def transcribe(vid: str, key: str | None) -> list[dict]:
    prompt = ("Nghe video tiếng Hàn này và chép lại lời nói thành các câu ngắn. Không dịch, không bịa "
              "những gì không nghe được. " + FORMAT)
    cues = clean_cues(_call([_video_part(vid), {"text": prompt}], key))
    if not cues:
        raise AppError("AI_EMPTY", "AI không nghe ra lời thoại nào trong video.", 502)
    return cues


def align(vid: str, cues: list[dict], key: str | None) -> list[dict]:
    lines = [c.get("text", "") for c in cues]
    prompt = ("Đây là transcript tiếng Hàn của video, mỗi phần tử là một câu theo thứ tự:\n"
              + json.dumps(lines, ensure_ascii=False)
              + "\nHãy nghe video và xác định thời điểm bắt đầu/kết thúc của từng câu. GIỮ NGUYÊN nội dung "
                "và số lượng câu, chỉ sửa thời gian. " + FORMAT)
    out = clean_cues(_call([_video_part(vid), {"text": prompt}], key))
    if len(out) != len(lines):
        raise AppError("AI_MISMATCH", "AI trả về số câu không khớp transcript gốc; giữ nguyên transcript cũ.", 502)
    return out
