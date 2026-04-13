import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getSignalColor, getTrendColor } from '../utils/colors';
import { formatPrice, formatNumber, formatPercent, getSymbolShort, formatTimeAgo, getSignalEmoji } from '../utils/formatters';
import { useFavorites } from '../store/FavoritesContext';
import SignalService from '../services/signalService';
import AIService from '../services/aiService';

export default function DetailScreen({ route, navigation }) {
  const { symbol } = route.params;
  const [signal, setSignal] = useState(route.params.signal);
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { toggleFavorite, isFavorite } = useFavorites();

  const s = signal;
  const color = getSignalColor(s.signal_type);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await SignalService.analyzeSingle(symbol);
      if (res.data) setSignal(res.data);
    } catch (e) { 
      Alert.alert('Hata', e.userMessage || 'Yenileme başarısız');
    }
    setLoading(false);
  };

  const getAI = async () => {
    setAiLoading(true);
    try {
      const res = await AIService.interpretSignal(symbol);
      setAiText(res.data.interpretation);
    } catch (e) { 
      setAiText(e.userMessage || 'AI yorumu alınamadı.');
    }
    setAiLoading(false);
  };

  const pct = (target) => {
    if (!target || !s.current_price) return '';
    return (((parseFloat(target) - parseFloat(s.current_price)) / parseFloat(s.current_price)) * 100).toFixed(2) + '%';
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerSymbol}>{s.symbol}</Text>
          <Text style={styles.headerTime}>{formatTimeAgo(s.created_at)}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleFavorite(s.symbol)}>
          <Ionicons name={isFavorite(s.symbol) ? 'star' : 'star-outline'} size={24} color={isFavorite(s.symbol) ? Colors.warning : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.signalBox}>
        <View style={[styles.bigBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.bigSignal, { color }]}>{getSignalEmoji(s.signal_type)} {(s.signal_type || '').replace('_', ' ')}</Text>
        </View>
        <Text style={styles.bigPrice}>{formatPrice(s.current_price)}</Text>
        <Text style={[styles.bigConf, { color }]}>Guven: %{formatNumber(s.confidence, 1)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trend Analizi</Text>
        <View style={styles.trendRow}>
          <View style={[styles.trendBadge, { borderColor: getTrendColor(s.trend_1h) + '44' }]}>
            <Text style={styles.trendLabel}>1H</Text>
            <Ionicons name={s.trend_1h === 'BULLISH' ? 'trending-up' : s.trend_1h === 'BEARISH' ? 'trending-down' : 'remove'} size={18} color={getTrendColor(s.trend_1h)} />
            <Text style={[styles.trendText, { color: getTrendColor(s.trend_1h) }]}>{s.trend_1h || 'N/A'}</Text>
          </View>
          <View style={[styles.trendBadge, { borderColor: getTrendColor(s.trend_4h) + '44' }]}>
            <Text style={styles.trendLabel}>4H</Text>
            <Ionicons name={s.trend_4h === 'BULLISH' ? 'trending-up' : s.trend_4h === 'BEARISH' ? 'trending-down' : 'remove'} size={18} color={getTrendColor(s.trend_4h)} />
            <Text style={[styles.trendText, { color: getTrendColor(s.trend_4h) }]}>{s.trend_4h || 'N/A'}</Text>
          </View>
        </View>
        <Text style={[styles.alignment, { color: s.trend_alignment === 'ALIGNED' ? Colors.bullish : s.trend_alignment === 'CONFLICTING' ? Colors.bearish : Colors.warning }]}>
          Uyum: {s.trend_alignment}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gostergeler</Text>
        <View style={styles.grid}>
          <Item label="RSI" value={formatNumber(s.rsi, 1)} sub={s.rsi_signal} color={s.rsi <= 30 ? Colors.bullish : s.rsi >= 70 ? Colors.bearish : null} />
          <Item label="ADX" value={formatNumber(s.adx, 1)} sub={s.adx_signal} color={s.adx >= 25 ? Colors.warning : null} />
          <Item label="MACD" value={formatNumber(s.macd_histogram, 6)} sub={s.macd_crossover} color={s.macd_crossover === 'BULLISH' ? Colors.bullish : s.macd_crossover === 'BEARISH' ? Colors.bearish : null} />
          <Item label="Hacim" value={formatNumber(s.volume_ratio, 2) + 'x'} sub={s.volume_signal} color={s.volume_ratio >= 1.5 ? Colors.bullish : null} />
          <Item label="EMA 200" value={s.price_vs_ema200} sub={formatPercent(s.ema_200_distance)} color={getTrendColor(s.price_vs_ema200)} />
          <Item label="BB Pozisyon" value={formatNumber(parseFloat(s.bb_position) * 100, 1) + '%'} sub={s.bb_signal} />
          <Item label="ATR" value={formatPrice(s.atr)} sub={formatPercent(s.atr_percent)} />
          <Item label="+DI / -DI" value={formatNumber(s.plus_di, 1) + ' / ' + formatNumber(s.minus_di, 1)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Puanlama</Text>
        <View style={styles.scoreRow}>
          <Score label="Alis" value={s.buy_score} color={Colors.bullish} />
          <Score label="Satis" value={s.sell_score} color={Colors.bearish} />
          <Score label="Bonus" value={s.bonus_score} color={parseInt(s.bonus_score) >= 0 ? Colors.bullish : Colors.bearish} />
          <Score label="Ham" value={s.raw_score} color={parseInt(s.raw_score) >= 0 ? Colors.bullish : Colors.bearish} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Yonetimi</Text>
        <View style={styles.riskBox}>
          <RiskRow label="Stop Loss" value={formatPrice(s.stop_loss)} pct={pct(s.stop_loss)} color={Colors.bearish} />
          <RiskRow label="TP 1" value={formatPrice(s.take_profit_1)} pct={pct(s.take_profit_1)} color={Colors.bullish} />
          <RiskRow label="TP 2" value={formatPrice(s.take_profit_2)} pct={pct(s.take_profit_2)} color={Colors.bullish} />
          <RiskRow label="TP 3" value={formatPrice(s.take_profit_3)} pct={pct(s.take_profit_3)} color={Colors.bullish} />
          {s.risk_reward_ratio && (
            <View style={styles.rrRow}>
              <Text style={styles.rrLabel}>Risk/Odul</Text>
              <Text style={styles.rrValue}>1:{s.risk_reward_ratio}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.aiBtn} onPress={getAI} disabled={aiLoading}>
          <Ionicons name="sparkles" size={20} color={Colors.textPrimary} />
          <Text style={styles.aiBtnText}>{aiLoading ? 'Analiz ediliyor...' : 'AI Yorumunu Gor'}</Text>
        </TouchableOpacity>
        {aiText && (
          <View style={styles.aiBox}>
            <Text style={styles.aiText}>{aiText}</Text>
          </View>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function Item({ label, value, sub, color }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={[styles.gridValue, color && { color }]}>{value || '-'}</Text>
      {sub && <Text style={styles.gridSub}>{sub}</Text>}
    </View>
  );
}

function Score({ label, value, color }) {
  return (
    <View style={styles.scoreBox}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, { color }]}>{value || 0}</Text>
    </View>
  );
}

function RiskRow({ label, value, pct, color }) {
  return (
    <View style={styles.riskRow}>
      <View style={[styles.riskDot, { backgroundColor: color }]} />
      <Text style={styles.riskLabel}>{label}</Text>
      <Text style={[styles.riskValue, { color }]}>{value}</Text>
      <Text style={[styles.riskPct, { color }]}>{pct}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12 },
  headerSymbol: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  headerTime: { fontSize: 12, color: Colors.textMuted },
  signalBox: { alignItems: 'center', paddingVertical: 16 },
  bigBadge: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, borderWidth: 2, marginBottom: 12 },
  bigSignal: { fontSize: 18, fontWeight: '800' },
  bigPrice: { fontSize: 32, fontWeight: '700', color: Colors.textPrimary },
  bigConf: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  trendRow: { flexDirection: 'row', gap: 8 },
  trendBadge: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', backgroundColor: Colors.surface },
  trendLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  trendText: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  alignment: { textAlign: 'center', marginTop: 8, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: Colors.surface, borderRadius: 12, padding: 8 },
  gridItem: { width: '50%', paddingVertical: 8, paddingHorizontal: 8 },
  gridLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  gridValue: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  gridSub: { fontSize: 11, color: Colors.textMuted },
  scoreRow: { flexDirection: 'row', gap: 8 },
  scoreBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, alignItems: 'center' },
  scoreLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  scoreValue: { fontSize: 22, fontWeight: '800' },
  riskBox: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16 },
  riskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  riskDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  riskLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  riskValue: { fontSize: 14, fontWeight: '600', marginRight: 8 },
  riskPct: { fontSize: 12, fontWeight: '500', minWidth: 55, textAlign: 'right' },
  rrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  rrLabel: { fontSize: 14, color: Colors.textSecondary },
  rrValue: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, gap: 8 },
  aiBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  aiBox: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginTop: 12 },
  aiText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
});