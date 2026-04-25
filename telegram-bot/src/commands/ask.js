const api = require('../services/api');

function extractAnswer(response) {
  const payload = response?.data ?? response;
  return payload?.answer || payload?.message || payload?.response || payload?.text || payload?.data?.answer;
}

async function ask(ctx) {
  const question = ctx.message.text.replace(/^\/ask(@\w+)?\s*/i, '').trim();
  if (!question) return ctx.reply('Lütfen bir soru yaz: /ask BTC için yorum nedir?');

  try {
    const response = await api.askAi(question);
    const answer = extractAnswer(response);
    return ctx.reply(answer || 'AI yanıtı alınamadı');
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");
    return ctx.reply('AI yanıtı alınamadı');
  }
}

module.exports = {
  ask,
};
