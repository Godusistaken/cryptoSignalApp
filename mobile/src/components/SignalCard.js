import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getSignalColor, getTrendColor } from '../utils/colors';
import { formatPrice, formatNumber, formatTimeAgo, getSymbolShort } from '../utils/formatters';
import { useFavorites } from '../store/FavoritesContext';

function SignalCard({ signal, onPress }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const color = getSignalColor(signal.signal_type);
  const sym = getSymbolShort(signal.symbol);
  const fav = isFavorite(signal.symbol);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(signal)} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{sym}</Text>
          <Text style={styles.pair}>/USDT</Text>
        </View>
        <Pressable onPress={() => toggleFavorite(signal.symbol)} hitSlop={10}>
          <Ionicons name={fav ? 'star' : 'star-outline'} size={22} color={fav ? Colors.warning : Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(signal.current_price)}</Text>
        <Text style={styles.time}>{formatTimeAgo(signal.created_at)}</Text>
      </View>

      <View style={styles.signalRow}>
        <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.signalText, { color }]}>{(signal.signal_type || '').replace('_', ' ')}</Text>
        </View>
        <View style={styles.confBox}>
          <Text style={styles.confLabel}>Guven</Text>
          <Text style={[styles.confValue, { color }]}>{formatNumber(signal.confidence, 1)}%</Text>
        </View>
      </View>

      <View style={styles.indicators}>
        <View style={styles.ind}>
          <Text style={styles.indLabel}>RSI</Text>
          <Text style={[styles.indValue, { color: signal.rsi <= 30 ? Colors.bullish : signal.rsi >= 70 ? Colors.bearish : Colors.textSecondary }]}>
            {formatNumber(signal.rsi, 1)}
          </Text>
        </View>
        <View style={styles.ind}>
          <Text style={styles.indLabel}>ADX</Text>
          <Text style={[styles.indValue, { color: signal.adx >= 25 ? Colors.warning : Colors.textSecondary }]}>
            {formatNumber(signal.adx, 1)}
          </Text>
        </View>
        <View style={styles.ind}>
          <Text style={styles.indLabel}>Vol</Text>
          <Text style={[styles.indValue, { color: signal.volume_ratio >= 1.5 ? Colors.bullish : Colors.textSecondary }]}>
            {formatNumber(signal.volume_ratio, 1)}x
          </Text>
        </View>
        <View style={styles.ind}>
          <Text style={styles.indLabel}>1H</Text>
          <Text style={[styles.indValue, { color: getTrendColor(signal.trend_1h) }]}>
            {signal.trend_1h === 'BULLISH' ? '↑' : signal.trend_1h === 'BEARISH' ? '↓' : '−'}
          </Text>
        </View>
        <View style={styles.ind}>
          <Text style={styles.indLabel}>4H</Text>
          <Text style={[styles.indValue, { color: getTrendColor(signal.trend_4h) }]}>
            {signal.trend_4h === 'BULLISH' ? '↑' : signal.trend_4h === 'BEARISH' ? '↓' : '−'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Sadece signal veya onPress değişirse yeniden render et
export default memo(SignalCard, (prevProps, nextProps) => {
  return prevProps.signal.id === nextProps.signal.id &&
         prevProps.signal.signal_type === nextProps.signal.signal_type &&
         prevProps.signal.confidence === nextProps.signal.confidence &&
         prevProps.signal.current_price === nextProps.signal.current_price;
});

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginHorizontal: 16, marginVertical: 6, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  symbolRow: { flexDirection: 'row', alignItems: 'baseline' },
  symbol: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  pair: { fontSize: 14, color: Colors.textMuted, marginLeft: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  price: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  time: { fontSize: 12, color: Colors.textMuted },
  signalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  signalText: { fontSize: 13, fontWeight: '700' },
  confBox: { alignItems: 'flex-end' },
  confLabel: { fontSize: 11, color: Colors.textMuted },
  confValue: { fontSize: 18, fontWeight: '700' },
  indicators: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10 },
  ind: { alignItems: 'center' },
  indLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  indValue: { fontSize: 14, fontWeight: '600' },
});