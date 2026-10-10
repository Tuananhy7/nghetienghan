import assert from 'node:assert/strict';
import test from 'node:test';

import { alignDirect, transcribeDirect } from '../js/ai-direct.js';

const videoId = 'a64cTl1enW8';
const cues = [{ start: 0, end: 1.25, text: '안녕하세요' }];
const originalFetch = globalThis.fetch;

function mockGemini(text, status = 200) {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify(status >= 400
      ? { error: { message: 'test error' } }
      : { candidates: [{ content: { parts: [{ text }] } }] }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return requests;
}

test('direct transcription calls Gemini with the same Korean JSON request shape', async () => {
  const requests = mockGemini(JSON.stringify(cues));
  try {
    const result = await transcribeDirect(`https://youtu.be/${videoId}`, 'test-api-key');
    const request = requests[0];
    const body = JSON.parse(request.options.body);

    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    assert.equal(request.options.headers['x-goog-api-key'], 'test-api-key');
    assert.deepEqual(body.contents[0].parts[0], {
      file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` },
    });
    assert.match(body.contents[0].parts[1].text, /dịch đúng ý sang tiếng Hàn tự nhiên/u);
    assert.deepEqual(result, { videoId, title: '', source: 'ai-direct', language: 'ko', cues });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('direct transcription rejects non-Korean output', async () => {
  mockGemini(JSON.stringify([{ start: 0, end: 1, text: 'Xin chào các bạn' }]));
  try {
    await assert.rejects(
      transcribeDirect(videoId, 'test-api-key'),
      (error) => error.code === 'AI_NOT_KOREAN',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('direct alignment calls Gemini and preserves expected cue count', async () => {
  const requests = mockGemini(JSON.stringify(cues));
  try {
    const result = await alignDirect(videoId, cues, 'test-api-key');
    assert.equal(requests.length, 1);
    assert.deepEqual(result.cues, cues);
    assert.equal(result.source, 'ai-aligned-direct');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('direct Gemini quota errors are surfaced clearly', async () => {
  mockGemini('', 429);
  try {
    await assert.rejects(
      transcribeDirect(videoId, 'test-api-key'),
      (error) => error.code === 'AI_QUOTA' && /hạn mức/u.test(error.message),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
