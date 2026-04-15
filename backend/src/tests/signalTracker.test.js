const test = require('node:test');
const assert = require('node:assert/strict');
const SignalTracker = require('../services/signalTracker');
const EVALUATION_CANDLE_TIME = Date.parse('2026-04-16T02:00:00.000Z');

function buildSignal(overrides = {}) {
  return {
    id: 1,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    direction: 'BUY',
    stop_loss: 95,
    take_profit_1: 105,
    take_profit_2: 110,
    take_profit_3: 120,
    created_at: '2026-04-16T00:00:00.000Z',
    last_checked_candle_time: null,
    ...overrides,
  };
}

function buildCandles({ highs = [], lows = [], closeTimes = [] } = {}) {
  return {
    highs,
    lows,
    closeTimes,
  };
}

test('BUY hits TP1 on a closed candle', () => {
  const signal = buildSignal();
  const result = SignalTracker.evaluateSignalAgainstCandles(signal, buildCandles({
    highs: [106],
    lows: [99],
    closeTimes: [EVALUATION_CANDLE_TIME],
  }));

  assert.equal(result.status, 'WIN_TP1');
});

test('BUY hits stop loss on a closed candle', () => {
  const signal = buildSignal();
  const result = SignalTracker.evaluateSignalAgainstCandles(signal, buildCandles({
    highs: [101],
    lows: [94],
    closeTimes: [EVALUATION_CANDLE_TIME],
  }));

  assert.equal(result.status, 'LOSS_SL');
});

test('SELL hits TP2 on a closed candle', () => {
  const signal = buildSignal({
    direction: 'SELL',
    stop_loss: 105,
    take_profit_1: 95,
    take_profit_2: 90,
    take_profit_3: 80,
  });
  const result = SignalTracker.evaluateSignalAgainstCandles(signal, buildCandles({
    highs: [101],
    lows: [89],
    closeTimes: [EVALUATION_CANDLE_TIME],
  }));

  assert.equal(result.status, 'WIN_TP2');
});

test('ambiguous candle touching both TP and SL resolves conservatively as LOSS_SL', () => {
  const signal = buildSignal();
  const result = SignalTracker.evaluateSignalAgainstCandles(signal, buildCandles({
    highs: [106],
    lows: [94],
    closeTimes: [EVALUATION_CANDLE_TIME],
  }));

  assert.equal(result.status, 'LOSS_SL');
});

test('signal expires after timeframe candle budget is exhausted', () => {
  const signal = buildSignal({
    timeframe: '1h',
    created_at: '2026-04-16T00:00:00.000Z',
  });
  const expirationTime = SignalTracker.getExpirationTime(signal);
  const result = SignalTracker.evaluateSignalAgainstCandles(signal, buildCandles({
    highs: [],
    lows: [],
    closeTimes: [],
  }), expirationTime + 1);

  assert.equal(result.status, 'EXPIRED');
});
