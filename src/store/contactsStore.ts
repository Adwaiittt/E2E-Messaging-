import { create } from 'zustand'

export interface Contact {
  id: string
  display_name: string
  public_key: string  // hex in renderer
  fingerprint: string
  paired_at: number
  lastMessage?: any
  unread?: number
}

export interface DiscoveredPeer {
  id: string
  ip: string
  port: number
  publicKeyHex: string
  trusted: boolean
  lastSeen: number
}

interface ContactsState {
  contacts: Contact[]
  discoveredPeers: DiscoveredPeer[]
  loading: boolean
  load: () => Promise<void>
  addContact: (c: Contact) => void
  removeContact: (id: string) => Promise<void>
  updateContact: (id: string, patch: Partial<Contact>) => void
  addDiscoveredPeer: (p: DiscoveredPeer) => void
  removeDiscoveredPeer: (id: string) => void
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  discoveredPeers: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const contacts = await window.electronAPI.getContacts()
    set({ contacts, loading: false })
  },

  addContact: (c) => {
    set(s => ({ contacts: [...s.contacts.filter(x => x.id !== c.id), c] }))
  },

  removeContact: async (id) => {
    await window.electronAPI.deleteContact(id)
    set(s => ({ contacts: s.contacts.filter(c => c.id !== id) }))
  },

  updateContact: (id, patch) => {
    set(s => ({
      contacts: s.contacts.map(c => c.id === id ? { ...c, ...patch } : c)
    }))
  },

  addDiscoveredPeer: (p) => {
    set(s => ({
      discoveredPeers: [...s.discoveredPeers.filter(x => x.id !== p.id), p]
    }))
  },

  removeDiscoveredPeer: (id) => {
    set(s => ({ discoveredPeers: s.discoveredPeers.filter(p => p.id !== id) }))
  }
}))
