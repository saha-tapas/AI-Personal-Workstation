const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';

async function generateWithOpenRouter(message) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    const error = new Error('OpenRouter is not configured. Add OPENROUTER_API_KEY to server/.env.');
    error.code = 'AI_CONFIGURATION_ERROR';
    throw error;
  }

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'AI Personal Workstation',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: message }],
      }),
    });
  } catch {
    const error = new Error('Unable to connect to OpenRouter.');
    error.code = 'AI_PROVIDER_ERROR';
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'OpenRouter returned an error.');
    error.code = 'AI_PROVIDER_ERROR';
    throw error;
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('OpenRouter returned an empty response.');
    error.code = 'AI_PROVIDER_ERROR';
    throw error;
  }

  return content;
}

module.exports = { generateWithOpenRouter };
