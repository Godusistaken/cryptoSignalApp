const express = require('express');
const router = express.Router();
const { SignalModel } = require('../../database/models');
const signalService = require('../../services/signalService');
const scheduler = require('../../scheduler/cron');

router.get('/stats', (req, res, next) => {
  try {
    const stats = SignalModel.getSignalTrackingStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

router.get('/analyzer-stats', (req, res, next) => {
  try {
    const stats = SignalModel.getAnalyzerBehaviorStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

router.get('/open', (req, res, next) => {
  try {
    const openSignals = SignalModel.getOpenHistoricalSignals();
    res.json({ success: true, count: openSignals.length, data: openSignals });
  } catch (error) {
    next(error);
  }
});

router.get('/history', (req, res, next) => {
  try {
    const history = SignalModel.getSignalHistory({
      symbol: req.query.symbol ? req.query.symbol.toUpperCase().replace(/-/g, '/') : undefined,
      status: req.query.status || undefined,
      limit: req.query.limit,
    });
    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    next(error);
  }
});

router.get('/', (req, res, next) => {
  try {
    const signals = SignalModel.getLatestSignals();
    const order = { STRONG_BUY: 1, STRONG_SELL: 2, BUY: 3, SELL: 4, WEAK_BUY: 5, WEAK_SELL: 6, WAIT: 7 };
    signals.sort((a, b) => (order[a.signal_type] || 99) - (order[b.signal_type] || 99));
    res.json({ success: true, count: signals.length, data: signals });
  } catch (error) {
    next(error);
  }
});

router.get('/status/scheduler', (req, res) => {
  res.json({ success: true, data: scheduler.getStatus() });
});

router.get('/history/:symbol', (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const history = SignalModel.getSignalHistoryBySymbol(symbol, parseInt(req.query.limit, 10) || 100);
    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    next(error);
  }
});

router.get('/:symbol', (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const signal = SignalModel.getSignalBySymbol(symbol);
    if (!signal) return res.status(404).json({ success: false, error: { message: 'Bulunamadi' } });
    res.json({ success: true, data: signal });
  } catch (error) {
    next(error);
  }
});

router.post('/analyze/:symbol', async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const coin = SignalModel.getCoinBySymbol(symbol);
    if (!coin || coin.is_active === 0) {
      return res.status(404).json({ success: false, error: { message: 'Bu coin takip listesinde degil' } });
    }

    const result = await signalService.analyzeSingle(symbol);
    if (!result) return res.status(500).json({ success: false, error: { message: 'Analiz basarisiz' } });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/run-cycle', async (req, res, next) => {
  try {
    const results = await scheduler.runNow();
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    next(error);
  }
});

router.post('/track/run', async (req, res, next) => {
  try {
    const result = await scheduler.runTrackerNow();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
