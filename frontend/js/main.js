import { health, getTranscript, aiTranscribe, aiAlign } from './api.js';
import { confirmAI, getKey } from './dialogs.js';
import { parseVideoId, loadVideo, getPlayer } from './youtube.js';
import { renderCues, findActive, setActive, getCues } from './transcript.js';
import { startSync } from './sync.js';
import { setCues, stop as stopDict } from './dictation.js';

const $ = (id) => document.getElementById(id);
const SOURCES = {
  manual: 'Phụ đề do người tạo video cung cấp',
  auto: 'Phụ đề tự động của YouTube (có thể sai)',
  ai: 'Transcript do AI (Gemini) tạo, có thể sai',
  'ai-aligned': 'Phụ đề đã được AI căn chỉnh lại thời gian',
};
let cur = null, serverKey = false;

const status = (msg, kind = '') => { const s = $('status'); s.hidden = !msg; s.textContent = msg; s.className = kind; };
const needKey = () => !getKey() && !serverKey;
const seek = (t) => { const p = getPlayer(); if (p) { p.seekTo(t, true); p.playVideo(); } };

function show(data) {
  renderCues(data.cues, seek);
  setCues(data.cues);
  $('src').textContent = SOURCES[data.source] || 'Transcript';
  if (data.title) $('title').textContent = data.title;
  $('align').hidden = false;
  status('');
}

async function offerAI() {
  status('Video không có phụ đề tiếng Hàn (cả do người tạo lẫn tự động).', 'warn');
  const ok = await confirmAI({
    title: 'Dùng AI để tạo transcript?',
    body: 'Link video sẽ được gửi tới Gemini API của Google (gói miễn phí, có giới hạn lượt dùng và độ dài; chỉ hoạt động với video công khai). Kết quả có thể sai chữ hoặc lệch thời gian.',
    needKey: needKey(),
  });
  if (!ok) return status('Đã hủy, không dùng AI. Bạn có thể thử video khác.', 'warn');
  status('AI đang nghe video và tạo transcript, có thể mất vài phút…');
  try { show(await aiTranscribe(cur.url)); } catch (e) { status(e.message, 'err'); }
}

$('form').onsubmit = async (e) => {
  e.preventDefault();
  const url = $('url').value.trim(), id = parseVideoId(url);
  if (!id) return status('Link YouTube không hợp lệ.', 'err');
  cur = { url, id };
  renderCues([], seek); $('align').hidden = true; $('title').textContent = '';
  status('Đang tìm phụ đề tiếng Hàn…');
  loadVideo(id, (m) => status(m, 'err')).catch((err) => status(err.message, 'err'));
  try { show(await getTranscript(url)); }
  catch (err) { err.code === 'NO_CAPTIONS' ? await offerAI() : status(err.message, 'err'); }
};

$('align').onclick = async () => {
  const ok = await confirmAI({
    title: 'Căn chỉnh thời gian bằng AI?',
    body: 'Bước riêng: gửi link video và nội dung transcript hiện tại tới Gemini để căn lại thời điểm từng câu. Nội dung câu giữ nguyên; thời gian vẫn có thể lệch.',
    needKey: needKey(),
  });
  if (!ok) return;
  status('AI đang căn chỉnh thời gian…');
  try { show(await aiAlign(cur.url, getCues())); } catch (e) { status(e.message + ' Transcript cũ được giữ nguyên.', 'err'); }
};

startSync(() => { const p = getPlayer(); if (p?.getCurrentTime) setActive(findActive(p.getCurrentTime())); });

function route() {
  const h = location.hash.slice(1) || 'listen';
  $('listen').hidden = h !== 'listen'; $('soon').hidden = h === 'listen';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.hash === `#${h}`));
}
addEventListener('hashchange', route); route();

health().then((h) => (serverKey = h.ai_key_on_server))
  .catch((e) => status(e.message, 'err'));

document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => {
    x.classList.toggle('on', x === b);
    x.setAttribute('aria-selected', String(x === b));
  });
  $('pane-tx').hidden = b.dataset.t !== 'tx';
  $('pane-dict').hidden = b.dataset.t !== 'dict';
  if (b.dataset.t !== 'dict') stopDict();
}));
