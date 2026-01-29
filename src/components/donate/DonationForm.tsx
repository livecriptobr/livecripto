'use client'

import { useState } from 'react'
import { Zap, CreditCard, QrCode, Loader2 } from 'lucide-react'
import PixPayment from './PixPayment'
import LightningPayment from './LightningPayment'
import VoiceRecorder from '@/components/donation/VoiceRecorder'
import GifSelector from '@/components/donation/GifSelector'

interface PollOptionData {
  id: string
  text: string
  color: string
}

interface ActivePollData {
  id: string
  title: string
  voteType: 'UNIQUE' | 'WEIGHTED'
  options: PollOptionData[]
}

interface IncentiveSettingsData {
  voiceMessagesEnabled: boolean
  voiceMessageMaxSecs: number
  mediaEnabled: boolean
  mediaGifsOnly: boolean
  minAmountForVoice: number
  minAmountForMedia: number
}

interface GifItem {
  id: string
  url: string
  previewUrl: string
  width: number
  height: number
}

interface GoalRewardData {
  id: string
  title: string
  description: string | null
  thresholdCents: number
  type: string
}

interface GoalData {
  id: string
  title: string
  description: string | null
  targetCents: number
  currentCents: number
  type: string
  charityName: string | null
  charityPercent: number | null
  deadline: string | null
  imageUrl: string | null
  rewards: GoalRewardData[]
  contributionCount: number
}

interface Props {
  username: string
  displayName: string
  minAmountCents: number
  primaryColor?: string
  activePoll?: ActivePollData | null
  incentiveSettings?: IncentiveSettingsData | null
  goals?: GoalData[]
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

export default function DonationForm({ username, displayName, minAmountCents, primaryColor, activePoll, incentiveSettings, goals }: Props) {
  const [amount, setAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [message, setMessage] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [state, setState] = useState<FormState>('form')
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [error, setError] = useState('')
  const [selectedPollOption, setSelectedPollOption] = useState<string | null>(null)
  const [voiceMessageUrl, setVoiceMessageUrl] = useState<string | null>(null)
  const [selectedGif, setSelectedGif] = useState<GifItem | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

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
          voiceMessageUrl,
          mediaUrl: selectedGif?.url || null,
          mediaType: selectedGif ? 'gif' : null,
          goalId: selectedGoalId || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar doacao')
      }

      setPaymentData(data)

      // Vote on poll if option selected
      if (selectedPollOption && activePoll && data.donationId) {
        try {
          await fetch(`/api/polls/${activePoll.id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              optionId: selectedPollOption,
              voterName: donorName.trim(),
              donationId: activePoll.voteType === 'WEIGHTED' ? data.donationId : undefined,
            }),
          })
        } catch {
          // vote failure should not block donation flow
        }
      }

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

        {/* Voice Recorder */}
        {incentiveSettings?.voiceMessagesEnabled && amountCents >= incentiveSettings.minAmountForVoice && (
          <VoiceRecorder
            maxDuration={incentiveSettings.voiceMessageMaxSecs}
            onRecorded={(url) => setVoiceMessageUrl(url)}
            onRemove={() => setVoiceMessageUrl(null)}
            existingUrl={voiceMessageUrl}
          />
        )}

        {/* GIF Selector */}
        {incentiveSettings?.mediaEnabled && amountCents >= incentiveSettings.minAmountForMedia && (
          <GifSelector
            onSelect={(gif) => setSelectedGif(gif)}
            onRemove={() => setSelectedGif(null)}
            selectedGif={selectedGif}
          />
        )}

        {/* Goals */}
        {goals && goals.length > 0 && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Contribuir para uma meta</label>
            <div className="space-y-2">
              {goals.map(goal => {
                const progress = goal.targetCents > 0 ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100)) : 0
                const qualifyingRewards = goal.rewards.filter(r => r.thresholdCents <= amountCents)
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedGoalId === goal.id
                        ? 'border-purple-500 bg-purple-600/10'
                        : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{goal.title}</span>
                      {goal.type === 'charity' && (
                        <span className="text-xs text-pink-400">{goal.charityName}</span>
                      )}
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>{progress}% - R$ {(goal.currentCents / 100).toFixed(2)}</span>
                      <span>Meta: R$ {(goal.targetCents / 100).toFixed(2)}</span>
                    </div>
                    {selectedGoalId === goal.id && qualifyingRewards.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-700 space-y-1">
                        <p className="text-xs text-purple-400 font-medium">Recompensas desbloqueadas:</p>
                        {qualifyingRewards.map(r => (
                          <p key={r.id} className="text-xs text-zinc-300 flex items-center gap-1">
                            <span className="text-green-400">&#10003;</span> {r.title}
                          </p>
                        ))}
                      </div>
                    )}
                    {selectedGoalId === goal.id && (
                      <span className="text-xs text-purple-400 mt-1 block">Selecionado</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Enquete ativa */}
        {activePoll && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">{activePoll.title}</label>
            <div className="space-y-2">
              {activePoll.options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedPollOption(selectedPollOption === opt.id ? null : opt.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedPollOption === opt.id
                      ? 'border-purple-500 bg-purple-600/10'
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span className="text-sm text-white">{opt.text}</span>
                  {selectedPollOption === opt.id && (
                    <span className="ml-auto text-purple-400 text-xs">Selecionado</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

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
          className="w-full disabled:bg-zinc-700 disabled:cursor-not-allowed py-4 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2"
          style={{
            backgroundColor: primaryColor || '#8B5CF6',
            ...(primaryColor ? {} : {}),
          }}
          onMouseEnter={e => { if (primaryColor) (e.currentTarget.style.opacity = '0.9') }}
          onMouseLeave={e => { if (primaryColor) (e.currentTarget.style.opacity = '1') }}
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
