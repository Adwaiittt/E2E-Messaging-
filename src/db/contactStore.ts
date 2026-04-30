import { dbRun, dbAll, dbGet } from './database'
import { v4 as uuidv4 } from 'uuid'

export interface Contact {
  id: string
  display_name: string
  public_key: string   // hex string
  fingerprint: string
  paired_at: number
}

export function saveContact(c: Omit<Contact, 'id'> & { id?: string }): Contact {
  const contact: Contact = { ...c, id: c.id ?? uuidv4() }
  dbRun(
    `INSERT OR REPLACE INTO contacts (id, display_name, public_key, fingerprint, paired_at)
     VALUES (?, ?, ?, ?, ?)`,
    [contact.id, contact.display_name, contact.public_key, contact.fingerprint, contact.paired_at]
  )
  return contact
}

export function getContacts(): Contact[] {
  return dbAll('SELECT * FROM contacts ORDER BY display_name')
}

export function getContact(id: string): Contact | null {
  return dbGet('SELECT * FROM contacts WHERE id = ?', [id])
}

export function getContactByFingerprint(fingerprint: string): Contact | null {
  return dbGet('SELECT * FROM contacts WHERE fingerprint = ?', [fingerprint])
}

export function deleteContact(id: string): void {
  dbRun('DELETE FROM contacts WHERE id = ?', [id])
}

export function updateDisplayName(id: string, name: string): void {
  dbRun('UPDATE contacts SET display_name = ? WHERE id = ?', [name, id])
}
