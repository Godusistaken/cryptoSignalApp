function normalizeInputSymbol(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s+/g, '').replace(/-/g, '/');
  if (!/^[A-Z0-9]+(\/[A-Z0-9]+)?$/.test(compact)) return null;

  if (compact.includes('/')) return compact;
  if (compact.endsWith('USDT') && compact.length > 4) {
    return `${compact.slice(0, -4)}/USDT`;
  }

  return `${compact}/USDT`;
}

function toPathSymbol(input) {
  const normalized = normalizeInputSymbol(input);
  return normalized ? encodeURIComponent(normalized) : null;
}

function toDisplaySymbol(input) {
  const normalized = normalizeInputSymbol(input);
  return normalized || (input || '').toString().toUpperCase();
}

function symbolBase(input) {
  const normalized = normalizeInputSymbol(input);
  return normalized ? normalized.replace('/USDT', '') : '';
}

module.exports = {
  normalizeInputSymbol,
  toPathSymbol,
  toDisplaySymbol,
  symbolBase,
};
