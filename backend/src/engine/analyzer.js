const Indicators = require('./indicators');
const RiskManager = require('./riskManager');
const logger = require('../utils/logger');

class Analyzer {
  static getLatestClosedIndex(closeTimes = [], fallbackLength = 0, now = Date.now()) {
    const lastIndex = fallbackLength - 1;
    if (lastIndex < 0) return -1;

    if (!Array.isArray(closeTimes) || closeTimes.length <= lastIndex) {
      return lastIndex;
    }

    const lastCloseTime = closeTimes[lastIndex];
    if (Number.isFinite(lastCloseTime) && lastCloseTime > now) {
      return lastIndex - 1;
    }

    return lastIndex;
  }

  static buildClosedCandleContext(ohlcv, now = Date.now()) {
    const opens = Array.isArray(ohlcv?.opens) ? ohlcv.opens : [];
    const highs = Array.isArray(ohlcv?.highs) ? ohlcv.highs : [];
    const lows = Array.isArray(ohlcv?.lows) ? ohlcv.lows : [];
    const closes = Array.isArray(ohlcv?.closes) ? ohlcv.closes : [];
    const volumes = Array.isArray(ohlcv?.volumes) ? ohlcv.volumes : [];
    const quoteVolumes = Array.isArray(ohlcv?.quoteVolumes) ? ohlcv.quoteVolumes : [];
    const closeTimes = Array.isArray(ohlcv?.closeTimes) ? ohlcv.closeTimes : [];

    const normalizedLength = Math.min(opens.length, highs.length, lows.length, closes.length, volumes.length);
    const latestClosedIndex = this.getLatestClosedIndex(closeTimes, normalizedLength, now);
    const closedLength = latestClosedIndex + 1;

    return {
      raw: { opens, highs, lows, closes, volumes, quoteVolumes, closeTimes },
      hasOpenCandle: latestClosedIndex >= 0 && latestClosedIndex < normalizedLength - 1,
      latestClosedIndex,
      lastRawIndex: normalizedLength - 1,
      opens: closedLength > 0 ? opens.slice(0, closedLength) : [],
      highs: closedLength > 0 ? highs.slice(0, closedLength) : [],
      lows: closedLength > 0 ? lows.slice(0, closedLength) : [],
      closes: closedLength > 0 ? closes.slice(0, closedLength) : [],
      volumes: closedLength > 0 ? volumes.slice(0, closedLength) : [],
      quoteVolumes: closedLength > 0 ? quoteVolumes.slice(0, closedLength) : [],
      closeTimes: closedLength > 0 ? closeTimes.slice(0, closedLength) : [],
    };
  }

