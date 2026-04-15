import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';
import { useFavorites } from '../store/FavoritesContext';
import SignalService from '../services/signalService';
import SignalCard from '../components/SignalCard';
import ScreenHeader from '../components/ScreenHeader';
import StateView from '../components/StateView';
import { Spacing } from '../utils/theme';

export default function FavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { favorites } = useFavorites();
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await SignalService.getAllSignals();
      setSignals((res.data || []).filter((s) => favorites.includes(s.symbol)));
    } catch (e) {
      const msg = e.userMessage || 'Favoriler yuklenemedi';
      setError(msg);
      Alert.alert('Hata', msg);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch();
  }, [favorites]);

  const renderItem = useCallback(({ item }) => (
    <SignalCard signal={item} onPress={(s) => navigation.navigate('Detail', { signal: s, symbol: s.symbol })} />
  ), [navigation]);

  const keyExtractor = useCallback((item) => item.symbol, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ScreenHeader
          title="Favoriler"
          subtitle={
            favorites.length === 0
              ? 'Takip etmek istedigin coinleri yildizlayarak burada topla.'
              : `${signals.length} aktif favori coin`
          }
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <FlatList
        data={signals}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} tintColor={Colors.primary} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <StateView
            icon="star-outline"
            title={favorites.length === 0 ? 'Favori listen bos' : 'Favori coin bulunamadi'}
            message={
              favorites.length === 0
                ? 'Sinyal kartlarindaki yildiz ile coinleri hizlica ekleyebilirsin.'
                : 'Favori coinler icin guncel veri geldiginde burada gorunecek.'
            }
            actionLabel={favorites.length === 0 ? undefined : 'Yenile'}
            onAction={favorites.length === 0 ? undefined : fetch}
          />
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
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.bearish,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 120,
    paddingTop: 4,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
});
