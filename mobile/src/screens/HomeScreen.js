import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';
import { formatPercent, formatTimeAgo } from '../utils/formatters';
import SignalService from '../services/signalService';
import SignalCard from '../components/SignalCard';
import ScreenHeader from '../components/ScreenHeader';
import StateView from '../components/StateView';
import { Radius, Spacing } from '../utils/theme';

const DEFAULT_STATS = {
  totalSignals: 0,
  openSignals: 0,
  wins: 0,
  losses: 0,
  expired: 0,
  winRate: 0,
  tp1Wins: 0,
  tp2Wins: 0,
  tp3Wins: 0,
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [lastUpdate, setLastUpdate] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatsError(null);

    try {
      const [signalsRes, coinsRes, statsRes] = await Promise.allSettled([
        SignalService.getAllSignals(),
        SignalService.getCoins(),
        SignalService.getStats(),
      ]);

      if (signalsRes.status !== 'fulfilled' || coinsRes.status !== 'fulfilled') {
        throw (signalsRes.status === 'rejected' ? signalsRes.reason : coinsRes.reason);
      }

      const activeSymbols = new Set((coinsRes.value.data || []).map((coin) => coin.symbol));
      const latestSignals = signalsRes.value.data || [];
      const activeSignals = latestSignals.filter((signal) => activeSymbols.has(signal.symbol));

      setSignals(activeSignals);
      setLastUpdate(new Date());

      if (statsRes.status === 'fulfilled') {
        setStats({ ...DEFAULT_STATS, ...(statsRes.value.data || {}) });
      } else {
        setStats(DEFAULT_STATS);
        setStatsError('Performans istatistikleri şu anda alınamıyor.');
      }
    } catch (e) {
      const msg = e.userMessage || 'Sinyaller yuklenemedi';
      setError(msg);
      setSignals([]);
      Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSignals();
    }, [fetchSignals])
  );

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      const matchSearch = s.symbol.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchFilter = filter === 'ALL'
        || (filter === 'BUY' && (s.signal_type || '').includes('BUY'))
        || (filter === 'SELL' && (s.signal_type || '').includes('SELL'))
        || (filter === 'WAIT' && s.signal_type === 'WAIT');
      return matchSearch && matchFilter;
    });
  }, [signals, debouncedSearch, filter]);

  const filters = ['ALL', 'BUY', 'SELL', 'WAIT'];
  const isFiltered = search.length > 0 || filter !== 'ALL';

  const renderItem = useCallback(({ item }) => (
    <SignalCard signal={item} onPress={(s) => navigation.navigate('Detail', { signal: s, symbol: s.symbol })} />
  ), [navigation]);

  const keyExtractor = useCallback((item) => `${item.symbol}${item.id}`, []);

  const renderHeader = useCallback(() => (
    <View style={styles.listHeader}>
      <ScreenHeader
        title="Crypto Sinyalleri"
        subtitle={lastUpdate ? `Son guncelleme ${formatTimeAgo(lastUpdate)}` : 'Canli coin sinyalleri ve trend ozeti'}
      />

      <View style={styles.performanceCard}>
        <View style={styles.performanceTopRow}>
          <View style={styles.performanceHero}>
            <Text style={styles.performanceLabel}>Win Rate</Text>
            <Text style={styles.performanceValue}>{formatPercent(stats.winRate)}</Text>
            <Text style={styles.performanceHint}>Cozulen sinyaller uzerinden hesaplanir</Text>
          </View>

          <View style={styles.performanceSideGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Toplam</Text>
              <Text style={styles.metricValue}>{stats.totalSignals}</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Kazanc</Text>
              <Text style={[styles.metricValue, styles.metricValueSuccess]}>{stats.wins}</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Kayip</Text>
              <Text style={[styles.metricValue, styles.metricValueDanger]}>{stats.losses}</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Acik</Text>
              <Text style={styles.metricValue}>{stats.openSignals}</Text>
            </View>
          </View>
        </View>

        <View style={styles.performanceFooter}>
          <View style={styles.performancePill}>
            <Text style={styles.performancePillLabel}>TP1</Text>
            <Text style={styles.performancePillValue}>{stats.tp1Wins}</Text>
          </View>
          <View style={styles.performancePill}>
            <Text style={styles.performancePillLabel}>TP2</Text>
            <Text style={styles.performancePillValue}>{stats.tp2Wins}</Text>
          </View>
          <View style={styles.performancePill}>
            <Text style={styles.performancePillLabel}>TP3</Text>
            <Text style={styles.performancePillValue}>{stats.tp3Wins}</Text>
          </View>
          <View style={styles.performancePill}>
            <Text style={styles.performancePillLabel}>Expired</Text>
            <Text style={styles.performancePillValue}>{stats.expired}</Text>
          </View>
        </View>

        {statsError ? (
          <View style={styles.statsBanner}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.statsBannerText}>{statsError}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryLabel}>Toplam</Text>
          <Text style={styles.summaryValue}>{signals.length}</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryLabel}>Gorunen</Text>
          <Text style={styles.summaryValue}>{filtered.length}</Text>
        </View>
        <TouchableOpacity style={styles.refreshPill} onPress={fetchSignals} activeOpacity={0.85}>
          <Ionicons name="refresh" size={16} color={Colors.primaryLight} />
          <Text style={styles.refreshText}>Yenile</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={18} color={Colors.bearish} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.controlsCard}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Coin ara..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.filterBtn, filter === item && styles.filterActive]}
              onPress={() => setFilter(item)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  ), [error, fetchSignals, filter, filtered.length, lastUpdate, search, signals.length, stats, statsError]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSignals} tintColor={Colors.primary} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <StateView loading title="Sinyaller yukleniyor" message="Guncel market verileri cekiliyor." />
          ) : error ? (
            <StateView
              icon="cloud-offline-outline"
              title="Veri alinamadi"
              message={error}
              actionLabel="Tekrar dene"
              onAction={fetchSignals}
            />
          ) : (
            <StateView
              icon={isFiltered ? 'search-outline' : 'analytics-outline'}
              title={isFiltered ? 'Eslesen sinyal yok' : 'Sinyal bulunamadi'}
              message={isFiltered ? 'Arama veya filtre secimini genisletmeyi dene.' : 'Aktif coin listesinde gosterilecek sinyal yok.'}
              actionLabel={isFiltered ? 'Filtreleri sifirla' : 'Tekrar dene'}
              onAction={isFiltered ? () => {
                setSearch('');
                setFilter('ALL');
              } : fetchSignals}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 120,
    flexGrow: 1,
  },
  listHeader: {
    paddingBottom: Spacing.sm,
  },
  performanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  performanceTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  performanceHero: {
    flex: 1.1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-between',
  },
  performanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  performanceValue: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  performanceHint: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  performanceSideGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    width: '47%',
    minHeight: 72,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  metricValueSuccess: {
    color: Colors.bullish,
  },
  metricValueDanger: {
    color: Colors.bearish,
  },
  performanceFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  performancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  performancePillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  performancePillValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  statsBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  refreshPill: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  refreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: `${Colors.bearish}33`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.bearish,
    fontSize: 12,
    flex: 1,
  },
  controlsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    marginBottom: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    minHeight: 42,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.primaryLight,
  },
  separator: {
    height: 12,
  },
});
