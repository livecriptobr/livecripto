'use client'

import { useState, useEffect } from 'react'
import { Wallet, ArrowUpRight, Save, Loader2 } from 'lucide-react'

interface WithdrawRequest {
  id: string
  method: string
  amountCents: number
  destinationSnapshot: string
  status: string
  createdAt: string
}

export default function PayoutsPage() {
  const [balance, setBalance] = useState(0)
  const [pixKey, setPixKey] = useState('')
  const [lightningAddress, setLightningAddress] = useState('')
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState<'PIX' | 'LIGHTNING'>('PIX')
  const [saving, setSaving] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [balanceRes, settingsRes, withdrawsRes] = await Promise.all([
        fetch('/api/private/balance'),
        fetch('/api/private/payout-settings'),
        fetch('/api/private/withdraws'),
      ])

      const balanceData = await balanceRes.json()
      const settingsData = await settingsRes.json()
      const withdrawsData = await withdrawsRes.json()

      setBalance(balanceData.balanceCents || 0)
      setPixKey(settingsData.pixKey || '')
      setLightningAddress(settingsData.lightningAddress || '')
      setWithdraws(withdrawsData.withdraws || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/private/payout-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixKey, lightningAddress }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setMessage({ type: 'success', text: 'Configuracoes salvas!' })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setMessage(null)

    try {
      const amountCents = Math.round(parseFloat(withdrawAmount.replace(',', '.')) * 100)

      if (isNaN(amountCents) || amountCents <= 0) {
        throw new Error('Valor invalido')
      }

      const res = await fetch('/api/private/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: withdrawMethod, amountCents }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: 'Saque solicitado!' })
      setWithdrawAmount('')
      fetchData()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setWithdrawing(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'Solicitado'
      case 'PROCESSING': return 'Processando'
      case 'PAID': return 'Pago'
      case 'REJECTED': return 'Rejeitado'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'text-yellow-400 bg-yellow-400/10'
      case 'PROCESSING': return 'text-blue-400 bg-blue-400/10'
      case 'PAID': return 'text-green-400 bg-green-400/10'
      case 'REJECTED': return 'text-red-400 bg-red-400/10'
      default: return 'text-zinc-400 bg-zinc-400/10'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Saques</h1>

      {/* Balance */}
      <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-xl p-6 border border-purple-500/20">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="w-6 h-6 text-purple-400" />
          <span className="text-zinc-400">Saldo disponivel</span>
        </div>
        <p className="text-4xl font-bold text-white">{formatCurrency(balance)}</p>
      </div>

      {/* Payout Settings */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-xl font-semibold">Configuracoes de Saque</h2>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Chave PIX</label>
          <input
            type="text"
            value={pixKey}
            onChange={e => setPixKey(e.target.value)}
            placeholder="CPF, email, telefone ou chave aleatoria"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Lightning Address</label>
          <input
            type="text"
            value={lightningAddress}
            onChange={e => setLightningAddress(e.target.value)}
            placeholder="usuario@wallet.com"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>

      {/* Request Withdraw */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-xl font-semibold">Solicitar Saque</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Valor (R$)</label>
            <input
              type="text"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="10,00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-zinc-500 mt-1">Minimo: R$ 10,00</p>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Metodo</label>
            <select
              value={withdrawMethod}
              onChange={e => setWithdrawMethod(e.target.value as 'PIX' | 'LIGHTNING')}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
            >
              <option value="PIX">PIX</option>
              <option value="LIGHTNING">Lightning</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={withdrawing || !withdrawAmount}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
          Solicitar Saque
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Withdraw History */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4">Historico de Saques</h2>

        {withdraws.length === 0 ? (
          <p className="text-zinc-500">Nenhum saque solicitado</p>
        ) : (
          <div className="space-y-3">
            {withdraws.map(w => (
              <div key={w.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div>
                  <p className="font-medium">{formatCurrency(w.amountCents)}</p>
                  <p className="text-sm text-zinc-400">{w.method} - {formatDate(w.createdAt)}</p>
                  <p className="text-xs text-zinc-500 truncate max-w-xs">{w.destinationSnapshot}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(w.status)}`}>
                  {getStatusLabel(w.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
