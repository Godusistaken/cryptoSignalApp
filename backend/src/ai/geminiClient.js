const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const { AppError } = require('../utils/errors');

let client;

function getGeminiClient() {
  if (!config.gemini.apiKey) {
    throw new AppError('AI servisi backend ortam degiskenlerinde ayarli degil.', 503, {
      code: 'AI_NOT_CONFIGURED',
      expose: true,
    });
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  }

  return client;
}

module.exports = { getGeminiClient };
