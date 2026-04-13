import api from '../config/api';

const AIService = {
  async interpretSignal(symbol) {
    const formatted = symbol.replace('/', '-');
    const res = await api.post('/ai/interpret/' + formatted);
    return res.data;
  },
};

export default AIService;