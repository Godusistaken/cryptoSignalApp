import api from '../config/api';

const AIService = {
  async chat(message) {
    const res = await api.post('/ai/chat', { message });
    return res.data;
  },

  async interpretSignal(symbol) {
    const formatted = symbol.replace('/', '-');
    const res = await api.post('/ai/interpret/' + formatted);
    return res.data;
  },
};

export default AIService;
