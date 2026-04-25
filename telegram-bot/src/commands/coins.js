const api = require('../services/api');
const { normalizeInputSymbol, toDisplaySymbol } = require('../utils/symbol');

function extractCoins(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.coins)) return response.coins;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.coins)) return response.data.coins;
  return [];
}

function extractSymbolArg(ctx, usage) {
  const symbol = ctx.message.text.split(/\s+/)[1];
  if (!symbol) {
    ctx.reply(`Lütfen bir coin gir: ${usage}`);
    return null;
  }

  const normalized = normalizeInputSymbol(symbol);
  if (!normalized) {
    ctx.reply('Geçersiz coin sembolü');
    return null;
  }

  return normalized;
}

async function listCoins(ctx) {
  try {
    const response = await api.getCoins();
    const coins = extractCoins(response);

    if (!coins.length) {
      return ctx.reply('Takip edilen coin bulunamadı');
    }

    const lines = coins.map((coin) => {
      const symbol = typeof coin === 'string' ? coin : coin.symbol;
      return `- ${toDisplaySymbol(symbol)}`;
    });

    return ctx.reply(['Takip edilen coinler:', ...lines].join('\n'));
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");
    return ctx.reply('Coin listesi alınamadı');
  }
}

async function addCoin(ctx) {
  const symbol = extractSymbolArg(ctx, '/addcoin BTC');
  if (!symbol) return null;

  try {
    const response = await api.addCoin(symbol);
    const addedSymbol = response?.data?.symbol || response?.coin?.symbol || symbol;
    return ctx.reply(`${toDisplaySymbol(addedSymbol)} takip listesine eklendi ✅`);
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");

    const message = error.response?.data?.error?.message || '';
    if (message.includes('zaten')) {
      return ctx.reply(`${toDisplaySymbol(symbol)} zaten takip ediliyor`);
    }
    if (api.isNotFound(error) || message.includes('bulun')) {
      return ctx.reply('Bu coin bulunamadı');
    }

    return ctx.reply('Coin eklenemedi');
  }
}

async function removeCoin(ctx) {
  const symbol = extractSymbolArg(ctx, '/removecoin BTC');
  if (!symbol) return null;

  try {
    await api.removeCoin(symbol);
    return ctx.reply(`${toDisplaySymbol(symbol)} takip listesinden silindi ✅`);
  } catch (error) {
    if (api.isBackendUnavailable(error)) return ctx.reply("Backend'e bağlanılamadı ❌");
    if (api.isNotFound(error)) return ctx.reply('Bu coin bulunamadı');
    return ctx.reply('Coin silinemedi');
  }
}

module.exports = {
  listCoins,
  addCoin,
  removeCoin,
  extractCoins,
};
