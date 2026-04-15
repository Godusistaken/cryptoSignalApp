const config = require('../config');
const { SignalModel } = require('../database/models');
const { AppError } = require('../utils/errors');
const { getGeminiClient } = require('./geminiClient');

const DISCLAIMER = 'Yatırım tavsiyesi değildir. Kendi araştırmanı yap.';
const NEWS_UNAVAILABLE_LINE = 'Şu an doğrulanmış canlı haber kaynağına erişemiyorum.';

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

const MODE_LABELS = {
  analysis: 'Genel analiz',
  news: 'Son haberler',
  compare: 'Karşılaştırma',
  project: 'Proje özeti',
  risk: 'Risk özeti',
};

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' },
          bullets: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['heading'],
      },
    },
    followUp: { type: 'string' },
  },
  required: ['title', 'summary', 'sections'],
};

const SYSTEM_INSTRUCTION = `
Sen mobil uygulama içindeki eğitim odaklı bir kripto araştırma asistanısın.
Varsayılan dilin doğal ve akıcı Türkçe.

Temel davranış:
- Kısa, net, pratik ve doğal yaz.
- Kullanıcı hangi soruyu sorduysa doğrudan ona cevap ver.
- Robotik girişler, gereksiz savunmacı cümleler ve düşük değerli filler kullanma.
- Belirsizlik sadece gerçekten gerektiğinde belirtilmeli.
- Hype yapma, kesinlik iddia etme, al-sat emri verme.
- Kişisel finansal tavsiye verme.
- Disclaimer metnini cevabın içine tekrar tekrar gömme; istemci bunu ayrı gösterecek.

Kalite kuralları:
- "Son haberler", "güncel haber", "bugün ne oldu" gibi sorular haber modudur.
- Haber modunda doğrulanabilir güncel kaynak yoksa bunu tek kısa cümleyle söyle ve sonra yine faydalı bir fallback ver.
- Canlı haber yoksa genel analizi haber gibi sunma.
- Proje sorularında ne yaptığını sade dille anlat.
- Karşılaştırmalarda utility, ekosistem, benimsenme, risk ve anlatı boyutlarını dengeli ele al.
- Risk sorularında teknik, benimsenme, tokenomik, regülasyon ve anlatı risklerini ayır.
- Kullanıcı Türkçe yazıyorsa Türkçe cevap ver. İngilizce yazıyorsa İngilizce cevap verebilirsin.

Üslup:
- Ürün kalitesinde Türkçe kullan.
- Gerekmedikçe İngilizce terim serpiştirme.
- Kısa başlıklar ve okunabilir yapı kullan.
- Kullanıcı spesifik sorduysa genel ve boş cevap verme.
`.trim();

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AppError('AI yanıtı zaman aşımına uğradı.', 504, { code: 'AI_TIMEOUT' }));
      }, timeoutMs);
    }),
  ]);
}

