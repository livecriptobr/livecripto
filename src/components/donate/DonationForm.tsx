'use client'

import { useState } from 'react'
import { Zap, CreditCard, QrCode, Loader2 } from 'lucide-react'
import PixPayment from './PixPayment'
import LightningPayment from './LightningPayment'

interface Props {
  username: string
  displayName: string
  minAmountCents: number
}

type PaymentMethod = 'pix' | 'card' | 'lightning'
type FormState = 'form' | 'processing' | 'payment' | 'success' | 'error'

interface PaymentData {
  method: PaymentMethod
  donationId: string
  qrCode?: string
  copyPaste?: string
  invoice?: string
  redirectUrl?: string
}

export default function DonationForm({ username, displayName, minAmountCents }: Props) {
  const [amount, setAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [message, setMessage] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [state, setState] = useState<FormState>('form')
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [error, setError] = useState('')

  const amountCents = Math.round(parseFloat(amount.replace(',', '.') || '0') * 100)
  const isValid = amountCents >= minAmountCents && donorName.trim() && message.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setState('processing')
    setError('')

    try {
      const res = await fetch('/api/public/donate/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          amountCents,
          donorName: donorName.trim(),
          message: message.trim(),
          method,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar doacao')
      }

      setPaymentData(data)

      if (method === 'card' && data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        setState('payment')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      setState('error')
    }
  }

  if (state === 'payment' && paymentData) {
    if (method === 'pix') {
      return <PixPayment data={paymentData} onBack={() => setState('form')} />
    }
    if (method === 'lightning') {
      return <LightningPayment data={paymentData} onBack={() => setState('form')} />
    }
  }

  const formatCurrency = (value: string) => {
    const num = value.replace(/\D/g, '')
    const cents = parseInt(num || '0', 10)
    return (cents / 100).toFixed(2).replace('.', ',')
  }

  return (
    <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Doar para {displayName}
        </h1>
        <p className="text-zinc-400 text-sm">
          Minimo: R$ {(minAmountCents / 100).toFixed(2).replace('.', ',')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Valor */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Valor (R$)</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(formatCurrency(e.target.value))}
            placeholder="0,00"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-2xl text-center focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Nome */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Seu nome</label>
          <input
            type="text"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value.slice(0, 50))}
            placeholder="Como quer ser chamado?"
            maxLength={50}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Mensagem */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Mensagem
            <span className="float-right">{message.length}/400</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 400))}
            placeholder="Sua mensagem para o streamer..."
            maxLength={400}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none resize-none"
          />
        </div>

        {/* Metodo de pagamento */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">Forma de pagamento</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMethod('pix')}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                method === 'pix'
                  ? 'bg-green-600/20 border-green-500 text-green-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <QrCode className="w-6 h-6" />
              <span className="text-xs">PIX</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                method === 'card'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <CreditCard className="w-6 h-6" />
              <span className="text-xs">Cartao</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod('lightning')}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                method === 'lightning'
                  ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <Zap className="w-6 h-6" />
              <span className="text-xs">Lightning</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || state === 'processing'}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed py-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2"
        >
          {state === 'processing' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            `Doar R$ ${amount || '0,00'}`
          )}
        </button>
      </form>
    </div>
  )
}
