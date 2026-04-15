const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class BinanceFetcher {
  constructor() {
    this.client = axios.create({ baseURL: config.binance.baseUrl, timeout: 30000 });
    this.cache = new Map();
    this.cacheTTL = 30000; // 30 saniye cache
    this.symbolsCache = null;
    this.symbolsCacheTime = 0;
  }

  // Binance'den tüm USDT çiftlerini çek
  async getAllUSDTSymbols() {
    // 5 dakika cache
    if (this.symbolsCache && Date.now() - this.symbolsCacheTime < 300000) {
      return this.symbolsCache;
    }
    
    const res = await this.client.get('/api/v3/exchangeInfo');
    const symbols = res.data.symbols
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .map(s => ({
        symbol: s.baseAsset + '/USDT',
        name: s.baseAsset,
        binanceSymbol: s.symbol
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    this.symbolsCache = symbols;
    this.symbolsCacheTime = Date.now();
    return symbols;
  }

  // Binance'de coin ara
  async searchSymbols(query) {
    const all = await this.getAllUSDTSymbols();
    const q = query.toUpperCase();
    return all.filter(s => s.name.includes(q) || s.symbol.includes(q)).slice(0, 20);
  }

  // Coin'in Binance'de var olup olmadığını kontrol et
  async validateSymbol(symbol) {
    const all = await this.getAllUSDTSymbols();
    return all.some(s => s.symbol === symbol);
  }

  getCacheKey(symbol, interval) {
    return `${symbol}_${interval}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
    // Cache temizliği - 100'den fazla entry varsa eskileri sil
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (now - v.timestamp > this.cacheTTL) this.cache.delete(k);
      }
    }
  }

  async fetchOHLCV(symbol, interval = '1h', limit = 300) {
    const cacheKey = this.getCacheKey(symbol, interval);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.debug(`Cache hit: ${symbol} ${interval}`);
      return cached;
    }

    const s = symbol.replace('/', '');
    const res = await this.client.get('/api/v3/klines', { params: { symbol: s, interval, limit } });
    const opens = [], highs = [], lows = [], closes = [], volumes = [], quoteVolumes = [], closeTimes = [];
    for (const c of res.data) {
      opens.push(parseFloat(c[1])); highs.push(parseFloat(c[2]));
      lows.push(parseFloat(c[3])); closes.push(parseFloat(c[4]));
      volumes.push(parseFloat(c[5]));
      quoteVolumes.push(parseFloat(c[7]));
      closeTimes.push(c[6]);
    }
    const data = { opens, highs, lows, closes, volumes, quoteVolumes, closeTimes };
    this.setCache(cacheKey, data);
    return data;
  }

  async fetchMultiTimeframe(symbol) {
    const [data1h, data4h] = await Promise.all([
      this.fetchOHLCV(symbol, '1h', 300),
      this.fetchOHLCV(symbol, '4h', 300),
    ]);
    return { data1h, data4h };
  }

  async fetchMultipleSymbols(symbols) {
    const results = {};
    const chunks = [];
    for (let i = 0; i < symbols.length; i += 3) chunks.push(symbols.slice(i, i + 3));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (sym) => {
        try { results[sym] = await this.fetchMultiTimeframe(sym); }
        catch (e) { logger.error(`${sym} veri cekilemedi: ${e.message}`); results[sym] = null; }
      }));
      await new Promise(r => setTimeout(r, 500));
    }
    return results;
  }
}

module.exports = new BinanceFetcher();
