import React, { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface Props {
  data: string
  size?: number
}

export default function QRCodeDisplay({ data, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !data) return
    QRCode.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 2,
      color: { dark: '#22c55e', light: '#0d1a10' }
    }).catch(console.error)
  }, [data, size])

  return (
    <div className="rounded-xl overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  )
}
