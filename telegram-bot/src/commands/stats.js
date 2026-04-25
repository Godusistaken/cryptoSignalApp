const api = require('../services/api');

function unwrapStats(response) {
  if (response?.data?.stats) return response.data.stats;
  if (response?.data && !Array.isArray(response.data)) return response.data;
  if (response?.stats) return response.stats;
  return response || {};
}

function pickNumber(payload, keys) {
  for (const key of keys) {
    if (payload?.[key] !== undefined && payload[key] !== null) return payload[key];
  }
  return null;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%`;
}

async function stats(ctx) {
  try {
    const response = await api.getStats();
    const summary = unwrapStats(response);

    const winRate = pickNumber(summary, ['winRate', 'win_rate', 'successRate']);
    const totalSignals = pickNumber(summary, ['totalSignals', 'total_signals', 'total']);
    const openSignals = pickNumber(summary, ['openSignals', 'open_signals', 'open']);

    return ctx.reply([
      'Sinyal istatistikleri',
      `Win rate: ${formatPercent(winRate)}`,
      `Toplam sinyal: ${totalSignals ?? '-'}`,
      `Açık sinyal: ${openSignals ?? '-'}`,
    ].join('\n'));
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");
    return ctx.reply('İstatistikler alınamadı');
  }
}

module.exports = {
  stats,
};
