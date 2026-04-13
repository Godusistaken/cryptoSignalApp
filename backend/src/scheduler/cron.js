const cron = require('node-cron');
const config = require('../config');
const signalService = require('../services/signalService');
const { SignalModel } = require('../database/models');
const logger = require('../utils/logger');

class Scheduler {
  constructor() { this.job = null; this.isRunning = false; }

  // Aktif coinleri veritabanından al
  getActiveCoins() {
    const dbCoins = SignalModel.getActiveCoins();
    if (dbCoins && dbCoins.length > 0) {
      return dbCoins.map(c => c.symbol);
    }
    // Veritabanında coin yoksa config'den al
    return config.scheduler.coins;
  }

  start() {
    this.job = cron.schedule(config.scheduler.cronSchedule, async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        const coins = this.getActiveCoins();
        logger.info(`=== OTOMATIK ANALIZ (${coins.length} coin) ===`);
        await signalService.runAnalysisCycle(coins);
        SignalModel.cleanOldHistory(30);
      } catch (e) { logger.error('Cron hata:', e.message); }
      finally { this.isRunning = false; }
    });
    logger.info(`Zamanlayici basladi: ${config.scheduler.cronSchedule}`);
  }

  stop() { if (this.job) this.job.stop(); }

  async runNow() {
    if (this.isRunning) throw new Error('Zaten calisiyor');
    this.isRunning = true;
    try { 
      const coins = this.getActiveCoins();
      return await signalService.runAnalysisCycle(coins); 
    }
    finally { this.isRunning = false; }
  }

  getStatus() { 
    const coins = this.getActiveCoins();
    return { isRunning: this.isRunning, schedule: config.scheduler.cronSchedule, coins }; 
  }
}

module.exports = new Scheduler();