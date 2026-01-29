'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gift,
  Award,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Download,
  MessageSquare,
  Star,
} from 'lucide-react'

interface Claim {
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
  claimedCount: number
  maxClaims: number | null
  isActive: boolean
  goalId: string
  goalTitle: string
  claims: Claim[]
}

interface RewardsResponse {
  rewards: Reward[]
  summary: {
    totalActive: number
    totalPendingClaims: number
    totalDeliveredClaims: number
  }
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<RewardsResponse>

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'mention':
      return { label: 'Mencao', icon: MessageSquare, color: 'bg-blue-500/20 text-blue-400' }
    case 'download':
      return { label: 'Download', icon: Download, color: 'bg-green-500/20 text-green-400' }
    default:
      return { label: 'Custom', icon: Star, color: 'bg-purple-500/20 text-purple-400' }
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-400' }
    case 'delivered':
      return { label: 'Entregue', color: 'bg-green-500/20 text-green-400' }
    default:
      return { label: status, color: 'bg-zinc-500/20 text-zinc-400' }
  }
}

export default function RewardsPage() {
  const { data, mutate } = useSWR('/api/private/rewards', fetcher)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null)
  const [togglingRewardId, setTogglingRewardId] = useState<string | null>(null)

  const rewards = data?.rewards || []
  const summary = data?.summary || { totalActive: 0, totalPendingClaims: 0, totalDeliveredClaims: 0 }

  const markAsDelivered = async (claimId: string) => {
    setUpdatingClaimId(claimId)
    try {
      await fetch('/api/private/rewards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, claimStatus: 'delivered' }),
      })
      await mutate()
    } catch { /* silent */ }
    setUpdatingClaimId(null)
  }

  const toggleRewardActive = async (rewardId: string, currentActive: boolean) => {
    setTogglingRewardId(rewardId)
    try {
      await fetch('/api/private/rewards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId, isActive: !currentActive }),
      })
      await mutate()
    } catch { /* silent */ }
    setTogglingRewardId(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Recompensas</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Gift className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Recompensas Ativas</p>
              <p className="text-2xl font-bold text-white">{summary.totalActive}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Claims Pendentes</p>
              <p className="text-2xl font-bold text-white">{summary.totalPendingClaims}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Claims Entregues</p>
              <p className="text-2xl font-bold text-white">{summary.totalDeliveredClaims}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rewards Table */}
      {!data ? (
        <div className="text-center py-12 text-zinc-500">Carregando...</div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-700 rounded-2xl">
          <Award className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-400">Nenhuma recompensa cadastrada</p>
          <p className="text-zinc-500 text-sm mt-1">
            Adicione recompensas nas suas metas para incentivar doacoes
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-zinc-800/50 text-sm font-medium text-zinc-400">
            <div className="col-span-3">Recompensa</div>
            <div className="col-span-2">Meta</div>
            <div className="col-span-2">Valor Minimo</div>
            <div className="col-span-1">Tipo</div>
            <div className="col-span-2">Claims</div>
            <div className="col-span-2">Acoes</div>
          </div>

          {/* Table Rows */}
          {rewards.map(reward => {
            const typeBadge = getTypeBadge(reward.type)
            const TypeIcon = typeBadge.icon
            const isExpanded = expandedId === reward.id
            const pendingClaims = reward.claims.filter(c => c.status === 'pending')

            return (
              <div key={reward.id} className="border-t border-zinc-800">
                {/* Main Row */}
                <div
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 items-center cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : reward.id)}
                >
                  <div className="col-span-3 flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-white font-medium text-sm">{reward.title}</p>
                      {reward.description && (
                        <p className="text-zinc-500 text-xs line-clamp-1">{reward.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-zinc-300">{reward.goalTitle}</div>
                  <div className="col-span-2 text-sm text-zinc-300">
                    {formatCents(reward.thresholdCents)}
                  </div>
                  <div className="col-span-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge.color}`}>
                      <TypeIcon className="w-3 h-3" />
                      {typeBadge.label}
                    </span>
                  </div>
                  <div className="col-span-2 text-sm">
                    <span className="text-zinc-300">
                      {reward.claimedCount}
                      {reward.maxClaims ? ` / ${reward.maxClaims}` : ''}
                    </span>
                    {pendingClaims.length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                        {pendingClaims.length} pendente{pendingClaims.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleRewardActive(reward.id, reward.isActive)}
                      disabled={togglingRewardId === reward.id}
                      className="flex items-center gap-1 text-xs transition-colors"
                      title={reward.isActive ? 'Desativar' : 'Ativar'}
                    >
                      {reward.isActive ? (
                        <ToggleRight className="w-6 h-6 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-zinc-500" />
                      )}
                      <span className={reward.isActive ? 'text-green-400' : 'text-zinc-500'}>
                        {reward.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Expanded Claims */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 ml-6">
                        {reward.claims.length === 0 ? (
                          <p className="text-sm text-zinc-500 py-2">Nenhum claim registrado</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                              Claims ({reward.claims.length})
                            </p>
                            {reward.claims.map(claim => {
                              const statusBadge = getStatusBadge(claim.status)
                              return (
                                <div
                                  key={claim.id}
                                  className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3"
                                >
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <p className="text-sm text-white font-medium">
                                        {claim.donorName}
                                      </p>
                                      {claim.donorEmail && (
                                        <p className="text-xs text-zinc-500">{claim.donorEmail}</p>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-500">
                                      {formatDate(claim.claimedAt)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                                      {statusBadge.label}
                                    </span>
                                    {claim.status === 'pending' && (
                                      <button
                                        onClick={() => markAsDelivered(claim.id)}
                                        disabled={updatingClaimId === claim.id}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white text-xs rounded-lg transition-colors"
                                      >
                                        {updatingClaimId === claim.id
                                          ? 'Salvando...'
                                          : 'Marcar como entregue'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
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
