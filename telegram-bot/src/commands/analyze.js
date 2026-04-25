const api = require('../services/api');
const { extractSignal, formatSignalDetail } = require('./signals');

async function analyze(ctx) {
  const symbol = ctx.message.text.split(/\s+/)[1];
  if (!symbol) return ctx.reply('Lütfen bir coin gir: /analyze BTC');

  try {
    await ctx.reply(`${symbol.toUpperCase()} için yeni analiz başlatılıyor...`);
    const response = await api.analyzeSignal(symbol);
    const signal = extractSignal(response);

    if (!signal || !signal.symbol) {
      return ctx.reply('Bu coin bulunamadı');
    }

    return ctx.reply(formatSignalDetail(signal));
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");
    if (api.isNotFound(error)) return ctx.reply('Bu coin bulunamadı');
    return ctx.reply('Analiz tamamlanamadı');
  }
}

module.exports = {
  analyze,
};
