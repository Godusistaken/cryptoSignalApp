const fetcher = require('../fetcher/binance');
const Analyzer = require('../engine/analyzer');
const { SignalModel } = require('../database/models');
const logger = require('../utils/logger');

class SignalService {
  async runAnalysisCycle(coins) {
    logger.info(`${coins.length} coin analiz ediliyor...`);
    const start = Date.now();
    const results = [];
    const data = await fetcher.fetchMultipleSymbols(coins);

    for (const symbol of coins) {
      try {
        const d = data[symbol];
        if (!d) { logger.warn(`${symbol} veri yok`); continue; }
        const analysis = Analyzer.analyzeMultiTimeframe(d.data1h, d.data4h, symbol);
        if (!analysis) continue;

        const saved = SignalModel.upsertSignal(analysis);
        SignalModel.addToHistory({
          signalId: saved.id, symbol: analysis.symbol, timeframe: analysis.timeframe,
          signalType: analysis.signalType, confidence: analysis.confidence, currentPrice: analysis.currentPrice,
          direction: analysis.direction, entryPrice: analysis.currentPrice,
          rsi: analysis.rsi, macdHistogram: analysis.macdHistogram, adx: analysis.adx,
          volumeRatio: analysis.volumeRatio, bbPosition: analysis.bbPosition,
          trend1h: analysis.trend1h, trend4h: analysis.trend4h,
          stopLoss: analysis.stopLoss, takeProfit1: analysis.takeProfit1,
          takeProfit2: analysis.takeProfit2, takeProfit3: analysis.takeProfit3,
          buyScore: analysis.buyScore, sellScore: analysis.sellScore, bonusScore: analysis.bonusScore,
          rawScore: analysis.rawScore, vetoReason: analysis.vetoReason, marketRegime: analysis.marketRegime,
        });
        SignalModel.deleteOldSignals(symbol, 5);
        results.push(analysis);
        logger.info(`${symbol}: ${analysis.signalType} (%${analysis.confidence}) | RSI:${analysis.rsi} ADX:${analysis.adx}`);
      } catch (err) { logger.error(`${symbol} hata: ${err.message}`); }
    }
    logger.info(`Analiz bitti: ${results.length}/${coins.length} coin, ${Date.now() - start}ms`);
    return results;
  }

  async analyzeSingle(symbol) {
    const d = await fetcher.fetchMultiTimeframe(symbol);
    const analysis = Analyzer.analyzeMultiTimeframe(d.data1h, d.data4h, symbol);
    if (analysis) {
      SignalModel.upsertSignal(analysis);
      SignalModel.addToHistory({
        signalId: null, symbol: analysis.symbol, timeframe: analysis.timeframe,
        signalType: analysis.signalType, confidence: analysis.confidence, currentPrice: analysis.currentPrice,
        direction: analysis.direction, entryPrice: analysis.currentPrice,
        rsi: analysis.rsi, macdHistogram: analysis.macdHistogram, adx: analysis.adx,
        volumeRatio: analysis.volumeRatio, bbPosition: analysis.bbPosition,
        trend1h: analysis.trend1h, trend4h: analysis.trend4h,
        stopLoss: analysis.stopLoss, takeProfit1: analysis.takeProfit1,
        takeProfit2: analysis.takeProfit2, takeProfit3: analysis.takeProfit3,
        buyScore: analysis.buyScore, sellScore: analysis.sellScore, bonusScore: analysis.bonusScore,
        rawScore: analysis.rawScore, vetoReason: analysis.vetoReason, marketRegime: analysis.marketRegime,
      });
    }
    return analysis;
  }
}

module.exports = new SignalService();
