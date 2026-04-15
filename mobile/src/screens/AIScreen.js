import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';
import AIService from '../services/aiService';
import ScreenHeader from '../components/ScreenHeader';
import StateView from '../components/StateView';
import { Radius, Spacing } from '../utils/theme';

const STARTER_PROMPTS = [
  'BTC ne iş yapar?',
  'SOL ve ADA karşılaştır',
  'ETH için temel riskler neler?',
  'ONT projesini açıkla',
];

const BETA_SCOPES = [
  'Proje açıklaması',
  'Temel görünüm',
  'Risk özeti',
  'Karşılaştırma',
  'Haber denemesi',
];

const MODE_LABELS = {
  analysis: 'Temel görünüm',
  news: 'Haber denemesi',
  compare: 'Karşılaştırma',
  project: 'Proje özeti',
  risk: 'Risk özeti',
};

const BETA_DESCRIPTION = 'Beta: Bu özellik deneme aşamasındadır. Yanıtlar her zaman tutarlı veya güncel olmayabilir.';
const PROVIDER_BUSY_MESSAGE = 'AI özelliği şu anda yoğun veya geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.';
const NETWORK_FALLBACK_MESSAGE = 'AI özelliğine şu anda bağlanılamıyor. Lütfen bağlantını kontrol edip tekrar dene.';

