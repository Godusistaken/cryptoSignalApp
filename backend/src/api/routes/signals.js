const express = require('express');
const router = express.Router();
const { SignalModel } = require('../../database/models');
const signalService = require('../../services/signalService');
const scheduler = require('../../scheduler/cron');

router.get('/', (req, res, next) => {
  try {
    const signals = SignalModel.getLatestSignals();
    const order = { STRONG_BUY:1, STRONG_SELL:2, BUY:3, SELL:4, WEAK_BUY:5, WEAK_SELL:6, WAIT:7 };
    signals.sort((a, b) => (order[a.signal_type]||99) - (order[b.signal_type]||99));
    res.json({ success: true, count: signals.length, data: signals });
  } catch (e) { next(e); }
});

router.get('/status/scheduler', (req, res) => {
  res.json({ success: true, data: scheduler.getStatus() });
});

router.get('/history/:symbol', (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const history = SignalModel.getSignalHistory(symbol, parseInt(req.query.limit) || 100);
    res.json({ success: true, count: history.length, data: history });
  } catch (e) { next(e); }
});

router.get('/:symbol', (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const signal = SignalModel.getSignalBySymbol(symbol);
    if (!signal) return res.status(404).json({ success: false, error: { message: 'Bulunamadi' } });
    res.json({ success: true, data: signal });
  } catch (e) { next(e); }
});

router.post('/analyze/:symbol', async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const result = await signalService.analyzeSingle(symbol);
    if (!result) return res.status(500).json({ success: false, error: { message: 'Analiz basarisiz' } });
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/run-cycle', async (req, res, next) => {
  try {
    const results = await scheduler.runNow();
    res.json({ success: true, count: results.length, data: results });
  } catch (e) { next(e); }
});

module.exports = router;
