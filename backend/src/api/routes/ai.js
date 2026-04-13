const express = require('express');
const router = express.Router();
const aiInterpreter = require('../../ai/interpreter');
const { SignalModel } = require('../../database/models');

router.post('/interpret/:symbol', async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const signal = SignalModel.getSignalBySymbol(symbol);
    if (!signal) return res.status(404).json({ success: false, error: { message: 'Sinyal bulunamadi' } });
    const interpretation = await aiInterpreter.interpretSignal(signal);
    res.json({ success: true, data: { symbol, signalType: signal.signal_type, interpretation } });
  } catch (e) { next(e); }
});

module.exports = router;