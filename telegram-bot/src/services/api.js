const axios = require('axios');
const { normalizeInputSymbol, toPathSymbol } = require('../utils/symbol');

function normalizeBackendBaseUrl(value) {
  const raw = (value || 'http://localhost:3000').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw.slice(0, -4) : raw;
}

function isPlaceholderApiKey(value) {
  const normalized = (value || '').trim();
  return !normalized || normalized === 'your_api_key_here';
}

const backendBaseUrl = normalizeBackendBaseUrl(process.env.BACKEND_URL);
const apiKey = process.env.API_KEY;

const client = axios.create({
  baseURL: backendBaseUrl,
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  if (!isPlaceholderApiKey(apiKey)) {
    config.headers['x-api-key'] = apiKey.trim();
  }
  return config;
});

function buildUrl(path) {
  return client.getUri({ url: path });
}

function getRequestErrorDetails(error) {
  const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
  const url = error.config ? client.getUri(error.config) : 'UNKNOWN';
  const status = error.response?.status || 'NO_RESPONSE';
  const body = error.response?.data || null;
  const code = error.code || 'NO_CODE';

  return {
    method,
    url,
    status,
    code,
    response: body,
  };
}

function logRequestError(error) {
  console.error('Backend request failed', getRequestErrorDetails(error));
}

async function request(config) {
  try {
    const response = await client.request(config);
    return response.data;
  } catch (error) {
    if (config.logErrors !== false) {
      logRequestError(error);
    }
    throw error;
  }
}

function normalizeSymbol(symbol) {
  return toPathSymbol(symbol);
}

function isBackendUnavailable(error) {
  return !error.response;
}

function isNotFound(error) {
  return error.response?.status === 404;
}

async function getHealth() {
  return request({ method: 'GET', url: '/api/health' });
}

async function getSignals(options = {}) {
  return request({ method: 'GET', url: '/api/signals', logErrors: options.logErrors });
}

function getSignalsUrl() {
  return buildUrl('/api/signals');
}

async function getSignal(symbol) {
  return request({ method: 'GET', url: `/api/signals/${normalizeSymbol(symbol)}` });
}

async function analyzeSignal(symbol) {
  return request({ method: 'POST', url: `/api/signals/analyze/${normalizeSymbol(symbol)}` });
}

async function askAi(message) {
  return request({ method: 'POST', url: '/api/ai/chat', data: { message } });
}

async function getStats() {
  return request({ method: 'GET', url: '/api/signals/stats' });
}

async function getCoins() {
  return request({ method: 'GET', url: '/api/coins' });
}

async function addCoin(symbol) {
  return request({
    method: 'POST',
    url: '/api/coins',
    data: { symbol: normalizeInputSymbol(symbol) },
  });
}

async function removeCoin(symbol) {
  return request({ method: 'DELETE', url: `/api/coins/${normalizeSymbol(symbol)}` });
}

async function debugBackend() {
  const result = {
    baseUrl: backendBaseUrl,
    healthUrl: buildUrl('/api/health'),
    signalsUrl: buildUrl('/api/signals'),
    health: null,
    signals: null,
  };

  try {
    result.health = await request({ method: 'GET', url: '/api/health' });
  } catch (error) {
    result.healthError = {
      status: error.response?.status || null,
      code: error.code || null,
      message: error.message,
      body: error.response?.data || null,
    };
  }

  try {
    result.signals = await request({ method: 'GET', url: '/api/signals' });
  } catch (error) {
    result.signalsError = {
      status: error.response?.status || null,
      code: error.code || null,
      message: error.message,
      body: error.response?.data || null,
    };
  }

  return result;
}

module.exports = {
  getHealth,
  getSignals,
  getSignal,
  analyzeSignal,
  askAi,
  getStats,
  getCoins,
  addCoin,
  removeCoin,
  debugBackend,
  isBackendUnavailable,
  isNotFound,
  normalizeSymbol,
  normalizeBackendBaseUrl,
  getRequestErrorDetails,
  getSignalsUrl,
};
