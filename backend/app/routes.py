import os

from fastapi import APIRouter, Header
from pydantic import BaseModel

from .core.errors import AppError
from .services import ai, youtube

router = APIRouter(prefix="/api")


class UrlIn(BaseModel):
    url: str
    confirmed: bool = False  # người dùng đã xác nhận bước AI này
    cues: list[dict] | None = None


def _confirmed(b: UrlIn):
    if not b.confirmed:
        raise AppError("NOT_CONFIRMED", "Cần người dùng xác nhận trước khi dùng AI.", 400)


@router.get("/health")
def health():
    return {"ok": True, "ai_key_on_server": bool(os.getenv("GEMINI_API_KEY"))}


@router.post("/transcript")
def transcript(b: UrlIn):
    return youtube.fetch_korean_transcript(youtube.video_id(b.url))


@router.post("/ai/transcribe")
def ai_transcribe(b: UrlIn, x_gemini_key: str | None = Header(None)):
    _confirmed(b)
    vid = youtube.video_id(b.url)
    return {"videoId": vid, "source": "ai", "language": "ko", "cues": ai.transcribe(vid, x_gemini_key)}


@router.post("/ai/align")
def ai_align(b: UrlIn, x_gemini_key: str | None = Header(None)):
    _confirmed(b)
    if not b.cues:
        raise AppError("NO_CUES", "Chưa có transcript để căn chỉnh.")
    vid = youtube.video_id(b.url)
    return {"videoId": vid, "source": "ai-aligned", "language": "ko", "cues": ai.align(vid, b.cues, x_gemini_key)}
