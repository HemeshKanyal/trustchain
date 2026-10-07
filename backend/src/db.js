import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  device TEXT,
  status TEXT NOT NULL,
  created_block INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS shipments_device ON shipments(device, status);

CREATE TABLE IF NOT EXISTS chain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block INTEGER NOT NULL,
  log_index INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  contract TEXT NOT NULL,
  name TEXT NOT NULL,
  batch_id INTEGER,
  shipment_id INTEGER,
  args TEXT NOT NULL,
  timestamp INTEGER,
  UNIQUE (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS chain_events_batch ON chain_events(batch_id);
CREATE INDEX IF NOT EXISTS chain_events_shipment ON chain_events(shipment_id);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL,
  device TEXT NOT NULL,
  seq INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  window_end INTEGER NOT NULL,
  readings INTEGER NOT NULL,
  min_temp_x10 INTEGER NOT NULL,
  max_temp_x10 INTEGER NOT NULL,
  max_humidity_x10 INTEGER NOT NULL,
  lat_e6 INTEGER NOT NULL,
  lon_e6 INTEGER NOT NULL,
  tamper INTEGER NOT NULL,
  data_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  status TEXT NOT NULL,          -- pending | confirmed | rejected | failed | stored
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  tx_hash TEXT,
  breach_flags INTEGER,
  UNIQUE (shipment_id, seq)
);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS samples (
  report_id INTEGER NOT NULL REFERENCES reports(id),
  t INTEGER NOT NULL,
  temp_x10 INTEGER,
  humidity_x10 INTEGER,
  lat_e6 INTEGER,
  lon_e6 INTEGER,
  flags INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS samples_report ON samples(report_id);

CREATE TABLE IF NOT EXISTS rfid_events (
  report_id INTEGER NOT NULL REFERENCES reports(id),
  t INTEGER NOT NULL,
  uid TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prescription_texts (
  id INTEGER PRIMARY KEY,
  iv TEXT NOT NULL,
  tag TEXT NOT NULL,
  ct TEXT NOT NULL,
  stored_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_documents (
  address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  data BLOB NOT NULL,
  uploaded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash TEXT NOT NULL,
  verdict TEXT NOT NULL,
  where_bought TEXT,
  note TEXT,
  contact TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash TEXT NOT NULL,
  verdict TEXT NOT NULL,
  visitor TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scans_code ON scans(code_hash);

CREATE TABLE IF NOT EXISTS price_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_key TEXT NOT NULL,
  product_name TEXT,
  batch_id INTEGER,
  price REAL NOT NULL,
  source TEXT NOT NULL,          -- pharmacy | public
  reporter TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS price_reports_batch ON price_reports(batch_id);

CREATE TABLE IF NOT EXISTS receive_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL,
  expected_batch INTEGER NOT NULL,
  found_batch INTEGER,
  ok INTEGER NOT NULL,
  checker TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,            -- breach | quarantine | recall | quarantine_released
  batch_id INTEGER,
  shipment_id INTEGER,
  details TEXT NOT NULL,
  tx_hash TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (type, tx_hash, batch_id, shipment_id)
);
`);

export function getMeta(key, fallback = null) {
  return db.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value ?? fallback;
}

export function setMeta(key, value) {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

export function transaction(fn) {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
