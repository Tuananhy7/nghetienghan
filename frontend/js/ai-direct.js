import { parseVideoId } from './youtube.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
const FORMAT = 'Trả về JSON: mảng [{"start": giây, "end": giây, "text": "..."}], tăng dần theo thời gian.';
const TRANSCRIBE_PROMPT = (
  'Nghe lời nói và lời hát trong video, rồi tạo phụ đề TIẾNG HÀN. '
  + 'Nếu lời gốc đã là tiếng Hàn, chép lại chính xác bằng Hangul. '
  + 'Nếu lời gốc là ngôn ngữ khác, dịch đúng ý sang tiếng Hàn tự nhiên; '
  + 'không chép nguyên văn bằng ngôn ngữ gốc, không phiên âm bằng chữ Latin. '
  + 'Giữ từng câu ngắn theo lời nói/hát và thời điểm thực tế; không bịa nội dung '
  + 'không nghe được. Mọi trường text phải là tiếng Hàn viết bằng Hangul. '
  + FORMAT
);

function appError(code, message) {
  return Object.assign(new Error(message), { code });
}

function cleanCues(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((cue) => {
    const start = Number(cue?.start), end = Number(cue?.end);
    const text = String(cue?.text ?? '').trim().replace(/\s+/gu, ' ');
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || start < 0) return [];
    return [{ start: Math.round(start * 100) / 100, end: Math.round(Math.max(end, start) * 100) / 100, text }];
  }).sort((a, b) => a.start - b.start);
}

function requireKorean(cues) {
  if (!cues.length) throw appError('AI_EMPTY', 'AI không nghe ra lời thoại nào trong video.');
  const letters = cues.flatMap(({ text }) => [...text].filter((char) => /\p{L}/u.test(char)));
  const hangul = letters.filter((char) => /[\uac00-\ud7a3]/u.test(char)).length;
  if (!letters.length || hangul / letters.length < 0.3) {
    throw appError(
      'AI_NOT_KOREAN',
      'AI không tạo được phụ đề tiếng Hàn. Hãy thử lại hoặc kiểm tra video có lời nghe được.',
    );
  }
}

async function callGemini(videoId, prompt, key) {
  if (!key) throw appError('NO_AI_KEY', 'Cần nhập Gemini API key để dùng AI mode.');
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` } },
            { text: prompt },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
  } catch {
    throw appError(
      'AI_NETWORK',
      'Không kết nối trực tiếp được Gemini. Kiểm tra mạng, quyền truy cập API hoặc CORS rồi thử lại.',
    );
  }

  if (response.status === 429) {
    throw appError('AI_QUOTA', 'Đã hết hạn mức miễn phí của Gemini. Thử lại sau.');
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json()).error?.message || '';
    } catch {
      detail = '';
    }
    throw appError(
      'AI_ERROR',
      `Gemini trả lỗi ${response.status}${detail ? `: ${detail.slice(0, 200)}` : '.'}`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw appError('AI_BAD_OUTPUT', 'Gemini trả về dữ liệu không đọc được. Thử lại hoặc dùng video ngắn hơn.');
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw appError('AI_BAD_OUTPUT', 'Gemini không trả về phụ đề. Video có thể bị giới hạn hoặc không được hỗ trợ.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw appError('AI_BAD_OUTPUT', 'Gemini trả về dữ liệu không đọc được. Thử lại hoặc dùng video ngắn hơn.');
  }
}

export async function transcribeDirect(url, key) {
  const videoId = parseVideoId(url);
  if (!videoId) throw appError('BAD_URL', 'Link YouTube không hợp lệ.');
  const cues = cleanCues(await callGemini(videoId, TRANSCRIBE_PROMPT, key));
  requireKorean(cues);
  return { videoId, title: '', source: 'ai-direct', language: 'ko', cues };
}

export async function alignDirect(url, cues, key) {
  const videoId = parseVideoId(url);
  if (!videoId) throw appError('BAD_URL', 'Link YouTube không hợp lệ.');
  const lines = cues.map((cue) => cue.text);
  const prompt = (
    'Đây là transcript tiếng Hàn của video, mỗi phần tử là một câu theo thứ tự:\n'
    + JSON.stringify(lines)
    + '\nHãy nghe video và xác định thời điểm bắt đầu/kết thúc của từng câu. GIỮ NGUYÊN nội dung '
    + 'và số lượng câu, chỉ sửa thời gian. '
    + FORMAT
  );
  const result = cleanCues(await callGemini(videoId, prompt, key));
  if (result.length !== lines.length) {
    throw appError('AI_MISMATCH', 'AI trả về số câu không khớp phụ đề gốc; giữ nguyên phụ đề cũ.');
  }
  return { videoId, title: '', source: 'ai-aligned-direct', language: 'ko', cues: result };
}
