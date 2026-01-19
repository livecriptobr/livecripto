'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface UserLinksProps {
  username: string
  overlayToken: string
}

export function UserLinks({ username, overlayToken }: UserLinksProps) {
  const [copiedDonate, setCopiedDonate] = useState(false)
  const [copiedOverlay, setCopiedOverlay] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const donateUrl = `${appUrl}/${username}`
  const overlayUrl = `${appUrl}/overlay/${username}?token=${overlayToken}`

  const copyToClipboard = async (text: string, type: 'donate' | 'overlay') => {
    await navigator.clipboard.writeText(text)
    if (type === 'donate') {
      setCopiedDonate(true)
      setTimeout(() => setCopiedDonate(false), 2000)
    } else {
      setCopiedOverlay(true)
      setTimeout(() => setCopiedOverlay(false), 2000)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">Link de doacao</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-zinc-800 px-4 py-2 rounded-lg text-purple-400 text-sm truncate">
            {donateUrl}
          </code>
          <button
            onClick={() => copyToClipboard(donateUrl, 'donate')}
            className="bg-purple-600 hover:bg-purple-700 p-2 rounded-lg transition-colors"
          >
            {copiedDonate ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-300 mb-2">URL do Overlay</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-zinc-800 px-4 py-2 rounded-lg text-green-400 text-sm truncate">
            {overlayUrl}
          </code>
          <button
            onClick={() => copyToClipboard(overlayUrl, 'overlay')}
            className="bg-green-600 hover:bg-green-700 p-2 rounded-lg transition-colors"
          >
            {copiedOverlay ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Adicione como Browser Source no OBS (800x600)
        </p>
      </div>
    </div>
  )
}