function normalizeAIError(error) {
  const status = error?.response?.status;
  const rawMessage = String(error?.response?.data?.error?.message || error?.userMessage || error?.message || '').toLowerCase();

  if (rawMessage.includes('internet baglantisi yok')) {
    return NETWORK_FALLBACK_MESSAGE;
  }

  if (rawMessage.includes('mesaj boş') || rawMessage.includes('mesaj gerekli')) {
    return 'Bir soru yazarak deneyebilirsin.';
  }

  if (rawMessage.includes('1200 karakter')) {
    return 'Sorunu biraz daha kısa yazarak tekrar deneyebilirsin.';
  }

  if (
    status === 429
    || status === 502
    || status === 503
    || status === 504
    || rawMessage.includes('kota')
    || rawMessage.includes('rate')
    || rawMessage.includes('timeout')
    || rawMessage.includes('zaman aşımı')
    || rawMessage.includes('yanıtı alınamadı')
    || rawMessage.includes('yaniti alinamadi')
    || rawMessage.includes('sunucuya ulasilamiyor')
  ) {
    return PROVIDER_BUSY_MESSAGE;
  }

  return 'AI Beta şu anda bu isteğe net bir yanıt üretemedi. Lütfen farklı bir ifadeyle tekrar deneyin.';
}

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const pushMessage = (message) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, ...message }]);
  };

  const sendPrompt = async (promptOverride) => {
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || loading) return;

    pushMessage({ role: 'user', text: prompt });
    setInput('');
    setLoading(true);

    try {
      const res = await AIService.chat(prompt);
      const payload = res.data;
      pushMessage({
        role: 'ai',
        text: payload.answer,
        title: payload.title,
        summary: payload.summary,
        sections: payload.sections || [],
        followUp: payload.followUp,
        disclaimer: payload.disclaimer,
        sources: payload.sources || [],
        detectedCoins: payload.detectedCoins || [],
        mode: payload.mode,
      });
    } catch (e) {
      pushMessage({
        role: 'error',
        text: normalizeAIError(e),
      });
    } finally {
      setLoading(false);
    }
  };

  const openSource = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <ScreenHeader
          title="AI Beta"
          subtitle="Proje açıklaması, temel görünüm, risk çerçevesi ve yüksek seviyeli karşılaştırmalar için yardımcı deneyim."
          right={(
            <View style={styles.betaChip}>
              <Ionicons name="flask-outline" size={14} color={Colors.primaryLight} />
              <Text style={styles.betaText}>Beta</Text>
            </View>
          )}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introCard}>
          <View style={styles.introTopRow}>
            <Text style={styles.introTitle}>Kontrollü beta deneyimi</Text>
            <View style={styles.subtleBadge}>
              <Text style={styles.subtleBadgeText}>İsteğe bağlı</Text>
            </View>
          </View>
          <Text style={styles.betaNotice}>{BETA_DESCRIPTION}</Text>
          <Text style={styles.introText}>
            En iyi sonuçlar proje mantığı, temel çerçeve, risk görünümü ve coin karşılaştırması gibi sorularda gelir.
            Haber akışı ise sınırlı ve deneysel kalabilir.
          </Text>

          <View style={styles.scopeRow}>
            {BETA_SCOPES.map((scope) => (
              <View key={scope} style={[styles.scopeChip, scope === 'Haber denemesi' && styles.scopeChipMuted]}>
                <Text style={[styles.scopeChipText, scope === 'Haber denemesi' && styles.scopeChipTextMuted]}>{scope}</Text>
              </View>
            ))}
          </View>

          <View style={styles.promptGroup}>
            <Text style={styles.promptGroupTitle}>Önerilen başlangıç soruları</Text>
            <View style={styles.promptRow}>
              {STARTER_PROMPTS.map((prompt) => (
                <TouchableOpacity key={prompt} style={styles.promptChip} onPress={() => sendPrompt(prompt)} activeOpacity={0.85}>
                  <Text style={styles.promptChipText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {messages.length === 0 ? (
          <StateView
            compact
            icon="sparkles-outline"
            title="AI Beta hazır"
            message="Kısa ve net sorularla başla. Proje açıklaması, risk özeti ve karşılaştırma soruları genelde daha tutarlı çalışır."
          />
        ) : null}

        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageCard,
              message.role === 'user' ? styles.userBubble : styles.aiBubble,
              message.role === 'error' && styles.errorBubble,
            ]}
          >
            {message.role !== 'user' && message.mode ? (
              <View style={styles.metaRow}>
                <View style={styles.modeChip}>
                  <Text style={styles.modeChipText}>{MODE_LABELS[message.mode] || message.mode}</Text>
                </View>
                {message.detectedCoins?.length ? (
                  <Text style={styles.detectedText}>{message.detectedCoins.join(', ')}</Text>
                ) : null}
              </View>
            ) : null}

            {message.role === 'ai' && message.title ? <Text style={styles.answerTitle}>{message.title}</Text> : null}
            {message.role === 'ai' && message.summary ? <Text style={styles.summaryText}>{message.summary}</Text> : null}

            {message.role === 'ai' && message.sections?.length ? (
              <View style={styles.sectionList}>
                {message.sections.map((section, index) => (
                  <View key={`${message.id}-section-${index}`} style={styles.sectionBlock}>
                    <Text style={styles.sectionHeading}>{section.heading}</Text>
                    {section.body ? <Text style={styles.sectionBody}>{section.body}</Text> : null}
                    {section.bullets?.length ? (
                      <View style={styles.bulletList}>
                        {section.bullets.map((bullet, bulletIndex) => (
                          <View key={`${message.id}-bullet-${index}-${bulletIndex}`} style={styles.bulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.bulletText}>{bullet}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {message.role === 'user' ? (
              <Text style={[styles.bubbleText, styles.userBubbleText]}>{message.text}</Text>
            ) : null}

            {message.role === 'ai' && message.mode === 'news' ? (
              <View style={styles.experimentalNote}>
                <Ionicons name="information-circle-outline" size={15} color={Colors.textMuted} />
                <Text style={styles.experimentalNoteText}>Haber akışı beta kapsamında sınırlı ve deneysel olabilir.</Text>
              </View>
            ) : null}

            {message.role === 'ai' && message.followUp ? (
              <View style={styles.followUpCard}>
                <Text style={styles.followUpLabel}>Devam sorusu için</Text>
                <Text style={styles.followUpText}>{message.followUp}</Text>
              </View>
            ) : null}

            {message.sources?.length ? (
              <View style={styles.sourcesWrap}>
                <Text style={styles.sourcesTitle}>Kaynaklar</Text>
                {message.sources.map((source) => (
                  <TouchableOpacity key={source.url} onPress={() => openSource(source.url)} activeOpacity={0.75} style={styles.sourceItem}>
                    <Ionicons name="link-outline" size={14} color={Colors.primaryLight} />
                    <Text style={styles.sourceText}>{source.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {message.disclaimer ? (
              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimer}>{message.disclaimer}</Text>
              </View>
            ) : null}

            {message.role === 'error' ? <Text style={styles.errorText}>{message.text}</Text> : null}
          </View>
        ))}

        {loading ? (
          <View style={[styles.messageCard, styles.aiBubble]}>
            <View style={styles.loadingRow}>
              <Ionicons name="flask-outline" size={16} color={Colors.primaryLight} />
              <Text style={styles.loadingText}>AI Beta yanıtı hazırlanıyor...</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={styles.input}
          placeholder="BTC ne iş yapar, SOL ve ADA karşılaştır, ETH için riskler..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendPrompt()}
          autoCapitalize="sentences"
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={() => sendPrompt()} disabled={loading}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  betaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: `${Colors.primary}33`,
  },
  betaText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 10,
  },
  introCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 12,
  },
  introTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  introTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subtleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  betaNotice: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  introText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
  },
  scopeChipMuted: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scopeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  scopeChipTextMuted: {
    color: Colors.textMuted,
  },
  promptGroup: {
    gap: 10,
  },
  promptGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promptChipText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  messageCard: {
    maxWidth: '96%',
    padding: 15,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorBubble: {
    borderColor: `${Colors.bearish}55`,
    backgroundColor: Colors.dangerSoft,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  modeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  detectedText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  bubbleText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  userBubbleText: {
    color: Colors.textPrimary,
  },
  answerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    paddingBottom: 2,
  },
  sectionList: {
    gap: 14,
    marginTop: 12,
  },
  sectionBlock: {
    gap: 8,
    paddingBottom: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  experimentalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  experimentalNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  followUpCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followUpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryLight,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  followUpText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  sourcesWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 8,
  },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  sourceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.primaryLight,
  },
  disclaimerBox: {
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
});