function mapModelError(error) {
  if (error?.status === 429) {
    return new AppError('AI servisi şu an kota sınırına ulaştı. Lütfen kısa süre sonra tekrar dene.', 503, {
      code: 'AI_RATE_LIMITED',
      expose: true,
    });
  }

  if (error instanceof AppError) {
    return error;
  }

  return new AppError('AI yanıtı alınamadı.', 502, {
    code: 'AI_PROVIDER_ERROR',
    expose: true,
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function sanitizePrompt(message) {
  const trimmed = normalizeText(message);
  if (!trimmed) {
    throw new AppError('Mesaj boş olamaz.', 400, { code: 'EMPTY_MESSAGE' });
  }
  if (trimmed.length > 1200) {
    throw new AppError('Mesaj çok uzun. Lütfen 1200 karakterden kısa tut.', 400, {
      code: 'MESSAGE_TOO_LONG',
    });
  }
  return trimmed;
}

function normalizeForIntent(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildCoinCatalog() {
  const allCoins = SignalModel.getAllCoins();
  const catalog = new Map();

  allCoins.forEach((coin) => {
    const symbol = coin.symbol.replace('/USDT', '');
    const aliases = [symbol.toLowerCase()];

    if (coin.name) aliases.push(coin.name.toLowerCase());
    if (COMMON_COIN_ALIASES[symbol]) aliases.push(...COMMON_COIN_ALIASES[symbol]);

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
    if (catalog.has(normalizedToken)) found.add(`${normalizedToken}/USDT`);
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

function detectMode(message) {
  const text = normalizeForIntent(message);

  if (
    /\b(son haber|son haberler|guncel haber|latest news|news|bugun ne oldu|neler oldu|headline|haber akisi|haber özeti|haber ozeti)\b/.test(text)
  ) {
    return 'news';
  }

  if (/\b(karsilastir|karsilastirma|compare|vs|versus|farki|hangisi)\b/.test(text)) {
    return 'compare';
  }

  if (/\b(risk|riskler|tehlike|downside|zayif yon|zayif taraf)\b/.test(text)) {
    return 'risk';
  }

  if (/\b(ne is yapar|ne ise yarar|nedir|what does|proje ne yapiyor|project|acikla|anlat)\b/.test(text)) {
    return 'project';
  }

  return 'analysis';
}

function buildChatPrompt({ message, mode, detectedCoins, useSearch }) {
  const coinHint = detectedCoins.length > 0
    ? `Tespit edilen coinler: ${detectedCoins.join(', ')}`
    : 'Belirgin bir coin tespiti yok.';

  const modeInstruction = {
    news: `
Kullanıcı son haber istiyor.
Eğer arama/grounding ile doğrulanabilir güncel kaynak bulunduysa şu yapıyı kullan:
- kısa özet
- 3 ila 5 öne çıkan gelişme
- neden önemli
- takip edilmesi gereken riskler
Eğer doğrulanabilir güncel kaynak yoksa haber uydurma.
İlk cümlede kısa ve dürüst şekilde canlı haber olmadığını söyle.
Ardından yine de işe yarayan bir fallback ver: takip edilmesi gereken başlıklar, izlenecek riskler, önemli veri noktaları.
Bu fallback'i "son haber" gibi etiketleme.
`,
    compare: `
Kullanıcı iki varlığı karşılaştırmak istiyor.
Utility, ekosistem, benimsenme, risk ve anlatı başlıklarında dengeli karşılaştır.
Kesin kazanan ilan etme.
Benzer yönleri ve ayrışan noktaları açık yaz.
`,
    project: `
Kullanıcı projenin ne yaptığını öğrenmek istiyor.
Şu sırayı önemse:
- proje ne yapıyor
- kullanım alanı
- güçlü taraflar
- riskler
- kısa sonuç
`,
    risk: `
Kullanıcı risk odaklı cevap istiyor.
Teknik risk, benimsenme riski, tokenomik risk, regülasyon riski ve anlatı riskini ayrı ele al.
Kuru korkutma yerine pratik bir risk çerçevesi ver.
`,
    analysis: `
Kullanıcı genel ama faydalı bir analiz istiyor.
Projenin ne yaptığı, kullanım alanı, güçlü tarafları, riskleri ve kısa sonuç bölümleriyle cevap ver.
Genel laflar yerine somut başlıklar kullan.
`,
  }[mode];

  return `
Mod: ${mode} (${MODE_LABELS[mode]})
${coinHint}
Arama durumu: ${useSearch ? 'Google Search grounding açık' : 'Grounding kapalı'}

Ek talimat:
${modeInstruction}

Kullanıcının isteği:
${message}
`.trim();
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
Bu trading sinyalini doğal Türkçe ile kısa ve faydalı şekilde açıkla.
Ne anlama geldiğini, hangi göstergelerin öne çıktığını ve temel riskleri belirt.
Abartılı dil kullanma.

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

function normalizeStructuredResponse(payload, mode) {
  const sections = Array.isArray(payload?.sections)
    ? payload.sections
        .map((section) => ({
          heading: normalizeText(section.heading),
          body: normalizeText(section.body),
          bullets: Array.isArray(section.bullets)
            ? section.bullets.map((item) => normalizeText(item)).filter(Boolean)
            : [],
        }))
        .filter((section) => section.heading && (section.body || section.bullets.length > 0))
    : [];

  if (!normalizeText(payload?.summary) || sections.length === 0) {
    throw new AppError('AI yanıtı beklenen yapıda değil.', 502, { code: 'INVALID_AI_RESPONSE' });
  }

  return {
    title: normalizeText(payload.title) || MODE_LABELS[mode],
    summary: normalizeText(payload.summary),
    sections,
    followUp: normalizeText(payload.followUp),
  };
}

function parseStructuredJson(raw) {
  const cleaned = normalizeText(raw)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw error;
  }
}

function renderStructuredToText(result) {
  const lines = [result.summary];

  result.sections.forEach((section) => {
    lines.push(`\n${section.heading}`);
    if (section.body) lines.push(section.body);
    section.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
  });

  if (result.followUp) {
    lines.push('\nKısa not');
    lines.push(result.followUp);
  }

  return lines.join('\n').trim();
}

function buildNewsFallback(detectedCoins) {
  const coin = detectedCoins[0]?.replace('/USDT', '') || 'Bu varlık';
  return {
    title: `${coin} için takip listesi`,
    summary: NEWS_UNAVAILABLE_LINE,
    sections: [
      {
        heading: 'Takip edilmesi gereken ana başlıklar',
        bullets: coin === 'BTC'
          ? [
              'Makro veri akışı ve Fed faiz beklentileri',
              'Spot ETF giriş-çıkış dengesi',
              'Regülasyon ve kurumsal açıklamalar',
              'Borsalara giren-çıkan BTC miktarı',
              'On-chain tarafta uzun vadeli yatırımcı ve miner akışları',
            ]
          : [
              'Proje taraflı resmi duyurular ve yol haritası güncellemeleri',
              'Likidite, hacim ve büyük borsa listeleme-delisting gelişmeleri',
              'Regülasyon, güvenlik veya ortaklık haberleri',
              'Ekosistem aktivitesi, kullanıcı artışı ve geliştirici ilgisi',
              'Token unlock, staking, arz baskısı veya treasury hareketleri',
            ],
      },
      {
        heading: 'Neden önemli',
        body: 'Canlı haber olmasa da bu başlıklar fiyatlama, anlatı ve risk algısını en hızlı değiştiren alanlardır.',
        bullets: [],
      },
      {
        heading: 'Takip edilmesi gereken riskler',
        bullets: [
          'Haber akışı olmadan yalnızca fiyat hareketine anlam yüklemek yanıltıcı olabilir.',
          'Kısa vadeli fiyat hareketleri likidite ve makro beklentilerle sert değişebilir.',
        ],
      },
    ],
    followUp: `${coin} için istersen haber yerine proje özeti, risk analizi veya temel görünüm çıkarabilirim.`,
  };
}

function buildStructuredFallbackFromText(text, mode) {
  const paragraphs = normalizeText(text)
    .split(/\n{2,}/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const summary = paragraphs[0] || 'Kısa bir özet üretilemedi.';
  const sectionBodies = paragraphs.slice(1);
  const headingsByMode = {
    analysis: ['Proje ve kullanım alanı', 'Güçlü taraflar', 'Riskler', 'Kısa sonuç'],
    project: ['Proje ve kullanım alanı', 'Güçlü taraflar', 'Riskler', 'Kısa sonuç'],
    compare: ['Karşılaştırma', 'Ayrışan noktalar', 'Risk çerçevesi', 'Dengeli sonuç'],
    risk: ['Ana riskler', 'Yakın izleme başlıkları', 'Sonuç'],
    news: ['Yakın izleme başlıkları', 'Neden önemli', 'Riskler'],
  };

  const headings = headingsByMode[mode] || headingsByMode.analysis;
  const sections = (sectionBodies.length ? sectionBodies : [summary])
    .slice(0, headings.length)
    .map((body, index) => ({
      heading: headings[index],
      body,
      bullets: [],
    }));

  return {
    title: MODE_LABELS[mode],
    summary,
    sections,
    followUp: '',
  };
}

function buildPlainTextFallbackPrompt({ prompt, mode }) {
  return `
${prompt}

JSON üretmek yerine doğal ve kısa Türkçe düz metin ver.
Şu kurallara uy:
- İlk paragraf en fazla 2 cümlelik özet olsun.
- Sonraki paragraflar kısa başlıksız bölümler gibi ilerlesin.
- Boş filler kullanma.
- Haber modunda doğrulanmış canlı haber yoksa bunu tek kısa cümleyle söyle ve sonra takip edilmesi gereken başlıkları yaz.
- Karşılaştırmada iki tarafı dengeli ele al.
`.trim();
}

function buildSectionedTextPrompt({ prompt, mode }) {
  const modeHeadings = {
    analysis: ['Proje ne yapıyor', 'Kullanım alanı', 'Güçlü taraflar', 'Riskler', 'Kısa sonuç'],
    project: ['Proje ne yapıyor', 'Kullanım alanı', 'Güçlü taraflar', 'Riskler', 'Kısa sonuç'],
    compare: ['Utility', 'Ekosistem', 'Benimsenme', 'Risk', 'Anlatı ve sonuç'],
    risk: ['Ana riskler', 'Teknik ve operasyonel taraf', 'Piyasa ve anlatı tarafı', 'Kısa sonuç'],
  };

  const headings = (modeHeadings[mode] || modeHeadings.analysis)
    .map((heading) => `- ${heading}`)
    .join('\n');

  return `
${prompt}

Aşağıdaki biçime tam uy:
TITLE: kısa başlık
SUMMARY: en fazla 2 cümlelik kısa özet
SECTION: başlık
BODY: kısa paragraf
BULLETS:
- madde
- madde
SECTION: başlık
BODY: kısa paragraf
BULLETS:
- madde
FOLLOW_UP: isteğe bağlı kısa devam sorusu önerisi

Kurallar:
- Cevabı doğal Türkçe yaz.
- Aşağıdaki bölüm başlıklarına yakın kal:
${headings}
- En az 3 bölüm üret.
- Kullanıcı spesifik bir şey sorduysa ilk bölüm onu doğrudan yanıtlasın.
- Gereksiz disclaimer ekleme.
`.trim();
}

function parseSectionedText(raw, mode) {
  const lines = normalizeText(raw).split(/\r?\n/);
  const sections = [];
  let title = MODE_LABELS[mode];
  let summary = '';
  let followUp = '';
  let currentSection = null;
  let inBullets = false;

  const pushCurrentSection = () => {
    if (!currentSection) return;
    currentSection.body = normalizeText(currentSection.body);
    currentSection.bullets = currentSection.bullets.filter(Boolean);
    if (currentSection.heading && (currentSection.body || currentSection.bullets.length > 0)) {
      sections.push(currentSection);
    }
    currentSection = null;
  };

  lines.forEach((line) => {
    const trimmed = normalizeText(line);
    if (!trimmed) {
      inBullets = false;
      return;
    }

    if (trimmed.startsWith('TITLE:')) {
      title = normalizeText(trimmed.slice('TITLE:'.length)) || title;
      return;
    }

    if (trimmed.startsWith('SUMMARY:')) {
      summary = normalizeText(trimmed.slice('SUMMARY:'.length));
      return;
    }

    if (trimmed.startsWith('SECTION:')) {
      pushCurrentSection();
      currentSection = {
        heading: normalizeText(trimmed.slice('SECTION:'.length)),
        body: '',
        bullets: [],
      };
      inBullets = false;
      return;
    }

    if (trimmed.startsWith('BODY:')) {
      if (!currentSection) {
        currentSection = { heading: MODE_LABELS[mode], body: '', bullets: [] };
      }
      currentSection.body = normalizeText(trimmed.slice('BODY:'.length));
      inBullets = false;
      return;
    }

    if (trimmed === 'BULLETS:') {
      inBullets = true;
      return;
    }

    if (trimmed.startsWith('FOLLOW_UP:')) {
      pushCurrentSection();
      followUp = normalizeText(trimmed.slice('FOLLOW_UP:'.length));
      inBullets = false;
      return;
    }

    if (inBullets && trimmed.startsWith('-')) {
      if (!currentSection) {
        currentSection = { heading: MODE_LABELS[mode], body: '', bullets: [] };
      }
      currentSection.bullets.push(normalizeText(trimmed.slice(1)));
      return;
    }

    if (!currentSection) {
      currentSection = { heading: MODE_LABELS[mode], body: '', bullets: [] };
    }
    currentSection.body = normalizeText(`${currentSection.body}\n${trimmed}`);
  });

  pushCurrentSection();

  if (!summary && sections.length > 0) {
    summary = sections[0].body || sections[0].bullets[0] || '';
  }

  if (!summary || sections.length === 0) {
    throw new AppError('AI sectioned yanıtı beklenen yapıda değil.', 502, {
      code: 'INVALID_AI_SECTIONED_RESPONSE',
    });
  }

  return {
    title,
    summary,
    sections,
    followUp,
  };
}

class CryptoAssistant {
  async generateStructured({ prompt, useSearch = false, mode }) {
    const ai = getGeminiClient();
    const request = {
      model: config.gemini.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: useSearch ? 0.25 : 0.35,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
        responseJsonSchema: OUTPUT_SCHEMA,
      },
    };

    if (useSearch) {
      request.config.tools = [{ googleSearch: {} }];
    }

    let response;
    try {
      response = await withTimeout(
        ai.models.generateContent(request),
        config.gemini.timeoutMs
      );
    } catch (error) {
      throw mapModelError(error);
    }

    const raw = normalizeText(response.text);
    if (!raw) {
      throw new AppError('AI yanıtı boş döndü.', 502, { code: 'EMPTY_AI_RESPONSE' });
    }

    try {
      return {
        payload: parseStructuredJson(raw),
        sources: extractSources(response),
      };
    } catch (initialError) {
      let retryResponse;
      try {
        retryResponse = await withTimeout(
          ai.models.generateContent({
            ...request,
            contents: `${prompt}\n\nSadece geçerli JSON döndür. Markdown, açıklama veya kod bloğu ekleme.`,
            config: {
              ...request.config,
              temperature: 0.15,
              maxOutputTokens: 900,
            },
          }),
          config.gemini.timeoutMs
        );
      } catch (error) {
        throw mapModelError(error);
      }

      const retryRaw = normalizeText(retryResponse.text);
      try {
        return {
          payload: parseStructuredJson(retryRaw),
          sources: extractSources(retryResponse),
        };
      } catch (retryError) {
        const textFallback = await this.generateText({
          prompt: buildPlainTextFallbackPrompt({ prompt, mode }),
          useSearch,
        });

        return {
          payload: buildStructuredFallbackFromText(textFallback, mode),
          sources: useSearch ? extractSources(retryResponse) : [],
        };
      }
    }
  }

  async generateText({ prompt, useSearch = false }) {
    const ai = getGeminiClient();
    const request = {
      model: config.gemini.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.35,
        maxOutputTokens: 700,
      },
    };

    if (useSearch) {
      request.config.tools = [{ googleSearch: {} }];
    }

    let response;
    try {
      response = await withTimeout(
        ai.models.generateContent(request),
        config.gemini.timeoutMs
      );
    } catch (error) {
      throw mapModelError(error);
    }

    const answer = normalizeText(response.text);
    if (!answer) {
      throw new AppError('AI yanıtı boş döndü.', 502, { code: 'EMPTY_AI_RESPONSE' });
    }

    return answer;
  }

  async generateSectionedText({ prompt, mode }) {
    const raw = await this.generateText({
      prompt: buildSectionedTextPrompt({ prompt, mode }),
    });

    try {
      return parseSectionedText(raw, mode);
    } catch (error) {
      return buildStructuredFallbackFromText(raw, mode);
    }
  }

  async chat(message) {
    const sanitized = sanitizePrompt(message);
    const mode = detectMode(sanitized);
    const detectedCoins = detectCoins(sanitized);
    const wantsLatest = mode === 'news';
    const prompt = buildChatPrompt({ message: sanitized, mode, detectedCoins, useSearch: wantsLatest });

    try {
      let structured;
      let sources = [];

      if (wantsLatest) {
        const result = await this.generateStructured({ prompt, useSearch: true, mode });
        structured = normalizeStructuredResponse(result.payload, mode);
        sources = result.sources;
      } else {
        structured = await this.generateSectionedText({ prompt, mode });
      }

      if (wantsLatest && sources.length === 0) {
        const fallback = buildNewsFallback(detectedCoins);
        return {
          answer: renderStructuredToText(fallback),
          disclaimer: DISCLAIMER,
          sources: [],
          detectedCoins,
          mode,
          title: fallback.title,
          summary: fallback.summary,
          sections: fallback.sections,
          followUp: fallback.followUp,
        };
      }

      return {
        answer: renderStructuredToText(structured),
        disclaimer: DISCLAIMER,
        sources,
        detectedCoins,
        mode,
        title: structured.title,
        summary: structured.summary,
        sections: structured.sections,
        followUp: structured.followUp,
      };
    } catch (error) {
      if (wantsLatest) {
        const fallback = buildNewsFallback(detectedCoins);
        return {
          answer: renderStructuredToText(fallback),
          disclaimer: DISCLAIMER,
          sources: [],
          detectedCoins,
          mode,
          title: fallback.title,
          summary: fallback.summary,
          sections: fallback.sections,
          followUp: fallback.followUp,
        };
      }
      throw error;
    }
  }

  async interpretSignal(signal) {
    const prompt = buildSignalInterpretationPrompt(signal);
    const interpretation = await this.generateText({ prompt });

    return {
      interpretation,
      disclaimer: DISCLAIMER,
      sources: [],
    };
  }
}

module.exports = new CryptoAssistant();