  static analyze(ohlcv, symbol, timeframe = '1h') {
    const closed = this.buildClosedCandleContext(ohlcv);
    const { opens, highs, lows, closes, volumes, quoteVolumes, closeTimes, raw, latestClosedIndex, lastRawIndex, hasOpenCandle } = closed;
    if (!closes || closes.length < 200) { logger.warn(`Yetersiz veri: ${symbol}`); return null; }

    const currentPrice = closes[closes.length - 1];
    const rsi = Indicators.calculateRSI(closes, 14);
    const macd = Indicators.calculateMACD(closes, 12, 26, 9);
    const ema200Data = Indicators.calculateEMA200Trend(closes);
    const adxData = Indicators.calculateADX(highs, lows, closes, 14);
    const atr = Indicators.calculateATR(highs, lows, closes, 14);
    const volumeData = Indicators.calculateVolumeAnalysis({
      closes,
      volumes,
      baseVolumes: volumes,
      quoteVolumes,
      currentIndex: closes.length - 1,
    }, 20);
    const bb = Indicators.calculateBollingerBands(closes, 20, 2);
    const hasValidVolumeRatio = Number.isFinite(volumeData.ratio) && volumeData.ratio >= 0;

    logger.debug(JSON.stringify({
      event: 'volume_analysis',
      symbol,
      timeframe,
      exchange: 'binance',
      source: 'binance-klines',
      selectedBarIndex: latestClosedIndex,
      selectedBarType: hasOpenCandle ? 'previous_closed_bar' : 'latest_closed_or_only_bar',
      selectedBarReason: hasOpenCandle ? 'last kline still open; excluded from all indicator and scoring calculations' : 'last kline already closed or close time unavailable',
      rawLastBarIndex: lastRawIndex,
      baseVolume: closes.length > 0 ? volumes[closes.length - 1] : null,
      quoteVolume: closes.length > 0 && Array.isArray(quoteVolumes) ? quoteVolumes[closes.length - 1] : null,
      closePrice: currentPrice,
      currentUsdVolume: volumeData.currentUsdVolume,
      averageUsdVolume: volumeData.averageUsdVolume,
      volumeRatio: volumeData.ratio,
      finalVolumeState: volumeData.signal,
      chosenCurrentVolumeSource: volumeData.currentVolumeSource,
      historicalVolumeSources: volumeData.historicalSourceBreakdown,
    }));

    let rsiSignal = 'NEUTRAL', rsiScore = 0;
    if (rsi !== null) {
      if (rsi <= 20) { rsiSignal = 'EXTREMELY_OVERSOLD'; rsiScore = 3; }
      else if (rsi <= 30) { rsiSignal = 'OVERSOLD'; rsiScore = 2; }
      else if (rsi <= 40) { rsiSignal = 'SLIGHTLY_OVERSOLD'; rsiScore = 1; }
      else if (rsi >= 80) { rsiSignal = 'EXTREMELY_OVERBOUGHT'; rsiScore = -3; }
      else if (rsi >= 70) { rsiSignal = 'OVERBOUGHT'; rsiScore = -2; }
      else if (rsi >= 60) { rsiSignal = 'SLIGHTLY_OVERBOUGHT'; rsiScore = -1; }
    }

    let macdScore = 0;
    if (macd.histogram !== null) {
      if (macd.crossover === 'BULLISH') macdScore = 3;
      else if (macd.crossover === 'BEARISH') macdScore = -3;
      else if (macd.histogram > 0 && macd.macdLine > 0) macdScore = 2;
      else if (macd.histogram > 0) macdScore = 1;
      else if (macd.histogram < 0 && macd.macdLine < 0) macdScore = -2;
      else if (macd.histogram < 0) macdScore = -1;
    }

    let ema200Score = 0;
    if (ema200Data.trend === 'BULLISH') { ema200Score = 2; if (ema200Data.distance > 5) ema200Score = 1; }
    else if (ema200Data.trend === 'BEARISH') { ema200Score = -2; if (ema200Data.distance < -5) ema200Score = -1; }

    let adxSignal = 'WEAK_TREND', adxScore = 0;
    if (adxData.adx !== null) {
      if (adxData.adx >= 50) adxSignal = 'VERY_STRONG_TREND';
      else if (adxData.adx >= 25) adxSignal = 'STRONG_TREND';
      else if (adxData.adx >= 20) adxSignal = 'MODERATE_TREND';
      if (adxData.adx >= 25) adxScore = adxData.plusDi > adxData.minusDi ? 2 : -2;
      else if (adxData.adx >= 20) adxScore = adxData.plusDi > adxData.minusDi ? 1 : -1;
    }

    let bbSignal = 'NEUTRAL', bbScore = 0;
    if (bb.position !== null) {
      if (bb.position <= 0) { bbSignal = 'BELOW_LOWER'; bbScore = 2; }
      else if (bb.position <= 0.2) { bbSignal = 'NEAR_LOWER'; bbScore = 1; }
      else if (bb.position >= 1) { bbSignal = 'ABOVE_UPPER'; bbScore = -2; }
      else if (bb.position >= 0.8) { bbSignal = 'NEAR_UPPER'; bbScore = -1; }
      else bbSignal = 'MIDDLE';
    }

    const isStrongBullTrend = adxData.adx !== null && adxData.adx >= 25 && ema200Data.trend === 'BULLISH' && adxData.plusDi > adxData.minusDi;
    const isStrongBearTrend = adxData.adx !== null && adxData.adx >= 25 && ema200Data.trend === 'BEARISH' && adxData.minusDi > adxData.plusDi;
    const isRangingMarket = adxData.adx !== null && adxData.adx < 20;
    const marketRegime = isStrongBullTrend ? 'STRONG_BULL' : isStrongBearTrend ? 'STRONG_BEAR' : isRangingMarket ? 'RANGE' : 'NEUTRAL';

    let effectiveRsiScore = rsiScore;
    let effectiveBbScore = bbScore;
    let effectiveEma200Score = ema200Score;
    let effectiveAdxScore = adxScore;
    let effectiveMacdScore = macdScore;

    if (isStrongBullTrend) {
      effectiveRsiScore = Math.max(0, effectiveRsiScore);
      effectiveBbScore = Math.max(0, effectiveBbScore);
    } else if (isStrongBearTrend) {
      effectiveRsiScore = Math.min(0, effectiveRsiScore);
      effectiveBbScore = Math.min(0, effectiveBbScore);
    } else if (isRangingMarket) {
      effectiveEma200Score = 0;
      effectiveAdxScore = 0;
      effectiveMacdScore = Math.sign(effectiveMacdScore) * Math.min(Math.abs(effectiveMacdScore), 1);
    }

    let buyScore = 0, sellScore = 0;
    for (const s of [effectiveRsiScore, effectiveMacdScore, effectiveEma200Score, effectiveAdxScore, effectiveBbScore]) {
      if (s > 0) buyScore += s; if (s < 0) sellScore += Math.abs(s);
    }

    let bonusScore = 0;
    if (macd.crossover === 'BULLISH' && rsi < 50) bonusScore += 2;
    if (macd.crossover === 'BEARISH' && rsi > 50) bonusScore -= 2;
    if (ema200Data.trend === 'BULLISH' && effectiveMacdScore > 0 && effectiveRsiScore > 0) bonusScore += 2;
    if (ema200Data.trend === 'BEARISH' && effectiveMacdScore < 0 && effectiveRsiScore < 0) bonusScore -= 2;
    if (hasValidVolumeRatio && volumeData.ratio >= 1.5) { if (buyScore > sellScore) bonusScore += 1; if (sellScore > buyScore) bonusScore -= 1; }
    if (adxData.adx >= 30) {
      if (adxData.plusDi > adxData.minusDi && buyScore > sellScore) bonusScore += 1;
      if (adxData.minusDi > adxData.plusDi && sellScore > buyScore) bonusScore -= 1;
    }
    if (!isStrongBearTrend && bb.position <= 0.1 && rsi < 35) bonusScore += 2;
    if (!isStrongBullTrend && bb.position >= 0.9 && rsi > 65) bonusScore -= 2;

    const rawScore = buyScore - sellScore + bonusScore;

    let signalType = 'WAIT', direction = 'NEUTRAL';
    if (rawScore >= 8) { signalType = 'STRONG_BUY'; direction = 'BUY'; }
    else if (rawScore >= 5) { signalType = 'BUY'; direction = 'BUY'; }
    else if (rawScore >= 3) { signalType = 'WEAK_BUY'; direction = 'BUY'; }
    else if (rawScore <= -8) { signalType = 'STRONG_SELL'; direction = 'SELL'; }
    else if (rawScore <= -5) { signalType = 'SELL'; direction = 'SELL'; }
    else if (rawScore <= -3) { signalType = 'WEAK_SELL'; direction = 'SELL'; }

    if (adxData.adx !== null && adxData.adx < 15) {
      if (signalType === 'STRONG_BUY') signalType = 'WEAK_BUY';
      else if (signalType === 'STRONG_SELL') signalType = 'WEAK_SELL';
      else if (signalType === 'BUY' && rawScore < 6) signalType = 'WEAK_BUY';
      else if (signalType === 'SELL' && rawScore > -6) signalType = 'WEAK_SELL';
    }
    if (hasValidVolumeRatio && volumeData.ratio < 0.3 && (signalType === 'WEAK_BUY' || signalType === 'WEAK_SELL')) signalType = 'WAIT';

    const isUpperBollingerRegion = bb.position !== null && bb.position >= 0.8;
    const isLowerBollingerRegion = bb.position !== null && bb.position <= 0.2;
    const buyVeto = rsi !== null && rsi >= 75 && isUpperBollingerRegion;
    const sellVeto = rsi !== null && rsi <= 25 && isLowerBollingerRegion;
    let vetoReason = null;
    if (buyVeto && direction === 'BUY') {
      signalType = 'WAIT';
      direction = 'NEUTRAL';
      vetoReason = 'BUY_VETO_RSI_OVERBOUGHT_UPPER_BB';
    } else if (sellVeto && direction === 'SELL') {
      signalType = 'WAIT';
      direction = 'NEUTRAL';
      vetoReason = 'SELL_VETO_RSI_OVERSOLD_LOWER_BB';
    }

    let confidence = Math.min((Math.abs(rawScore) / 16) * 100, 100);
    if (adxData.adx >= 30) confidence = Math.min(confidence * 1.15, 100);
    else if (adxData.adx < 20) confidence *= 0.8;
    if (hasValidVolumeRatio && volumeData.ratio >= 1.5) confidence = Math.min(confidence * 1.1, 100);
    else if (hasValidVolumeRatio && volumeData.ratio < 0.5) confidence *= 0.85;
    confidence = Math.round(confidence * 100) / 100;

    const risk = RiskManager.calculateLevels(currentPrice, atr, direction, adxData.adx, volumeData.ratio);
    const livePrice = hasOpenCandle && raw.closes.length > 0 ? raw.closes[raw.closes.length - 1] : currentPrice;

    return {
      symbol, timeframe, signalType, confidence, currentPrice,
      openPrice: opens[opens.length - 1], highPrice: highs[highs.length - 1], lowPrice: lows[lows.length - 1],
      volume: volumes[volumes.length - 1],
      livePrice,
      confirmedCandleCloseTime: closeTimes[closeTimes.length - 1] || null,
      hasOpenCandle,
      rsi, rsiSignal, macdLine: macd.macdLine, macdSignalLine: macd.signalLine,
      macdHistogram: macd.histogram, macdCrossover: macd.crossover,
      ema200: ema200Data.ema200, priceVsEma200: ema200Data.trend, ema200Distance: ema200Data.distance,
      adx: adxData.adx, plusDi: adxData.plusDi, minusDi: adxData.minusDi, adxSignal,
      atr, atrPercent: atr ? Math.round((atr / currentPrice) * 10000) / 100 : null,
      volumeRatio: volumeData.ratio, volumeSignal: volumeData.signal,
      bbUpper: bb.upper, bbMiddle: bb.middle, bbLower: bb.lower, bbPosition: bb.position, bbSignal,
      buyScore, sellScore, bonusScore, rawScore,
      vetoReason,
      marketRegime,
      stopLoss: risk.stopLoss, takeProfit1: risk.takeProfit1, takeProfit2: risk.takeProfit2,
      takeProfit3: risk.takeProfit3, riskRewardRatio: risk.riskRewardRatio,
      analysisNotes: `RSI:${rsiSignal}|MACD:${macd.crossover}|Trend:${ema200Data.trend}|ADX:${adxSignal}|Vol:${volumeData.signal}|BB:${bbSignal}`,
    };
  }

