const api = require('../services/api');
const { normalizeInputSymbol, toDisplaySymbol } = require('../utils/symbol');

const signalEmojis = {
  STRONG_BUY: '🟢',
  BUY: '✅',
  WEAK_BUY: '🟡',
  WAIT: '⏸',
  WEAK_SELL: '🟠',
  SELL: '🔻',
  STRONG_SELL: '🔴',
};

function unwrapPayload(response) {
  return response?.data ?? response;
}

function extractSignalList(response) {
  const payload = response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.signals)) return payload.signals;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.signals)) return payload.data.signals;
  return [];
}

function extractCoinList(response) {
  const payload = response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.coins)) return payload.coins;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.coins)) return payload.data.coins;
  return [];
}

function extractSignal(response) {
  const payload = response;
  if (!payload) return null;
  if (payload.signal) return payload.signal;
  if (payload.coin?.signal) return payload.coin.signal;
  if (payload.data?.signal) return payload.data.signal;
  if (payload.data && !Array.isArray(payload.data) && typeof payload.data === 'object') return payload.data;
  return payload;
}

function pick(signal, names, fallback = null) {
  for (const name of names) {
    if (signal?.[name] !== undefined && signal[name] !== null && signal[name] !== '') {
      return signal[name];
    }
  }
  return fallback;
}

function signalSymbol(signal) {
  return pick(signal, ['symbol', 'coin', 'pair'], '');
}

function displaySymbol(signal) {
  return toDisplaySymbol(signalSymbol(signal));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Math.round(Number(value))}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 8 });
}

function formatDateTime(value) {
  if (value === null || value === undefined || value === '') return null;

  const numeric = Number(value);
  const date = Number.isFinite(numeric) && value.toString().length >= 10
    ? new Date(numeric)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function analysisTime(signal) {
  return formatDateTime(pick(signal, ['analyzedAt', 'analyzed_at', 'createdAt', 'created_at', 'timestamp', 'signalTime']));
}

function candleTime(signal) {
  return formatDateTime(pick(signal, [
    'candleTimestamp',
    'candle_timestamp',
    'confirmedCandleCloseTime',
    'confirmed_candle_close_time',
  ]));
}

function formatSignalLine(signal) {
  const signalType = pick(signal, ['signalType', 'signal_type', 'type'], 'WAIT');
  const emoji = signalEmojis[signalType] || '';
  const lines = [
    `${emoji} ${displaySymbol(signal)}:  ${signalType} (${formatPercent(pick(signal, ['confidence']))})`,
  ];

  const analyzedAt = analysisTime(signal);
  if (analyzedAt) lines.push(`Analiz zamanı: ${analyzedAt}`);

  return lines.join('\n');
}

function formatSignalDetail(signal) {
  const signalType = pick(signal, ['signalType', 'signal_type'], 'WAIT');
  const emoji = signalEmojis[signalType] || '';
  const lines = [
    `${emoji} ${displaySymbol(signal)} - ${signalType} (${formatPercent(pick(signal, ['confidence']))})`,
    `Fiyat: ${formatNumber(pick(signal, ['currentPrice', 'current_price', 'price']))}`,
    `RSI: ${formatNumber(pick(signal, ['rsi']))}`,
    `ADX: ${formatNumber(pick(signal, ['adx']))}`,
    `Trend: ${pick(signal, ['priceVsEma200', 'price_vs_ema200', 'trend'], '-')}`,
    `Stop Loss: ${formatNumber(pick(signal, ['stopLoss', 'stop_loss']))}`,
    `TP1: ${formatNumber(pick(signal, ['takeProfit1', 'take_profit_1']))}`,
    `TP2: ${formatNumber(pick(signal, ['takeProfit2', 'take_profit_2']))}`,
    `TP3: ${formatNumber(pick(signal, ['takeProfit3', 'take_profit_3']))}`,
  ];

  const analyzedAt = analysisTime(signal);
  const candleAt = candleTime(signal);
  if (analyzedAt) lines.push(`Analiz zamanı: ${analyzedAt}`);
  if (candleAt) lines.push(`Mum zamanı: ${candleAt}`);

  return lines.join('\n');
}

function activeSymbolSet(coins) {
  return new Set(coins
    .map(coin => normalizeInputSymbol(typeof coin === 'string' ? coin : coin.symbol))
    .filter(Boolean));
}

async function sendSignals(ctx) {
  try {
    const [signalsResponse, coinsResponse] = await Promise.all([
      api.getSignals(),
      api.getCoins(),
    ]);
    const activeSymbols = activeSymbolSet(extractCoinList(coinsResponse));
    const signals = extractSignalList(signalsResponse)
      .filter(signal => activeSymbols.has(normalizeInputSymbol(signalSymbol(signal))));

    if (!signals.length) {
      return ctx.reply('Gösterilecek sinyal bulunamadı');
    }

    return ctx.reply(signals.map(formatSignalLine).join('\n\n'));
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");
    return ctx.reply('Sinyaller alınamadı');
  }
}

async function sendSignal(ctx) {
  const symbol = ctx.message.text.split(/\s+/)[1];
  if (!symbol) return ctx.reply('Lütfen bir coin gir: /signal BTC');

  try {
    const response = await api.getSignal(symbol);
    const signal = extractSignal(response);

    if (!signal || !signalSymbol(signal)) {
      return ctx.reply('Bu coin bulunamadı');
    }

    return ctx.reply(formatSignalDetail(signal));
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");
    if (api.isNotFound(error)) return ctx.reply('Bu coin bulunamadı');
    return ctx.reply('Sinyal alınamadı');
  }
}

module.exports = {
  sendSignals,
  sendSignal,
  formatSignalDetail,
  extractSignal,
  extractSignalList,
  signalEmojis,
  unwrapPayload,
  formatDateTime,
};
