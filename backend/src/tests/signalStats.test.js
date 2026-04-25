const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../database/db');
const { SignalModel } = require('../database/models');

const TEST_SYMBOL = 'TEST_STATS/USDT';
const TEST_ACTIVE_SYMBOL = 'TEST_ACTIVE_FILTER/USDT';

function cleanup() {
  db.prepare('DELETE FROM signal_history WHERE symbol = ?').run(TEST_SYMBOL);
  db.prepare('DELETE FROM signals WHERE symbol = ?').run(TEST_SYMBOL);
  db.prepare('DELETE FROM signal_history WHERE symbol = ?').run(TEST_ACTIVE_SYMBOL);
  db.prepare('DELETE FROM signals WHERE symbol = ?').run(TEST_ACTIVE_SYMBOL);
  db.prepare('DELETE FROM coins WHERE symbol = ?').run(TEST_ACTIVE_SYMBOL);
}

function buildHistory(overrides = {}) {
  return {
    signalId: null,
    symbol: TEST_SYMBOL,
    timeframe: '1h',
    signalType: 'TEST_BUY_META',
    confidence: 70,
    currentPrice: 100,
    direction: 'BUY',
    entryPrice: 100,
    stopLoss: 90,
    takeProfit1: 110,
    takeProfit2: 120,
    takeProfit3: 130,
    buyScore: 5,
    sellScore: 1,
    bonusScore: 0,
    rawScore: 4,
    marketRegime: 'STRONG_BULL',
    status: 'WIN_TP1',
    ...overrides,
  };
}

test.beforeEach(cleanup);
test.afterEach(cleanup);

test('stored signal rows include analysis metadata', () => {
  const saved = SignalModel.upsertSignal({
    symbol: TEST_SYMBOL,
    timeframe: '1h',
    signalType: 'TEST_BUY_META',
    confidence: 70,
    currentPrice: 100,
    buyScore: 5,
    sellScore: 1,
    bonusScore: 0,
    rawScore: 4,
    vetoReason: 'BUY_VETO_RSI_OVERBOUGHT_UPPER_BB',
    marketRegime: 'STRONG_BULL',
    stopLoss: 90,
    takeProfit1: 110,
    takeProfit2: 120,
    takeProfit3: 130,
  });

  const history = SignalModel.addToHistory(buildHistory({
    signalId: saved.id,
    vetoReason: 'BUY_VETO_RSI_OVERBOUGHT_UPPER_BB',
  }));

  const signalRow = db.prepare(`
    SELECT signal_type, confidence, raw_score, buy_score, sell_score, bonus_score, veto_reason, market_regime
    FROM signals
    WHERE id = ?
  `).get(saved.id);
  const historyRow = db.prepare(`
    SELECT signal_type, confidence, raw_score, buy_score, sell_score, bonus_score, veto_reason, market_regime
    FROM signal_history
    WHERE id = ?
  `).get(history.id);

  assert.deepEqual(signalRow, {
    signal_type: 'TEST_BUY_META',
    confidence: 70,
    raw_score: 4,
    buy_score: 5,
    sell_score: 1,
    bonus_score: 0,
    veto_reason: 'BUY_VETO_RSI_OVERBOUGHT_UPPER_BB',
    market_regime: 'STRONG_BULL',
  });
  assert.deepEqual(historyRow, signalRow);
});

test('latest signal queries only include active tracked coins and expose analysis timestamps', () => {
  db.prepare('INSERT INTO coins (symbol, name, is_active) VALUES (?, ?, 1)').run(TEST_ACTIVE_SYMBOL, 'Test Active Filter');

  const saved = SignalModel.upsertSignal({
    symbol: TEST_ACTIVE_SYMBOL,
    timeframe: '1h',
    signalType: 'BUY',
    confidence: 61,
    currentPrice: 100,
    analyzedAt: '2026-04-25T00:58:00.000Z',
    confirmedCandleCloseTime: Date.parse('2026-04-25T00:00:00.000Z'),
  });

  const activeSignals = SignalModel.getLatestSignals();
  const activeSignal = activeSignals.find(signal => signal.symbol === TEST_ACTIVE_SYMBOL);

  assert.equal(activeSignal.id, saved.id);
  assert.equal(activeSignal.analyzedAt, '2026-04-25T00:58:00.000Z');
  assert.equal(activeSignal.candleTimestamp, Date.parse('2026-04-25T00:00:00.000Z'));
  assert.equal(SignalModel.getSignalBySymbol(TEST_ACTIVE_SYMBOL).id, saved.id);

  SignalModel.deactivateCoin(TEST_ACTIVE_SYMBOL);

  assert.equal(SignalModel.getLatestSignals().some(signal => signal.symbol === TEST_ACTIVE_SYMBOL), false);
  assert.equal(SignalModel.getSignalBySymbol(TEST_ACTIVE_SYMBOL), undefined);
});

