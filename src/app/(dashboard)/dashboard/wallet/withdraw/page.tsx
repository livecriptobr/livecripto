'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Wallet, ArrowUpRight, Plus, Trash2, QrCode, CreditCard, Zap } from 'lucide-react'

interface BankAccount {
  id: string
  pixKeyType: string
  pixKey: string
  label: string | null
  isDefault: boolean
}

interface MethodBalances {
  pix: number
  card: number
  lightning: number
  total: number
}

interface LimitsData {
  daily: { used: number; limit: number; remaining: number }
  monthly: { used: number; limit: number; remaining: number }
  minWithdraw: number
  balance: number
  balances: MethodBalances
}

type WithdrawTab = 'PIX' | 'CARD' | 'LIGHTNING'

export default function WithdrawPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [limits, setLimits] = useState<LimitsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<WithdrawTab>('PIX')

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [lightningAddress, setLightningAddress] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  // Add PIX account form
  const [showAdd, setShowAdd] = useState(false)
  const [newPixKeyType, setNewPixKeyType] = useState('cpf')
  const [newPixKey, setNewPixKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [aRes, lRes] = await Promise.all([
        fetch('/api/bank-accounts'),
        fetch('/api/wallet/limits'),
      ])
      const aData = await aRes.json()
      const lData = await lRes.json()

      setBankAccounts(aData.accounts || [])
      setLimits(lData)

      if (aData.accounts?.length > 0 && !selectedAccount) {
        const defaultAcc = aData.accounts.find((a: BankAccount) => a.isDefault)
        setSelectedAccount(defaultAcc?.id || aData.accounts[0].id)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedAccount])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  const getActiveBalance = () => {
    if (!limits?.balances) return 0
    switch (activeTab) {
      case 'PIX': return limits.balances.pix
      case 'CARD': return limits.balances.card
      case 'LIGHTNING': return limits.balances.lightning
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setMessage(null)

    try {
      const amountCents = Math.round(parseFloat(withdrawAmount.replace(',', '.')) * 100)
      if (isNaN(amountCents) || amountCents <= 0) throw new Error('Valor invalido')

      const body: Record<string, unknown> = { amountCents, method: activeTab }

      if (activeTab === 'PIX') {
        body.bankAccountId = selectedAccount || undefined
      } else if (activeTab === 'LIGHTNING') {
        if (!lightningAddress.trim()) throw new Error('Informe um endereco Lightning')
        body.lightningAddress = lightningAddress.trim()
      }

      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: 'Saque solicitado com sucesso!' })
      setWithdrawAmount('')
      fetchData()
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro' })
    } finally {
      setWithdrawing(false)
    }
  }

  const handleAddAccount = async () => {
    setAdding(true)
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
      setShowAdd(false)
      setNewPixKey('')
      setNewLabel('')
      fetchData()
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro' })
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    try {
      const res = await fetch(`/api/bank-accounts?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      fetchData()
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao remover' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  const balances = limits?.balances ?? { pix: 0, card: 0, lightning: 0, total: 0 }

  const tabs: { key: WithdrawTab; label: string; icon: React.ReactNode; color: string; balance: number }[] = [
    { key: 'PIX', label: 'PIX', icon: <QrCode className="w-5 h-5" />, color: 'green', balance: balances.pix },
    { key: 'CARD', label: 'Cartao', icon: <CreditCard className="w-5 h-5" />, color: 'blue', balance: balances.card },
    { key: 'LIGHTNING', label: 'Lightning', icon: <Zap className="w-5 h-5" />, color: 'yellow', balance: balances.lightning },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Sacar</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setMessage(null); setWithdrawAmount('') }}
            className={`rounded-xl p-5 border text-left transition-all ${
              activeTab === tab.key
                ? `bg-${tab.color}-600/10 border-${tab.color}-500/40 ring-1 ring-${tab.color}-500/20`
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={activeTab === tab.key ? `text-${tab.color}-400` : 'text-zinc-500'}>
                {tab.icon}
              </span>
              <span className="text-sm text-zinc-400">{tab.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(tab.balance)}</p>
          </button>
        ))}
      </div>

      {/* Total + Limits */}
      <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-xl p-5 border border-purple-500/20">
        <div className="flex items-center gap-3 mb-1">
          <Wallet className="w-5 h-5 text-purple-400" />
          <span className="text-zinc-400 text-sm">Saldo total</span>
        </div>
        <p className="text-3xl font-bold text-white">{formatCurrency(balances.total)}</p>
        {limits && (
          <div className="flex gap-6 mt-2 text-sm text-zinc-400">
            <span>Diario restante: {formatCurrency(limits.daily.remaining)}</span>
            <span>Mensal restante: {formatCurrency(limits.monthly.remaining)}</span>
          </div>
        )}
      </div>

      {/* Withdraw Form */}
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Solicitar Saque — {tabs.find(t => t.key === activeTab)?.label}
        </h2>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Valor (R$)</label>
          <input
            type="text"
            value={withdrawAmount}
            onChange={e => setWithdrawAmount(e.target.value)}
            placeholder="10,00"
            className="w-full max-w-xs bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Disponivel: {formatCurrency(getActiveBalance())} | Minimo: {formatCurrency(limits?.minWithdraw ?? 1000)}
          </p>
        </div>

        {/* PIX: account selector */}
        {activeTab === 'PIX' && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Chave PIX de destino</label>
            {bankAccounts.length > 0 ? (
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
              >
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label || acc.pixKeyType.toUpperCase()}: {acc.pixKey}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-zinc-500 text-sm py-2">Adicione uma chave PIX abaixo para sacar.</p>
            )}
          </div>
        )}

        {/* LIGHTNING: address input */}
        {activeTab === 'LIGHTNING' && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Endereco Lightning</label>
            <input
              type="text"
              value={lightningAddress}
              onChange={e => setLightningAddress(e.target.value)}
              placeholder="usuario@walletofsatoshi.com"
              className="w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500"
            />
            <p className="text-xs text-zinc-500 mt-1">Lightning Address ou LNURL</p>
          </div>
        )}

        {/* CARD: info */}
        {activeTab === 'CARD' && (
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm text-blue-300">
              O saque de cartao sera processado via MercadoPago. O valor sera transferido para sua conta MercadoPago.
            </p>
          </div>
        )}

        <button
          onClick={handleWithdraw}
          disabled={
            withdrawing ||
            !withdrawAmount ||
            (activeTab === 'PIX' && bankAccounts.length === 0) ||
            (activeTab === 'LIGHTNING' && !lightningAddress.trim())
          }
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors font-medium"
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

      {/* PIX Bank Accounts Management — only show on PIX tab */}
      {activeTab === 'PIX' && (
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Minhas Chaves PIX</h2>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Chave
            </button>
          </div>

          {showAdd && (
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
                    placeholder="Ex: Nubank"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <button
                onClick={handleAddAccount}
                disabled={adding || !newPixKey}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          )}

          {bankAccounts.length === 0 ? (
            <p className="text-zinc-500 text-sm">Nenhuma chave PIX cadastrada. Clique em &quot;Adicionar Chave&quot; para comecar.</p>
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
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Remover chave"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
