import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff } from 'lucide-react'

interface Props {
  onScan: (data: string) => void
}

export default function QRCodeScanner({ onScan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const id = 'qr-scanner-' + Date.now()
    if (!containerRef.current) return

    const div = document.createElement('div')
    div.id = id
    containerRef.current.appendChild(div)

    const scanner = new Html5Qrcode(id)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decoded) => {
        setStarted(false)
        scanner.stop().then(() => onScan(decoded)).catch(() => onScan(decoded))
      },
      () => {}
    ).then(() => setStarted(true))
     .catch((e: any) => setError(e.message ?? 'Camera error'))

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CameraOff className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-sm text-gray-500">{error}</p>
        <p className="text-xs text-gray-600 mt-2">Use manual entry below</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-black relative" style={{ minHeight: 260 }}>
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera className="w-8 h-8 text-gray-600 animate-pulse" />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}
