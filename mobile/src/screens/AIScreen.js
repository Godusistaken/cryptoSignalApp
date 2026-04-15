import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';
import AIService from '../services/aiService';
import ScreenHeader from '../components/ScreenHeader';
import { Radius, Spacing } from '../utils/theme';

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Bir coin yaz, mevcut sinyali yorumlayayim.\n\nOrnek: BTC veya ETH/USDT' },
  ]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;

    let sym = input.trim().toUpperCase();
    if (!sym.includes('/')) sym += '/USDT';

    setMessages((prev) => [...prev, { role: 'user', text: `${sym} analiz et` }]);
    setInput('');
    setLoading(true);

    try {
      const res = await AIService.interpretSignal(sym);
      setMessages((prev) => [...prev, { role: 'ai', text: res.data.interpretation }]);
    } catch (e) {
      const errorMsg = e.userMessage || 'Bir hata olustu';
      setMessages((prev) => [...prev, { role: 'ai', text: `${sym}: ${errorMsg}` }]);
    }

    setLoading(false);
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
          subtitle="Sinyal yorumlarini hizli okumak icin hafif bir yardimci ekran."
          right={(
            <View style={styles.betaChip}>
              <Ionicons name="sparkles" size={14} color={Colors.primaryLight} />
              <Text style={styles.betaText}>Beta</Text>
            </View>
          )}
        />
      </View>

      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent} keyboardShouldPersistTaps="handled">
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Nasil kullanilir?</Text>
          <Text style={styles.introText}>Sadece coin kodunu yazman yeterli. Bu ekran mevcut sinyali yorumlar, yeni bot mantigi eklemez.</Text>
        </View>

        {messages.map((message, index) => (
          <View key={index} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.text}</Text>
          </View>
        ))}

        {loading ? (
          <View style={[styles.bubble, styles.aiBubble]}>
            <Text style={styles.bubbleText}>Analiz ediliyor...</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={styles.input}
          placeholder="Coin yaz (BTC, ETH...)"
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          autoCapitalize="characters"
          returnKeyType="send"
        />
        <TouchableOpacity style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={send} disabled={loading}>
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
  },
  introCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
  bubble: {
    maxWidth: '88%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
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
  bubbleText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  userBubbleText: {
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    minHeight: 48,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
