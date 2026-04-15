class Indicators {
  static isValidNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  static toUsdVolume(baseVolume, quoteVolume, closePrice) {
    if (this.isValidNumber(quoteVolume) && quoteVolume >= 0) {
      return { usdVolume: quoteVolume, source: 'quoteVolume' };
    }
    if (this.isValidNumber(baseVolume) && baseVolume >= 0 && this.isValidNumber(closePrice) && closePrice > 0) {
      return { usdVolume: baseVolume * closePrice, source: 'baseVolume*closePrice' };
    }
    return { usdVolume: null, source: 'unavailable' };
  }

  static calculateSMA(data, period) {
    if (data.length < period) return null;
    const slice = data.slice(data.length - period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  static calculateEMA(data, period) {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let ema = 0;
    for (let i = 0; i < period; i++) ema += data[i];
    ema /= period;
    for (let i = period; i < data.length; i++) ema = (data[i] - ema) * k + ema;
    return ema;
  }

  static calculateEMASeries(data, period) {
    if (data.length < period) return Array(data.length).fill(null);
    const k = 2 / (period + 1);
    const result = Array(period - 1).fill(null);
    let ema = 0;
    for (let i = 0; i < period; i++) ema += data[i];
    ema /= period;
    result.push(ema);
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * k + ema;
      result.push(ema);
    }
    return result;
  }

  static calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    const changes = [];
    for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) { avgGain += gains[i]; avgLoss += losses[i]; }
    avgGain /= period; avgLoss /= period;
    for (let i = period; i < changes.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    if (avgLoss === 0) return 100;
    return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
  }

  static calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
    if (closes.length < slow + signal) return { macdLine: null, signalLine: null, histogram: null, crossover: 'NONE' };
    const emaFast = this.calculateEMASeries(closes, fast);
    const emaSlow = this.calculateEMASeries(closes, slow);
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
      if (emaFast[i] !== null && emaSlow[i] !== null) macdLine.push(emaFast[i] - emaSlow[i]);
      else macdLine.push(null);
    }
    const macdValues = macdLine.filter(v => v !== null);
    if (macdValues.length < signal) return { macdLine: null, signalLine: null, histogram: null, crossover: 'NONE' };
    const signalValues = this.calculateEMASeries(macdValues, signal);
    const lastMacd = macdValues[macdValues.length - 1];
    const lastSignal = signalValues[signalValues.length - 1];
    const prevMacd = macdValues[macdValues.length - 2];
    const prevSignal = signalValues[signalValues.length - 2];
    let crossover = 'NONE';
    if (prevMacd !== null && prevSignal !== null) {
      if (prevMacd <= prevSignal && lastMacd > lastSignal) crossover = 'BULLISH';
      else if (prevMacd >= prevSignal && lastMacd < lastSignal) crossover = 'BEARISH';
    }
    return {
      macdLine: Math.round(lastMacd * 1e8) / 1e8,
      signalLine: Math.round(lastSignal * 1e8) / 1e8,
      histogram: Math.round((lastMacd - lastSignal) * 1e8) / 1e8,
      crossover,
    };
  }

  static calculateADX(highs, lows, closes, period = 14) {
    if (highs.length < period * 2 + 1) return { adx: null, plusDi: null, minusDi: null };
    const trs = [], pDMs = [], mDMs = [];
    for (let i = 1; i < highs.length; i++) {
      trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
      const up = highs[i] - highs[i-1], down = lows[i-1] - lows[i];
      pDMs.push(up > down && up > 0 ? up : 0);
      mDMs.push(down > up && down > 0 ? down : 0);
    }
    let sTR = 0, sPDM = 0, sMDM = 0;
    for (let i = 0; i < period; i++) { sTR += trs[i]; sPDM += pDMs[i]; sMDM += mDMs[i]; }
    const dxValues = [];
    let plusDi = sTR ? 100 * sPDM / sTR : 0;
    let minusDi = sTR ? 100 * sMDM / sTR : 0;
    let diSum = plusDi + minusDi;
    dxValues.push(diSum ? 100 * Math.abs(plusDi - minusDi) / diSum : 0);
    for (let i = period; i < trs.length; i++) {
      sTR = sTR - sTR / period + trs[i];
      sPDM = sPDM - sPDM / period + pDMs[i];
      sMDM = sMDM - sMDM / period + mDMs[i];
      plusDi = sTR ? 100 * sPDM / sTR : 0;
      minusDi = sTR ? 100 * sMDM / sTR : 0;
      diSum = plusDi + minusDi;
      dxValues.push(diSum ? 100 * Math.abs(plusDi - minusDi) / diSum : 0);
    }
    if (dxValues.length < period) return { adx: null, plusDi: null, minusDi: null };
    let adx = 0;
    for (let i = 0; i < period; i++) adx += dxValues[i];
    adx /= period;
    for (let i = period; i < dxValues.length; i++) adx = (adx * (period - 1) + dxValues[i]) / period;
    return { adx: Math.round(adx * 100) / 100, plusDi: Math.round(plusDi * 100) / 100, minusDi: Math.round(minusDi * 100) / 100 };
  }

  static calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return null;
    const trs = [];
    for (let i = 1; i < highs.length; i++)
      trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
    let atr = 0;
    for (let i = 0; i < period; i++) atr += trs[i];
    atr /= period;
    for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
    return Math.round(atr * 1e8) / 1e8;
  }

  static calculateBollingerBands(closes, period = 20, mult = 2) {
    if (closes.length < period) return { upper: null, middle: null, lower: null, position: null };
    const slice = closes.slice(closes.length - period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(slice.reduce((a, v) => a + Math.pow(v - middle, 2), 0) / period);
    const upper = middle + mult * stdDev, lower = middle - mult * stdDev;
    const bw = upper - lower;
    const position = bw ? (closes[closes.length - 1] - lower) / bw : 0.5;
    return {
      upper: Math.round(upper * 1e8) / 1e8, middle: Math.round(middle * 1e8) / 1e8,
      lower: Math.round(lower * 1e8) / 1e8, position: Math.round(position * 1e4) / 1e4,
    };
  }

  static calculateVolumeAnalysis(volumeContext, period = 20) {
    const unknown = {
      ratio: null,
      signal: 'UNKNOWN',
      currentUsdVolume: null,
      averageUsdVolume: null,
      currentVolumeSource: 'unavailable',
      historicalSourceBreakdown: {},
    };

    if (!volumeContext || !Array.isArray(volumeContext.closes)) return unknown;

    const closes = volumeContext.closes;
    const baseVolumes = Array.isArray(volumeContext.baseVolumes)
      ? volumeContext.baseVolumes
      : Array.isArray(volumeContext.volumes)
        ? volumeContext.volumes
        : [];
    const quoteVolumes = Array.isArray(volumeContext.quoteVolumes) ? volumeContext.quoteVolumes : [];
    const currentIndex = Number.isInteger(volumeContext.currentIndex) ? volumeContext.currentIndex : closes.length - 1;

    if (currentIndex < 0 || closes.length <= currentIndex || baseVolumes.length <= currentIndex) return unknown;
    if (currentIndex < period) return unknown;

    const currentVolume = this.toUsdVolume(baseVolumes[currentIndex], quoteVolumes[currentIndex], closes[currentIndex]);
    if (!this.isValidNumber(currentVolume.usdVolume) || currentVolume.usdVolume < 0) {
      return { ...unknown, currentVolumeSource: currentVolume.source };
    }

    const historicalUsdVolumes = [];
    const historicalSourceBreakdown = {};
    for (let i = currentIndex - period; i < currentIndex; i++) {
      const historicalVolume = this.toUsdVolume(baseVolumes[i], quoteVolumes[i], closes[i]);
      if (!this.isValidNumber(historicalVolume.usdVolume) || historicalVolume.usdVolume < 0) {
        return {
          ...unknown,
          currentUsdVolume: currentVolume.usdVolume,
          currentVolumeSource: currentVolume.source,
          historicalSourceBreakdown,
        };
      }
      historicalUsdVolumes.push(historicalVolume.usdVolume);
      historicalSourceBreakdown[historicalVolume.source] = (historicalSourceBreakdown[historicalVolume.source] || 0) + 1;
    }

    const averageUsdVolume = this.calculateSMA(historicalUsdVolumes, period);
    if (!this.isValidNumber(averageUsdVolume) || averageUsdVolume <= 0) {
      return {
        ...unknown,
        currentUsdVolume: currentVolume.usdVolume,
        currentVolumeSource: currentVolume.source,
        historicalSourceBreakdown,
      };
    }

    const ratio = currentVolume.usdVolume / averageUsdVolume;
    if (!this.isValidNumber(ratio) || ratio < 0) {
      return {
        ...unknown,
        currentUsdVolume: currentVolume.usdVolume,
        averageUsdVolume,
        currentVolumeSource: currentVolume.source,
        historicalSourceBreakdown,
      };
    }

    let signal = 'VERY_LOW';
    if (ratio >= 2.5) signal = 'EXTREME_HIGH';
    else if (ratio >= 1.5) signal = 'HIGH';
    else if (ratio >= 0.8) signal = 'NORMAL';
    else if (ratio >= 0.4) signal = 'LOW';

    return {
      ratio: Math.round(ratio * 1e4) / 1e4,
      signal,
      currentUsdVolume: Math.round(currentVolume.usdVolume * 100) / 100,
      averageUsdVolume: Math.round(averageUsdVolume * 100) / 100,
      currentVolumeSource: currentVolume.source,
      historicalSourceBreakdown,
    };
  }

  static calculateEMA200Trend(closes) {
    const ema200 = this.calculateEMA(closes, 200);
    if (!ema200) return { ema200: null, trend: 'UNKNOWN', distance: null };
    const price = closes[closes.length - 1];
    const distance = ((price - ema200) / ema200) * 100;
    return {
      ema200: Math.round(ema200 * 1e8) / 1e8,
      trend: price > ema200 ? 'BULLISH' : price < ema200 ? 'BEARISH' : 'NEUTRAL',
      distance: Math.round(distance * 100) / 100,
    };
  }
}

module.exports = Indicators;
