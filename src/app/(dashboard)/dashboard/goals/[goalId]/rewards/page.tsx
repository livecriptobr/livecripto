'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Gift, X, Check, Loader2, Download, MessageSquare, Star } from 'lucide-react'

interface RewardClaim {
  id: string
  donorName: string
  donorEmail: string | null
  status: string
  claimedAt: string
}

interface Reward {
  id: string
  title: string
  description: string | null
  thresholdCents: number
  type: string
  downloadUrl: string | null
  claimedCount: number
  maxClaims: number | null
  isActive: boolean
  sortOrder: number
  _count: { claims: number }
}

interface GoalData {
  id: string
  title: string
  targetCents: number
  currentCents: number
}

interface RewardsResponse {
  rewards: Reward[]
}

interface GoalResponse {
  goal: GoalData
}

interface ClaimsResponse {
  claims: RewardClaim[]
}

const fetcher = <T,>(url: string) => fetch(url).then(r => r.json()) as Promise<T>

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const REWARD_TYPES = [
  { value: 'mention', label: 'Mencao', icon: MessageSquare },
  { value: 'digital_download', label: 'Download', icon: Download },
  { value: 'custom', label: 'Personalizado', icon: Star },
]

export default function RewardsPage() {
  const params = useParams<{ goalId: string }>()
  const goalId = params.goalId

  const { data: goalData } = useSWR(`/api/goals/${goalId}`, (url: string) => fetcher<GoalResponse>(url))
  const { data: rewardsData, mutate } = useSWR(`/api/goals/${goalId}/rewards`, (url: string) => fetcher<RewardsResponse>(url))

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewClaimsRewardId, setViewClaimsRewardId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    thresholdAmount: '',
    type: 'mention',
    maxClaims: '',
    downloadUrl: '',
  })

  const rewards = rewardsData?.rewards || []
  const goal = goalData?.goal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const thresholdCents = Math.round(parseFloat(form.thresholdAmount.replace(',', '.') || '0') * 100)

    await fetch(`/api/goals/${goalId}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || undefined,
        thresholdCents,
        type: form.type,
        maxClaims: form.maxClaims ? parseInt(form.maxClaims) : undefined,
        downloadUrl: form.downloadUrl || undefined,
      }),
    })

    await mutate()
    setShowForm(false)
    setForm({ title: '', description: '', thresholdAmount: '', type: 'mention', maxClaims: '', downloadUrl: '' })
    setSaving(false)
  }

  const toggleReward = async (rewardId: string, isActive: boolean) => {
    await fetch(`/api/goals/${goalId}/rewards/${rewardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    await mutate()
  }

  const deleteReward = async (rewardId: string) => {
    if (!confirm('Excluir recompensa?')) return
    await fetch(`/api/goals/${goalId}/rewards/${rewardId}`, { method: 'DELETE' })
    await mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/goals" className="text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Recompensas</h1>
          {goal && (
            <p className="text-sm text-zinc-400">{goal.title} - {formatCents(goal.targetCents)}</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {/* Add Reward Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Nova Recompensa</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Titulo</label>
                <input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Valor minimo da doacao (R$)</label>
                <input
                  type="text"
                  value={form.thresholdAmount}
                  onChange={e => setForm(prev => ({ ...prev, thresholdAmount: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                  placeholder="10,00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Tipo</label>
                <div className="flex gap-2">
                  {REWARD_TYPES.map(rt => (
                    <button
                      key={rt.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, type: rt.value }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        form.type === rt.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <rt.icon className="w-4 h-4" /> {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.type === 'digital_download' && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">URL do download</label>
                  <input
                    value={form.downloadUrl}
                    onChange={e => setForm(prev => ({ ...prev, downloadUrl: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Descricao (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Max claims (vazio = ilimitado)</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxClaims}
                  onChange={e => setForm(prev => ({ ...prev, maxClaims: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rewards List */}
      {rewards.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-700 rounded-2xl">
          <Gift className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-400">Nenhuma recompensa</p>
          <p className="text-zinc-500 text-sm mt-1">Adicione recompensas para incentivar doadores</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map(reward => {
            const TypeIcon = REWARD_TYPES.find(t => t.value === reward.type)?.icon || Gift
            return (
              <div key={reward.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${reward.isActive ? 'bg-purple-600/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`font-medium ${reward.isActive ? 'text-white' : 'text-zinc-500'}`}>
                        {reward.title}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        A partir de {formatCents(reward.thresholdCents)}
                        {reward.maxClaims && ` - ${reward._count.claims}/${reward.maxClaims} claims`}
                      </p>
                      {reward.description && (
                        <p className="text-xs text-zinc-500 mt-1">{reward.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setViewClaimsRewardId(viewClaimsRewardId === reward.id ? null : reward.id)}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors"
                    >
                      Claims ({reward._count.claims})
                    </button>
                    <button
                      onClick={() => toggleReward(reward.id, reward.isActive)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        reward.isActive
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-yellow-400'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-green-400'
                      }`}
                    >
                      {reward.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => deleteReward(reward.id)}
                      className="px-2 py-1 bg-zinc-800 hover:bg-red-900/50 rounded text-xs text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Claims */}
                <AnimatePresence>
                  {viewClaimsRewardId === reward.id && (
                    <ClaimsPanel goalId={goalId} rewardId={reward.id} />
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ClaimsPanel({ goalId, rewardId }: { goalId: string; rewardId: string }) {
  const { data, mutate } = useSWR(
    `/api/goals/${goalId}/rewards/${rewardId}/claims`,
    (url: string) => fetcher<ClaimsResponse>(url)
  )
  const [updating, setUpdating] = useState<string | null>(null)

  const claims = data?.claims || []

  const markDelivered = async (claimId: string) => {
    setUpdating(claimId)
    await fetch(`/api/goals/${goalId}/rewards/${rewardId}/claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    })
    await mutate()
    setUpdating(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-3 pt-3 border-t border-zinc-800">
        {claims.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum claim ainda</p>
        ) : (
          <div className="space-y-2">
            {claims.map(claim => (
              <div key={claim.id} className="flex items-center justify-between text-sm bg-zinc-800/50 rounded-lg px-3 py-2">
                <div>
                  <span className="text-zinc-300">{claim.donorName}</span>
                  {claim.donorEmail && <span className="text-zinc-500 ml-2">{claim.donorEmail}</span>}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    claim.status === 'delivered' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {claim.status === 'delivered' ? 'Entregue' : 'Pendente'}
                  </span>
                </div>
                {claim.status !== 'delivered' && (
                  <button
                    onClick={() => markDelivered(claim.id)}
                    disabled={updating === claim.id}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white transition-colors"
                  >
                    {updating === claim.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Marcar como entregue
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