test('tracking stats include metadata breakdowns, win rates, and ambiguity counts', () => {
  const baseline = SignalModel.getSignalTrackingStats();

  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_BUY_META',
    direction: 'BUY',
    status: 'WIN_TP1',
    marketRegime: 'STRONG_BULL',
    vetoReason: 'BUY_VETO_RSI_OVERBOUGHT_UPPER_BB',
  }));
  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_SELL_META',
    direction: 'SELL',
    status: 'LOSS_SL',
    marketRegime: 'RANGE',
    vetoReason: 'SELL_VETO_RSI_OVERSOLD_LOWER_BB',
    ambiguousResolution: true,
    stopLoss: 110,
    takeProfit1: 90,
    takeProfit2: 80,
    takeProfit3: 70,
  }));
  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_LEGACY_META',
    direction: 'BUY',
    status: 'LOSS_SL',
    rawScore: null,
    marketRegime: null,
    vetoReason: null,
    ambiguousResolution: null,
  }));

  const stats = SignalModel.getSignalTrackingStats();

  assert.equal(stats.countsBySignalType.TEST_BUY_META, 1);
  assert.equal(stats.countsBySignalType.TEST_SELL_META, 1);
  assert.equal(stats.countsBySignalType.TEST_LEGACY_META, 1);
  assert.ok(stats.countsByDirection.BUY >= 1);
  assert.ok(stats.countsByDirection.SELL >= 1);
  assert.ok(stats.countsByMarketRegime.STRONG_BULL >= 1);
  assert.ok(stats.countsByMarketRegime.RANGE >= 1);
  assert.equal(stats.countsByMarketRegime.UNKNOWN, undefined);
  assert.ok(stats.countsByStatus.WIN_TP1 >= 1);
  assert.ok(stats.countsByStatus.LOSS_SL >= 1);
  assert.ok(stats.vetoReasonCounts.BUY_VETO_RSI_OVERBOUGHT_UPPER_BB >= 1);
  assert.ok(stats.vetoReasonCounts.SELL_VETO_RSI_OVERSOLD_LOWER_BB >= 1);
  assert.equal(stats.vetoReasonCounts.UNKNOWN, undefined);
  assert.deepEqual(stats.winRateBySignalType.TEST_BUY_META, { wins: 1, losses: 0, winRate: 100 });
  assert.deepEqual(stats.winRateBySignalType.TEST_SELL_META, { wins: 0, losses: 1, winRate: 0 });
  assert.equal(stats.winRateByMarketRegime.UNKNOWN, undefined);
  assert.equal(stats.rowsWithMarketRegime - baseline.rowsWithMarketRegime, 2);
  assert.equal(stats.rowsWithRawScore - baseline.rowsWithRawScore, 2);
  assert.equal(stats.rowsWithVetoReason - baseline.rowsWithVetoReason, 2);
  assert.equal(stats.rowsWithAmbiguousResolution - baseline.rowsWithAmbiguousResolution, 1);
  assert.equal(stats.measuredRows - baseline.measuredRows, 2);
  assert.equal(stats.legacyRows - baseline.legacyRows, 1);
  assert.ok(stats.metadataCoveragePercent <= 100);
  assert.equal(stats.ambiguousResolutions - baseline.ambiguousResolutions, 1);
});

