const { generateWithOpenRouter } = require('./providers/openrouterProvider');

async function generateResponse({ message }) {
  return generateWithOpenRouter(message);
}

module.exports = { generateResponse };
