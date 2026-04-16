const fetcher = require('../fetcher/binance');
const { SignalModel } = require('../database/models');
const logger = require('../utils/logger');

const DEFAULT_EXPIRATION_CANDLES = {
  '5m': 36,
  '15m': 24,
  '30m': 20,
  '1h': 16,
  '4h': 12,
  '1d': 7,
};

const TIMEFRAME_TO_MS = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

class SignalTracker {
  static parseTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return null;

    const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  static getExpirationCandles(timeframe = '1h') {
    return DEFAULT_EXPIRATION_CANDLES[timeframe] || 16;
  }

  static getTimeframeMs(timeframe = '1h') {
    return TIMEFRAME_TO_MS[timeframe] || TIMEFRAME_TO_MS['1h'];
  }

  static getFetchStartTime(signal) {
    if (Number.isFinite(signal.last_checked_candle_time)) {
      return signal.last_checked_candle_time + 1;
    }

    const createdAtMs = this.parseTimestamp(signal.created_at);
    if (!Number.isFinite(createdAtMs)) return undefined;

    return Math.max(0, createdAtMs - this.getTimeframeMs(signal.timeframe));
  }

  static getExpirationTime(signal) {
    const createdAtMs = this.parseTimestamp(signal.created_at);
    if (!Number.isFinite(createdAtMs)) return null;

    const timeframeMs = this.getTimeframeMs(signal.timeframe);
    return createdAtMs + (this.getExpirationCandles(signal.timeframe) * timeframeMs);
  }

  static normalizeResolution({ status = 'OPEN', resolvedCandleTime = null, lastCheckedCandleTime = null, ambiguousResolution = false } = {}) {
    return {
      status,
      resolvedAt: status === 'OPEN' ? null : new Date(resolvedCandleTime || Date.now()).toISOString(),
      lastCheckedCandleTime,
      ambiguousResolution,
    };
  }

  static evaluateSignalAgainstCandles(signal, candles, now = Date.now()) {
    const highs = Array.isArray(candles?.highs) ? candles.highs : [];
    const lows = Array.isArray(candles?.lows) ? candles.lows : [];
    const closeTimes = Array.isArray(candles?.closeTimes) ? candles.closeTimes : [];
    const direction = String(signal.direction || '').toUpperCase();
    const createdAtMs = this.parseTimestamp(signal.created_at);
    const minCandleCloseTime = Number.isFinite(signal.last_checked_candle_time)
      ? signal.last_checked_candle_time
      : createdAtMs;

    let latestCheckedCandleTime = Number.isFinite(signal.last_checked_candle_time)
      ? signal.last_checked_candle_time
      : null;

    for (let index = 0; index < closeTimes.length; index += 1) {
      const high = highs[index];
      const low = lows[index];
      const candleCloseTime = closeTimes[index];

      if (Number.isFinite(minCandleCloseTime) && candleCloseTime <= minCandleCloseTime) {
        continue;
      }

      latestCheckedCandleTime = candleCloseTime;

      if (direction === 'BUY') {
        const hitStop = Number.isFinite(signal.stop_loss) && low <= signal.stop_loss;
        const hitTp3 = Number.isFinite(signal.take_profit_3) && high >= signal.take_profit_3;
        const hitTp2 = Number.isFinite(signal.take_profit_2) && high >= signal.take_profit_2;
        const hitTp1 = Number.isFinite(signal.take_profit_1) && high >= signal.take_profit_1;

        // Conservative ambiguity rule: if the same closed candle touches both SL and any TP, count it as LOSS_SL.
        if (hitStop && (hitTp1 || hitTp2 || hitTp3)) {
          return this.normalizeResolution({ status: 'LOSS_SL', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime, ambiguousResolution: true });
        }
        if (hitStop) {
          return this.normalizeResolution({ status: 'LOSS_SL', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
        if (hitTp3) {
          return this.normalizeResolution({ status: 'WIN_TP3', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
        if (hitTp2) {
          return this.normalizeResolution({ status: 'WIN_TP2', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
        if (hitTp1) {
          return this.normalizeResolution({ status: 'WIN_TP1', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
      }

      if (direction === 'SELL') {
        const hitStop = Number.isFinite(signal.stop_loss) && high >= signal.stop_loss;
        const hitTp3 = Number.isFinite(signal.take_profit_3) && low <= signal.take_profit_3;
        const hitTp2 = Number.isFinite(signal.take_profit_2) && low <= signal.take_profit_2;
        const hitTp1 = Number.isFinite(signal.take_profit_1) && low <= signal.take_profit_1;

        // Conservative ambiguity rule: if the same closed candle touches both SL and any TP, count it as LOSS_SL.
        if (hitStop && (hitTp1 || hitTp2 || hitTp3)) {
          return this.normalizeResolution({ status: 'LOSS_SL', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime, ambiguousResolution: true });
        }
        if (hitStop) {
          return this.normalizeResolution({ status: 'LOSS_SL', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
        if (hitTp3) {
          return this.normalizeResolution({ status: 'WIN_TP3', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
        if (hitTp2) {
          return this.normalizeResolution({ status: 'WIN_TP2', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
        if (hitTp1) {
          return this.normalizeResolution({ status: 'WIN_TP1', resolvedCandleTime: candleCloseTime, lastCheckedCandleTime: candleCloseTime });
        }
      }
    }

    const expirationTime = this.getExpirationTime(signal);
    if (expirationTime !== null && now >= expirationTime) {
      return this.normalizeResolution({
        status: 'EXPIRED',
        resolvedCandleTime: latestCheckedCandleTime || expirationTime,
        lastCheckedCandleTime: latestCheckedCandleTime,
      });
    }

    return this.normalizeResolution({ status: 'OPEN', lastCheckedCandleTime: latestCheckedCandleTime });
  }

  static async evaluateOpenSignals() {
    const openSignals = SignalModel.getOpenHistoricalSignals();
    const results = [];

    for (const signal of openSignals) {
      try {
        const expirationTime = SignalTracker.getExpirationTime(signal);
        if (expirationTime !== null && Date.now() >= expirationTime) {
          const resolution = SignalTracker.evaluateSignalAgainstCandles(signal, { highs: [], lows: [], closeTimes: [] });
          SignalModel.updateHistoricalSignalStatus(signal.id, resolution);
          results.push({ id: signal.id, symbol: signal.symbol, status: resolution.status, ambiguousResolution: resolution.ambiguousResolution });
          continue;
        }

        const candles = await fetcher.fetchClosedKlinesSince(signal.symbol, signal.timeframe, {
          startTime: SignalTracker.getFetchStartTime(signal),
          limit: 1000,
        });

        const resolution = SignalTracker.evaluateSignalAgainstCandles(signal, candles);

        if (resolution.status === 'OPEN') {
          if (Number.isFinite(resolution.lastCheckedCandleTime)) {
            SignalModel.updateHistoricalSignalCheckpoint(signal.id, {
              lastCheckedCandleTime: resolution.lastCheckedCandleTime,
            });
          }
        } else {
          SignalModel.updateHistoricalSignalStatus(signal.id, resolution);
        }

        results.push({ id: signal.id, symbol: signal.symbol, status: resolution.status, ambiguousResolution: resolution.ambiguousResolution });
      } catch (error) {
        logger.error(`Signal tracker hata (${signal.symbol}#${signal.id}): ${error.message}`);
      }
    }

    return {
      processed: openSignals.length,
      results,
      stats: SignalModel.getSignalTrackingStats(),
    };
  }
}

module.exports = SignalTracker;
