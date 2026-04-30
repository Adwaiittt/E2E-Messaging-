import { getDatabase, persistDatabase } from './database'

export function runMigrations(): void {
  const db = getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id          TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      public_key  TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      paired_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      contact_id  TEXT NOT NULL,
      direction   TEXT NOT NULL,
      ciphertext  TEXT NOT NULL,
      plaintext   TEXT,
      timestamp   INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'sent',
      expires_at  INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id, timestamp);

    CREATE TABLE IF NOT EXISTS ratchet_state (
      contact_id  TEXT PRIMARY KEY,
      state_blob  TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  persistDatabase()
}
