export const formatPrice = (price) => {
  if (!price && price !== 0) return '-';
  const num = parseFloat(price);
  if (num >= 1000) return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return '$' + num.toFixed(4);
  return '$' + num.toFixed(6);
};

export const formatNumber = (value, decimals = 2) => {
  if (!value && value !== 0) return '-';
  return parseFloat(value).toFixed(decimals);
};

export const formatPercent = (value) => {
  if (!value && value !== 0) return '-';
  return parseFloat(value).toFixed(2) + '%';
};

export const getSymbolShort = (symbol) => {
  return (symbol || '').replace('/USDT', '').replace('USDT', '');
};

export const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';

  const ts = String(timestamp);
  const now = new Date();
  let then;

  if (ts.includes('T') || ts.includes('Z')) {
    then = new Date(ts);
  } else {
    then = new Date(ts + 'Z');
  }

  if (isNaN(then.getTime())) return '';

  const diff = Math.floor((now - then) / 60000);

  if (diff < 0) return 'az once';
  if (diff < 1) return 'az once';
  if (diff < 60) return diff + ' dk once';
  if (diff < 1440) return Math.floor(diff / 60) + ' sa once';
  return Math.floor(diff / 1440) + ' gun once';
};

export const getSignalEmoji = (type) => {
  const map = {
    STRONG_BUY: '+', BUY: '+', WEAK_BUY: '+',
    STRONG_SELL: '-', SELL: '-', WEAK_SELL: '-',
    WAIT: '=',
  };
  return map[type] || '=';
};
