const path = require('path');
const api = require('./api');
const StateStore = require('../utils/stateStore');
const { getAdminChatIds } = require('../utils/auth');

const STRONG_SIGNALS = new Set(['STRONG_BUY', 'STRONG_SELL']);

function unwrapPayload(response) {
  return response?.data ?? response;
}

function extractSignalList(response) {
  const payload = unwrapPayload(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.signals)) return payload.signals;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function field(signal, names, fallback = null) {
  for (const name of names) {
    if (signal?.[name] !== undefined && signal[name] !== null && signal[name] !== '') {
      return signal[name];
    }
  }
  return fallback;
}

function signalType(signal) {
  return field(signal, ['signalType', 'signal_type', 'type'], 'WAIT');
}

function signalSymbol(signal) {
  return field(signal, ['symbol', 'coin', 'pair'], '-');
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 8 });
}

function buildDedupKey(signal) {
  const symbol = signalSymbol(signal);
  const type = signalType(signal);
  const timeframe = field(signal, ['timeframe', 'interval'], '1h');
  const timestamp = field(signal, [
    'confirmedCandleCloseTime',
    'confirmed_candle_close_time',
    'signalTimestamp',
    'signal_timestamp',
    'createdAt',
    'created_at',
    'updatedAt',
    'updated_at',
    'timestamp',
    'time',
    'id',
  ], null);

  if (timestamp) return [symbol, type, timeframe, timestamp].join('|');

  return [
    symbol,
    type,
    timeframe,
    field(signal, ['currentPrice', 'current_price', 'price'], '-'),
    field(signal, ['rawScore', 'raw_score', 'score'], '-'),
    field(signal, ['confidence'], '-'),
  ].join('|');
}

function formatAlertMessage(signal) {
  const type = signalType(signal);
  const title = type === 'STRONG_SELL' ? 'STRONG SELL SİNYALİ' : 'STRONG BUY SİNYALİ';
  const reason = field(signal, ['analysisNotes', 'analysis_notes', 'reason', 'note'], '-');
  const time = field(signal, [
    'confirmedCandleCloseTime',
    'confirmed_candle_close_time',
    'createdAt',
    'created_at',
    'timestamp',
    'time',
  ], '-');

  return [
    title,
    `Coin: ${signalSymbol(signal)}`,
    `Fiyat: ${formatNumber(field(signal, ['currentPrice', 'current_price', 'price']))}`,
    `Timeframe: ${field(signal, ['timeframe', 'interval'], '-')}`,
    `Skor: ${formatNumber(field(signal, ['rawScore', 'raw_score', 'score']))}`,
    `Sebep: ${reason}`,
    `Zaman: ${time}`,
  ].join('\n');
}

class AlertService {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.intervalMs = Math.max(5, Number(process.env.TELEGRAM_ALERT_INTERVAL_SECONDS || 60)) * 1000;
    this.enabled = String(process.env.TELEGRAM_ALERTS_ENABLED || 'true').toLowerCase() === 'true';
    this.sendExisting = String(process.env.TELEGRAM_SEND_EXISTING_ALERTS || 'false').toLowerCase() === 'true';
    this.store = options.store || new StateStore(path.join(__dirname, '../../data/alert-state.json'));
    this.timer = null;
    this.initialized = false;
  }

  start() {
    this.store.load();

    if (!this.enabled) {
      console.log('Telegram alert polling kapali.');
      return;
    }

    console.log(`Telegram alert polling baslatildi. Interval: ${this.intervalMs / 1000}s URL: ${api.getSignalsUrl()}`);
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.store.save();
  }

  async poll() {
    try {
      // Keep alert polling on the same all-signals helper used by /signals.
      const response = await api.getSignals({ logErrors: false });
      const strongSignals = extractSignalList(response).filter(signal => STRONG_SIGNALS.has(signalType(signal)));
      const adminChatIds = getAdminChatIds();

      if (!this.initialized && !this.sendExisting) {
        strongSignals.forEach(signal => this.store.mark(buildDedupKey(signal), {
          symbol: signalSymbol(signal),
          signalType: signalType(signal),
          initializedOnly: true,
        }));
        this.store.save();
        this.initialized = true;
        console.log(`Mevcut guclu sinyaller goruldu olarak isaretlendi: ${strongSignals.length}`);
        return;
      }

      this.initialized = true;

      if (!adminChatIds.length) {
        console.warn('TELEGRAM_ADMIN_CHAT_IDS bos. Alert gonderimi atlandi.');
        return;
      }

      for (const signal of strongSignals) {
        const key = buildDedupKey(signal);
        if (this.store.has(key)) continue;

        const message = formatAlertMessage(signal);
        for (const chatId of adminChatIds) {
          await this.bot.telegram.sendMessage(chatId, message);
        }

        this.store.mark(key, {
          symbol: signalSymbol(signal),
          signalType: signalType(signal),
        });
        this.store.save();
      }
    } catch (error) {
      const details = api.getRequestErrorDetails(error);
      if (api.isBackendUnavailable(error)) {
        console.warn('Alert polling request failed', details);
        return;
      }

      console.error('Alert polling request failed', details);
    }
  }
}

module.exports = {
  AlertService,
  buildDedupKey,
  formatAlertMessage,
  extractSignalList,
};
