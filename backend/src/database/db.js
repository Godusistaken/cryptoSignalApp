const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

const dbPath = path.join(__dirname, '../../data/signals.db');

// data klasoru yoksa olustur
const fs = require('fs');
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// WAL mode - daha hizli
db.pragma('journal_mode = WAL');

// Tablolari olustur
db.exec(`
  CREATE TABLE IF NOT EXISTS coins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT UNIQUE NOT NULL,
    name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT DEFAULT '1h',
    signal_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    current_price REAL NOT NULL,
    open_price REAL,
    high_price REAL,
    low_price REAL,
    volume REAL,
    rsi REAL,
    rsi_signal TEXT,
    macd_line REAL,
    macd_signal_line REAL,
    macd_histogram REAL,
    macd_crossover TEXT,
    ema_200 REAL,
    price_vs_ema200 TEXT,
    ema_200_distance REAL,
    adx REAL,
    plus_di REAL,
    minus_di REAL,
    adx_signal TEXT,
    atr REAL,
    atr_percent REAL,
    volume_ratio REAL,
    volume_signal TEXT,
    bb_upper REAL,
    bb_middle REAL,
    bb_lower REAL,
    bb_position REAL,
    bb_signal TEXT,
    trend_1h TEXT,
    trend_4h TEXT,
    trend_alignment TEXT,
    buy_score INTEGER DEFAULT 0,
    sell_score INTEGER DEFAULT 0,
    bonus_score INTEGER DEFAULT 0,
    raw_score INTEGER DEFAULT 0,
    veto_reason TEXT,
    market_regime TEXT,
    stop_loss REAL,
    take_profit_1 REAL,
    take_profit_2 REAL,
    take_profit_3 REAL,
    risk_reward_ratio REAL,
    analysis_notes TEXT,
    analyzed_at TEXT,
    candle_timestamp INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS signal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER,
    symbol TEXT NOT NULL,
    timeframe TEXT DEFAULT '1h',
    signal_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    current_price REAL NOT NULL,
    rsi REAL,
    macd_histogram REAL,
    adx REAL,
    volume_ratio REAL,
    bb_position REAL,
    trend_1h TEXT,
    trend_4h TEXT,
    stop_loss REAL,
    take_profit_1 REAL,
    take_profit_2 REAL,
    take_profit_3 REAL,
    buy_score INTEGER,
    sell_score INTEGER,
    bonus_score INTEGER,
    raw_score INTEGER,
    veto_reason TEXT,
    market_regime TEXT,
    direction TEXT,
    entry_price REAL,
    status TEXT DEFAULT 'OPEN',
    resolved_at TEXT,
    ambiguous_resolution INTEGER DEFAULT 0,
    last_checked_candle_time INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
  CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at);
  CREATE INDEX IF NOT EXISTS idx_history_symbol ON signal_history(symbol);
  CREATE INDEX IF NOT EXISTS idx_history_created ON signal_history(created_at);
`);

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

ensureColumn('signal_history', 'direction', 'TEXT');
ensureColumn('signal_history', 'entry_price', 'REAL');
ensureColumn('signal_history', 'status', "TEXT DEFAULT 'OPEN'");
ensureColumn('signal_history', 'resolved_at', 'TEXT');
ensureColumn('signal_history', 'raw_score', 'INTEGER');
ensureColumn('signal_history', 'veto_reason', 'TEXT');
ensureColumn('signal_history', 'market_regime', 'TEXT');
ensureColumn('signal_history', 'ambiguous_resolution', 'INTEGER DEFAULT 0');
ensureColumn('signal_history', 'last_checked_candle_time', 'INTEGER');
ensureColumn('signals', 'veto_reason', 'TEXT');
ensureColumn('signals', 'market_regime', 'TEXT');
ensureColumn('signals', 'analyzed_at', 'TEXT');
ensureColumn('signals', 'candle_timestamp', 'INTEGER');

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_history_status ON signal_history(status);
`);

db.exec(`
  UPDATE signal_history
  SET status = 'OPEN'
  WHERE status IS NULL;

  UPDATE signal_history
  SET entry_price = current_price
  WHERE entry_price IS NULL;

  UPDATE signal_history
  SET direction = CASE
    WHEN signal_type LIKE '%BUY%' THEN 'BUY'
    WHEN signal_type LIKE '%SELL%' THEN 'SELL'
    ELSE 'NEUTRAL'
  END
  WHERE direction IS NULL;
`);

// Varsayilan coinleri ekle
const defaultCoins = [
  ['BTC/USDT', 'Bitcoin'], ['ETH/USDT', 'Ethereum'],
  ['BNB/USDT', 'BNB'], ['SOL/USDT', 'Solana'],
  ['XRP/USDT', 'Ripple'], ['ADA/USDT', 'Cardano'],
  ['AVAX/USDT', 'Avalanche'], ['DOGE/USDT', 'Dogecoin'],
  ['DOT/USDT', 'Polkadot'], ['LINK/USDT', 'Chainlink'],
  ['UNI/USDT', 'Uniswap'], ['LTC/USDT', 'Litecoin'],
];

const insertCoin = db.prepare('INSERT OR IGNORE INTO coins (symbol, name) VALUES (?, ?)');
for (const [symbol, name] of defaultCoins) {
  insertCoin.run(symbol, name);
}

logger.info('Veritabani hazir (SQLite)');

module.exports = db;
