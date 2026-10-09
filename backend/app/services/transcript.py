"""Chuẩn hóa transcript về dạng [{start, end, text}] (giây)."""


def cues_from_json3(data: dict) -> list[dict]:
    cues: list[dict] = []
    for ev in data.get("events", []):
        text = " ".join("".join(s.get("utf8", "") for s in ev.get("segs") or []).split())
        if not text:
            continue
        start = ev.get("tStartMs", 0) / 1000
        end = start + ev.get("dDurationMs", 0) / 1000
        if cues and cues[-1]["text"] == text:  # phụ đề tự động hay lặp dòng
            cues[-1]["end"] = max(cues[-1]["end"], round(end, 2))
            continue
        cues.append({"start": round(start, 2), "end": round(end, 2), "text": text})
    for a, b in zip(cues, cues[1:]):
        a["end"] = min(a["end"], b["start"])
    return cues


def clean_cues(raw) -> list[dict]:
    """Làm sạch dữ liệu do AI trả về."""
    out = []
    for c in raw if isinstance(raw, list) else []:
        try:
            text = " ".join(str(c["text"]).split())
            start, end = float(c["start"]), float(c["end"])
        except (KeyError, TypeError, ValueError):
            continue
        if text and start >= 0:
            out.append({"start": round(start, 2), "end": round(max(end, start), 2), "text": text})
    return sorted(out, key=lambda c: c["start"])
