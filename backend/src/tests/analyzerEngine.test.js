const test = require('node:test');
const assert = require('node:assert/strict');
const Analyzer = require('../engine/analyzer');
const Indicators = require('../engine/indicators');
const RiskManager = require('../engine/riskManager');

const originalIndicators = {
  calculateRSI: Indicators.calculateRSI,
  calculateMACD: Indicators.calculateMACD,
  calculateEMA200Trend: Indicators.calculateEMA200Trend,
  calculateADX: Indicators.calculateADX,
  calculateATR: Indicators.calculateATR,
  calculateVolumeAnalysis: Indicators.calculateVolumeAnalysis,
  calculateBollingerBands: Indicators.calculateBollingerBands,
};

function restoreIndicators() {
  Object.assign(Indicators, originalIndicators);
}

function buildOhlcv(length = 220, price = 100) {
  const values = Array(length).fill(price);
  return {
    opens: values,
    highs: values.map(v => v + 1),
    lows: values.map(v => v - 1),
    closes: values,
    volumes: Array(length).fill(1000),
    quoteVolumes: Array(length).fill(100000),
    closeTimes: Array.from({ length }, (_, i) => Date.parse('2026-04-16T00:00:00.000Z') + i * 3600000),
  };
}

function mockIndicators({
  rsi = 50,
  macd = { macdLine: 1, signalLine: 0, histogram: 1, crossover: 'NONE' },
  ema200Data = { ema200: 90, trend: 'BULLISH', distance: 10 },
  adxData = { adx: 30, plusDi: 30, minusDi: 10 },
  atr = 5,
  volumeData = {
    ratio: 1,
    signal: 'NORMAL',
    currentUsdVolume: 100000,
    averageUsdVolume: 100000,
    currentVolumeSource: 'quoteVolume',
    historicalSourceBreakdown: { quoteVolume: 20 },
  },
  bb = { upper: 110, middle: 100, lower: 90, position: 0.5 },
}) {
  Indicators.calculateRSI = () => rsi;
  Indicators.calculateMACD = () => macd;
  Indicators.calculateEMA200Trend = () => ema200Data;
  Indicators.calculateADX = () => adxData;
  Indicators.calculateATR = () => atr;
  Indicators.calculateVolumeAnalysis = () => volumeData;
  Indicators.calculateBollingerBands = () => bb;
}

test.afterEach(() => {
  restoreIndicators();
});

test('BUY veto turns overbought upper-band BUY setup into WAIT with veto reason', () => {
  mockIndicators({
    rsi: 80,
    macd: { macdLine: 2, signalLine: 1, histogram: 1, crossover: 'BULLISH' },
    ema200Data: { ema200: 90, trend: 'BULLISH', distance: 10 },
    adxData: { adx: 35, plusDi: 35, minusDi: 10 },
    bb: { upper: 105, middle: 100, lower: 95, position: 0.9 },
  });

  const result = Analyzer.analyze(buildOhlcv(), 'BTCUSDT');

  assert.equal(result.signalType, 'WAIT');
  assert.equal(result.stopLoss, null);
  assert.equal(result.vetoReason, 'BUY_VETO_RSI_OVERBOUGHT_UPPER_BB');
  assert.equal(result.marketRegime, 'STRONG_BULL');
});

test('SELL veto turns oversold lower-band SELL setup into WAIT with veto reason', () => {
  mockIndicators({
    rsi: 20,
    macd: { macdLine: -2, signalLine: -1, histogram: -1, crossover: 'BEARISH' },
    ema200Data: { ema200: 110, trend: 'BEARISH', distance: -10 },
    adxData: { adx: 35, plusDi: 10, minusDi: 35 },
    bb: { upper: 105, middle: 100, lower: 95, position: 0.1 },
  });

  const result = Analyzer.analyze(buildOhlcv(), 'BTCUSDT');

  assert.equal(result.signalType, 'WAIT');
  assert.equal(result.stopLoss, null);
  assert.equal(result.vetoReason, 'SELL_VETO_RSI_OVERSOLD_LOWER_BB');
  assert.equal(result.marketRegime, 'STRONG_BEAR');
});

