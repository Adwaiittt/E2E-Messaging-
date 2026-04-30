import React, { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { useContactsStore } from '../../store/contactsStore'
import { useMessagesStore } from '../../store/messagesStore'
import SetupScreen from './SetupScreen'
import UnlockScreen from './UnlockScreen'
import MainLayout from './MainLayout'

export default function App() {
  const { isSetupComplete, isUnlocked, setSetupComplete, setUnlocked } = useAppStore()
  const { addDiscoveredPeer, removeDiscoveredPeer } = useContactsStore()
  const { receiveMessage } = useMessagesStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    window.electronAPI.isSetupComplete().then(v => {
      setSetupComplete(v)
      setChecking(false)
    })
  }, [])

  useEffect(() => {
    if (!isUnlocked) return

    // Subscribe to real-time events
    const unsubs = [
      window.electronAPI.onIncomingMessage((msg) => receiveMessage(msg)),
      window.electronAPI.onPeerFound((peer) => addDiscoveredPeer(peer)),
      window.electronAPI.onPeerLost((peer) => removeDiscoveredPeer(peer.id))
    ]
    return () => unsubs.forEach(fn => fn())
  }, [isUnlocked])

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-950">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isSetupComplete) return <SetupScreen />
  if (!isUnlocked) return <UnlockScreen />
  return <MainLayout />
}
