'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, ArrowUpRight, Loader2, Plus } from 'lucide-react'

interface WithdrawRequest {
  id: string
  method: string
  amountCents: number
  destinationSnapshot: string
  status: string
  createdAt: string
}

interface BankAccount {
  id: string
  pixKeyType: string
  pixKey: string
  label: string | null
  isDefault: boolean
}

interface LimitsData {
  daily: { used: number; limit: number; remaining: number }
  monthly: { used: number; limit: number; remaining: number }
  minWithdraw: number
  balance: number
}

export default function PayoutsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [limits, setLimits] = useState<LimitsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Add bank account form
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newPixKeyType, setNewPixKeyType] = useState('cpf')
  const [newPixKey, setNewPixKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [wRes, aRes, lRes] = await Promise.all([
        fetch('/api/withdrawals'),
        fetch('/api/bank-accounts'),
        fetch('/api/wallet/limits'),
      ])
      const wData = await wRes.json()
      const aData = await aRes.json()
      const lData = await lRes.json()

      setWithdrawals(wData.withdrawals || [])
      setBankAccounts(aData.accounts || [])
      setLimits(lData)

      if (aData.accounts?.length > 0 && !selectedAccount) {
        const defaultAcc = aData.accounts.find((a: BankAccount) => a.isDefault)
        setSelectedAccount(defaultAcc?.id || aData.accounts[0].id)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedAccount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setMessage(null)

    try {
      const amountCents = Math.round(parseFloat(withdrawAmount.replace(',', '.')) * 100)
      if (isNaN(amountCents) || amountCents <= 0) {
        throw new Error('Valor invalido')
      }

      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, bankAccountId: selectedAccount || undefined }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: 'Saque solicitado com sucesso!' })
      setWithdrawAmount('')
      fetchData()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setWithdrawing(false)
    }
  }

  const handleAddAccount = async () => {
    setAddingAccount(true)
    setMessage(null)

    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixKeyType: newPixKeyType, pixKey: newPixKey, label: newLabel || undefined }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: 'Chave PIX adicionada!' })
      setShowAddAccount(false)
      setNewPixKey('')
      setNewLabel('')
      fetchData()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setAddingAccount(false)
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
        <p className="text-4xl font-bold text-white">{formatCurrency(limits?.balance ?? 0)}</p>
      </div>

      {/* Withdraw Form */}
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
            <p className="text-xs text-zinc-500 mt-1">
              Minimo: {formatCurrency(limits?.minWithdraw ?? 1000)}
            </p>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Conta PIX</label>
            {bankAccounts.length > 0 ? (
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
              >
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label || acc.pixKeyType.toUpperCase()}: {acc.pixKey}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-zinc-500 text-sm py-2">Nenhuma chave PIX cadastrada. Adicione abaixo.</p>
            )}
          </div>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={withdrawing || !withdrawAmount || bankAccounts.length === 0}
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

      {/* Bank Accounts */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chaves PIX</h2>
          <button
            onClick={() => setShowAddAccount(!showAddAccount)}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {showAddAccount && (
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Tipo</label>
                <select
                  value={newPixKeyType}
                  onChange={e => setNewPixKeyType(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">Email</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatoria</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Chave PIX</label>
                <input
                  type="text"
                  value={newPixKey}
                  onChange={e => setNewPixKey(e.target.value)}
                  placeholder="Sua chave PIX"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Apelido (opcional)</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="Ex: Banco Inter"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <button
              onClick={handleAddAccount}
              disabled={addingAccount || !newPixKey}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              {addingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Salvar Chave
            </button>
          </div>
        )}

        {bankAccounts.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhuma chave PIX cadastrada</p>
        ) : (
          <div className="space-y-2">
            {bankAccounts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-white">
                    {acc.label || acc.pixKeyType.toUpperCase()}
                    {acc.isDefault && (
                      <span className="ml-2 text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">Padrao</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400">{acc.pixKeyType.toUpperCase()}: {acc.pixKey}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal History */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4">Historico de Saques</h2>

        {withdrawals.length === 0 ? (
          <p className="text-zinc-500">Nenhum saque solicitado</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map(w => (
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
