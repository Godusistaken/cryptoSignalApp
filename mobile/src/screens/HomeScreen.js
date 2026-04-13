import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';
import { formatTimeAgo } from '../utils/formatters';
import SignalService from '../services/signalService';
import SignalCard from '../components/SignalCard';

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function HomeScreen({ navigation }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const debouncedSearch = useDebounce(search, 300);

  const fetchSignals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await SignalService.getAllSignals();
      setSignals(res.data || []);
      setLastUpdate(new Date());
    } catch (e) {
      const msg = e.userMessage || 'Sinyaller yüklenemedi';
      setError(msg);
      if (signals.length === 0) {
        Alert.alert('Hata', msg);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchSignals(); }, []);

  const filtered = useMemo(() => {
    return signals.filter(s => {
      const matchSearch = s.symbol.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchFilter = filter === 'ALL'
        || (filter === 'BUY' && s.signal_type.includes('BUY'))
        || (filter === 'SELL' && s.signal_type.includes('SELL'))
        || (filter === 'WAIT' && s.signal_type === 'WAIT');
      return matchSearch && matchFilter;
    });
  }, [signals, debouncedSearch, filter]);

  const filters = ['ALL', 'BUY', 'SELL', 'WAIT'];

  const renderItem = useCallback(({ item }) => (
    <SignalCard signal={item} onPress={(s) => navigation.navigate('Detail', { signal: s, symbol: s.symbol })} />
  ), [navigation]);

  const keyExtractor = useCallback((item) => item.symbol + item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: 180,
    offset: 180 * index,
    index,
  }), []);

  if (loading && signals.length === 0) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Sinyaller yukleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Crypto Sinyalleri</Text>
        {lastUpdate && <Text style={styles.subtitle}>Guncelleme: {formatTimeAgo(lastUpdate)}</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Coin ara..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.count}>{filtered.length} sinyal</Text>

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSignals} tintColor={Colors.primary} colors={[Colors.primary]} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="analytics-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Sinyal bulunamadi</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textMuted, marginTop: 16 },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: 16, marginVertical: 8, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: Colors.textPrimary },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  filterTextActive: { color: Colors.textPrimary },
  count: { fontSize: 12, color: Colors.textMuted, paddingHorizontal: 16, marginBottom: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 15, marginTop: 12 },
  errorText: { color: Colors.bearish, fontSize: 12, marginTop: 4 },
});