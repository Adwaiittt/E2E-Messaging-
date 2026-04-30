import React, { useState } from 'react'
import { Shield, Lock, User, ChevronRight, ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

type Step = 'welcome' | 'name' | 'pin' | 'confirm'

export default function SetupScreen() {
  const { setSetupComplete, setUnlocked } = useAppStore()
  const [step, setStep] = useState<Step>('welcome')
  const [displayName, setDisplayName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFinish() {
    if (pin !== confirmPin) { setError('PINs do not match'); return }
    if (pin.length < 4) { setError('PIN must be at least 4 characters'); return }
    setLoading(true)
    try {
      const res = await window.electronAPI.completeSetup(pin, displayName || 'Anonymous')
      if (res.ok) {
        setSetupComplete(true)
        setUnlocked(true)
        await useAppStore.getState().loadIdentity()
        await useAppStore.getState().loadSettings()
      } else {
        setError(res.error ?? 'Setup failed')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-surface-950 flex items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        {step === 'welcome' && (
          <div className="animate-fadeIn text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center glow-green">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-3 text-glow">Welcome to LanMsg</h1>
            <p className="text-gray-400 leading-relaxed mb-2">
              A fully private, end-to-end encrypted messenger that works entirely on your local network.
            </p>
            <div className="glass rounded-2xl p-5 mt-6 text-left space-y-3 mb-8">
              {[
                ['🔑', 'No account created', 'Your identity is a cryptographic key on this device only.'],
                ['🚫', 'Zero servers', 'Messages never touch any server. Peer-to-peer only.'],
                ['🔒', 'End-to-end encrypted', 'Double Ratchet encryption. Only you and your contact can read.'],
              ].map(([icon, title, desc]) => (
                <div key={title} className="flex gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep('name')}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 hover-lift"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="animate-fadeIn">
            <button onClick={() => setStep('welcome')} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center mb-6">
              <User className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Your Display Name</h2>
            <p className="text-gray-400 text-sm mb-6">This is shown to contacts. You can change it later.</p>
            <input
              type="text"
              placeholder="e.g. Alice"
              maxLength={32}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all mb-4"
              autoFocus
            />
            <button
              onClick={() => setStep('pin')}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'pin' && (
          <div className="animate-fadeIn">
            <button onClick={() => setStep('name')} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Create a PIN</h2>
            <p className="text-gray-400 text-sm mb-6">
              This PIN encrypts your identity and messages. <strong className="text-white">If you forget it, you cannot recover your data.</strong>
            </p>
            <div className="relative mb-4">
              <input
                type={showPin ? 'text' : 'password'}
                placeholder="Enter PIN (min 4 chars)"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all pr-12"
                autoFocus
              />
              <button onClick={() => setShowPin(!showPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 no-drag">
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => { if (pin.length >= 4) { setError(''); setStep('confirm') } else setError('PIN must be at least 4 characters') }}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="animate-fadeIn">
            <button onClick={() => { setError(''); setStep('pin') }} disabled={loading} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 disabled:opacity-30 text-sm mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Confirm PIN</h2>
            <p className="text-gray-400 text-sm mb-6">Enter your PIN again to confirm.</p>
            <input
              type="password"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFinish()}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all mb-2"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={handleFinish}
              disabled={loading}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Create Identity'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
