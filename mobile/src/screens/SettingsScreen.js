import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../utils/colors';
import SignalService from '../services/signalService';
import ScreenHeader from '../components/ScreenHeader';
import StateView from '../components/StateView';
import { Radius, Spacing } from '../utils/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState([]);
  const [coinModalVisible, setCoinModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await SignalService.getHealth();
      setHealth(res);
    } catch (e) {
      Alert.alert('Hata', e.userMessage || 'Sunucu durumu alinamadi');
      setHealth(null);
    }
    setLoading(false);
  };

  const loadCoins = async () => {
    try {
      const res = await SignalService.getCoins();
      setCoins(res.data || []);
    } catch (e) {
      console.log('Coin listesi alinamadi:', e.message);
    }
  };

  useEffect(() => {
    loadStatus();
    loadCoins();
  }, []);

  const runCycle = () => {
    Alert.alert('Analiz', 'Tum coinleri analiz etmek ister misin?', [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Baslat',
        onPress: async () => {
          try {
            const res = await SignalService.runCycle();
            Alert.alert('Tamam', `${res.count} coin analiz edildi`);
          } catch (e) {
            Alert.alert('Hata', e.userMessage || 'Analiz basarisiz');
          }
        },
      },
    ]);
  };

  const searchCoins = useCallback(async (query) => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await SignalService.searchCoins(query);
      setSearchResults(res.data || []);
    } catch (e) {
      console.log('Arama hatasi:', e.message);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCoins(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCoins]);

  const addCoin = async (symbol, name) => {
    try {
      await SignalService.addCoin(symbol, name);
      Alert.alert('Basarili', `${symbol} eklendi`);
      setCoinModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      loadCoins();
    } catch (e) {
      Alert.alert('Hata', e.userMessage || 'Coin eklenemedi');
    }
  };

  const removeCoin = (symbol) => {
    Alert.alert('Onayla', `${symbol} kaldirmak istiyor musun?`, [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Kaldir',
        style: 'destructive',
        onPress: async () => {
          try {
            await SignalService.removeCoin(symbol);
            Alert.alert('Tamam', 'Coin kaldirildi');
            loadCoins();
          } catch (e) {
            Alert.alert('Hata', e.userMessage || 'Coin kaldirilamadi');
          }
        },
      },
    ]);
  };

  const renderSearchResult = ({ item }) => {
    const alreadyAdded = coins.some((coin) => coin.symbol === item.symbol);
    return (
      <TouchableOpacity
        style={[styles.searchItem, alreadyAdded && styles.searchItemDisabled]}
        onPress={() => !alreadyAdded && addCoin(item.symbol, item.name)}
        disabled={alreadyAdded}
      >
        <Text style={styles.searchSymbol}>{item.symbol}</Text>
        {alreadyAdded ? <Text style={styles.addedText}>Eklendi</Text> : <Ionicons name="add-circle" size={24} color={Colors.bullish} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScreenHeader title="Ayarlar" subtitle="Sunucu sagligi, coin listesi ve yonetim islemleri." />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sunucu Durumu</Text>
          <View style={styles.card}>
            {loading && !health ? (
              <StateView loading compact title="Durum kontrol ediliyor" message="Sunucu ve scheduler bilgileri aliniyor." />
            ) : (
              <>
                <Row label="Durum" value={health ? 'Online' : 'Offline'} color={health ? Colors.bullish : Colors.bearish} />
                {health ? <Row label="DB" value={health.database || 'N/A'} color={health.database === 'online' ? Colors.bullish : Colors.bearish} /> : null}
                {health ? <Row label="Uptime" value={`${Math.floor(health.uptime / 3600)} saat`} /> : null}
                {health ? <Row label="Memory" value={health.memory || 'N/A'} /> : null}
                {health?.scheduler ? <Row label="Coin Sayisi" value={`${health.scheduler.coins?.length} adet`} isLast /> : null}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>Coin Listesi</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setCoinModalVisible(true)}>
              <Ionicons name="add" size={18} color={Colors.textPrimary} />
              <Text style={styles.addBtnText}>Ekle</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionHint}>{coins.length} coin izleniyor</Text>
          <View style={styles.coinListWrap}>
            {coins.length > 0 ? (
              <View style={styles.coinList}>
                {coins.map((coin) => (
                  <View key={coin.symbol} style={styles.coinChip}>
                    <Text style={styles.coinChipText}>{coin.symbol.replace('/USDT', '')}</Text>
                    <TouchableOpacity onPress={() => removeCoin(coin.symbol)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <StateView icon="albums-outline" compact title="Coin listesi bos" message="Izlemek istedigin coinleri ekleyerek analiz kapsamina alabilirsin." />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Islemler</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={runCycle}>
            <View style={styles.actionIcon}>
              <Ionicons name="refresh" size={18} color={Colors.primaryLight} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionText}>Manuel analiz baslat</Text>
              <Text style={styles.actionSubtext}>Tum coinler icin yeni sinyal dongusu tetikler.</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={loadStatus}>
            <View style={styles.actionIcon}>
              <Ionicons name="pulse" size={18} color={Colors.primaryLight} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionText}>Durumu kontrol et</Text>
              <Text style={styles.actionSubtext}>Sunucu, veritabani ve scheduler sagligini yeniler.</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.about}>Crypto Signal Analyzer v1.0{'\n'}RSI, MACD, ADX, ATR, Bollinger ve multi-timeframe trend analizi kullanan ozel motor.</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={coinModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coin Ekle</Text>
              <TouchableOpacity onPress={() => {
                setCoinModalVisible(false);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Coin ara (or: PEPE, SHIB)"
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
              />
              {searching ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.symbol}
              renderItem={renderSearchResult}
              style={styles.searchList}
              ListEmptyComponent={
                searchQuery.length > 0 && !searching ? (
                  <Text style={styles.emptyText}>Sonuc bulunamadi</Text>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value, color, isLast = false }) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  header: {
    paddingBottom: Spacing.sm,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  sectionTitleInline: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: -4,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  rowLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: Radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  actionCopy: {
    flex: 1,
  },
  actionText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  actionSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  about: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  coinListWrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  coinList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coinChipText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  searchList: {
    marginTop: 16,
  },
  searchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  searchItemDisabled: {
    opacity: 0.5,
  },
  searchSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  addedText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    paddingVertical: 20,
  },
});
