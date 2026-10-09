let cues = [], els = [], active = -1;
export const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function renderCues(list, onSeek) {
  cues = list; active = -1;
  const ol = document.getElementById('cues');
  ol.replaceChildren();
  els = list.map((c) => {
    const li = document.createElement('li');
    const t = document.createElement('time'); t.textContent = fmt(c.start);
    const s = document.createElement('span'); s.textContent = c.text; s.lang = 'ko';
    li.append(t, s);
    li.onclick = () => onSeek(c.start);
    ol.append(li);
    return li;
  });
}

/** Chỉ số câu đang phát tại thời điểm t (tìm nhị phân), -1 nếu chưa tới/đã quá xa. */
export function findActive(t) {
  let lo = 0, hi = cues.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].start <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r >= 0 && t <= cues[r].end + 2 ? r : -1;
}

export function setActive(i) {
  if (i === active) return;
  els[active]?.classList.remove('on');
  active = i;
  const el = els[i];
  if (!el) return;
  el.classList.add('on');
  const box = el.parentElement;
  const boxRect = box.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const isVisible = elRect.top >= boxRect.top && elRect.bottom <= boxRect.bottom;
  if (!isVisible) {
    const top = box.scrollTop + elRect.top - boxRect.top - (box.clientHeight - el.clientHeight) / 2;
    box.scrollTo({ top, behavior: 'smooth' });
  }
}
export const getCues = () => cues;
