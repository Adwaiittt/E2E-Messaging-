import React, { useState, useEffect } from 'react'
import { MessageSquare, Settings, UserPlus, X, Minus, Square } from 'lucide-react'
import ChatListScreen from './ChatListScreen'
import PeerPairingScreen from './PeerPairingScreen'
import SettingsScreen from './SettingsScreen'
import ChatWindow from './ChatWindow'
import { Contact } from '../../store/contactsStore'

type Tab = 'chats' | 'pairing' | 'settings'

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [openChat, setOpenChat] = useState<Contact | null>(null)

  const tabs = [
    { id: 'chats' as Tab, icon: MessageSquare, label: 'Chats' },
    { id: 'pairing' as Tab, icon: UserPlus, label: 'Add' },
    { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
  ]

  function handleMinimize() { window.electronAPI.minimizeWindow() }
  function handleMaximize() { window.electronAPI.maximizeWindow() }
  function handleClose() { window.electronAPI.closeWindow() }

  return (
    <div className="h-screen flex flex-col bg-surface-950 overflow-hidden">
      {/* Titlebar */}
      <div className="titlebar h-8 flex items-center justify-between px-4 bg-surface-900/80 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-500 tracking-wider">LANMSG</span>
        <div className="no-drag flex gap-2">
          <button onClick={handleMinimize} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors" />
          <button onClick={handleMaximize} className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-400 transition-colors" />
          <button onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-16 bg-surface-900 border-r border-white/5 flex flex-col items-center py-4 gap-2 flex-shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setOpenChat(null) }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all no-drag ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
              title={tab.label}
            >
              <tab.icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        {/* Content pane */}
        <div className="flex flex-1 overflow-hidden">
          {openChat ? (
            <ChatWindow contact={openChat} onBack={() => setOpenChat(null)} />
          ) : (
            <>
              {activeTab === 'chats' && <ChatListScreen onOpenChat={setOpenChat} />}
              {activeTab === 'pairing' && <PeerPairingScreen onPaired={(c) => { setActiveTab('chats'); setOpenChat(c) }} />}
              {activeTab === 'settings' && <SettingsScreen />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
