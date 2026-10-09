from fastapi.testclient import TestClient

from app.main import app
from app.services import youtube
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


def test_manual_preferred_over_auto(monkeypatch):
    info = {"title": "t",
            "subtitles": {"ko": [{"ext": "json3", "url": "https://m/"}]},
            "automatic_captions": {"ko": [{"ext": "json3", "url": "https://a/"}]}}
    monkeypatch.setattr(youtube, "_extract", lambda v: info)
    monkeypatch.setattr(youtube, "_download", lambda u: J3)
    assert youtube.fetch_korean_transcript("dQw4w9WgXcQ")["source"] == "manual"
    info["subtitles"] = {}
    assert youtube.fetch_korean_transcript("dQw4w9WgXcQ")["source"] == "auto"


def test_machine_translation_ignored(monkeypatch):
    info = {"subtitles": {}, "automatic_captions": {"ko": [{"ext": "json3", "url": "https://a/?tlang=ko"}]}}
    monkeypatch.setattr(youtube, "_extract", lambda v: info)
    r = c.post("/api/transcript", json={"url": "dQw4w9WgXcQ"})
    assert r.status_code == 404 and r.json()["code"] == "NO_CAPTIONS"
