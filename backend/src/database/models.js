const db = require('./db');
const logger = require('../utils/logger');

const WIN_STATUSES = ['WIN_TP1', 'WIN_TP2', 'WIN_TP3'];
const LOSS_STATUSES = ['LOSS_SL'];

function mapSignalDirection(signalType) {
  if (typeof signalType !== 'string') return 'NEUTRAL';
  if (signalType.includes('BUY')) return 'BUY';
  if (signalType.includes('SELL')) return 'SELL';
  return 'NEUTRAL';
}

function buildHistoryWhereClause(options = {}) {
  const clauses = [];
  const params = [];

  if (options.symbol) {
    clauses.push('symbol = ?');
    params.push(options.symbol);
  }

  if (options.status) {
    clauses.push('status = ?');
    params.push(options.status);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

const SignalModel = {
  upsertSignal(d) {
    const stmt = db.prepare(`
      INSERT INTO signals (
        symbol, timeframe, signal_type, confidence,
        current_price, open_price, high_price, low_price, volume,
        rsi, rsi_signal, macd_line, macd_signal_line, macd_histogram, macd_crossover,
        ema_200, price_vs_ema200, ema_200_distance,
        adx, plus_di, minus_di, adx_signal, atr, atr_percent,
        volume_ratio, volume_signal,
        bb_upper, bb_middle, bb_lower, bb_position, bb_signal,
        trend_1h, trend_4h, trend_alignment,
        buy_score, sell_score, bonus_score, raw_score,
        stop_loss, take_profit_1, take_profit_2, take_profit_3, risk_reward_ratio,
        analysis_notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      d.symbol, d.timeframe || '1h', d.signalType, d.confidence,
      d.currentPrice, d.openPrice, d.highPrice, d.lowPrice, d.volume,
      d.rsi, d.rsiSignal, d.macdLine, d.macdSignalLine, d.macdHistogram, d.macdCrossover,
      d.ema200, d.priceVsEma200, d.ema200Distance,
      d.adx, d.plusDi, d.minusDi, d.adxSignal, d.atr, d.atrPercent,
      d.volumeRatio, d.volumeSignal,
      d.bbUpper, d.bbMiddle, d.bbLower, d.bbPosition, d.bbSignal,
      d.trend1h, d.trend4h, d.trendAlignment,
      d.buyScore, d.sellScore, d.bonusScore, d.rawScore,
      d.stopLoss, d.takeProfit1, d.takeProfit2, d.takeProfit3, d.riskRewardRatio,
      d.analysisNotes
    );

    return { id: result.lastInsertRowid, ...d };
  },

  addToHistory(d) {
    const stmt = db.prepare(`
      INSERT INTO signal_history (
        signal_id, symbol, timeframe, signal_type, confidence, current_price,
        rsi, macd_histogram, adx, volume_ratio, bb_position,
        trend_1h, trend_4h, stop_loss, take_profit_1, take_profit_2, take_profit_3,
        buy_score, sell_score, bonus_score, direction, entry_price, status, last_checked_candle_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const direction = d.direction || mapSignalDirection(d.signalType);
    const entryPrice = d.entryPrice ?? d.currentPrice;
    const result = stmt.run(
      d.signalId, d.symbol, d.timeframe || '1h', d.signalType, d.confidence, d.currentPrice,
      d.rsi, d.macdHistogram, d.adx, d.volumeRatio, d.bbPosition,
      d.trend1h, d.trend4h, d.stopLoss, d.takeProfit1, d.takeProfit2, d.takeProfit3,
      d.buyScore, d.sellScore, d.bonusScore, direction, entryPrice, d.status || 'OPEN', d.lastCheckedCandleTime || null
    );

    return { id: result.lastInsertRowid, ...d, direction, entryPrice, status: d.status || 'OPEN' };
  },

  updateHistoricalSignalStatus(id, { status, resolvedAt = null, lastCheckedCandleTime = null }) {
    const stmt = db.prepare(`
      UPDATE signal_history
      SET status = ?,
          resolved_at = ?,
          last_checked_candle_time = COALESCE(?, last_checked_candle_time)
      WHERE id = ?
    `);

    const result = stmt.run(status, resolvedAt, lastCheckedCandleTime, id);
    return result.changes;
  },

  updateHistoricalSignalCheckpoint(id, { lastCheckedCandleTime }) {
    const stmt = db.prepare(`
      UPDATE signal_history
      SET last_checked_candle_time = ?
      WHERE id = ?
    `);

    const result = stmt.run(lastCheckedCandleTime, id);
    return result.changes;
  },

  getOpenHistoricalSignals() {
    return db.prepare(`
      SELECT *
      FROM signal_history
      WHERE status = 'OPEN'
      ORDER BY created_at ASC, id ASC
    `).all();
  },

  getSignalTrackingStats() {
    const row = db.prepare(`
      SELECT
        COUNT(*) AS totalSignals,
        SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS openSignals,
        SUM(CASE WHEN status IN ('WIN_TP1', 'WIN_TP2', 'WIN_TP3') THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN status = 'LOSS_SL' THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) AS expired,
        SUM(CASE WHEN status = 'WIN_TP1' THEN 1 ELSE 0 END) AS tp1Wins,
        SUM(CASE WHEN status = 'WIN_TP2' THEN 1 ELSE 0 END) AS tp2Wins,
        SUM(CASE WHEN status = 'WIN_TP3' THEN 1 ELSE 0 END) AS tp3Wins
      FROM signal_history
    `).get() || {};

    const totalSignals = row.totalSignals || 0;
    const openSignals = row.openSignals || 0;
    const wins = row.wins || 0;
    const losses = row.losses || 0;
    const expired = row.expired || 0;
    const tp1Wins = row.tp1Wins || 0;
    const tp2Wins = row.tp2Wins || 0;
    const tp3Wins = row.tp3Wins || 0;
    const resolvedForRate = wins + losses;
    const winRate = resolvedForRate > 0 ? Math.round((wins / resolvedForRate) * 10000) / 100 : 0;

    return {
      totalSignals,
      openSignals,
      wins,
      losses,
      expired,
      winRate,
      tp1Wins,
      tp2Wins,
      tp3Wins,
    };
  },

  getLatestSignals() {
    return db.prepare(`
      SELECT * FROM signals
      WHERE id IN (SELECT MAX(id) FROM signals GROUP BY symbol)
      ORDER BY created_at DESC
    `).all();
  },

  getSignalBySymbol(symbol) {
    return db.prepare('SELECT * FROM signals WHERE symbol = ? ORDER BY created_at DESC LIMIT 1').get(symbol);
  },

  getSignalHistoryBySymbol(symbol, limit = 100) {
    return db.prepare(`
      SELECT *
      FROM signal_history
      WHERE symbol = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(symbol, limit);
  },

  getSignalHistory(options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 100, 500));
    const { whereSql, params } = buildHistoryWhereClause(options);
    return db.prepare(`
      SELECT *
      FROM signal_history
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(...params, limit);
  },

  getActiveCoins() {
    return db.prepare('SELECT * FROM coins WHERE is_active = 1 ORDER BY symbol').all();
  },

  deleteOldSignals(symbol, keep = 5) {
    db.prepare(`
      DELETE FROM signals WHERE symbol = ? AND id NOT IN (
        SELECT id FROM signals WHERE symbol = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(symbol, symbol, keep);
  },

  cleanOldHistory(days = 30) {
    db.prepare(`DELETE FROM signal_history WHERE created_at < datetime('now', '-${days} days')`).run();
  },

  getCoinBySymbol(symbol) {
    return db.prepare('SELECT * FROM coins WHERE symbol = ?').get(symbol);
  },

  addCoin(symbol, name) {
    const stmt = db.prepare('INSERT INTO coins (symbol, name, is_active) VALUES (?, ?, 1)');
    const result = stmt.run(symbol, name);
    return { id: result.lastInsertRowid, symbol, name, is_active: 1 };
  },

  activateCoin(symbol) {
    db.prepare('UPDATE coins SET is_active = 1 WHERE symbol = ?').run(symbol);
  },

  deactivateCoin(symbol) {
    db.prepare('UPDATE coins SET is_active = 0 WHERE symbol = ?').run(symbol);
  },

  getAllCoins() {
    return db.prepare('SELECT * FROM coins ORDER BY symbol').all();
  },

  logTrackingSummary(stats) {
    logger.info(`Tracking stats | total:${stats.totalSignals} open:${stats.openSignals} wins:${stats.wins} losses:${stats.losses} expired:${stats.expired} winRate:${stats.winRate}%`);
  },
};

module.exports = { SignalModel, WIN_STATUSES, LOSS_STATUSES, mapSignalDirection };
