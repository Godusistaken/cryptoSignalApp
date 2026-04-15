const express = require('express');
const router = express.Router();
const cryptoAssistant = require('../../ai/cryptoAssistant');
const { SignalModel } = require('../../database/models');
const { AppError } = require('../../utils/errors');

router.post('/chat', async (req, res, next) => {
  try {
    const message = req.body?.message;
    if (!message) {
      throw new AppError('Mesaj gerekli.', 400, { code: 'MISSING_MESSAGE' });
    }

    const result = await cryptoAssistant.chat(message);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/interpret/:symbol', async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/-/g, '/');
    const signal = SignalModel.getSignalBySymbol(symbol);
    if (!signal) return res.status(404).json({ success: false, error: { message: 'Sinyal bulunamadi' } });
    const result = await cryptoAssistant.interpretSignal(signal);
    res.json({
      success: true,
      data: {
        symbol,
        signalType: signal.signal_type,
        interpretation: result.interpretation,
        disclaimer: result.disclaimer,
        sources: result.sources,
      },
    });
  } catch (e) { next(e); }
});

module.exports = router;
