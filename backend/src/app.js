const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./api/middleware/errorHandler');
const auth = require('./api/middleware/auth');
const scheduler = require('./scheduler/cron');

// Veritabanini baslat
const db = require('./database/db');

const signalRoutes = require('./api/routes/signals');
const coinRoutes = require('./api/routes/coins');
const aiRoutes = require('./api/routes/ai');

const app = express();
app.set('etag', false);

// Security middleware
app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:19000', 'http://localhost:8081'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(compression());
app.use(express.json({ limit: '10kb' }));

app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
  next();
});

// Rate limiting - DDoS koruması
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 100, // IP başına 100 istek
  message: { success: false, error: { message: 'Cok fazla istek, biraz bekle.' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Daha sıkı limit - analiz endpoint'leri için
const analyzeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { success: false, error: { message: 'Analiz limiti asildi, 1 dk bekle.' } },
});
app.use('/api/signals/analyze', analyzeLimiter);
app.use('/api/signals/run-cycle', analyzeLimiter);

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { success: false, error: { message: 'AI istek limiti asildi, 1 dk bekle.' } },
});
app.use('/api/ai', aiLimiter);

app.get('/api/health', (req, res) => {
  // DB health check
  let dbStatus = 'offline';
  try {
    db.prepare('SELECT 1').get();
    dbStatus = 'online';
  } catch (e) {
    dbStatus = 'error';
  }
  
  res.json({ 
    success: true, 
    status: 'online', 
    uptime: Math.floor(process.uptime()), 
    database: dbStatus,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    scheduler: scheduler.getStatus() 
  });
});

app.use('/api/signals', auth, signalRoutes);
app.use('/api/coins', auth, coinRoutes);
app.use('/api/ai', auth, aiRoutes);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info('========================================');
  logger.info(`  CRYPTO SIGNAL SERVER`);
  logger.info(`  Port: ${config.port}`);
  logger.info(`  Coinler: ${config.scheduler.coins.length} adet`);
  logger.info(`  Zamanlama: Her saat basi`);
  logger.info('========================================');

  scheduler.start();

  // Ilk analizi 3 saniye sonra baslat
  setTimeout(async () => {
    try {
      logger.info('Ilk analiz basliyor...');
      await scheduler.runNow();
      logger.info('Ilk analiz tamamlandi!');
    } catch (e) { logger.error('Ilk analiz hatasi: ' + e.message); }
  }, 3000);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} sinyali alindi, kapatiliyor...`);
  scheduler.stop();
  
  server.close(() => {
    logger.info('HTTP server kapatildi');
    db.close();
    logger.info('Veritabani kapatildi');
    process.exit(0);
  });
  
  // 10 saniye içinde kapanmazsa zorla kapat
  setTimeout(() => {
    logger.error('Zorla kapatiliyor...');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
