import api from '../config/api';

const SignalService = {
  async getAllSignals() {
    const res = await api.get('/signals');
    return res.data;
  },

  async getStats() {
    const res = await api.get('/signals/stats');
    return res.data;
  },

  async getSignal(symbol) {
    const formatted = symbol.replace('/', '-');
    const res = await api.get('/signals/' + formatted);
    return res.data;
  },

  async getHistory(symbol, limit = 50) {
    const formatted = symbol.replace('/', '-');
    const res = await api.get('/signals/history/' + formatted, { params: { limit } });
    return res.data;
  },

  async analyzeSingle(symbol) {
    const formatted = symbol.replace('/', '-');
    const res = await api.post('/signals/analyze/' + formatted);
    return res.data;
  },

  async runCycle() {
    const res = await api.post('/signals/run-cycle');
    return res.data;
  },

  async getHealth() {
    const res = await api.get('/health');
    return res.data;
  },

  // Coin yönetimi
  async getCoins() {
    const res = await api.get('/coins');
    return res.data;
  },

  async searchCoins(query) {
    const res = await api.get('/coins/search', { params: { q: query } });
    return res.data;
  },

  async addCoin(symbol, name) {
    const res = await api.post('/coins', { symbol, name });
    return res.data;
  },

  async removeCoin(symbol) {
    const formatted = symbol.replace('/', '-');
    const res = await api.delete('/coins/' + formatted);
    return res.data;
  },
};

export default SignalService;
