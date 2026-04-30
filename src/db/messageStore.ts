import { dbRun, dbAll, dbGet } from './database'
import { v4 as uuidv4 } from 'uuid'

export interface Message {
  id: string
  contact_id: string
  direction: 'sent' | 'received'
  ciphertext: string  // hex
  plaintext: string | null
  timestamp: number
  status: 'sent' | 'delivered' | 'read' | 'failed'
  expires_at: number | null
}

export function saveMessage(msg: Omit<Message, 'id'> & { id?: string }): Message {
  const m: Message = { ...msg, id: msg.id ?? uuidv4() }
  dbRun(
    `INSERT OR REPLACE INTO messages
     (id, contact_id, direction, ciphertext, plaintext, timestamp, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.id, m.contact_id, m.direction, m.ciphertext, m.plaintext, m.timestamp, m.status, m.expires_at]
  )
  return m
}

export function getMessages(contactId: string, limit = 100): Message[] {
  const rows = dbAll(
    `SELECT * FROM messages WHERE contact_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [contactId, limit]
  )
  return rows.reverse() as Message[]
}

export function getLastMessage(contactId: string): Message | null {
  return dbGet(
    `SELECT * FROM messages WHERE contact_id = ? ORDER BY timestamp DESC LIMIT 1`,
    [contactId]
  )
}

export function updateMessageStatus(id: string, status: string): void {
  dbRun('UPDATE messages SET status = ? WHERE id = ?', [status, id])
}

export function deleteExpiredMessages(): void {
  dbRun('DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < ?', [Date.now()])
}

export function getUnreadCount(contactId: string): number {
  const row = dbGet(
    "SELECT COUNT(*) as cnt FROM messages WHERE contact_id = ? AND direction = 'received' AND status != 'read'",
    [contactId]
  )
  return (row?.cnt as number) ?? 0
}

export function saveRatchetState(contactId: string, stateBlob: string): void {
  dbRun(
    `INSERT OR REPLACE INTO ratchet_state (contact_id, state_blob, updated_at) VALUES (?, ?, ?)`,
    [contactId, stateBlob, Date.now()]
  )
}

export function getRatchetState(contactId: string): string | null {
  const row = dbGet('SELECT state_blob FROM ratchet_state WHERE contact_id = ?', [contactId])
  return row?.state_blob ?? null
}

export function getSetting(key: string): string | null {
  const row = dbGet('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  dbRun('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}
