'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Copy, Check, Loader2 } from 'lucide-react'

interface Props {
  data: {
    donationId: string
    qrCode?: string
    copyPaste?: string
  }
  onBack: () => void
}

export default function PixPayment({ data, onBack }: Props) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<'pending' | 'paid' | 'expired'>('pending')

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/donate/status?provider=openpix&id=${data.donationId}`)
        const result = await res.json()
        if (result.status === 'PAID') {
          setStatus('paid')
          clearInterval(interval)
        } else if (result.status === 'EXPIRED') {
          setStatus('expired')
          clearInterval(interval)
        }
      } catch (e) {
        console.error('Poll error:', e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [data.donationId])

  const handleCopy = async () => {
    if (data.copyPaste) {
      await navigator.clipboard.writeText(data.copyPaste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (status === 'paid') {
    return (
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Pagamento confirmado!</h2>
        <p className="text-zinc-400">Obrigado pela sua doacao!</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <h2 className="text-xl font-bold text-white text-center mb-6">Pagar com PIX</h2>

      {data.qrCode && (
        <div className="bg-white p-4 rounded-xl mb-6 mx-auto w-fit">
          <img src={data.qrCode} alt="QR Code PIX" className="w-48 h-48" />
        </div>
      )}

      {data.copyPaste && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Ou copie o codigo:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.copyPaste}
              readOnly
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm truncate"
            />
            <button
              onClick={handleCopy}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mt-6 text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Aguardando pagamento...</span>
      </div>
    </div>
  )
}
