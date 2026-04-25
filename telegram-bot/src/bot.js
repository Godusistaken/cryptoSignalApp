require('dotenv').config();

const { Telegraf } = require('telegraf');
const api = require('./services/api');
const { AlertService } = require('./services/alerts');
const { sendSignals, sendSignal } = require('./commands/signals');
const { analyze } = require('./commands/analyze');
const { ask } = require('./commands/ask');
const { stats } = require('./commands/stats');
const { listCoins, addCoin, removeCoin } = require('./commands/coins');
const { debugBackend } = require('./commands/debugBackend');
const { getChatId, requireAdmin } = require('./utils/auth');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN eksik. Lütfen .env dosyasını kontrol et.');
}

const bot = new Telegraf(token);
const alertService = new AlertService(bot);

bot.start((ctx) => {
  ctx.reply([
    'Crypto Signal Bot hazır.',
    '',
    'Komutlar:',
    '/signals - Tüm coinlerin son sinyallerini gösterir',
    '/signal BTC - Bir coin için detaylı sinyal gösterir',
    '/analyze BTC - Yeni analiz başlatır ve sonucu gösterir',
    '/ask <soru> - Soruyu AI endpointine iletir',
    '/stats - Win rate ve sinyal istatistiklerini gösterir',
    '/coins - Takip edilen coinleri listeler',
    '/addcoin BTC - Coin ekler (admin)',
    '/removecoin BTC - Coin siler (admin)',
    '/chatid - Bu sohbetin chat id bilgisini gösterir',
    '/debugbackend - Backend bağlantısını test eder (admin)',
  ].join('\n'));
});

bot.command('signals', sendSignals);
bot.command('signal', sendSignal);
bot.command('analyze', analyze);
bot.command('ask', ask);
bot.command('stats', stats);
bot.command('coins', listCoins);
bot.command('addcoin', requireAdmin(addCoin));
bot.command('add', requireAdmin(addCoin));
bot.command('removecoin', requireAdmin(removeCoin));
bot.command('remove', requireAdmin(removeCoin));
bot.command('deletecoin', requireAdmin(removeCoin));
bot.command('chatid', (ctx) => ctx.reply(`Chat ID: ${getChatId(ctx)}`));
bot.command('debugbackend', requireAdmin(debugBackend));

bot.catch((error, ctx) => {
  console.error('Bot hatası:', error);
  if (api.isBackendUnavailable(error)) {
    return ctx.reply("Backend'e bağlanılamadı ❌");
  }
  return ctx.reply('Beklenmeyen bir hata oluştu');
});

bot.launch()
  .then(() => {
    console.log('Telegram bot başlatıldı');
    alertService.start();
  })
  .catch((error) => {
    console.error('Telegram bot başlatılamadı:', error);
    process.exit(1);
  });

function shutdown(signal) {
  alertService.stop();
  bot.stop(signal);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
