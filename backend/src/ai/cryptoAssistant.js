const config = require('../config');
const { SignalModel } = require('../database/models');
const { AppError } = require('../utils/errors');
const { getGeminiClient } = require('./geminiClient');

const DISCLAIMER = 'This is not financial advice. Always do your own research.';
const NEWS_UNAVAILABLE_MESSAGE = 'Latest-news lookup is currently unavailable with verifiable sources. I can still help with a non-live project overview or risk summary.';

const COMMON_COIN_ALIASES = {
  BTC: ['bitcoin'],
  ETH: ['ethereum', 'ether'],
  SOL: ['solana'],
  ADA: ['cardano'],
  AVAX: ['avalanche'],
  ONT: ['ontology'],
  XRP: ['ripple'],
  DOGE: ['dogecoin'],
  DOT: ['polkadot'],
  LINK: ['chainlink'],
  UNI: ['uniswap'],
  LTC: ['litecoin'],
  BNB: ['binance coin', 'bnb chain'],
};

const SYSTEM_INSTRUCTION = `
You are an educational crypto market analysis assistant inside a mobile crypto app.

Your job:
- Explain crypto projects, token utility, ecosystem context, sentiment, and risks in plain language.
- Be practical, concise, and educational.
- Separate facts from interpretation when useful.
- Highlight uncertainty where appropriate.
- Mention volatility, execution risk, adoption risk, tokenomics risk, regulatory risk, and narrative risk when relevant.

Strict safety rules:
- Do not promise profits.
- Do not guarantee outcomes.
- Do not give personalized financial advice.
- Do not tell the user to blindly buy, sell, or ape into anything.
- Do not fabricate live data, recent news, or sources.
- If recent verifiable news is unavailable, say so clearly.

Response style:
- Start with the direct answer.
- Use short sections or bullets only when they improve readability.
- Include a short disclaimer sentence at the end only if the caller does not inject one separately.
`.trim();

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AppError('AI yaniti zaman asimina ugradi.', 504, { code: 'AI_TIMEOUT' }));
      }, timeoutMs);
    }),
  ]);
}

function detectMode(message) {
  const text = message.toLowerCase();
  if (/\b(compare|comparison|vs|versus)\b/.test(text)) return 'compare';
  if (/\b(news|latest|recent|headline|headlines|today)\b/.test(text)) return 'news';
  return 'analysis';
}

function buildCoinCatalog() {
  const allCoins = SignalModel.getAllCoins();
  const catalog = new Map();

  allCoins.forEach((coin) => {
    const symbol = coin.symbol.replace('/USDT', '');
    const aliases = [symbol.toLowerCase()];

    if (coin.name) {
      aliases.push(coin.name.toLowerCase());
    }

    if (COMMON_COIN_ALIASES[symbol]) {
      aliases.push(...COMMON_COIN_ALIASES[symbol]);
    }

    catalog.set(symbol, new Set(aliases));
  });

  Object.entries(COMMON_COIN_ALIASES).forEach(([symbol, aliases]) => {
    if (!catalog.has(symbol)) {
      catalog.set(symbol, new Set([symbol.toLowerCase(), ...aliases]));
    }
  });

  return catalog;
}

function detectCoins(message) {
  const normalized = message.toLowerCase();
  const upperMatches = message.toUpperCase().match(/\b[A-Z]{2,10}(?:\/USDT)?\b/g) || [];
  const found = new Set();
  const catalog = buildCoinCatalog();

  upperMatches.forEach((token) => {
    const normalizedToken = token.replace('/USDT', '');
    if (catalog.has(normalizedToken)) {
      found.add(`${normalizedToken}/USDT`);
    }
  });

  for (const [symbol, aliases] of catalog.entries()) {
    for (const alias of aliases) {
      if (normalized.includes(alias)) {
        found.add(`${symbol}/USDT`);
        break;
      }
    }
  }

  return Array.from(found).slice(0, 4);
}

function sanitizePrompt(message) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    throw new AppError('Mesaj bos olamaz.', 400, { code: 'EMPTY_MESSAGE' });
  }
  if (trimmed.length > 1200) {
    throw new AppError('Mesaj cok uzun. Lutfen 1200 karakterden kisa tut.', 400, {
      code: 'MESSAGE_TOO_LONG',
    });
  }
  return trimmed;
}

