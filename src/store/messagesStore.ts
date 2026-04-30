import { create } from 'zustand'

export interface Message {
  id: string
  contact_id: string
  direction: 'sent' | 'received'
  ciphertext: any
  plaintext: string | null
  timestamp: number
  status: 'sent' | 'delivered' | 'read' | 'failed'
  expires_at: number | null
}

interface MessagesState {
  messages: Record<string, Message[]>
  sending: boolean
  load: (contactId: string) => Promise<void>
  send: (contactId: string, text: string) => Promise<void>
  receiveMessage: (msg: Message) => void
  updateStatus: (id: string, status: Message['status']) => void
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: {},
  sending: false,

  load: async (contactId) => {
    const msgs = await window.electronAPI.getMessages(contactId)
    set(s => ({ messages: { ...s.messages, [contactId]: msgs } }))
  },

  send: async (contactId, text) => {
    set({ sending: true })
    try {
      const res = await window.electronAPI.sendMessage(contactId, text)
      if (res?.message) {
        set(s => ({
          messages: {
            ...s.messages,
            [contactId]: [...(s.messages[contactId] ?? []), res.message]
          }
        }))
      }
    } finally {
      set({ sending: false })
    }
  },

  receiveMessage: (msg) => {
    set(s => ({
      messages: {
        ...s.messages,
        [msg.contact_id]: [...(s.messages[msg.contact_id] ?? []), msg]
      }
    }))
  },

  updateStatus: (id, status) => {
    set(s => {
      const messages = { ...s.messages }
      for (const contactId in messages) {
        messages[contactId] = messages[contactId].map(m =>
          m.id === id ? { ...m, status } : m
        )
      }
      return { messages }
    })
  }
}))
