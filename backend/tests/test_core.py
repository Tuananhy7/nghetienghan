import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.core.errors import AppError
from app.services import ai, youtube
from app.services.transcript import cues_from_json3

c = TestClient(app)
J3 = {"events": [
    {"tStartMs": 0, "dDurationMs": 2000, "segs": [{"utf8": "안녕하세요"}]},
    {"tStartMs": 1500, "dDurationMs": 500, "segs": [{"utf8": "\n"}]},
    {"tStartMs": 2000, "dDurationMs": 2000, "segs": [{"utf8": "저는 "}, {"utf8": "학생이에요"}]},
    {"tStartMs": 4000, "dDurationMs": 1000, "segs": [{"utf8": "저는 학생이에요"}]},
]}


def test_json3_parse_and_dedupe():
    cues = cues_from_json3(J3)
    assert [x["text"] for x in cues] == ["안녕하세요", "저는 학생이에요"]
    assert cues[1]["end"] == 5.0


def test_video_id():
    assert youtube.video_id("https://youtu.be/dQw4w9WgXcQ?t=3") == "dQw4w9WgXcQ"
    assert youtube.video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_bad_url():
    r = c.post("/api/transcript", json={"url": "abc"})
    assert r.status_code == 400 and r.json()["code"] == "BAD_URL"


def test_ai_needs_confirmation():
    for p in ("transcribe", "align"):
        r = c.post(f"/api/ai/{p}", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
        assert r.json()["code"] == "NOT_CONFIRMED"


def test_gemini_uses_current_default_model(monkeypatch):
    calls = []
    response = httpx.Response(
        200,
        json={"candidates": [{"content": {"parts": [{"text": "[]"}]}}]},
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.setattr(ai.httpx, "post", lambda url, **kwargs: calls.append((url, kwargs)) or response)

    assert ai._call([{"text": "test"}], "test-key") == []
    assert calls[0][0] == ai.ENDPOINT.format("gemini-3.8-flash")
    assert calls[0][1]["headers"]["x-goog-api-key"] == "test-key"


def test_gemini_model_can_be_overridden(monkeypatch):
    calls = []
    response = httpx.Response(
        200,
        json={"candidates": [{"content": {"parts": [{"text": "[]"}]}}]},
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
    )
    monkeypatch.setenv("GEMINI_MODEL", "gemini-custom-model")
    monkeypatch.setattr(ai.httpx, "post", lambda url, **kwargs: calls.append(url) or response)

    ai._call([{"text": "test"}], "test-key")

    assert calls == [ai.ENDPOINT.format("gemini-custom-model")]


def test_ai_transcribe_translates_to_korean(monkeypatch):
    captured = []
    korean = [{"start": 0, "end": 1, "text": "안녕하세요"}]
    monkeypatch.setattr(ai, "_call", lambda parts, key: captured.append(parts[1]["text"]) or korean)

    assert ai.transcribe("dQw4w9WgXcQ", "test-key") == korean
    assert "dịch đúng ý sang tiếng Hàn tự nhiên" in captured[0]
    assert "không chép nguyên văn bằng ngôn ngữ gốc" in captured[0]


def test_ai_transcribe_rejects_non_korean_output(monkeypatch):
    monkeypatch.setattr(
        ai, "_call",
        lambda parts, key: [{"start": 0, "end": 1, "text": "Xin chào, bạn khỏe không?"}],
    )

    try:
        ai.transcribe("dQw4w9WgXcQ", "test-key")
    except AppError as error:
        assert error.code == "AI_NOT_KOREAN"
    else:
        raise AssertionError("Expected non-Korean transcription to be rejected")


def test_manual_preferred_over_auto(monkeypatch):
    info = {"title": "t",
            "subtitles": {"ko": [{"ext": "json3", "url": "https://m/"}]},
            "automatic_captions": {"ko": [{"ext": "json3", "url": "https://a/"}]}}
    monkeypatch.setattr(youtube, "_extract", lambda v: info)
    monkeypatch.setattr(youtube, "_download", lambda u: J3)
    assert youtube.fetch_korean_transcript("dQw4w9WgXcQ")["source"] == "manual"
    info["subtitles"] = {}
    assert youtube.fetch_korean_transcript("dQw4w9WgXcQ")["source"] == "auto"


def test_machine_translated_korean_is_fallback(monkeypatch):
    info = {
        "title": "t",
        "subtitles": {},
        "automatic_captions": {
            "ko": [{"ext": "json3", "url": "https://a/?lang=vi&tlang=ko"}],
        },
    }
    monkeypatch.setattr(youtube, "_extract", lambda v: info)
    monkeypatch.setattr(youtube, "_download", lambda u: J3)

    result = c.post("/api/transcript", json={"url": "dQw4w9WgXcQ"})

    assert result.status_code == 200
    assert result.json()["source"] == "translated"
    assert result.json()["language"] == "ko"


def test_native_korean_preferred_to_machine_translation(monkeypatch):
    info = {
        "subtitles": {},
        "automatic_captions": {
            "ko": [
                {"ext": "json3", "url": "https://a/?lang=vi&tlang=ko"},
                {"ext": "json3", "url": "https://a/?lang=ko"},
            ],
        },
    }
    monkeypatch.setattr(youtube, "_extract", lambda v: info)
    downloaded = []
    monkeypatch.setattr(youtube, "_download", lambda u: downloaded.append(u) or J3)

    result = youtube.fetch_korean_transcript("dQw4w9WgXcQ")

    assert result["source"] == "auto"
    assert downloaded == ["https://a/?lang=ko"]


def test_subtitle_download_retries_rate_limit(monkeypatch):
    responses = [
        httpx.Response(429, request=httpx.Request("GET", "https://youtube.test/captions")),
        httpx.Response(200, json=J3, request=httpx.Request("GET", "https://youtube.test/captions")),
    ]
    sleeps = []
    monkeypatch.setattr(youtube.httpx, "get", lambda *args, **kwargs: responses.pop(0))
    monkeypatch.setattr(youtube.time, "sleep", sleeps.append)

    result = youtube._download("https://youtube.test/captions")

    assert result == J3
    assert sleeps == [1]


def test_subtitle_download_reports_persistent_rate_limit_without_url(monkeypatch):
    url = "https://youtube.test/captions?signature=secret"
    request = httpx.Request("GET", url)
    monkeypatch.setattr(youtube.httpx, "get", lambda *args, **kwargs: httpx.Response(429, request=request))
    monkeypatch.setattr(youtube.time, "sleep", lambda _: None)

    try:
        youtube._download(url)
    except AppError as error:
        assert error.code == "SUB_RATE_LIMITED"
        assert "HTTP 429" in error.message
        assert "signature=secret" not in error.message
    else:
        raise AssertionError("Expected persistent HTTP 429 to raise AppError")
