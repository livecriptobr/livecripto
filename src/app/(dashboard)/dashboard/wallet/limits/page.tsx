'use client'

import { useState, useEffect } from 'react'
import { Loader2, Shield, Calendar, CalendarDays } from 'lucide-react'

interface LimitInfo {
  used: number
  limit: number
  remaining: number
}

interface LimitsData {
  daily: LimitInfo
  monthly: LimitInfo
  minWithdraw: number
  balance: number
}

export default function LimitsPage() {
  const [limits, setLimits] = useState<LimitsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wallet/limits')
      .then(res => res.json())
      .then((data: LimitsData) => setLimits(data))
      .catch(err => console.error('Error:', err))
      .finally(() => setLoading(false))
  }, [])

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!limits) {
    return <p className="text-zinc-500">Erro ao carregar limites</p>
  }

  const dailyPercent = limits.daily.limit > 0 ? Math.min(100, (limits.daily.used / limits.daily.limit) * 100) : 0
  const monthlyPercent = limits.monthly.limit > 0 ? Math.min(100, (limits.monthly.used / limits.monthly.limit) * 100) : 0

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Limites de Saque</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Limit */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Limite Diario</h2>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Utilizado: {formatCurrency(limits.daily.used)}</span>
              <span className="text-zinc-400">Limite: {formatCurrency(limits.daily.limit)}</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all"
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
            <p className="text-sm text-zinc-500 mt-2">
              Disponivel: {formatCurrency(limits.daily.remaining)}
            </p>
          </div>
        </div>

        {/* Monthly Limit */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Limite Mensal</h2>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Utilizado: {formatCurrency(limits.monthly.used)}</span>
              <span className="text-zinc-400">Limite: {formatCurrency(limits.monthly.limit)}</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div
                className="bg-purple-500 h-3 rounded-full transition-all"
                style={{ width: `${monthlyPercent}%` }}
              />
            </div>
            <p className="text-sm text-zinc-500 mt-2">
              Disponivel: {formatCurrency(limits.monthly.remaining)}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold">Informacoes</h2>
        </div>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li>Saque minimo: {formatCurrency(limits.minWithdraw)}</li>
          <li>Limite diario: {formatCurrency(limits.daily.limit)}</li>
          <li>Limite mensal: {formatCurrency(limits.monthly.limit)}</li>
          <li>Limites sao reiniciados a meia-noite (diario) e no primeiro dia do mes (mensal)</li>
        </ul>
      </div>
    </div>
  )
}
