import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';
import { useFavorites } from '../store/FavoritesContext';
import SignalService from '../services/signalService';
import SignalCard from '../components/SignalCard';

export default function FavoritesScreen({ navigation }) {
  const { favorites } = useFavorites();
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await SignalService.getAllSignals();
      setSignals((res.data || []).filter(s => favorites.includes(s.symbol)));
    } catch (e) {
      const msg = e.userMessage || 'Favoriler yüklenemedi';
      setError(msg);
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [favorites]);

  const renderItem = useCallback(({ item }) => (
    <SignalCard signal={item} onPress={(s) => navigation.navigate('Detail', { signal: s, symbol: s.symbol })} />
  ), [navigation]);

  const keyExtractor = useCallback((item) => item.symbol, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoriler</Text>
        <Text style={styles.subtitle}>{signals.length} coin</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
      <FlatList
        data={signals}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} tintColor={Colors.primary} colors={[Colors.primary]} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Favori yok</Text>
            <Text style={styles.emptyText}>Coin kartindaki yildiza bas</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted },
  errorText: { color: Colors.bearish, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyText: { color: Colors.textMuted, fontSize: 14, marginTop: 8 },
});