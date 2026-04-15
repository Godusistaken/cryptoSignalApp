import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getSignalColor, getTrendColor } from '../utils/colors';
import { formatPrice, formatNumber, formatTimeAgo, getSymbolShort, getSignalEmoji } from '../utils/formatters';
import { useFavorites } from '../store/FavoritesContext';
import { Elevation, Radius, Spacing } from '../utils/theme';

function SignalCard({ signal, onPress }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const color = getSignalColor(signal.signal_type);
  const sym = getSymbolShort(signal.symbol);
  const fav = isFavorite(signal.symbol);
  const signalLabel = (signal.signal_type || 'WAIT').replace(/_/g, ' ');

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(signal)} activeOpacity={0.78}>
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '44' }]}>
          <Text style={[styles.badgeText, { color }]}>{getSignalEmoji(signal.signal_type)} {signalLabel}</Text>
        </View>
        <Pressable onPress={() => toggleFavorite(signal.symbol)} hitSlop={10}>
          <Ionicons name={fav ? 'star' : 'star-outline'} size={22} color={fav ? Colors.warning : Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{sym}</Text>
          <Text style={styles.pair}>/USDT</Text>
        </View>
        <Text style={styles.time}>{formatTimeAgo(signal.created_at)}</Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(signal.current_price)}</Text>
        <View style={styles.confBox}>
          <Text style={styles.confLabel}>Guven</Text>
          <Text style={[styles.confValue, { color }]}>{formatNumber(signal.confidence, 1)}%</Text>
        </View>
      </View>

      <View style={styles.indicators}>
        <IndicatorBlock
          label="RSI"
          value={formatNumber(signal.rsi, 1)}
          color={signal.rsi <= 30 ? Colors.bullish : signal.rsi >= 70 ? Colors.bearish : Colors.textSecondary}
        />
        <IndicatorBlock
          label="ADX"
          value={formatNumber(signal.adx, 1)}
          color={signal.adx >= 25 ? Colors.warning : Colors.textSecondary}
        />
        <IndicatorBlock
          label="Vol"
          value={`${formatNumber(signal.volume_ratio, 1)}x`}
          color={signal.volume_ratio >= 1.5 ? Colors.bullish : Colors.textSecondary}
        />
        <IndicatorBlock
          label="1H"
          value={signal.trend_1h === 'BULLISH' ? 'UP' : signal.trend_1h === 'BEARISH' ? 'DN' : '--'}
          color={getTrendColor(signal.trend_1h)}
        />
        <IndicatorBlock
          label="4H"
          value={signal.trend_4h === 'BULLISH' ? 'UP' : signal.trend_4h === 'BEARISH' ? 'DN' : '--'}
          color={getTrendColor(signal.trend_4h)}
        />
      </View>
    </TouchableOpacity>
  );
}

function IndicatorBlock({ label, value, color }) {
  return (
    <View style={styles.ind}>
      <Text style={styles.indLabel}>{label}</Text>
      <Text style={[styles.indValue, { color }]}>{value}</Text>
    </View>
  );
}

export default memo(SignalCard, (prevProps, nextProps) => {
  return prevProps.signal.id === nextProps.signal.id &&
         prevProps.signal.signal_type === nextProps.signal.signal_type &&
         prevProps.signal.confidence === nextProps.signal.confidence &&
         prevProps.signal.current_price === nextProps.signal.current_price;
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  symbol: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  pair: {
    fontSize: 14,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  time: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confBox: {
    alignItems: 'flex-end',
  },
  confLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  confValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
  },
  ind: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  indLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  indValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
