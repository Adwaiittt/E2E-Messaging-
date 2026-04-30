import React, { useEffect, useState } from 'react'
import { Search, Wifi, WifiOff } from 'lucide-react'
import { useContactsStore, Contact } from '../../store/contactsStore'
import PeerAvatar from '../components/PeerAvatar'

interface Props { onOpenChat: (c: Contact) => void }

export default function ChatListScreen({ onOpenChat }: Props) {
  const { contacts, discoveredPeers, load } = useContactsStore()
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  const filtered = contacts.filter(c =>
    c.display_name.toLowerCase().includes(search.toLowerCase()) ||
    c.fingerprint.includes(search)
  )

  function formatTime(ts: number) {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const unpaired = discoveredPeers.filter(p => !p.trusted && !contacts.find(c => c.fingerprint === p.id))

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-lg font-semibold mb-3">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 outline-none focus:bg-white/8 transition-all border border-white/5 focus:border-white/10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && unpaired.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Wifi className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm">No contacts yet. Use <strong className="text-gray-400">Add</strong> to pair with nearby devices.</p>
          </div>
        )}

        {/* Paired contacts */}
        {filtered.map(contact => (
          <button
            key={contact.id}
            onClick={() => onOpenChat(contact)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/3 no-drag animate-slideIn"
          >
            <div className="relative">
              <PeerAvatar fingerprint={contact.fingerprint} name={contact.display_name} size={44} />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-900 status-online" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex justify-between items-baseline">
                <span className="font-medium text-sm truncate">{contact.display_name}</span>
                {contact.lastMessage && (
                  <span className="text-xs text-gray-600 flex-shrink-0 ml-2">{formatTime(contact.lastMessage.timestamp)}</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500 truncate">
                  {contact.lastMessage?.plaintext ?? <span className="italic text-gray-600">No messages yet</span>}
                </p>
                {contact.unread ? (
                  <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center">
                    {contact.unread}
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        ))}

        {/* Nearby unpaired */}
        {unpaired.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs text-gray-600 uppercase tracking-wider font-medium flex items-center gap-1.5">
              <Wifi className="w-3 h-3" /> Nearby — not paired
            </p>
          </div>
        )}
        {unpaired.map(peer => (
          <div key={peer.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/3 opacity-60">
            <PeerAvatar fingerprint={peer.id} name="?" size={44} />
            <div className="flex-1">
              <p className="text-sm font-medium">Unknown Device</p>
              <p className="text-xs text-gray-600 font-mono">{peer.id.slice(0, 16)}…</p>
            </div>
            <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-lg">Tap to pair</span>
          </div>
        ))}
      </div>
    </div>
  )
}