function buildChatPrompt({ message, mode, detectedCoins }) {
  const coinHint = detectedCoins.length > 0
    ? `Detected coins: ${detectedCoins.join(', ')}. Use them if relevant.`
    : 'No confident coin detection. Answer based on the user prompt only.';

  const modeHint = {
    analysis: 'Give a concise educational market/project overview with key risks and uncertainty.',
    compare: 'Compare the mentioned assets across utility, ecosystem, adoption, risks, and current narrative without declaring a guaranteed winner.',
    news: 'Use only verifiable recent information. If grounded recent information is unavailable, do not guess.',
  }[mode];

  return `${coinHint}\nMode: ${mode}\nInstruction: ${modeHint}\n\nUser request:\n${message}`;
}

function buildSignalInterpretationPrompt(signal) {
  const snapshot = {
    symbol: signal.symbol,
    signalType: signal.signal_type,
    confidence: signal.confidence,
    currentPrice: signal.current_price,
    rsi: signal.rsi,
    macdCrossover: signal.macd_crossover,
    adx: signal.adx,
    volumeRatio: signal.volume_ratio,
    trend1h: signal.trend_1h,
    trend4h: signal.trend_4h,
    stopLoss: signal.stop_loss,
    takeProfit1: signal.take_profit_1,
    takeProfit2: signal.take_profit_2,
    takeProfit3: signal.take_profit_3,
    riskRewardRatio: signal.risk_reward_ratio,
    createdAt: signal.created_at,
  };

  return `
Explain this trading signal in simple language for an educational app user.
Do not promise outcomes. Do not give personalized advice.
Mention what the signal suggests, what indicators stand out, and the main risks.
Keep it concise and practical.

Signal snapshot:
${JSON.stringify(snapshot, null, 2)}
`.trim();
}

function extractSources(response) {
  const metadata = response?.candidates?.[0]?.groundingMetadata;
  const chunks = metadata?.groundingChunks || [];
  const unique = new Map();

  chunks.forEach((chunk) => {
    const source = chunk.web || chunk.retrievedContext || chunk.maps;
    const uri = source?.uri;
    if (!uri || unique.has(uri)) return;

    unique.set(uri, {
      title: source.title || uri,
      url: uri,
    });
  });

  return Array.from(unique.values()).slice(0, 6);
}

function normalizeAiText(text) {
  return String(text || '').trim();
}

class CryptoAssistant {
  async generate({ prompt, useSearch = false }) {
    const ai = getGeminiClient();
    const request = {
      model: config.gemini.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
        maxOutputTokens: 900,
      },
    };

    if (useSearch) {
      request.config.tools = [{ googleSearch: {} }];
    }

    const response = await withTimeout(
      ai.models.generateContent(request),
      config.gemini.timeoutMs
    );

    const answer = normalizeAiText(response.text);
    if (!answer) {
      throw new AppError('AI yaniti bos dondu.', 502, { code: 'EMPTY_AI_RESPONSE' });
    }

    return {
      answer,
      sources: extractSources(response),
    };
  }

  async chat(message) {
    const sanitized = sanitizePrompt(message);
    const mode = detectMode(sanitized);
    const detectedCoins = detectCoins(sanitized);
    const prompt = buildChatPrompt({ message: sanitized, mode, detectedCoins });
    const wantsLatest = mode === 'news';

    try {
      const result = await this.generate({ prompt, useSearch: wantsLatest });

      if (wantsLatest && result.sources.length === 0) {
        return {
          answer: NEWS_UNAVAILABLE_MESSAGE,
          disclaimer: DISCLAIMER,
          sources: [],
          detectedCoins,
          mode,
        };
      }

      return {
        answer: result.answer,
        disclaimer: DISCLAIMER,
        sources: result.sources,
        detectedCoins,
        mode,
      };
    } catch (error) {
      if (wantsLatest && (error.status === 400 || error.status === 404 || error.status === 429 || error.status >= 500)) {
        return {
          answer: NEWS_UNAVAILABLE_MESSAGE,
          disclaimer: DISCLAIMER,
          sources: [],
          detectedCoins,
          mode,
        };
      }
      throw error;
    }
  }

  async interpretSignal(signal) {
    const prompt = buildSignalInterpretationPrompt(signal);
    const result = await this.generate({ prompt, useSearch: false });

    return {
      interpretation: `${result.answer}\n\n${DISCLAIMER}`,
      disclaimer: DISCLAIMER,
      sources: result.sources,
    };
  }
}

module.exports = new CryptoAssistant();
