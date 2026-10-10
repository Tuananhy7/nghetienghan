import { health, getTranscript, aiTranscribe, aiAlign } from './api.js';
import { alignDirect, transcribeDirect } from './ai-direct.js';
import { confirmAI, getKey } from './dialogs.js';
import { parseVideoId, loadVideo, getPlayer } from './youtube.js';
import { renderCues, findActive, setActive, getCues } from './transcript.js';
import { startSync } from './sync.js';
import { setCues, stop as stopDict } from './dictation.js';

const $ = (id) => document.getElementById(id);
const SOURCES = {
  manual: 'Phụ đề do người tạo video cung cấp',
  auto: 'Phụ đề tự động của YouTube (có thể sai)',
  translated: 'Phụ đề do YouTube dịch tự động sang tiếng Hàn (có thể sai)',
  ai: 'Phụ đề do AI (Gemini) tạo, có thể sai',
  'ai-direct': 'Phụ đề do Gemini tạo trực tiếp (có thể sai)',
  'ai-aligned': 'Phụ đề đã được AI căn chỉnh lại thời gian',
  'ai-aligned-direct': 'Phụ đề đã được Gemini căn chỉnh trực tiếp',
};
let cur = null, serverKey = false, serverKeyChecked = false, currentTranscriptDirect = false;

const status = (msg, kind = '') => { const s = $('status'); s.hidden = !msg; s.textContent = msg; s.className = kind; };
const needKey = (direct = false) => !getKey() && (direct || !serverKey);
const seek = (t) => { const p = getPlayer(); if (p) { p.seekTo(t, true); p.playVideo(); } };

function show(data, direct = false) {
  renderCues(data.cues, seek);
  setCues(data.cues);
  currentTranscriptDirect = direct;
  $('src').textContent = SOURCES[data.source] || 'Transcript';
  if (data.title) $('title').textContent = data.title;
  $('align').hidden = false;
  status('');
}

async function offerAI(rateLimited = false) {
  if (!serverKeyChecked) {
    try {
      const result = await health();
      serverKey = result.ai_key_on_server;
    } catch {
      serverKey = false;
    }
    serverKeyChecked = true;
  }
  status(
    rateLimited
      ? 'YouTube đang giới hạn tải phụ đề. Bạn có thể chờ rồi thử lại hoặc chọn dùng AI.'
      : 'Video không có phụ đề tiếng Hàn (cả do người tạo lẫn tự động).',
    'warn',
  );
  const ok = await confirmAI({
    title: 'Dùng AI để tạo phụ đề?',
    body: `${rateLimited ? 'YouTube đang tạm giới hạn tải phụ đề. ' : ''}AI sẽ tạo phụ đề bằng tiếng Hàn; nếu lời gốc là ngôn ngữ khác, AI sẽ dịch sang tiếng Hàn. Link video sẽ được gửi tới Gemini API của Google (gói miễn phí, có giới hạn lượt dùng và độ dài; chỉ hoạt động với video công khai). Kết quả có thể sai chữ hoặc lệch thời gian.`,
    needKey: needKey(),
  });
  if (!ok) return status('Đã hủy, không dùng AI. Bạn có thể thử video khác.', 'warn');
  status('AI đang nghe video và tạo phụ đề, có thể mất vài phút…');
  try { show(await aiTranscribe(cur.url)); } catch (e) { status(e.message, 'err'); }
}

$('form').onsubmit = async (e) => {
  e.preventDefault();
  const url = $('url').value.trim(), id = parseVideoId(url);
  if (!id) return status('Link YouTube không hợp lệ.', 'err');
  cur = { url, id };
  currentTranscriptDirect = false;
  renderCues([], seek); $('align').hidden = true; $('title').textContent = '';
  loadVideo(id, (m) => status(m, 'err')).catch((err) => status(err.message, 'err'));

  if ($('ai-mode').getAttribute('aria-pressed') === 'true') {
    const ok = await confirmAI({
      title: 'Dùng Gemini trực tiếp tạo phụ đề?',
      body: 'AI mode gọi Gemini trực tiếp từ trình duyệt, không qua backend. Link video và API key sẽ được gửi trực tiếp tới Google. API key có thể được xem trong trình duyệt; chỉ dùng key cá nhân đã giới hạn phù hợp. AI tạo phụ đề tiếng Hàn và có thể dịch lời gốc sang tiếng Hàn.',
      needKey: needKey(true),
    });
    if (!ok) return status('Đã hủy, không gửi yêu cầu tới Gemini.', 'warn');
    status('AI mode: đang gửi video trực tiếp tới Gemini để tạo phụ đề tiếng Hàn…');
    try { show(await transcribeDirect(url, getKey()), true); }
    catch (err) { status(err.message, 'err'); }
    return;
  }

  status('Đang tìm phụ đề tiếng Hàn…');
  try { show(await getTranscript(url)); }
  catch (err) {
    if (err.code === 'NO_CAPTIONS' || err.code === 'SUB_RATE_LIMITED') {
      await offerAI(err.code === 'SUB_RATE_LIMITED');
    } else status(err.message, 'err');
  }
};

$('align').onclick = async () => {
  const ok = await confirmAI({
    title: 'Căn chỉnh thời gian bằng AI?',
    body: `${currentTranscriptDirect ? 'AI mode sẽ gọi Gemini trực tiếp, không qua backend. API key sẽ được gửi tới Google. ' : ''}Gửi link video và nội dung phụ đề hiện tại tới Gemini để căn lại thời điểm từng câu. Nội dung câu giữ nguyên; thời gian vẫn có thể lệch.`,
    needKey: needKey(currentTranscriptDirect),
  });
  if (!ok) return;
  status('AI đang căn chỉnh thời gian…');
  try {
    const result = currentTranscriptDirect
      ? await alignDirect(cur.url, getCues(), getKey())
      : await aiAlign(cur.url, getCues());
    show(result, currentTranscriptDirect);
  } catch (e) { status(e.message + ' Phụ đề cũ được giữ nguyên.', 'err'); }
};

$('ai-mode').onclick = () => {
  const button = $('ai-mode');
  const enabled = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(enabled));
  status(
    enabled
      ? 'AI mode đang bật: yêu cầu tạo phụ đề sẽ gửi trực tiếp tới Gemini, không qua backend.'
      : 'AI mode đã tắt: ứng dụng dùng backend để lấy phụ đề.',
    'warn',
  );
};

startSync(() => { const p = getPlayer(); if (p?.getCurrentTime) setActive(findActive(p.getCurrentTime())); });

function route() {
  const h = location.hash.slice(1) || 'listen';
  $('listen').hidden = h !== 'listen'; $('soon').hidden = h === 'listen';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.hash === `#${h}`));
}
addEventListener('hashchange', route); route();

document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => {
    x.classList.toggle('on', x === b);
    x.setAttribute('aria-selected', String(x === b));
  });
  $('pane-tx').hidden = b.dataset.t !== 'tx';
  $('pane-dict').hidden = b.dataset.t !== 'dict';
  if (b.dataset.t !== 'dict') stopDict();
}));
