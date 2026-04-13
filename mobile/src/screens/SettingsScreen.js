import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';
import SignalService from '../services/signalService';

export default function SettingsScreen() {
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
      Alert.alert('Hata', e.userMessage || 'Sunucu durumu alınamadı');
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
      { text: 'Baslat', onPress: async () => {
        try {
          const res = await SignalService.runCycle();
          Alert.alert('Tamam', res.count + ' coin analiz edildi');
        } catch (e) { Alert.alert('Hata', e.userMessage || 'Analiz basarisiz'); }
      }},
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
      Alert.alert('Basarili', symbol + ' eklendi');
      setCoinModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      loadCoins();
    } catch (e) {
      Alert.alert('Hata', e.userMessage || 'Coin eklenemedi');
    }
  };

  const removeCoin = (symbol) => {
    Alert.alert('Onayla', symbol + ' kaldirmak istiyor musun?', [
      { text: 'Iptal', style: 'cancel' },
      { text: 'Kaldir', style: 'destructive', onPress: async () => {
        try {
          await SignalService.removeCoin(symbol);
          Alert.alert('Tamam', 'Coin kaldirildi');
          loadCoins();
        } catch (e) {
          Alert.alert('Hata', e.userMessage || 'Coin kaldirilamadi');
        }
      }},
    ]);
  };

  const renderSearchResult = ({ item }) => {
    const alreadyAdded = coins.some(c => c.symbol === item.symbol);
    return (
      <TouchableOpacity 
        style={[styles.searchItem, alreadyAdded && styles.searchItemDisabled]}
        onPress={() => !alreadyAdded && addCoin(item.symbol, item.name)}
        disabled={alreadyAdded}
      >
        <Text style={styles.searchSymbol}>{item.symbol}</Text>
        {alreadyAdded && <Text style={styles.addedText}>Eklendi</Text>}
        {!alreadyAdded && <Ionicons name="add-circle" size={24} color={Colors.bullish} />}
      </TouchableOpacity>
    );
  };

  const renderCoin = ({ item }) => (
    <View style={styles.coinItem}>
      <Text style={styles.coinSymbol}>{item.symbol}</Text>
      <TouchableOpacity onPress={() => removeCoin(item.symbol)} hitSlop={10}>
        <Ionicons name="close-circle" size={22} color={Colors.bearish} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Ayarlar</Text></View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sunucu Durumu</Text>
        <View style={styles.card}>
          <Row label="Durum" value={health ? 'Online' : 'Offline'} color={health ? Colors.bullish : Colors.bearish} />
          {health && <Row label="DB" value={health.database || 'N/A'} color={health.database === 'online' ? Colors.bullish : Colors.bearish} />}
          {health && <Row label="Uptime" value={Math.floor(health.uptime / 3600) + ' saat'} />}
          {health && <Row label="Memory" value={health.memory || 'N/A'} />}
          {health?.scheduler && <Row label="Coin Sayisi" value={health.scheduler.coins?.length + ' adet'} />}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Coin Listesi ({coins.length})</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setCoinModalVisible(true)}>
            <Ionicons name="add" size={20} color={Colors.textPrimary} />
            <Text style={styles.addBtnText}>Ekle</Text>
          </TouchableOpacity>
        </View>
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Islemler</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={runCycle}>
          <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
          <Text style={styles.actionText}>Manuel Analiz Baslat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={loadStatus}>
          <Ionicons name="pulse" size={20} color={Colors.textPrimary} />
          <Text style={styles.actionText}>Durumu Kontrol Et</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.about}>Crypto Signal Analyzer v1.0{'\n'}Ozel analiz motoru ile RSI, MACD, ADX, ATR, Bollinger, multi-timeframe trend analizi.</Text>
        </View>
      </View>

      {/* Coin Ekleme Modal */}
      <Modal visible={coinModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coin Ekle</Text>
              <TouchableOpacity onPress={() => { setCoinModalVisible(false); setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Coin ara (ör: PEPE, SHIB)"
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
              />
              {searching && <ActivityIndicator size="small" color={Colors.primary} />}
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

function Row({ label, value, color }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  rowLabel: { fontSize: 14, color: Colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  actionText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  about: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  
  // Coin listesi
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  addBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  coinList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  coinChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: Colors.border },
  coinChipText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, marginTop: 16, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, color: Colors.textPrimary, fontSize: 16 },
  searchList: { marginTop: 16 },
  searchItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  searchItemDisabled: { opacity: 0.5 },
  searchSymbol: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  addedText: { fontSize: 14, color: Colors.textMuted },
  emptyText: { textAlign: 'center', color: Colors.textMuted, paddingVertical: 20 },
});