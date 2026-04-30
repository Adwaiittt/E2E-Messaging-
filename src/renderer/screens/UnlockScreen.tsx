import React, { useState } from 'react'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useContactsStore } from '../../store/contactsStore'

export default function UnlockScreen() {
  const { setUnlocked, loadSettings, loadIdentity } = useAppStore()
  const { load: loadContacts } = useContactsStore()
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUnlock() {
    if (!pin) return
    setLoading(true)
    setError('')
    try {
      const ok = await window.electronAPI.verifyPin(pin)
      if (ok) {
        setUnlocked(true)
        await Promise.all([loadSettings(), loadIdentity(), loadContacts()])
      } else {
        setError('Incorrect PIN')
      }
    } catch {
      setError('Unlock failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-surface-950 flex items-center justify-center">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 w-full max-w-sm px-6 text-center animate-fadeIn">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center glow-green">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-1">LanMsg</h1>
        <p className="text-gray-500 text-sm mb-8">Enter your PIN to unlock</p>

        <div className="relative mb-4">
          <input
            type={showPin ? 'text' : 'password'}
            placeholder="PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all pr-12 text-center text-lg tracking-widest"
            autoFocus
          />
          <button onClick={() => setShowPin(!showPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 no-drag">
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={loading || !pin}
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-xl font-semibold transition-all"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'Unlock'}
        </button>
      </div>
    </div>
  )
}
