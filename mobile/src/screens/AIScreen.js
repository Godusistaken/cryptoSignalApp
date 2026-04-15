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
  'Analyze BTC',
  'Latest ETH news',
  'Compare SOL vs ADA',
  'What does ONT do?',
];

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
        disclaimer: payload.disclaimer,
        sources: payload.sources || [],
        detectedCoins: payload.detectedCoins || [],
        mode: payload.mode,
      });
    } catch (e) {
      pushMessage({
        role: 'error',
        text: e.userMessage || 'AI yaniti alinamadi.',
      });
    }

    setLoading(false);
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
          title="AI Asistan"
          subtitle="Egitim odakli crypto analiz yardimcisi. Proje, risk, anlati ve haber ozetleri icin kullan."
          right={(
            <View style={styles.betaChip}>
              <Ionicons name="sparkles" size={14} color={Colors.primaryLight} />
              <Text style={styles.betaText}>Gemini</Text>
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
          <Text style={styles.introTitle}>Neler sorabilirsin?</Text>
          <Text style={styles.introText}>Coin analizi, proje ozeti, riskler, ekosistem, sentiment ve uygun oldugunda verifiable latest news ozetleri.</Text>
          <View style={styles.promptRow}>
            {STARTER_PROMPTS.map((prompt) => (
              <TouchableOpacity key={prompt} style={styles.promptChip} onPress={() => sendPrompt(prompt)} activeOpacity={0.85}>
                <Text style={styles.promptChipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {messages.length === 0 ? (
          <StateView
            compact
            icon="chatbubble-ellipses-outline"
            title="Hazir"
            message="Bir soru yaz veya alttaki orneklerden biriyle basla."
          />
        ) : null}

        {messages.map((message) => (
          <View key={message.id} style={[styles.messageCard, message.role === 'user' ? styles.userBubble : styles.aiBubble, message.role === 'error' && styles.errorBubble]}>
            {message.role !== 'user' && message.mode ? (
              <View style={styles.metaRow}>
                <View style={styles.modeChip}>
                  <Text style={styles.modeChipText}>{message.mode}</Text>
                </View>
                {message.detectedCoins?.length ? (
                  <Text style={styles.detectedText}>{message.detectedCoins.join(', ')}</Text>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.text}</Text>

            {message.sources?.length ? (
              <View style={styles.sourcesWrap}>
                <Text style={styles.sourcesTitle}>Sources</Text>
                {message.sources.map((source) => (
                  <TouchableOpacity key={source.url} onPress={() => openSource(source.url)} activeOpacity={0.75} style={styles.sourceItem}>
                    <Ionicons name="link-outline" size={14} color={Colors.primaryLight} />
                    <Text style={styles.sourceText}>{source.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {message.disclaimer ? <Text style={styles.disclaimer}>{message.disclaimer}</Text> : null}
          </View>
        ))}

        {loading ? (
          <View style={[styles.messageCard, styles.aiBubble]}>
            <View style={styles.loadingRow}>
              <Ionicons name="sparkles" size={16} color={Colors.primaryLight} />
              <Text style={styles.loadingText}>Gemini dusunuyor...</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={styles.input}
          placeholder="BTC analiz et, ETH haberi sor, iki coin karsilastir..."
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
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  introText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
    maxWidth: '92%',
    padding: 14,
    borderRadius: 16,
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
    alignItems: 'center',
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
    textTransform: 'uppercase',
  },
  detectedText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
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
  sourcesWrap: {
    marginTop: 12,
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
    alignItems: 'center',
    gap: 8,
  },
  sourceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.primaryLight,
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
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
