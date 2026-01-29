'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, ChevronLeft, ChevronRight, Download, DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react'

interface Transaction {
  id: string
  type: string
  status: string
  amountCents: number
  feeCents: number
  netCents: number
  balanceCents: number
  description: string | null
  paymentMethod: string | null
  createdAt: string
}

interface Summary {
  totalReceived: number
  totalFees: number
  totalWithdrawn: number
  currentBalance: number
}

interface HistoryResponse {
  transactions: Transaction[]
  total: number
  page: number
  limit: number
  totalPages: number
  summary: Summary
}

const ITEMS_PER_PAGE = 20

export default function HistoryPage() {
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
      })
      if (typeFilter) params.set('type', typeFilter)
      if (methodFilter) params.set('method', methodFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)

      const res = await fetch(`/api/wallet/history?${params}`)
      const json = await res.json() as HistoryResponse
      setData(json)
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, methodFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'donation_received':
        return { label: 'Doacao', color: 'text-green-400 bg-green-400/10' }
      case 'withdrawal':
        return { label: 'Saque', color: 'text-orange-400 bg-orange-400/10' }
      case 'fee':
        return { label: 'Taxa', color: 'text-red-400 bg-red-400/10' }
      case 'refund':
        return { label: 'Estorno', color: 'text-purple-400 bg-purple-400/10' }
      default:
        return { label: type, color: 'text-zinc-400 bg-zinc-400/10' }
    }
  }

  const handleExportCSV = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    window.open(`/api/wallet/export?${params}`, '_blank')
  }

  const summary = data?.summary

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Extrato</h1>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-zinc-400 text-sm">Total Recebido</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(summary?.totalReceived ?? 0)}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-red-400" />
            <span className="text-zinc-400 text-sm">Total Taxas</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(summary?.totalFees ?? 0)}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-5 h-5 text-orange-400" />
            <span className="text-zinc-400 text-sm">Total Sacado</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{formatCurrency(summary?.totalWithdrawn ?? 0)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/20 rounded-xl p-6 border border-purple-500/20">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            <span className="text-zinc-400 text-sm">Saldo Atual</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(summary?.currentBalance ?? 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Tipo</label>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Todos</option>
              <option value="donation_received">Doacoes</option>
              <option value="withdrawal">Saques</option>
              <option value="fee">Taxas</option>
              <option value="refund">Estornos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Metodo</label>
            <select
              value={methodFilter}
              onChange={e => { setMethodFilter(e.target.value); setPage(1) }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Todos</option>
              <option value="pix">PIX</option>
              <option value="card">Cartao</option>
              <option value="crypto">Crypto</option>
              <option value="lightning">Lightning</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Ate</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : !data || data.transactions.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma transacao encontrada</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                  <th className="p-4">Data</th>
                  <th className="p-4">ID</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Descricao</th>
                  <th className="p-4">Metodo</th>
                  <th className="p-4 text-right">Bruto</th>
                  <th className="p-4 text-right">Taxa</th>
                  <th className="p-4 text-right">Liquido</th>
                  <th className="p-4 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map(tx => {
                  const badge = getTypeBadge(tx.type)
                  return (
                    <tr key={tx.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="p-4 text-zinc-300 whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                      <td className="p-4 text-zinc-500 font-mono text-xs">{tx.id.slice(0, 8)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-300 max-w-[200px] truncate">{tx.description || '-'}</td>
                      <td className="p-4 text-zinc-400 uppercase text-xs">{tx.paymentMethod || '-'}</td>
                      <td className="p-4 text-right text-zinc-300">{formatCurrency(tx.amountCents)}</td>
                      <td className="p-4 text-right text-red-400">{tx.feeCents > 0 ? `-${formatCurrency(tx.feeCents)}` : '-'}</td>
                      <td className="p-4 text-right text-white font-medium">{formatCurrency(tx.netCents)}</td>
                      <td className="p-4 text-right text-zinc-300">{formatCurrency(tx.balanceCents)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-800">
                <p className="text-sm text-zinc-400">
                  Pagina {data.page} de {data.totalPages} ({data.total} transacoes)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= (data?.totalPages ?? 1)}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
