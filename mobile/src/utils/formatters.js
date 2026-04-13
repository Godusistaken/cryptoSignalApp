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
  
  // timestamp string değilse stringe çevir
  const ts = String(timestamp);
  
  const now = new Date();
  let then;
  
  // Backend UTC zamanı gönderiyor, parse ederken bunu dikkate al
  if (ts.includes('T') || ts.includes('Z')) {
    then = new Date(ts);
  } else {
    // SQLite datetime formatı: "2024-01-15 14:30:45" (UTC)
    then = new Date(ts + 'Z');
  }
  
  // Geçersiz tarih kontrolü
  if (isNaN(then.getTime())) return '';
  
  const diff = Math.floor((now - then) / 60000); // dakika cinsinden
  
  if (diff < 0) return 'az once'; // gelecek zaman (saat farkı durumunda)
  if (diff < 1) return 'az once';
  if (diff < 60) return diff + ' dk once';
  if (diff < 1440) return Math.floor(diff / 60) + ' sa once';
  return Math.floor(diff / 1440) + ' gun once';
};

export const getSignalEmoji = (type) => {
  const map = {
    STRONG_BUY: '🟢', BUY: '🟢', WEAK_BUY: '🟡',
    STRONG_SELL: '🔴', SELL: '🔴', WEAK_SELL: '🟠',
    WAIT: '⚪',
  };
  return map[type] || '⚪';
};