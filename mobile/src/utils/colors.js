export const Colors = {
  background: '#0a0e27',
  surface: '#131735',
  surfaceLight: '#1c2145',
  surfaceElevated: '#20264d',
  card: '#171c3a',
  primary: '#6c5ce7',
  primaryLight: '#a29bfe',
  primarySoft: 'rgba(108, 92, 231, 0.16)',
  strongBuy: '#00e676',
  buy: '#4caf50',
  weakBuy: '#8bc34a',
  strongSell: '#ff1744',
  sell: '#f44336',
  weakSell: '#ff5722',
  wait: '#ffc107',
  neutral: '#90a4ae',
  textPrimary: '#ffffff',
  textSecondary: '#b0b8d1',
  textMuted: '#6b7394',
  bullish: '#00e676',
  bearish: '#ff1744',
  warning: '#ffc107',
  border: '#2a2f55',
  divider: '#1e234a',
  dangerSoft: 'rgba(255, 23, 68, 0.14)',
  successSoft: 'rgba(0, 230, 118, 0.14)',
};

export const getSignalColor = (type) => {
  const map = {
    STRONG_BUY: Colors.strongBuy, BUY: Colors.buy, WEAK_BUY: Colors.weakBuy,
    STRONG_SELL: Colors.strongSell, SELL: Colors.sell, WEAK_SELL: Colors.weakSell,
    WAIT: Colors.wait,
  };
  return map[type] || Colors.neutral;
};

export const getTrendColor = (trend) => {
  if (trend === 'BULLISH') return Colors.bullish;
  if (trend === 'BEARISH') return Colors.bearish;
  return Colors.neutral;
};
