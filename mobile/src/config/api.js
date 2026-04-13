import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// BURAYA KENDİ IP ADRESİNİ YAZ!
// CMD'de ipconfig yaz, IPv4 Address'i bul
// Ornek: 192.168.1.42
const API_BASE_URL = 'http://192.168.1.101:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Network durumunu kontrol et
export const checkNetwork = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected;
};

// Request interceptor - network kontrolü
api.interceptors.request.use(
  async (config) => {
    const isConnected = await checkNetwork();
    if (!isConnected) {
      return Promise.reject(new Error('İnternet bağlantısı yok'));
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - hata yönetimi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Bir hata oluştu';
    
    if (error.message === 'İnternet bağlantısı yok') {
      message = 'İnternet bağlantısı yok';
    } else if (error.code === 'ECONNABORTED') {
      message = 'Bağlantı zaman aşımına uğradı';
    } else if (error.response) {
      // Server yanıt verdi ama hata kodu
      const status = error.response.status;
      if (status === 404) message = 'Bulunamadı';
      else if (status === 429) message = 'Çok fazla istek, biraz bekle';
      else if (status === 500) message = 'Sunucu hatası';
      else if (error.response.data?.error?.message) {
        message = error.response.data.error.message;
      }
    } else if (error.request) {
      // İstek yapıldı ama yanıt yok
      message = 'Sunucuya ulaşılamıyor';
    }
    
    console.log('API Hata:', message);
    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;