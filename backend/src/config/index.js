require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT) || 3000,
  binance: {
    baseUrl: process.env.BINANCE_BASE_URL || 'https://api.binance.com',
  },
  scheduler: {
    cronSchedule: process.env.CRON_SCHEDULE || '0 * * * *',
    coins: (process.env.ANALYSIS_COINS || 'BTC/USDT,ETH/USDT,BNB/USDT,SOL/USDT,XRP/USDT,ADA/USDT,DOGE/USDT,AVAX/USDT,DOT/USDT,LINK/USDT,UNI/USDT,LTC/USDT').split(',').map(s => s.trim()),
  },
};

module.exports = config;