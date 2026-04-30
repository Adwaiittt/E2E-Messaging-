import React, { useState, useEffect } from 'react'
import { QrCode, ScanLine, CheckCircle, X, Monitor } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useContactsStore, Contact } from '../../store/contactsStore'
import QRCodeDisplay from '../components/QRCodeDisplay'
import QRCodeScanner from '../components/QRCodeScanner'

interface Props { onPaired: (c: Contact) => void }

type Tab = 'show' | 'scan'

interface ScannedData { publicKey: string; ip: string; port: number; fingerprint: string }

export default function PeerPairingScreen({ onPaired }: Props) {
  const { identity } = useAppStore()
  const { addContact } = useContactsStore()
  const [tab, setTab] = useState<Tab>('show')
  const [localIP, setLocalIP] = useState('0.0.0.0')
  const [scanned, setScanned] = useState<ScannedData | null>(null)
  const [peerName, setPeerName] = useState('')
  const [pairing, setPairing] = useState(false)
  const [paired, setPaired] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualIp, setManualIp] = useState('')
  const [manualPort, setManualPort] = useState('54321')
  const [manualPubkey, setManualPubkey] = useState('')

  useEffect(() => {
    // Get local IP from mDNS peers or environment
    window.electronAPI.getPeers().then(peers => {
      if (peers.length > 0) setLocalIP(peers[0].ip)
    })
  }, [])

  const qrData = identity ? JSON.stringify({
    publicKey: identity.publicKey,
    fingerprint: identity.fingerprint,
    ip: localIP,
    port: 54321
  }) : ''

  function handleScanned(raw: string) {
    try {
      const data = JSON.parse(raw)
      if (!data.publicKey || !data.ip || !data.port) return
      const fingerprint = data.publicKey.slice(0, 32)
      setScanned({ ...data, fingerprint: data.fingerprint ?? fingerprint })
    } catch {}
  }

  async function confirmPairing(data: ScannedData) {
    setPairing(true)
    try {
      const contact = {
        display_name: peerName || `Peer ${data.fingerprint.slice(0, 8)}`,
        public_key: data.publicKey,
        fingerprint: data.fingerprint,
        paired_at: Date.now()
      }
      const saved = await window.electronAPI.saveContact(contact)
      addContact(saved)

      // Connect via TCP
      await window.electronAPI.connectToPeer(saved.id, data.ip, data.port)

      setPaired(true)
      setTimeout(() => onPaired(saved), 1500)
    } finally {
      setPairing(false)
    }
  }

  async function handleManualPair() {
    if (!manualIp || !manualPubkey) return
    const fp = manualPubkey.slice(0, 32)
    const data: ScannedData = { publicKey: manualPubkey, ip: manualIp, port: parseInt(manualPort), fingerprint: fp }
    setScanned(data)
    setManualMode(false)
  }

  if (paired) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 animate-fadeIn">
        <CheckCircle className="w-16 h-16 text-brand-500 mb-4" />
        <h3 className="text-xl font-bold">Paired!</h3>
        <p className="text-gray-400 text-sm mt-2">Opening chat…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 h-full overflow-y-auto">
      <div className="px-6 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-lg font-semibold mb-4">Pair with a Device</h2>
        <div className="flex bg-white/5 rounded-xl p-1">
          {(['show', 'scan'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all no-drag ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {t === 'show' ? '📲 Show My QR' : '📷 Scan QR'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-6">
        {tab === 'show' && identity && (
          <div className="animate-fadeIn flex flex-col items-center">
            <p className="text-sm text-gray-400 mb-4 text-center">Have the other device scan this QR code</p>
            <div className="glass rounded-2xl p-4 mb-4">
              <QRCodeDisplay data={qrData} size={220} />
            </div>
            <p className="text-xs text-gray-500 mb-1">Your identity fingerprint:</p>
            <div className="glass rounded-xl px-4 py-2 font-mono text-xs text-brand-400 break-all text-center">
              {identity.fingerprint}
            </div>
            <p className="text-xs text-gray-600 mt-3 text-center">Verbally verify this fingerprint with your contact</p>
          </div>
        )}

        {tab === 'scan' && !scanned && !manualMode && (
          <div className="animate-fadeIn">
            <p className="text-sm text-gray-400 mb-4 text-center">Point camera at the other device's QR code</p>
            <QRCodeScanner onScan={handleScanned} />
            <button onClick={() => setManualMode(true)} className="mt-4 w-full py-2.5 text-sm text-gray-400 hover:text-gray-200 border border-white/10 rounded-xl transition-all no-drag">
              <Monitor className="w-4 h-4 inline mr-2" />Enter IP manually
            </button>
          </div>
        )}

        {tab === 'scan' && manualMode && (
          <div className="animate-fadeIn space-y-3">
            <h3 className="font-medium mb-4">Manual Entry</h3>
            {[
              { label: 'IP Address', value: manualIp, set: setManualIp, placeholder: '192.168.1.x' },
              { label: 'Port', value: manualPort, set: setManualPort, placeholder: '54321' },
              { label: 'Public Key (hex)', value: manualPubkey, set: setManualPubkey, placeholder: '64-char hex' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500/50 transition-all no-drag" />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setManualMode(false)} className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm text-gray-400 no-drag">Cancel</button>
              <button onClick={handleManualPair} className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-medium transition-all no-drag">Connect</button>
            </div>
          </div>
        )}

        {scanned && (
          <div className="animate-fadeIn">
            <div className="glass rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-brand-500" />
                <h3 className="font-semibold">Device Found</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">IP</span>
                  <span className="text-xs font-mono">{scanned.ip}:{scanned.port}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Fingerprint — verbally verify:</span>
                  <div className="bg-white/5 rounded-lg p-2 font-mono text-xs text-brand-400 break-all">{scanned.fingerprint}</div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Contact name</label>
              <input
                value={peerName}
                onChange={e => setPeerName(e.target.value)}
                placeholder="Enter a name for this contact"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-500/50 transition-all no-drag"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setScanned(null)} className="flex-1 py-3 border border-white/10 rounded-xl text-sm text-gray-400 no-drag">
                <X className="w-4 h-4 inline mr-1" />Cancel
              </button>
              <button onClick={() => confirmPairing(scanned)} disabled={pairing}
                className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-all no-drag">
                {pairing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : '✓ Trust & Connect'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
