const express = require('express');
const router = express.Router();
const { SignalModel } = require('../../database/models');
const fetcher = require('../../fetcher/binance');
const logger = require('../../utils/logger');

// Tüm aktif coinleri listele
router.get('/', (req, res) => {
  const coins = SignalModel.getActiveCoins();
  res.json({ success: true, count: coins.length, data: coins });
});

// Binance'de coin ara
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const results = await fetcher.searchSymbols(q);
    res.json({ success: true, count: results.length, data: results });
  } catch (e) {
    logger.error('Coin arama hatasi: ' + e.message);
    next(e);
  }
});

// Yeni coin ekle
router.post('/', async (req, res, next) => {
  try {
    const { symbol, name } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: { message: 'Symbol gerekli' } });
    }
    
    // Binance'de var mı kontrol et
    const valid = await fetcher.validateSymbol(symbol);
    if (!valid) {
      return res.status(400).json({ success: false, error: { message: 'Bu coin Binance\'de bulunamadi' } });
    }
    
    // Zaten var mı kontrol et
    const existing = SignalModel.getCoinBySymbol(symbol);
    if (existing) {
      // Pasifse aktif et
      if (existing.is_active === 0) {
        SignalModel.activateCoin(symbol);
        return res.json({ success: true, message: 'Coin aktif edildi', data: { ...existing, is_active: 1 } });
      }
      return res.status(400).json({ success: false, error: { message: 'Bu coin zaten ekli' } });
    }
    
    const coin = SignalModel.addCoin(symbol, name || symbol.replace('/USDT', ''));
    logger.info('Yeni coin eklendi: ' + symbol);
    res.json({ success: true, message: 'Coin eklendi', data: coin });
  } catch (e) {
    logger.error('Coin ekleme hatasi: ' + e.message);
    next(e);
  }
});

// Coin sil (deaktif et)
router.delete('/:symbol', (req, res, next) => {
  try {
    const symbol = req.params.symbol.replace('-', '/');
    const existing = SignalModel.getCoinBySymbol(symbol);
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: 'Coin bulunamadi' } });
    }
    
    SignalModel.deactivateCoin(symbol);
    logger.info('Coin deaktif edildi: ' + symbol);
    res.json({ success: true, message: 'Coin kaldirildi' });
  } catch (e) {
    logger.error('Coin silme hatasi: ' + e.message);
    next(e);
  }
});

module.exports = router;