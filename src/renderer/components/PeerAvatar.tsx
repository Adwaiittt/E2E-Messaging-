import React, { useMemo } from 'react'

interface Props {
  fingerprint: string
  name: string
  size?: number
}

const COLORS = [
  ['#1a4a2e', '#22c55e'], ['#1a2a4a', '#3b82f6'], ['#3a1a4a', '#a855f7'],
  ['#4a1a2a', '#ec4899'], ['#4a3a1a', '#f59e0b'], ['#1a3a4a', '#06b6d4'],
]

export default function PeerAvatar({ fingerprint, name, size = 40 }: Props) {
  const [bg, fg] = useMemo(() => {
    const idx = parseInt(fingerprint.slice(0, 2), 16) % COLORS.length
    return COLORS[idx]
  }, [fingerprint])

  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)`,
        border: `1.5px solid ${fg}30`,
        fontSize: size * 0.38,
        color: fg,
        borderRadius: size * 0.28,
        flexShrink: 0
      }}
      className="flex items-center justify-center font-bold select-none"
    >
      {initials}
    </div>
  )
}
