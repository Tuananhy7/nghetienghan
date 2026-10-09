import { API_BASE } from './config.js';
import { getKey } from './dialogs.js';

async function call(path, body, ai = false) {
  let r;
  try {
    r = await fetch(API_BASE + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(ai && getKey() ? { 'X-Gemini-Key': getKey() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw { code: 'NO_BACKEND', message: `Không kết nối được backend (${API_BASE}). Hãy chạy backend trước (xem README).` };
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: d.code || `HTTP_${r.status}`, message: d.message || `Lỗi máy chủ (${r.status}).` };
  return d;
}

export const health = () => call('/api/health');
export const getTranscript = (url) => call('/api/transcript', { url });
export const aiTranscribe = (url) => call('/api/ai/transcribe', { url, confirmed: true }, true);
export const aiAlign = (url, cues) => call('/api/ai/align', { url, cues, confirmed: true }, true);
