import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// Aktif ngrok tüneli
// Tünel değişirse bu adresi güncellemek gerekir.
const API_BASE_URL = 'https://exception-jackknife-payback.ngrok-free.dev/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'ngrok-skip-browser-warning': '1',
  },
});

export const checkNetwork = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected;
};

api.interceptors.request.use(
  async (config) => {
    const isConnected = await checkNetwork();
    if (!isConnected) {
      return Promise.reject(new Error('Internet baglantisi yok'));
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Bir hata olustu';

    if (error.message === 'Internet baglantisi yok') {
      message = 'Internet baglantisi yok';
    } else if (error.code === 'ECONNABORTED') {
      message = 'Baglanti zaman asimina ugradi';
    } else if (error.response) {
      const status = error.response.status;
      if (status === 404) message = 'API endpoint bulunamadi';
      else if (status === 429) message = 'Cok fazla istek, biraz bekle';
      else if (status === 500) message = 'Sunucu hatasi';
      else if (error.response.data?.error?.message) {
        message = error.response.data.error.message;
      }
    } else if (error.request) {
      message = `Sunucuya ulasilamiyor (${API_BASE_URL}). ngrok tuneli ve backend acik olmali.`;
    }

    console.log('API Hata:', message);
    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;
