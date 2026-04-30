import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle, ChevronRight, Copy, Check, Eye, EyeOff, Globe, Wifi, WifiOff, Clock } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

export default function SettingsScreen() {
  const { identity, settings, saveSettings } = useAppStore()
  const [displayName, setDisplayName] = useState(settings.displayName)
  const [copied, setCopied] = useState(false)
  const [showPinChange, setShowPinChange] = useState(false)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [showWipeConfirm, setShowWipeConfirm] = useState(false)

  useEffect(() => {
    setDisplayName(settings.displayName)
  }, [settings.displayName])

  async function copyFingerprint() {
    if (!identity) return
    navigator.clipboard.writeText(identity.fingerprint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveDisplayName() {
    await saveSettings({ displayName })
  }

  async function changePIN() {
    const res = await window.electronAPI.changePin(oldPin, newPin)
    if (res.ok) { setPinMsg('PIN changed!'); setOldPin(''); setNewPin('') }
    else setPinMsg(res.error ?? 'Failed')
    setTimeout(() => setPinMsg(''), 3000)
  }

  async function panicWipe() {
    await window.electronAPI.panicWipe()
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">{title}</h3>
      <div className="glass rounded-2xl overflow-hidden">{children}</div>
    </div>
  )

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full transition-all no-drag ${value ? 'bg-brand-500' : 'bg-white/15'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full transition-all mx-1 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )

  const disappearOptions = [
    { label: 'Off', value: 0 },
    { label: '5 min', value: 300 },
    { label: '1 hour', value: 3600 },
    { label: '24 hours', value: 86400 },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <h2 className="text-lg font-semibold mb-5">Settings</h2>

      <Section title="Identity">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onBlur={saveDisplayName}
                className="bg-transparent font-semibold text-sm outline-none border-b border-transparent focus:border-brand-500/50 transition-all no-drag"
              />
              <p className="text-xs text-gray-500">Display name</p>
            </div>
          </div>
          {identity && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Fingerprint</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-brand-400 flex-1 break-all">{identity.fingerprint}</code>
                <button onClick={copyFingerprint} className="no-drag p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-200 transition-all">
                  {copied ? <Check className="w-4 h-4 text-brand-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Public Key</p>
                <code className="text-xs font-mono text-gray-600 break-all block">{identity.publicKey}</code>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Network">
        <Row label="LAN-only mode">
          <Toggle value={settings.lanOnly} onChange={v => saveSettings({ lanOnly: v })} />
        </Row>
        {!settings.lanOnly && (
          <>
            <div className="px-4 py-3 border-b border-white/5">
              <label className="text-xs text-gray-500 block mb-1">STUN Server</label>
              <input
                defaultValue={settings.stunServer}
                onBlur={e => saveSettings({ stunServer: e.target.value })}
                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs font-mono text-gray-300 outline-none focus:ring-1 focus:ring-brand-500/30 no-drag"
              />
            </div>
            <div className="px-4 py-3">
              <label className="text-xs text-gray-500 block mb-2">TURN Server (optional)</label>
              {[
                { label: 'URL', key: 'turnUrl', val: settings.turnUrl },
                { label: 'Username', key: 'turnUser', val: settings.turnUser },
                { label: 'Credential', key: 'turnCred', val: settings.turnCred },
              ].map(f => (
                <div key={f.key} className="mb-2">
                  <label className="text-xs text-gray-600 block mb-0.5">{f.label}</label>
                  <input
                    defaultValue={f.val}
                    onBlur={e => saveSettings({ [f.key]: e.target.value })}
                    className="w-full bg-white/5 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-brand-500/30 no-drag"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Privacy">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Disappearing messages</p>
          <div className="flex gap-2 flex-wrap">
            {disappearOptions.map(o => (
              <button key={o.value} onClick={() => saveSettings({ disappearAfter: o.value })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all no-drag ${settings.disappearAfter === o.value ? 'bg-brand-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <Row label="Change PIN">
          <button onClick={() => setShowPinChange(!showPinChange)} className="no-drag p-1 text-gray-500 hover:text-gray-200">
            <ChevronRight className={`w-4 h-4 transition-transform ${showPinChange ? 'rotate-90' : ''}`} />
          </button>
        </Row>
        {showPinChange && (
          <div className="px-4 pb-4 space-y-2">
            {[
              { label: 'Current PIN', value: oldPin, set: setOldPin },
              { label: 'New PIN', value: newPin, set: setNewPin },
            ].map(f => (
              <input key={f.label} type="password" placeholder={f.label} value={f.value} onChange={e => f.set(e.target.value)}
                className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand-500/30 no-drag" />
            ))}
            {pinMsg && <p className={`text-xs ${pinMsg.includes('!') ? 'text-brand-400' : 'text-red-400'}`}>{pinMsg}</p>}
            <button onClick={changePIN} className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-medium transition-all no-drag">
              Update PIN
            </button>
          </div>
        )}
      </Section>

      <Section title="Danger Zone">
        {!showWipeConfirm ? (
          <button
            onClick={() => setShowWipeConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-red-500/10 transition-all no-drag"
          >
            <AlertTriangle className="w-5 h-5" />
            <div className="text-left">
              <p className="font-medium text-sm">Panic Wipe</p>
              <p className="text-xs text-red-500/70">Permanently delete all data and quit</p>
            </div>
          </button>
        ) : (
          <div className="px-4 py-4">
            <p className="text-sm text-red-400 mb-3 font-medium">⚠️ This cannot be undone. All keys, messages, and contacts will be destroyed.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowWipeConfirm(false)} className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm no-drag">Cancel</button>
              <button onClick={panicWipe} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold text-white transition-all no-drag">WIPE</button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}
