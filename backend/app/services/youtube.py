"""Lấy metadata và phụ đề tiếng Hàn qua yt-dlp (gốc → tự động → dịch máy)."""
import re
import time
from urllib.parse import parse_qs, urlparse

import httpx
import yt_dlp
from yt_dlp.utils.networking import std_headers

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
    for attempt in range(3):
        try:
            response = httpx.get(
                url, headers=std_headers, timeout=20, follow_redirects=True,
            )
        except httpx.HTTPError as e:
            raise AppError(
                "SUB_DOWNLOAD",
                f"Không tải được phụ đề do lỗi kết nối ({type(e).__name__}).",
                502,
            ) from e

        if response.status_code == 429:
            if attempt < 2:
                time.sleep(attempt + 1)
                continue
            raise AppError(
                "SUB_RATE_LIMITED",
                "YouTube đang giới hạn tải phụ đề (HTTP 429). Đã thử lại nhưng vẫn bị chặn. "
                "Hãy đợi vài phút rồi thử lại, hoặc xác nhận để tạo transcript bằng AI.",
                503,
            )

        try:
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            raise AppError(
                "SUB_DOWNLOAD",
                f"YouTube trả lỗi HTTP {e.response.status_code} khi tải phụ đề.",
                502,
            )
        except ValueError as e:
            raise AppError("SUB_DOWNLOAD", "YouTube trả dữ liệu phụ đề không hợp lệ.", 502) from e
        if not isinstance(data, dict):
            raise AppError("SUB_DOWNLOAD", "YouTube trả dữ liệu phụ đề không hợp lệ.", 502)
        return data

    raise RuntimeError("Subtitle retry loop exited unexpectedly")


def _pick_ko(tracks: dict, translated: bool = False) -> str | None:
    for lang, fmts in tracks.items():
        if lang == "ko" or lang.startswith("ko-"):
            for f in fmts:
                url = f.get("url", "")
                target_languages = parse_qs(urlparse(url).query).get("tlang", [])
                is_korean_translation = "ko" in target_languages
                matches_translation = is_korean_translation if translated else not target_languages
                if f.get("ext") == "json3" and url and matches_translation:
                    return url
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

    for key in ("subtitles", "automatic_captions"):
        url = _pick_ko(info.get(key) or {}, translated=True)
        if url:
            cues = cues_from_json3(_download(url))
            if cues:
                return {"videoId": vid, "title": info.get("title", ""), "source": "translated",
                        "language": "ko", "cues": cues}

    raise AppError("NO_CAPTIONS", "Video không có phụ đề tiếng Hàn (cả do người tạo lẫn tự động).", 404)
