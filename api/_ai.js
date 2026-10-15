/*
 * Thin client for the Google Gemini REST API (generateContent).
 * The API key is read from the server environment only; it never reaches the browser.
 */
const DEFAULT_MODEL = 'gemini-flash-latest';

function modelName() { return process.env.GEMINI_MODEL || DEFAULT_MODEL; }
function hasKey() { return Boolean(process.env.GEMINI_API_KEY); }

async function callJSON(systemText, userText, { temperature = 0.7, timeoutMs = 25000 } = {}) {
  if (!hasKey()) throw new Error('NO_API_KEY');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelName()) + ':generateContent';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature, responseMimeType: 'application/json' }
      })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error('AI_HTTP_' + res.status + ': ' + body.slice(0, 300));
    }
    const data = await res.json();
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts || []).map(p => p.text || '').join('');
    return parseJSONLoose(text);
  } finally {
    clearTimeout(timer);
  }
}

// Accepts raw JSON or JSON wrapped in ``` fences / surrounded by stray text.
function parseJSONLoose(text) {
  if (!text) throw new Error('AI_EMPTY');
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) { /* continue */ }
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error('AI_BAD_JSON');
}

module.exports = { callJSON, parseJSONLoose, modelName, hasKey };
