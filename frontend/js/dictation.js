import { getPlayer } from './youtube.js';
import { compare } from './diff.js';

const $ = (id) => document.getElementById(id);
let raw = [], units = [], i = 0, scores = [], timer;

export function setCues(cues) { raw = cues; build(); }
export function stop() { clearInterval(timer); getPlayer()?.pauseVideo?.(); }

function build() {
  const n = +$('d-merge').value;
  units = [];
  for (let k = 0; k < raw.length; k += n) {
    const g = raw.slice(k, k + n);
    units.push({ start: g[0].start, end: g[g.length - 1].end, text: g.map((c) => c.text).join(' ') });
  }
  i = 0; scores = [];
  $('d-empty').hidden = units.length > 0;
  $('d-box').hidden = !units.length;
  if (units.length) load();
}

function hintText(text) {
  const lv = $('d-level').value, words = text.split(/\s+/);
  if (lv === 'easy') return words.map((w) => [...w][0] + '_'.repeat([...w].length - 1)).join(' ');
  if (lv === 'mid') return `${words.length} từ`;
  return '';
}

function load() {
  $('d-pos').textContent = `Lượt ${i + 1}/${units.length}`;
  const done = scores.filter((s) => s !== undefined);
  $('d-avg').textContent = done.length ? `Điểm trung bình ${Math.round(done.reduce((a, b) => a + b, 0) / done.length)}%` : '';
  $('d-hint').textContent = hintText(units[i].text);
  $('d-in').value = '';
  $('d-res').hidden = true;
  $('d-in').focus({ preventScroll: true });
}

function play() {
  const p = getPlayer(), u = units[i];
  if (!p?.seekTo) return;
  clearInterval(timer);
  const rate = +$('d-rate').value, t0 = Date.now();
  p.setPlaybackRate(rate); p.seekTo(u.start, true); p.playVideo();
  let started = false;
  timer = setInterval(() => {
    const t = p.getCurrentTime();
    if (t >= u.start - 0.3 && t < u.end) started = true;  // tránh dừng nhầm do giá trị cũ trước khi tua xong
    if ((started && t >= u.end) || Date.now() - t0 > ((u.end - u.start) / rate + 2.5) * 1000) { p.pauseVideo(); clearInterval(timer); }
  }, 60);
}

function words(list, cls) {
  const p = document.createElement('p'); p.lang = 'ko'; p.className = 'words';
  list.forEach((x) => { const s = document.createElement('span'); s.textContent = x.w; s.className = x.ok ? 'ok' : cls; p.append(s, ' '); });
  return p;
}

function render(parts) { const r = $('d-res'); r.replaceChildren(...parts); r.hidden = false; }
const line = (t) => { const e = document.createElement('p'); e.className = 'lbl'; e.textContent = t; return e; };

function check() {
  const v = $('d-in').value.trim();
  if (!v) return render([line('Hãy gõ những gì bạn nghe được, rồi bấm Kiểm tra.')]);
  const r = compare(units[i].text, v);
  scores[i] = r.score; load_avg();
  const head = document.createElement('p'); head.className = 'score'; head.textContent = `${r.score}% chính xác`;
  render([head, line('Đáp án (từ sai hoặc thiếu màu đỏ)'), words(r.ref, 'miss'), line('Bài của bạn (từ thừa hoặc sai màu đỏ)'), words(r.user, 'miss')]);
}

function load_avg() {
  const done = scores.filter((s) => s !== undefined);
  $('d-avg').textContent = `Điểm trung bình ${Math.round(done.reduce((a, b) => a + b, 0) / done.length)}%`;
}

function go(d) {
  if (i + d >= units.length) {
    const done = scores.filter((s) => s !== undefined);
    const avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 0;
    return render([line(`Bạn đã đi hết bài. Đã chấm ${done.length}/${units.length} lượt, điểm trung bình ${avg}%.`)]);
  }
  i = Math.max(0, i + d); load();
}

$('d-play').onclick = play;
$('d-check').onclick = check;
$('d-show').onclick = () => render([line('Đáp án (không tính điểm)'), words(compare(units[i].text, '').ref.map((x) => ({ ...x, ok: true })), 'ok')]);
$('d-prev').onclick = () => go(-1);
$('d-next').onclick = () => go(1);
$('d-level').onchange = () => units.length && ($('d-hint').textContent = hintText(units[i].text));
$('d-merge').onchange = build;
$('d-in').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(); } };
