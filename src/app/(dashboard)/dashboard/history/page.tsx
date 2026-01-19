'use client'

import { useState, useEffect } from 'react'
import { Gift, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

interface Donation {
  id: string
  donorName: string
  message: string
  amountCents: number
  currency: string
  paymentProvider: string
  status: string
  createdAt: string
  paidAt: string | null
}

const ITEMS_PER_PAGE = 20

export default function HistoryPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    fetchDonations()
  }, [offset, statusFilter])

  const fetchDonations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(offset),
      })
      if (statusFilter) {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/private/donations?${params}`)
      const data = await res.json()

      setDonations(data.donations || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching donations:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (cents: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
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
      case 'CREATED': return 'Criado'
      case 'PENDING': return 'Pendente'
      case 'PAID': return 'Pago'
      case 'FAILED': return 'Falhou'
      case 'EXPIRED': return 'Expirado'
      case 'REFUNDED': return 'Estornado'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED': return 'text-zinc-400 bg-zinc-400/10'
      case 'PENDING': return 'text-yellow-400 bg-yellow-400/10'
      case 'PAID': return 'text-green-400 bg-green-400/10'
      case 'FAILED': return 'text-red-400 bg-red-400/10'
      case 'EXPIRED': return 'text-orange-400 bg-orange-400/10'
      case 'REFUNDED': return 'text-purple-400 bg-purple-400/10'
      default: return 'text-zinc-400 bg-zinc-400/10'
    }
  }

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'MERCADOPAGO': return 'Mercado Pago'
      case 'OPENPIX': return 'OpenPix'
      case 'COINSNAP': return 'Coinsnap (BTC)'
      default: return provider
    }
  }

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)
  const currentPage = Math.floor(offset / ITEMS_PER_PAGE) + 1

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(offset - ITEMS_PER_PAGE)
    }
  }

  const handleNextPage = () => {
    if (offset + ITEMS_PER_PAGE < total) {
      setOffset(offset + ITEMS_PER_PAGE)
    }
  }

  // Calculate totals
  const totalPaid = donations
    .filter(d => d.status === 'PAID')
    .reduce((sum, d) => sum + d.amountCents, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Historico de Doacoes</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Filtrar:</label>
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">Todos</option>
            <option value="PAID">Pagos</option>
            <option value="PENDING">Pendentes</option>
            <option value="EXPIRED">Expirados</option>
            <option value="FAILED">Falhos</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-5 h-5 text-green-400" />
            <span className="text-zinc-400 text-sm">Total Recebido (pagina)</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="text-zinc-400 text-sm mb-2">Doacoes nesta pagina</div>
          <p className="text-2xl font-bold">{donations.length}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="text-zinc-400 text-sm mb-2">Total de doacoes</div>
          <p className="text-2xl font-bold">{total}</p>
        </div>
      </div>

      {/* Donations List */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : donations.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma doacao encontrada</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-800">
              {donations.map(donation => (
                <div key={donation.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{donation.donorName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(donation.status)}`}>
                          {getStatusLabel(donation.status)}
                        </span>
                      </div>
                      {donation.message && (
                        <p className="text-zinc-400 text-sm mb-2 line-clamp-2">{donation.message}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span>{getProviderLabel(donation.paymentProvider)}</span>
                        <span>{formatDate(donation.paidAt || donation.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${donation.status === 'PAID' ? 'text-green-400' : 'text-zinc-400'}`}>
                        {formatCurrency(donation.amountCents, donation.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-800">
                <p className="text-sm text-zinc-400">
                  Mostrando {offset + 1}-{Math.min(offset + ITEMS_PER_PAGE, total)} de {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={offset === 0}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-zinc-400">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={offset + ITEMS_PER_PAGE >= total}
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
