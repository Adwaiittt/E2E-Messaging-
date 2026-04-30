import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, Send, Paperclip, CheckCheck, Check, Clock, AlertCircle } from 'lucide-react'
import { Contact } from '../../store/contactsStore'
import { useMessagesStore, Message } from '../../store/messagesStore'
import { useAppStore } from '../../store/appStore'
import PeerAvatar from '../components/PeerAvatar'
import MessageBubble from '../components/MessageBubble'

interface Props {
  contact: Contact
  onBack: () => void
}

export default function ChatWindow({ contact, onBack }: Props) {
  const { messages, load, send, sending } = useMessagesStore()
  const { settings } = useAppStore()
  const [text, setText] = useState('')
  const [fileProgress, setFileProgress] = useState<Record<string, number>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const msgs = messages[contact.id] ?? []

  useEffect(() => {
    load(contact.id)

    const unsubProgress = window.electronAPI.onFileProgress(({ transferId, progress }: any) => {
      setFileProgress(p => ({ ...p, [transferId]: progress }))
    })
    return () => { unsubProgress() }
  }, [contact.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  async function handleSend() {
    const t = text.trim()
    if (!t || sending) return
    setText('')
    await send(contact.id, t)
  }

  async function handleFile() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // For Electron we need the actual path
    const filePath = (file as any).path
    if (filePath) {
      await window.electronAPI.sendFile(contact.id, filePath)
    }
    e.target.value = ''
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date
  const grouped = msgs.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = new Date(msg.timestamp).toDateString()
    const last = acc[acc.length - 1]
    if (last?.date === date) last.msgs.push(msg)
    else acc.push({ date, msgs: [msg] })
    return acc
  }, [])

  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface-900/50 flex-shrink-0">
        <button onClick={onBack} className="no-drag p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <PeerAvatar fingerprint={contact.fingerprint} name={contact.display_name} size={38} />
        <div className="flex-1">
          <p className="font-semibold text-sm">{contact.display_name}</p>
          <p className="text-xs text-gray-600 font-mono">{contact.fingerprint.slice(0, 16)}…</p>
        </div>
        <div className="w-2 h-2 rounded-full status-online" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {msgs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🔒</div>
              <p className="text-gray-500 text-sm">End-to-end encrypted</p>
              <p className="text-gray-600 text-xs">Messages are encrypted with Double Ratchet</p>
            </div>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-xs text-gray-600">{new Date(group.msgs[0].timestamp).toLocaleDateString()}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            {group.msgs.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} isLast={i === group.msgs.length - 1} />
            ))}
          </div>
        ))}

        {/* File upload progress */}
        {Object.entries(fileProgress).map(([id, progress]) =>
          progress < 100 ? (
            <div key={id} className="flex justify-end">
              <div className="bubble-sent px-4 py-3 max-w-xs w-48">
                <p className="text-xs text-gray-400 mb-2">Sending file…</p>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">{Math.round(progress)}%</p>
              </div>
            </div>
          ) : null
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5 flex gap-2 items-end flex-shrink-0">
        <button
          onClick={handleFile}
          className="no-drag p-2.5 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all flex-shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all resize-none max-h-32 no-drag"
          style={{ minHeight: '42px' }}
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="no-drag p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  )
}
