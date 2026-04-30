import React from 'react'
import { Message } from '../../store/messagesStore'
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react'

interface Props {
  message: Message
  isLast: boolean
}

function StatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'sent') return <Clock className="w-3 h-3 text-gray-600" />
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-gray-500" />
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-brand-400" />
  if (status === 'failed') return <AlertCircle className="w-3 h-3 text-red-500" />
  return null
}

export default function MessageBubble({ message, isLast }: Props) {
  const isSent = message.direction === 'sent'
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex mb-1 animate-fadeIn ${isSent ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] px-4 py-2.5 ${isSent ? 'bubble-sent' : 'bubble-recv'}`}>
        <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
          {message.plaintext ?? <span className="italic text-gray-500">[encrypted]</span>}
        </p>
        <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-gray-600">{time}</span>
          {isSent && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}
