"""Lấy metadata và phụ đề tiếng Hàn qua yt-dlp (thứ tự: người tạo → tự động)."""
import re

import httpx
import yt_dlp

from ..core.errors import AppError
from .transcript import cues_from_json3

_ID = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/|live/)([\w-]{11})")


def video_id(url: str) -> str:
    url = (url or "").strip()
    m = _ID.search(url)
    if m:
        return m.group(1)
    if re.fullmatch(r"[\w-]{11}", url):
        return url
    raise AppError("BAD_URL", "Link YouTube không hợp lệ.")


def _extract(vid: str) -> dict:
    opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(opts) as y:
            return y.extract_info(f"https://www.youtube.com/watch?v={vid}", download=False)
    except Exception as e:  # yt-dlp ném nhiều loại lỗi khác nhau
        raise AppError(
            "YT_UNAVAILABLE",
            "Không đọc được video: có thể video riêng tư/bị chặn vùng, lỗi mạng, YouTube chặn IP "
            f"hoặc yt-dlp cần cập nhật (pip install -U yt-dlp). Chi tiết: {str(e)[:200]}",
            502,
        )


def _download(url: str) -> dict:
    try:
        r = httpx.get(url, timeout=20, follow_redirects=True)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise AppError("SUB_DOWNLOAD", f"Tải phụ đề thất bại: {str(e)[:150]}", 502)


def _pick_ko(tracks: dict) -> str | None:
    for lang, fmts in tracks.items():
        if lang == "ko" or lang.startswith("ko-"):
            for f in fmts:
                # bỏ bản dịch máy từ ngôn ngữ khác (url có tlang=)
                if f.get("ext") == "json3" and "tlang=" not in f.get("url", ""):
                    return f["url"]
    return None


def fetch_korean_transcript(vid: str) -> dict:
    info = _extract(vid)
    for source, key in (("manual", "subtitles"), ("auto", "automatic_captions")):
        url = _pick_ko(info.get(key) or {})
        if url:
            cues = cues_from_json3(_download(url))
            if cues:
                return {"videoId": vid, "title": info.get("title", ""), "source": source,
                        "language": "ko", "cues": cues}
    raise AppError("NO_CAPTIONS", "Video không có phụ đề tiếng Hàn (cả do người tạo lẫn tự động).", 404)