test('ranging market caps MACD influence compared with aligned strong-trend regime', () => {
  const macd = { macdLine: 2, signalLine: 1, histogram: 1, crossover: 'BULLISH' };

  mockIndicators({
    rsi: 45,
    macd,
    ema200Data: { ema200: 90, trend: 'BULLISH', distance: 10 },
    adxData: { adx: 10, plusDi: 20, minusDi: 18 },
    bb: { upper: 110, middle: 100, lower: 90, position: 0.5 },
  });
  const rangingResult = Analyzer.analyze(buildOhlcv(), 'BTCUSDT');

  mockIndicators({
    rsi: 45,
    macd,
    ema200Data: { ema200: 90, trend: 'BULLISH', distance: 10 },
    adxData: { adx: 35, plusDi: 35, minusDi: 10 },
    bb: { upper: 110, middle: 100, lower: 90, position: 0.5 },
  });
  const trendResult = Analyzer.analyze(buildOhlcv(), 'BTCUSDT');

  assert.ok(rangingResult.rawScore < trendResult.rawScore);
  assert.ok(rangingResult.buyScore < trendResult.buyScore);
  assert.equal(rangingResult.marketRegime, 'RANGE');
  assert.equal(trendResult.marketRegime, 'STRONG_BULL');
  assert.notEqual(rangingResult.signalType, 'STRONG_BUY');
  assert.equal(trendResult.signalType, 'STRONG_BUY');
});

test('strong bull trend suppresses contradictory RSI and Bollinger mean-reversion pressure', () => {
  mockIndicators({
    rsi: 65,
    macd: { macdLine: 2, signalLine: 1, histogram: 1, crossover: 'NONE' },
    ema200Data: { ema200: 90, trend: 'BULLISH', distance: 10 },
    adxData: { adx: 35, plusDi: 35, minusDi: 10 },
    bb: { upper: 105, middle: 100, lower: 95, position: 0.85 },
  });

  const result = Analyzer.analyze(buildOhlcv(), 'BTCUSDT');

  assert.equal(result.rsiSignal, 'SLIGHTLY_OVERBOUGHT');
  assert.equal(result.bbSignal, 'NEAR_UPPER');
  assert.equal(result.sellScore, 0);
  assert.equal(result.vetoReason, null);
  assert.equal(result.marketRegime, 'STRONG_BULL');
  assert.match(result.signalType, /BUY/);
});

test('RiskManager tightens high-ADX BUY stop to 1.2 ATR and raises targets', () => {
  const result = RiskManager.calculateLevels(100, 10, 'BUY', 40, 1);

  assert.equal(result.stopLoss, 88);
  assert.equal(result.takeProfit1, 118);
  assert.equal(result.takeProfit2, 130);
  assert.equal(result.takeProfit3, 148);
  assert.equal(result.riskRewardRatio, 1.5);
});

test('RiskManager keeps high-ADX SELL stop at least 1.5 ATR away and raises targets', () => {
  const result = RiskManager.calculateLevels(100, 10, 'SELL', 30, 1);

  assert.equal(result.stopLoss, 115);
  assert.equal(result.takeProfit1, 83);
  assert.equal(result.takeProfit2, 72);
  assert.equal(result.takeProfit3, 55);
  assert.equal(result.riskRewardRatio, 1.13);
});

test('analyzer keeps vetoReason null when no veto is triggered', () => {
  mockIndicators({
    rsi: 45,
    macd: { macdLine: 2, signalLine: 1, histogram: 1, crossover: 'BULLISH' },
    ema200Data: { ema200: 90, trend: 'BULLISH', distance: 10 },
    adxData: { adx: 35, plusDi: 35, minusDi: 10 },
    bb: { upper: 110, middle: 100, lower: 90, position: 0.5 },
  });

  const result = Analyzer.analyze(buildOhlcv(), 'BTCUSDT');

  assert.equal(result.vetoReason, null);
  assert.ok(Object.hasOwn(result, 'signalType'));
  assert.ok(Object.hasOwn(result, 'confidence'));
  assert.ok(Object.hasOwn(result, 'rawScore'));
  assert.ok(Object.hasOwn(result, 'stopLoss'));
});