  static analyzeMultiTimeframe(ohlcv1h, ohlcv4h, symbol) {
    const a1h = this.analyze(ohlcv1h, symbol, '1h');
    const a4h = this.analyze(ohlcv4h, symbol, '4h');
    if (!a1h) return null;

    const getTrend = (a) => {
      let bull = 0, bear = 0;
      if (a.priceVsEma200 === 'BULLISH') bull++; else if (a.priceVsEma200 === 'BEARISH') bear++;
      if (a.macdHistogram > 0) bull++; else if (a.macdHistogram < 0) bear++;
      if (a.rsi > 50) bull++; else if (a.rsi < 50) bear++;
      if (a.plusDi > a.minusDi) bull++; else bear++;
      return bull >= 3 ? 'BULLISH' : bear >= 3 ? 'BEARISH' : 'NEUTRAL';
    };

    const trend1h = getTrend(a1h);
    const trend4h = a4h ? getTrend(a4h) : 'UNKNOWN';
    let trendAlignment = 'MIXED';
    if (trend1h === trend4h) trendAlignment = 'ALIGNED';
    else if (trend1h === 'NEUTRAL' || trend4h === 'NEUTRAL' || trend4h === 'UNKNOWN') trendAlignment = 'PARTIAL';
    else trendAlignment = 'CONFLICTING';

    let sig = a1h.signalType, conf = a1h.confidence;
    if (trendAlignment === 'ALIGNED') conf = Math.min(conf * 1.2, 100);
    else if (trendAlignment === 'CONFLICTING') {
      conf *= 0.7;
      if (sig === 'STRONG_BUY') sig = 'BUY';
      else if (sig === 'STRONG_SELL') sig = 'SELL';
      else if (sig === 'BUY') sig = 'WEAK_BUY';
      else if (sig === 'SELL') sig = 'WEAK_SELL';
    }

    return { ...a1h, signalType: sig, confidence: Math.round(conf * 100) / 100, trend1h, trend4h, trendAlignment };
  }
}

module.exports = Analyzer;