test('tracking stats include expired breakdowns by signal type and market regime', () => {
  const baseline = SignalModel.getSignalTrackingStats();

  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_EXPIRED_BUY',
    direction: 'BUY',
    status: 'EXPIRED',
    marketRegime: 'RANGE',
    rawScore: 5,
  }));
  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_EXPIRED_BUY',
    direction: 'BUY',
    status: 'EXPIRED',
    marketRegime: 'STRONG_BULL',
    rawScore: 6,
  }));
  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_EXPIRED_SELL',
    direction: 'SELL',
    status: 'EXPIRED',
    marketRegime: null,
    rawScore: null,
    stopLoss: 110,
    takeProfit1: 90,
    takeProfit2: 80,
    takeProfit3: 70,
  }));

  const stats = SignalModel.getSignalTrackingStats();

  assert.equal(stats.expiredCountsBySignalType.TEST_EXPIRED_BUY - (baseline.expiredCountsBySignalType.TEST_EXPIRED_BUY || 0), 2);
  assert.equal(stats.expiredCountsBySignalType.TEST_EXPIRED_SELL - (baseline.expiredCountsBySignalType.TEST_EXPIRED_SELL || 0), 1);
  assert.equal(stats.expiredCountsByMarketRegime.RANGE - (baseline.expiredCountsByMarketRegime.RANGE || 0), 1);
  assert.equal(stats.expiredCountsByMarketRegime.STRONG_BULL - (baseline.expiredCountsByMarketRegime.STRONG_BULL || 0), 1);
  assert.equal(stats.expiredCountsByMarketRegime.UNKNOWN, undefined);
  assert.equal(stats.expiredCountsBySignalTypeAndRegime.TEST_EXPIRED_BUY.RANGE - (baseline.expiredCountsBySignalTypeAndRegime.TEST_EXPIRED_BUY?.RANGE || 0), 1);
  assert.equal(stats.expiredCountsBySignalTypeAndRegime.TEST_EXPIRED_BUY.STRONG_BULL - (baseline.expiredCountsBySignalTypeAndRegime.TEST_EXPIRED_BUY?.STRONG_BULL || 0), 1);
  assert.equal(stats.expiredCountsBySignalTypeAndRegime.TEST_EXPIRED_SELL, undefined);
  assert.equal(stats.expiredWithoutMarketRegime - baseline.expiredWithoutMarketRegime, 1);
});

test('analyzer behavior stats count measured WAIT and veto rows without trackable filtering', () => {
  const baseline = SignalModel.getAnalyzerBehaviorStats();

  SignalModel.addToHistory(buildHistory({
    signalType: 'WAIT',
    direction: 'NEUTRAL',
    status: 'OPEN',
    rawScore: -2,
    marketRegime: 'STRONG_BULL',
    vetoReason: 'BUY_VETO_RSI_OVERBOUGHT_UPPER_BB',
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    takeProfit3: null,
  }));
  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_ANALYZER_BUY',
    direction: 'BUY',
    status: 'OPEN',
    rawScore: 6,
    marketRegime: 'RANGE',
    vetoReason: null,
  }));
  SignalModel.addToHistory(buildHistory({
    signalType: 'TEST_ANALYZER_LEGACY',
    direction: 'NEUTRAL',
    status: 'OPEN',
    rawScore: null,
    marketRegime: null,
    vetoReason: null,
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    takeProfit3: null,
  }));

  const stats = SignalModel.getAnalyzerBehaviorStats();

  assert.equal(stats.measuredRows - baseline.measuredRows, 2);
  assert.equal(stats.legacyRows - baseline.legacyRows, 1);
  assert.equal(stats.waitCount - baseline.waitCount, 1);
  assert.equal(stats.vetoedSignalCount - baseline.vetoedSignalCount, 1);
  assert.equal(stats.neutralCount - baseline.neutralCount, 1);
  assert.equal(stats.buyCount - baseline.buyCount, 1);
  assert.equal(stats.countsBySignalType.WAIT - (baseline.countsBySignalType.WAIT || 0), 1);
  assert.equal(stats.countsBySignalType.TEST_ANALYZER_BUY, 1);
  assert.equal(stats.countsBySignalType.TEST_ANALYZER_LEGACY, undefined);
  assert.equal(stats.countsByDirection.NEUTRAL - (baseline.countsByDirection.NEUTRAL || 0), 1);
  assert.equal(stats.countsByDirection.BUY - (baseline.countsByDirection.BUY || 0), 1);
  assert.equal(stats.countsByMarketRegime.STRONG_BULL - (baseline.countsByMarketRegime.STRONG_BULL || 0), 1);
  assert.equal(stats.countsByMarketRegime.RANGE - (baseline.countsByMarketRegime.RANGE || 0), 1);
  assert.equal(stats.countsByMarketRegime.UNKNOWN, undefined);
  assert.equal(stats.vetoReasonCounts.BUY_VETO_RSI_OVERBOUGHT_UPPER_BB - (baseline.vetoReasonCounts.BUY_VETO_RSI_OVERBOUGHT_UPPER_BB || 0), 1);
  assert.equal(stats.vetoReasonCounts.UNKNOWN, undefined);
  assert.ok(stats.metadataCoveragePercent <= 100);
});
