const cron = require('node-cron');
const config = require('../config');
const signalService = require('../services/signalService');
const SignalTracker = require('../services/signalTracker');
const { SignalModel } = require('../database/models');
const logger = require('../utils/logger');

class Scheduler {
  constructor() {
    this.analysisJob = null;
    this.trackerJob = null;
    this.isRunning = false;
    this.isTracking = false;
    this.trackerSchedule = '*/15 * * * *';
  }

  getActiveCoins() {
    const dbCoins = SignalModel.getActiveCoins();
    if (dbCoins && dbCoins.length > 0) {
      return dbCoins.map((coin) => coin.symbol);
    }
    return config.scheduler.coins;
  }

  start() {
    this.analysisJob = cron.schedule(config.scheduler.cronSchedule, async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        const coins = this.getActiveCoins();
        logger.info(`=== OTOMATIK ANALIZ (${coins.length} coin) ===`);
        await signalService.runAnalysisCycle(coins);
        SignalModel.cleanOldHistory(30);
      } catch (error) {
        logger.error('Cron analiz hata:', error.message);
      } finally {
        this.isRunning = false;
      }
    });

    this.trackerJob = cron.schedule(this.trackerSchedule, async () => {
      if (this.isTracking) return;
      this.isTracking = true;
      try {
        const trackingResult = await SignalTracker.evaluateOpenSignals();
        SignalModel.logTrackingSummary(trackingResult.stats);
      } catch (error) {
        logger.error('Cron tracking hata:', error.message);
      } finally {
        this.isTracking = false;
      }
    });

    logger.info(`Zamanlayici basladi: analiz=${config.scheduler.cronSchedule}, tracking=${this.trackerSchedule}`);
  }

  stop() {
    if (this.analysisJob) this.analysisJob.stop();
    if (this.trackerJob) this.trackerJob.stop();
  }

  async runNow() {
    if (this.isRunning) throw new Error('Zaten calisiyor');
    this.isRunning = true;
    try {
      const coins = this.getActiveCoins();
      return await signalService.runAnalysisCycle(coins);
    } finally {
      this.isRunning = false;
    }
  }

  async runTrackerNow() {
    if (this.isTracking) throw new Error('Tracking zaten calisiyor');
    this.isTracking = true;
    try {
      return await SignalTracker.evaluateOpenSignals();
    } finally {
      this.isTracking = false;
    }
  }

  getStatus() {
    const coins = this.getActiveCoins();
    return {
      isRunning: this.isRunning,
      isTracking: this.isTracking,
      schedule: config.scheduler.cronSchedule,
      trackerSchedule: this.trackerSchedule,
      coins,
    };
  }
}

module.exports = new Scheduler();
