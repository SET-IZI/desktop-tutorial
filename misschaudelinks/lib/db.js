// Base de données SQLite (module natif node:sqlite — aucune dépendance native à compiler)
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'public'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'private'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'misschaudelinks.db'));
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  adult INTEGER DEFAULT 0,
  highlight INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  position INTEGER DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  kind TEXT NOT NULL,               -- 'photo' | 'video'
  file TEXT NOT NULL,               -- fichier privé (jamais servi en statique)
  mime TEXT,
  preview TEXT,                     -- aperçu flouté public
  price_cents INTEGER NOT NULL DEFAULT 0,
  adult INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  email TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,             -- 'pending' | 'paid' | 'refunded'
  provider TEXT NOT NULL,           -- 'stripe' | 'demo'
  provider_ref TEXT,
  visitor TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,               -- view | click | media_view | checkout | purchase | age_ok | age_no
  ref_id INTEGER,
  visitor TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  referrer TEXT,
  country TEXT,
  ts INTEGER NOT NULL               -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires INTEGER NOT NULL
);
`);

const DEFAULT_SETTINGS = {
  name: 'misschaudex',
  bio: 'Bienvenue dans mon univers 💋 Tous mes liens & contenus exclusifs ici.',
  avatar: '',
  accent: '#ff2e8a',
  page_age_gate: '0',
  socials: JSON.stringify({ instagram: '', tiktok: '', x: '', snapchat: '', youtube: '' }),
  shop_title: 'Contenus exclusifs',
  shop_enabled: '1',
  admin_hash: '',
};

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  if (!getSetting.get(k)) setSettingStmt.run(k, v);
}

function settings() {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) out[row.key] = row.value;
  return out;
}
function setSetting(k, v) { setSettingStmt.run(k, String(v ?? '')); }

module.exports = { db, settings, setSetting, DATA_DIR };
