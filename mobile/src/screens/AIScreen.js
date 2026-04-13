import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';
import AIService from '../services/aiService';
import SignalService from '../services/signalService';

export default function AIScreen() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Merhaba! Bir coin yaz, sinyalini yorumlayayim.\n\nOrnek: BTC' },
  ]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    let sym = input.trim().toUpperCase();
    if (!sym.includes('/')) sym += '/USDT';

    setMessages(prev => [...prev, { role: 'user', text: sym + ' analiz et' }]);
    setInput('');
    setLoading(true);

    try {
      const res = await AIService.interpretSignal(sym);
      setMessages(prev => [...prev, { role: 'ai', text: res.data.interpretation }]);
    } catch (e) {
      const errorMsg = e.userMessage || 'Bir hata oluştu';
      setMessages(prev => [...prev, { role: 'ai', text: `❌ ${sym}: ${errorMsg}` }]);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={24} color={Colors.primary} />
        <Text style={styles.title}>AI Asistan</Text>
      </View>

      <ScrollView style={styles.msgs} contentContainerStyle={{ padding: 16 }}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.bubbleText, m.role === 'user' && { color: '#fff' }]}>{m.text}</Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.aiBubble]}>
            <Text style={styles.bubbleText}>Analiz ediliyor...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Coin yaz (BTC, ETH...)" placeholderTextColor={Colors.textMuted}
          value={input} onChangeText={setInput} onSubmitEditing={send} autoCapitalize="characters" />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={loading}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  msgs: { flex: 1 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 10 },
  userBubble: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  inputRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 30, borderTopWidth: 1, borderTopColor: Colors.border, gap: 10 },
  input: { flex: 1, backgroundColor: Colors.surface, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { backgroundColor: Colors.primary, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
});