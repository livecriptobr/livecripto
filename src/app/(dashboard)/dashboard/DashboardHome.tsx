'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { DollarSign, TrendingUp, Calendar, Clock, Copy, Check } from 'lucide-react'

interface DashboardHomeProps {
  username: string
  overlayToken: string
  appUrl: string
}

interface DashboardStats {
  totalReceived: number
  balance: number
  todayTotal: number
  todayCount: number
  monthTotal: number
  monthCount: number
  recentDonations: {
    id: string
    donorName: string
    message: string
    amountCents: number
    createdAt: string
  }[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DashboardHome({ username, overlayToken, appUrl }: DashboardHomeProps) {
  const { data, isLoading } = useSWR<DashboardStats>('/api/private/dashboard-stats', fetcher, {
    refreshInterval: 30000,
  })

  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  const stats = [
    { label: 'Total Recebido', value: data ? formatBRL(data.totalReceived) : '...', icon: <DollarSign size={20} />, color: 'text-green-400' },
    { label: 'Saldo Disponível', value: data ? formatBRL(data.balance) : '...', icon: <TrendingUp size={20} />, color: 'text-purple-400' },
    { label: 'Hoje', value: data ? `${formatBRL(data.todayTotal)} (${data.todayCount})` : '...', icon: <Clock size={20} />, color: 'text-blue-400' },
    { label: 'Este Mês', value: data ? `${formatBRL(data.monthTotal)} (${data.monthCount})` : '...', icon: <Calendar size={20} />, color: 'text-orange-400' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <p className="text-xl font-bold">{isLoading ? '...' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-300 mb-3">Seu link de doação</h2>
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
            <code className="text-purple-400 text-sm break-all flex-1 select-all">
              {appUrl}/{username}
            </code>
            <button
              onClick={() => copyToClipboard(`${appUrl}/${username}`, 'donate')}
              className="flex-shrink-0 p-2 hover:bg-zinc-700 rounded-lg transition-colors"
              title="Copiar link"
            >
              {copiedField === 'donate' ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-zinc-400" />}
            </button>
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-300 mb-3">URL do Overlay (OBS)</h2>
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
            <code className="text-green-400 text-sm break-all flex-1 select-all">
              {appUrl}/overlay/{username}?token={overlayToken}
            </code>
            <button
              onClick={() => copyToClipboard(`${appUrl}/overlay/${username}?token=${overlayToken}`, 'overlay')}
              className="flex-shrink-0 p-2 hover:bg-zinc-700 rounded-lg transition-colors"
              title="Copiar URL"
            >
              {copiedField === 'overlay' ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-zinc-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* Recent donations */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">Doações recentes</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {isLoading ? (
            <p className="px-6 py-4 text-sm text-zinc-500">Carregando...</p>
          ) : !data?.recentDonations?.length ? (
            <p className="px-6 py-4 text-sm text-zinc-500">Nenhuma doação ainda.</p>
          ) : (
            data.recentDonations.map(d => (
              <div key={d.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{d.donorName}</p>
                  <p className="text-xs text-zinc-500 truncate max-w-xs">{d.message}</p>
                </div>
                <span className="text-sm font-semibold text-green-400">{formatBRL(d.amountCents)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
