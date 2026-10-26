const { generateResponse } = require('../services/ai/aiService');

async function postChat(req, res) {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!message) {
    return res.status(400).json({ success: false, error: 'A message is required.' });
  }

  try {
    const response = await generateResponse({ message });
    return res.json({ success: true, message: response });
  } catch (error) {
    if (error.code === 'AI_CONFIGURATION_ERROR') {
      return res.status(503).json({ success: false, error: error.message });
    }

    if (error.code === 'AI_PROVIDER_ERROR') {
      return res.status(502).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: 'Unable to process the chat request.' });
  }
}

module.exports = { postChat };
