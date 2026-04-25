const api = require('../services/api');

function summarizeError(error) {
  if (!error) return '-';
  return error.body?.error?.message || error.body?.message || error.code || error.message || '-';
}

async function debugBackend(ctx) {
  const result = await api.debugBackend();
  const healthOk = Boolean(result.health?.success || result.health?.status === 'online');
  const signalsOk = !result.signalsError;
  const ok = healthOk && signalsOk;
  const failed = result.signalsError || result.healthError;

  if (ok) {
    return ctx.reply([
      'Backend bağlantısı başarılı ✅',
      `Health URL: ${result.healthUrl}`,
      `Signals URL: ${result.signalsUrl}`,
      `Health: OK`,
      `Signals: OK`,
    ].join('\n'));
  }

  return ctx.reply([
    'Backend bağlantısı başarısız ❌',
    `Status: ${failed?.status || 'NO_RESPONSE'}`,
    `URL: ${result.signalsError ? result.signalsUrl : result.healthUrl}`,
    `Hata: ${summarizeError(failed)}`,
  ].join('\n'));
}

module.exports = {
  debugBackend,
};
