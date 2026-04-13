const db = require('./db');
const logger = require('../utils/logger');

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
        buy_score, sell_score, bonus_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      d.signalId, d.symbol, d.timeframe || '1h', d.signalType, d.confidence, d.currentPrice,
      d.rsi, d.macdHistogram, d.adx, d.volumeRatio, d.bbPosition,
      d.trend1h, d.trend4h, d.stopLoss, d.takeProfit1, d.takeProfit2, d.takeProfit3,
      d.buyScore, d.sellScore, d.bonusScore
    );
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

  getSignalHistory(symbol, limit = 100) {
    return db.prepare('SELECT * FROM signal_history WHERE symbol = ? ORDER BY created_at DESC LIMIT ?').all(symbol, limit);
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

  // Coin yönetimi
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
};

module.exports = { SignalModel };